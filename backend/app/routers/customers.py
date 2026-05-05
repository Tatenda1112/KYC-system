from datetime import date as dt_date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func as sqlfunc
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Customer, GoldTransaction, MinerRegistration, SuspiciousTransactionReport
from app.audit_utils import log_event
from app.schemas import (
    CustomerAdminRow,
    CustomerCreate,
    CustomerOut,
    CustomerProfileOut,
    CustomerProfileTransactionOut,
    CustomerUpdate,
    StrReportOut,
    StrReportStatusUpdate,
)

router = APIRouter(prefix="/customers", tags=["customers"])


def _assess_risk(payload: CustomerCreate | CustomerUpdate | Customer) -> tuple[str, bool, str | None]:
    """Return (risk_level, is_flagged, flag_reason) based on customer profile."""
    reasons: list[str] = []
    pep = bool(getattr(payload, "politically_exposed", False))
    sanctioned = bool(getattr(payload, "known_sanctions", False))
    minor = bool(getattr(payload, "is_minor", False))
    pep_docs_missing = pep and (
        not getattr(payload, "proof_of_residence_ref", None)
        or not getattr(payload, "financial_statements_ref", None)
        or not getattr(payload, "pep_source_of_wealth_explained", False)
    )

    if pep:
        reasons.append("Politically exposed person (PEP) - enhanced due diligence required")
    if pep_docs_missing:
        reasons.append("PEP enhanced due diligence documentation is incomplete")
    if sanctioned:
        reasons.append("Known sanctions - transaction prohibited until cleared")
    if minor:
        reasons.append("Minor customer - guardian verification required")

    if reasons:
        return "high", True, "; ".join(reasons)
    return "medium", False, None


def _next_customer_number(db: Session) -> str:
    year = dt_date.today().year
    prefix = f"CUST-{year}-"
    latest = (
        db.query(Customer.customer_number)
        .filter(Customer.customer_number.isnot(None), Customer.customer_number.like(f"{prefix}%"))
        .order_by(Customer.customer_number.desc())
        .first()
    )
    if latest and latest[0]:
        try:
            seq = int(latest[0].split("-")[-1]) + 1
        except ValueError:
            seq = 1
    else:
        seq = 1
    return f"{prefix}{seq:05d}"


def _next_str_reference(db: Session) -> str:
    year = dt_date.today().year
    prefix = f"STR-{year}-"
    latest = (
        db.query(SuspiciousTransactionReport.reference)
        .filter(SuspiciousTransactionReport.reference.like(f"{prefix}%"))
        .order_by(SuspiciousTransactionReport.reference.desc())
        .first()
    )
    if latest and latest[0]:
        try:
            seq = int(latest[0].split("-")[-1]) + 1
        except ValueError:
            seq = 1
    else:
        seq = 1
    return f"{prefix}{seq:06d}"


def _validate_customer_compliance(payload: CustomerCreate | CustomerUpdate | Customer) -> None:
    if getattr(payload, "politically_exposed", False):
        missing: list[str] = []
        if not getattr(payload, "pep_details", None):
            missing.append("PEP details")
        if not getattr(payload, "pep_position", None):
            missing.append("PEP position")
        if not getattr(payload, "proof_of_residence_ref", None):
            missing.append("proof of residence reference")
        if not getattr(payload, "financial_statements_ref", None):
            missing.append("financial statements reference")
        if not getattr(payload, "pep_source_of_wealth_explained", False):
            missing.append("source of wealth confirmation")
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"PEP enhanced due diligence is incomplete: {', '.join(missing)}",
            )

    if getattr(payload, "is_minor", False):
        missing_guardian: list[str] = []
        if not getattr(payload, "guardian_full_name", None):
            missing_guardian.append("guardian full name")
        if not getattr(payload, "guardian_national_id", None):
            missing_guardian.append("guardian ID number")
        if not getattr(payload, "guardian_phone", None):
            missing_guardian.append("guardian phone")
        if missing_guardian:
            raise HTTPException(
                status_code=400,
                detail=f"Minor customer requires guardian details: {', '.join(missing_guardian)}",
            )


# /check and /admin MUST come before /{customer_id} to avoid being parsed as int IDs


@router.get("/check", response_model=CustomerOut | None)
def check_customer(
    national_id: str = Query(..., description="National ID to look up"),
    miner_reg_number: str | None = Query(None),
    db: Session = Depends(get_db),
) -> Customer | None:
    q = db.query(Customer).filter(Customer.national_id == national_id)
    if miner_reg_number:
        q = q.filter(Customer.miner_reg_number == miner_reg_number)
    return q.first()


@router.get("/admin", response_model=list[CustomerAdminRow])
def list_customers_admin(
    risk_level: str | None = None,
    is_flagged: bool | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
) -> list[CustomerAdminRow]:
    q = db.query(Customer)
    if risk_level:
        q = q.filter(Customer.risk_level == risk_level)
    if is_flagged is not None:
        q = q.filter(Customer.is_flagged.is_(is_flagged))
    if search:
        term = f"%{search}%"
        q = q.filter(Customer.full_name.ilike(term) | Customer.national_id.ilike(term))
    customers = q.order_by(Customer.created_at.desc()).all()

    reg_numbers = list({c.miner_reg_number for c in customers if c.miner_reg_number})
    miner_map: dict[str, MinerRegistration] = {}
    if reg_numbers:
        for m in db.query(MinerRegistration).filter(MinerRegistration.reg_number.in_(reg_numbers)).all():
            miner_map[m.reg_number] = m

    rows: list[CustomerAdminRow] = []
    for c in customers:
        miner = miner_map.get(c.miner_reg_number) if c.miner_reg_number else None
        rows.append(
            CustomerAdminRow(
                id=c.id,
                created_at=c.created_at,
                updated_at=c.updated_at,
                miner_reg_number=c.miner_reg_number,
                customer_number=c.customer_number,
                full_name=c.full_name,
                national_id=c.national_id,
                date_of_birth=c.date_of_birth,
                nationality=c.nationality,
                district=c.district,
                id_document_type=c.id_document_type,
                phone_number=c.phone_number,
                email=c.email,
                physical_address=c.physical_address,
                occupation=c.occupation,
                employer=c.employer,
                place_of_work=c.place_of_work,
                source_of_funds=c.source_of_funds,
                source_of_wealth=c.source_of_wealth,
                has_payslip=c.has_payslip,
                payslip_ref=c.payslip_ref,
                purpose_of_purchase=c.purpose_of_purchase,
                transaction_frequency=c.transaction_frequency,
                proof_of_residence_ref=c.proof_of_residence_ref,
                financial_statements_ref=c.financial_statements_ref,
                politically_exposed=c.politically_exposed,
                pep_details=c.pep_details,
                pep_position=c.pep_position,
                pep_organization=c.pep_organization,
                pep_since=c.pep_since,
                pep_relationship=c.pep_relationship,
                pep_source_of_wealth_explained=c.pep_source_of_wealth_explained,
                known_sanctions=c.known_sanctions,
                sanctions_details=c.sanctions_details,
                is_minor=c.is_minor,
                guardian_full_name=c.guardian_full_name,
                guardian_national_id=c.guardian_national_id,
                guardian_phone=c.guardian_phone,
                risk_level=c.risk_level,
                is_flagged=c.is_flagged,
                flag_reason=c.flag_reason,
                first_seen=c.first_seen,
                last_transaction=c.last_transaction,
                total_transactions=c.total_transactions,
                total_value_usd=c.total_value_usd,
                miner_full_name=miner.full_name if miner else None,
                miner_district=miner.district if miner else None,
            )
        )
    return rows


@router.get("/str/reports", response_model=list[StrReportOut])
def list_str_reports(
    status: str | None = None,
    search: str | None = None,
    filed_by: str | None = None,
    db: Session = Depends(get_db),
) -> list[SuspiciousTransactionReport]:
    q = db.query(SuspiciousTransactionReport)
    if status:
        q = q.filter(SuspiciousTransactionReport.status == status)
    if filed_by:
        q = q.filter(SuspiciousTransactionReport.filed_by == filed_by)
    if search:
        term = f"%{search}%"
        q = q.filter(
            SuspiciousTransactionReport.reference.ilike(term)
            | SuspiciousTransactionReport.customer_name.ilike(term)
            | SuspiciousTransactionReport.customer_national_id.ilike(term)
        )
    return q.order_by(SuspiciousTransactionReport.created_at.desc()).all()


@router.patch("/str/reports/{report_id}", response_model=StrReportOut)
def update_str_status(
    report_id: int,
    payload: StrReportStatusUpdate,
    db: Session = Depends(get_db),
) -> SuspiciousTransactionReport:
    report = db.get(SuspiciousTransactionReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="STR report not found")

    report.status = payload.status
    report.reviewed_by = payload.reviewed_by or "compliance_officer"
    report.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(report)
    return report


@router.get("/{customer_id}/profile", response_model=CustomerProfileOut)
def get_customer_profile(
    customer_id: int,
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
) -> CustomerProfileOut:
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    miner: MinerRegistration | None = None
    if customer.miner_reg_number:
        miner = (
            db.query(MinerRegistration)
            .filter(MinerRegistration.reg_number == customer.miner_reg_number)
            .first()
        )

    txn_count, txn_total, txn_avg, gold_avg, txn_max = (
        db.query(
            sqlfunc.count(GoldTransaction.id),
            sqlfunc.coalesce(sqlfunc.sum(GoldTransaction.sale_amount_usd), 0.0),
            sqlfunc.coalesce(sqlfunc.avg(GoldTransaction.sale_amount_usd), 0.0),
            sqlfunc.coalesce(sqlfunc.avg(GoldTransaction.gold_weight_grams), 0.0),
            sqlfunc.coalesce(sqlfunc.max(GoldTransaction.sale_amount_usd), 0.0),
        )
        .filter(GoldTransaction.customer_id == customer_id)
        .one()
    )

    cutoff_date = dt_date.today() - timedelta(days=90)
    recent_count, recent_total = (
        db.query(
            sqlfunc.count(GoldTransaction.id),
            sqlfunc.coalesce(sqlfunc.sum(GoldTransaction.sale_amount_usd), 0.0),
        )
        .filter(
            GoldTransaction.customer_id == customer_id,
            GoldTransaction.transaction_date >= cutoff_date,
        )
        .one()
    )

    transactions = (
        db.query(GoldTransaction)
        .filter(GoldTransaction.customer_id == customer_id)
        .order_by(GoldTransaction.transaction_date.desc(), GoldTransaction.created_at.desc())
        .limit(limit)
        .all()
    )

    return CustomerProfileOut(
        customer=CustomerOut.model_validate(customer),
        miner_full_name=miner.full_name if miner else None,
        miner_district=miner.district if miner else None,
        transaction_count=int(txn_count or 0),
        total_spend_usd=float(txn_total or 0.0),
        average_spend_usd=float(txn_avg or 0.0),
        average_gold_weight_grams=float(gold_avg or 0.0),
        largest_transaction_usd=float(txn_max or 0.0),
        last_90d_transaction_count=int(recent_count or 0),
        last_90d_spend_usd=float(recent_total or 0.0),
        transactions=[CustomerProfileTransactionOut.model_validate(txn) for txn in transactions],
    )


@router.post("", response_model=CustomerOut, status_code=201)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
) -> Customer:
    existing = (
        db.query(Customer)
        .filter(Customer.national_id == payload.national_id)
        .order_by(Customer.created_at.desc())
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Customer already exists for this national ID "
                f"(Customer #{existing.customer_number or existing.id}). "
                f"Use the existing customer record instead of creating a duplicate."
            ),
        )

    _validate_customer_compliance(payload)
    risk_level, is_flagged, flag_reason = _assess_risk(payload)
    customer = Customer(
        **payload.model_dump(),
        customer_number=_next_customer_number(db),
        risk_level=risk_level,
        is_flagged=is_flagged,
        flag_reason=flag_reason,
        first_seen=dt_date.today(),
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.post("/{customer_id}/str", status_code=201)
def submit_str(
    customer_id: int,
    payload: dict | None = None,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    reason = (payload or {}).get("reason") or customer.flag_reason or "Suspicious activity observed"
    note = (payload or {}).get("note")
    str_ref = _next_str_reference(db)
    filed_by = (payload or {}).get("filed_by") or customer.miner_reg_number or "system"

    report = SuspiciousTransactionReport(
        reference=str_ref,
        customer_id=customer.id,
        customer_number=customer.customer_number,
        customer_name=customer.full_name,
        customer_national_id=customer.national_id,
        reason=reason,
        note=note,
        status="Submitted",
        filed_by=filed_by,
    )
    db.add(report)

    detail = f"{str_ref} filed for customer {customer.customer_number or customer.national_id}: {reason}"
    if note:
        detail += f" | Note: {note}"

    log_event(
        db,
        action="str_submitted",
        entity_type="customer",
        entity_ref=str(customer_id),
        detail=detail,
        actor=filed_by,
    )
    db.commit()
    return {"str_reference": str_ref, "status": "submitted"}


@router.get("", response_model=list[CustomerOut])
def list_customers(
    miner_reg_number: str | None = None,
    risk_level: str | None = None,
    is_flagged: bool | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
) -> list[Customer]:
    q = db.query(Customer)
    if miner_reg_number:
        q = q.filter(Customer.miner_reg_number == miner_reg_number)
    if risk_level:
        q = q.filter(Customer.risk_level == risk_level)
    if is_flagged is not None:
        q = q.filter(Customer.is_flagged.is_(is_flagged))
    if search:
        term = f"%{search}%"
        q = q.filter(Customer.full_name.ilike(term) | Customer.national_id.ilike(term))
    return q.order_by(Customer.created_at.desc()).all()


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: int, db: Session = Depends(get_db)) -> Customer:
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.put("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
) -> Customer:
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(customer, field, value)

    _validate_customer_compliance(customer)
    risk_level, is_flagged, flag_reason = _assess_risk(customer)
    customer.risk_level = risk_level
    customer.is_flagged = is_flagged
    customer.flag_reason = flag_reason

    db.commit()
    db.refresh(customer)
    return customer


@router.delete("/{customer_id}", status_code=204)
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
):
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Keep transaction history but unlink customer reference.
    txns = db.query(GoldTransaction).filter(GoldTransaction.customer_id == customer_id).all()
    for txn in txns:
        txn.customer_id = None
        txn.customer_name = customer.full_name
        txn.customer_id_number = customer.national_id

    # Remove STR reports for this customer.
    db.query(SuspiciousTransactionReport).filter(
        SuspiciousTransactionReport.customer_id == customer_id
    ).delete()

    log_event(
        db,
        action="customer_deleted",
        entity_type="customer",
        entity_ref=str(customer_id),
        detail=(
            f"Customer deleted: {customer.full_name} "
            f"({customer.customer_number or customer.national_id})"
        ),
        actor="admin",
    )

    db.delete(customer)
    db.commit()
