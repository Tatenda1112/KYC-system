from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func as sqlfunc
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import GoldTransaction, MinerRegistration

router = APIRouter(prefix="/compliance", tags=["compliance"])


@router.get("/overview")
def compliance_overview(db: Session = Depends(get_db)):
    """System-wide compliance summary for the admin dashboard."""
    total_miners = db.query(sqlfunc.count(MinerRegistration.id)).scalar() or 0
    avg_score = db.query(sqlfunc.avg(MinerRegistration.score)).scalar() or 0.0

    # KYC status distribution
    kyc_rows = (
        db.query(MinerRegistration.kyc_status, sqlfunc.count())
        .group_by(MinerRegistration.kyc_status)
        .all()
    )
    kyc_distribution: dict[str, int] = {row[0]: int(row[1]) for row in kyc_rows}

    # Risk distribution
    risk_rows = (
        db.query(MinerRegistration.risk, sqlfunc.count())
        .group_by(MinerRegistration.risk)
        .all()
    )
    risk_distribution: dict[str, int] = {row[0]: int(row[1]) for row in risk_rows}

    total_txns = db.query(sqlfunc.count(GoldTransaction.id)).scalar() or 0
    flagged_txns = (
        db.query(sqlfunc.count(GoldTransaction.id))
        .filter(GoldTransaction.is_flagged.is_(True))
        .scalar()
        or 0
    )

    return {
        "total_miners": int(total_miners),
        "average_score": round(float(avg_score), 1),
        "kyc_distribution": kyc_distribution,
        "risk_distribution": risk_distribution,
        "total_transactions": int(total_txns),
        "flagged_transactions": int(flagged_txns),
    }


@router.get("/miners")
def compliance_miners(db: Session = Depends(get_db)):
    """Per-miner compliance snapshot, ordered by score ascending (worst first)."""
    miners = db.query(MinerRegistration).order_by(MinerRegistration.score.asc()).all()
    result = []
    for m in miners:
        flagged_count = (
            db.query(sqlfunc.count(GoldTransaction.id))
            .filter(
                GoldTransaction.miner_reg_number == m.reg_number,
                GoldTransaction.is_flagged.is_(True),
            )
            .scalar()
            or 0
        )
        total_txns = (
            db.query(sqlfunc.count(GoldTransaction.id))
            .filter(GoldTransaction.miner_reg_number == m.reg_number)
            .scalar()
            or 0
        )
        result.append(
            {
                "id": m.id,
                "reg_number": m.reg_number,
                "full_name": m.full_name,
                "district": m.district,
                "kyc_status": m.kyc_status,
                "score": m.score,
                "risk": m.risk,
                "flagged_transactions": int(flagged_count),
                "total_transactions": int(total_txns),
            }
        )
    return result


@router.get("/alerts")
def compliance_alerts(db: Session = Depends(get_db)):
    """Recent flagged transactions requiring compliance review."""
    flagged = (
        db.query(GoldTransaction)
        .filter(GoldTransaction.is_flagged.is_(True))
        .order_by(GoldTransaction.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": t.id,
            "transaction_date": str(t.transaction_date),
            "miner_reg_number": t.miner_reg_number,
            "buyer_name": t.buyer_name,
            "sale_amount_usd": t.sale_amount_usd,
            "payment_method": t.payment_method,
            "flag_reason": t.flag_reason,
            "created_at": t.created_at.isoformat(),
        }
        for t in flagged
    ]


@router.get("/miner/{reg_number}")
def miner_compliance(reg_number: str, db: Session = Depends(get_db)):
    """Individual miner compliance detail — used by the miner's own compliance view."""
    miner = (
        db.query(MinerRegistration)
        .filter(MinerRegistration.reg_number == reg_number)
        .first()
    )
    if not miner:
        raise HTTPException(status_code=404, detail="Miner not found")

    txns = (
        db.query(GoldTransaction)
        .filter(GoldTransaction.miner_reg_number == reg_number)
        .order_by(GoldTransaction.transaction_date.desc())
        .all()
    )
    total = len(txns)
    flagged = [t for t in txns if t.is_flagged]
    cdd_complete = sum(1 for t in txns if t.cdd_completed and t.buyer_verified)
    cash_txns = sum(1 for t in txns if t.payment_method == "cash")

    return {
        "reg_number": miner.reg_number,
        "full_name": miner.full_name,
        "district": miner.district,
        "kyc_status": miner.kyc_status,
        "score": miner.score,
        "risk": miner.risk,
        "total_transactions": total,
        "flagged_transactions": len(flagged),
        "cdd_completion_rate": round(cdd_complete / total * 100) if total > 0 else 0,
        "cash_transaction_count": cash_txns,
        "recent_flags": [
            {
                "id": t.id,
                "transaction_date": str(t.transaction_date),
                "sale_amount_usd": t.sale_amount_usd,
                "flag_reason": t.flag_reason,
            }
            for t in flagged[:5]
        ],
    }
