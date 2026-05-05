from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func as sqlfunc
from sqlalchemy.orm import Session

from app.audit_utils import log_event
from app.database import get_db
from app.models import AuditLog, Customer, GoldTransaction, MinerRegistration
from app.schemas import GoldTransactionCreate, GoldTransactionOut, TransactionStats

router = APIRouter(prefix="/transactions", tags=["transactions"])

def _ensure_verified_miner(db: Session, miner_reg_number: str) -> None:
    miner = (
        db.query(MinerRegistration)
        .filter(MinerRegistration.reg_number == miner_reg_number)
        .first()
    )
    if not miner:
        raise HTTPException(status_code=404, detail="Miner registration not found")
    if miner.kyc_status != "Verified":
        raise HTTPException(
            status_code=403,
            detail="Miner profile is locked until admin approval (KYC must be Verified).",
        )


def _compute_flags(payload: GoldTransactionCreate) -> tuple[bool, str | None]:
    """Return (is_flagged, flag_reason) based on AML/CDD rules."""
    reasons: list[str] = []
    if payload.payment_method == "cash" and payload.sale_amount_usd > 5000:
        reasons.append("Cash transaction above USD 5000 — mandatory AML review")
    if not payload.buyer_verified:
        reasons.append("Buyer identity not verified before transaction")
    if not payload.cdd_completed:
        reasons.append("CDD procedure not completed")
    return bool(reasons), "; ".join(reasons) if reasons else None


@router.post("", response_model=GoldTransactionOut, status_code=201)
def create_transaction(
    payload: GoldTransactionCreate,
    db: Session = Depends(get_db),
) -> GoldTransaction:
    if payload.miner_reg_number:
        _ensure_verified_miner(db, payload.miner_reg_number)

    is_flagged, flag_reason = _compute_flags(payload)
    txn = GoldTransaction(
        **payload.model_dump(),
        is_flagged=is_flagged,
        flag_reason=flag_reason,
    )
    db.add(txn)
    db.flush()  # populate txn.id before logging

    txn_ref = f"TXN-{str(txn.id).zfill(4)}"
    actor = payload.miner_reg_number or "unregistered"
    log_event(
        db,
        action="transaction_created",
        entity_type="transaction",
        entity_ref=txn_ref,
        detail=(
            f"{txn_ref} recorded by {actor} — "
            f"{payload.gold_weight_grams}g gold, ${payload.sale_amount_usd:.2f} USD, "
            f"{payload.payment_method} payment at {payload.buying_centre}"
        ),
        actor=actor,
    )
    if is_flagged:
        log_event(
            db,
            action="transaction_flagged",
            entity_type="transaction",
            entity_ref=txn_ref,
            detail=f"{txn_ref} auto-flagged: {flag_reason}",
            actor="system",
        )

    # Update linked customer transaction statistics
    if payload.customer_id:
        customer = db.get(Customer, payload.customer_id)
        if customer:
            customer.last_transaction = payload.transaction_date
            customer.total_transactions = (customer.total_transactions or 0) + 1
            customer.total_value_usd = (customer.total_value_usd or 0.0) + payload.sale_amount_usd

    db.commit()
    db.refresh(txn)
    return txn


# /stats MUST be declared before /{txn_id} to avoid "stats" being parsed as an int
@router.get("/stats", response_model=TransactionStats)
def transaction_stats(db: Session = Depends(get_db)) -> TransactionStats:
    total = db.query(sqlfunc.count(GoldTransaction.id)).scalar() or 0
    total_value = db.query(sqlfunc.sum(GoldTransaction.sale_amount_usd)).scalar() or 0.0
    flagged = (
        db.query(sqlfunc.count(GoldTransaction.id))
        .filter(GoldTransaction.is_flagged.is_(True))
        .scalar()
        or 0
    )
    cdd_incomplete = (
        db.query(sqlfunc.count(GoldTransaction.id))
        .filter(GoldTransaction.cdd_completed.is_(False))
        .scalar()
        or 0
    )
    return TransactionStats(
        total_transactions=int(total),
        total_value_usd=float(total_value),
        flagged_count=int(flagged),
        cdd_incomplete_count=int(cdd_incomplete),
    )


@router.get("", response_model=list[GoldTransactionOut])
def list_transactions(
    payment_method: str | None = None,
    flagged: bool | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    miner_reg_number: str | None = None,
    db: Session = Depends(get_db),
) -> list[GoldTransaction]:
    if miner_reg_number:
        _ensure_verified_miner(db, miner_reg_number)
    q = db.query(GoldTransaction)
    if payment_method:
        q = q.filter(GoldTransaction.payment_method == payment_method)
    if flagged is not None:
        q = q.filter(GoldTransaction.is_flagged.is_(flagged))
    if date_from:
        q = q.filter(GoldTransaction.transaction_date >= date_from)
    if date_to:
        q = q.filter(GoldTransaction.transaction_date <= date_to)
    if miner_reg_number:
        q = q.filter(GoldTransaction.miner_reg_number == miner_reg_number)
    return q.order_by(GoldTransaction.created_at.desc()).all()


@router.get("/{txn_id}", response_model=GoldTransactionOut)
def get_transaction(txn_id: int, db: Session = Depends(get_db)) -> GoldTransaction:
    txn = db.get(GoldTransaction, txn_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return txn


@router.delete("/{txn_id}", status_code=204)
def delete_transaction(txn_id: int, db: Session = Depends(get_db)):
    """Delete a single transaction and its audit log entries."""
    txn = db.get(GoldTransaction, txn_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    txn_ref = f"TXN-{str(txn_id).zfill(4)}"
    db.query(AuditLog).filter(AuditLog.entity_ref == txn_ref).delete()
    db.delete(txn)
    db.commit()


@router.delete("", status_code=200)
def delete_orphaned_transactions(db: Session = Depends(get_db)):
    """Delete all transactions whose miner_reg_number has no matching MinerRegistration."""
    active_reg_numbers = {
        r[0] for r in db.query(MinerRegistration.reg_number).all()
    }
    orphaned = db.query(GoldTransaction).filter(
        GoldTransaction.miner_reg_number.notin_(active_reg_numbers)
        if active_reg_numbers
        else GoldTransaction.id.isnot(None)
    ).all()
    deleted = 0
    for txn in orphaned:
        txn_ref = f"TXN-{str(txn.id).zfill(4)}"
        db.query(AuditLog).filter(AuditLog.entity_ref == txn_ref).delete()
        db.delete(txn)
        deleted += 1
    db.commit()
    return {"deleted": deleted}
