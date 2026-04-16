import csv
import io
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func as sqlfunc
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import GoldTransaction, MinerRegistration

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/summary")
def reports_summary(db: Session = Depends(get_db)):
    """Aggregate numbers for the admin reports page."""
    total_miners = db.query(sqlfunc.count(MinerRegistration.id)).scalar() or 0
    verified = (
        db.query(sqlfunc.count(MinerRegistration.id))
        .filter(MinerRegistration.kyc_status == "Verified")
        .scalar()
        or 0
    )
    total_txns = db.query(sqlfunc.count(GoldTransaction.id)).scalar() or 0
    total_value = db.query(sqlfunc.sum(GoldTransaction.sale_amount_usd)).scalar() or 0.0
    flagged = (
        db.query(sqlfunc.count(GoldTransaction.id))
        .filter(GoldTransaction.is_flagged.is_(True))
        .scalar()
        or 0
    )
    high_risk = (
        db.query(sqlfunc.count(MinerRegistration.id))
        .filter(MinerRegistration.risk == "High")
        .scalar()
        or 0
    )
    return {
        "total_miners": int(total_miners),
        "verified_miners": int(verified),
        "total_transactions": int(total_txns),
        "total_value_usd": float(total_value),
        "flagged_transactions": int(flagged),
        "high_risk_miners": int(high_risk),
        "generated_at": date.today().isoformat(),
    }


@router.get("/export/transactions")
def export_transactions(
    miner_reg_number: str | None = None,
    db: Session = Depends(get_db),
):
    """Stream a CSV export of transactions, optionally filtered to one miner."""
    q = db.query(GoldTransaction)
    if miner_reg_number:
        q = q.filter(GoldTransaction.miner_reg_number == miner_reg_number)
    txns = q.order_by(GoldTransaction.transaction_date.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Ref", "Date", "Miner Reg", "Buyer / Agent", "Buying Centre",
        "Weight (g)", "Amount (USD)", "Payment Method",
        "CDD Complete", "Flagged", "Flag Reason",
    ])
    for t in txns:
        ref = f"TXN-{str(t.id).zfill(4)}"
        cdd_ok = "Yes" if (t.buyer_verified and t.cdd_completed) else "No"
        writer.writerow([
            ref,
            t.transaction_date,
            t.miner_reg_number or "",
            t.buyer_name,
            t.buying_centre,
            t.gold_weight_grams,
            t.sale_amount_usd,
            t.payment_method,
            cdd_ok,
            "Yes" if t.is_flagged else "No",
            t.flag_reason or "",
        ])

    output.seek(0)
    fname = (
        f"transactions_{miner_reg_number}_{date.today().isoformat()}.csv"
        if miner_reg_number
        else f"transactions_{date.today().isoformat()}.csv"
    )
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@router.get("/export/miners")
def export_miners(db: Session = Depends(get_db)):
    """Stream a CSV export of all miner KYC registrations."""
    miners = (
        db.query(MinerRegistration)
        .order_by(MinerRegistration.created_at.desc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Reg Number", "Full Name", "District", "Years Operating",
        "Education", "Reg Type", "KYC Status", "Score", "Risk", "Registered",
    ])
    for m in miners:
        writer.writerow([
            m.reg_number, m.full_name, m.district, m.years_of_operation,
            m.education_level, m.registration_type,
            m.kyc_status, m.score, m.risk,
            m.created_at.date(),
        ])

    output.seek(0)
    fname = f"miners_{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@router.get("/miner/{reg_number}")
def miner_report_data(reg_number: str, db: Session = Depends(get_db)):
    """Full report payload for a single miner (used by miner Download report page)."""
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
    total_value = sum(t.sale_amount_usd for t in txns)
    flagged_list = [t for t in txns if t.is_flagged]
    cdd_ok = sum(1 for t in txns if t.cdd_completed and t.buyer_verified)

    return {
        "miner": {
            "reg_number": miner.reg_number,
            "full_name": miner.full_name,
            "district": miner.district,
            "registration_type": miner.registration_type,
            "kyc_status": miner.kyc_status,
            "score": miner.score,
            "risk": miner.risk,
            "created_at": miner.created_at.date().isoformat(),
        },
        "summary": {
            "total_transactions": len(txns),
            "total_value_usd": total_value,
            "flagged_count": len(flagged_list),
            "cdd_completion_rate": round(cdd_ok / len(txns) * 100) if txns else 0,
        },
        "transactions": [
            {
                "id": t.id,
                "transaction_date": str(t.transaction_date),
                "gold_weight_grams": t.gold_weight_grams,
                "sale_amount_usd": t.sale_amount_usd,
                "buying_centre": t.buying_centre,
                "buyer_name": t.buyer_name,
                "payment_method": t.payment_method,
                "cdd_ok": bool(t.cdd_completed and t.buyer_verified),
                "is_flagged": t.is_flagged,
                "flag_reason": t.flag_reason,
            }
            for t in txns
        ],
    }
