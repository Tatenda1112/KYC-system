from datetime import date as dt_date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Customer, MinerRegistration
from app.schemas import CustomerAdminRow, CustomerCreate, CustomerOut, CustomerUpdate

router = APIRouter(prefix="/customers", tags=["customers"])


def _assess_risk(politically_exposed: bool, known_sanctions: bool) -> tuple[str, bool, str | None]:
    """Return (risk_level, is_flagged, flag_reason) based on customer profile."""
    reasons: list[str] = []
    if politically_exposed:
        reasons.append("Politically exposed person (PEP) — requires enhanced due diligence")
    if known_sanctions:
        reasons.append("Known sanctions — transaction prohibited until cleared")
    if reasons:
        return "high", True, "; ".join(reasons)
    return "medium", False, None


# /check and /admin MUST come before /{customer_id} to avoid being parsed as int IDs

@router.get("/check", response_model=CustomerOut | None)
def check_customer(
    national_id: str = Query(..., description="National ID to look up"),
    miner_reg_number: str | None = Query(None),
    db: Session = Depends(get_db),
) -> Customer | None:
    """Check if a customer with this national ID already exists.

    If miner_reg_number is given, scope the search to that miner's customers.
    """
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
    """Admin endpoint: returns all customers enriched with linked miner name/district."""
    q = db.query(Customer)
    if risk_level:
        q = q.filter(Customer.risk_level == risk_level)
    if is_flagged is not None:
        q = q.filter(Customer.is_flagged.is_(is_flagged))
    if search:
        term = f"%{search}%"
        q = q.filter(
            Customer.full_name.ilike(term) | Customer.national_id.ilike(term)
        )
    customers = q.order_by(Customer.created_at.desc()).all()

    # Batch-fetch miner registrations for enrichment
    reg_numbers = list({c.miner_reg_number for c in customers if c.miner_reg_number})
    miner_map: dict[str, MinerRegistration] = {}
    if reg_numbers:
        for m in (
            db.query(MinerRegistration)
            .filter(MinerRegistration.reg_number.in_(reg_numbers))
            .all()
        ):
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
                full_name=c.full_name,
                national_id=c.national_id,
                date_of_birth=c.date_of_birth,
                nationality=c.nationality,
                phone_number=c.phone_number,
                email=c.email,
                physical_address=c.physical_address,
                occupation=c.occupation,
                employer=c.employer,
                place_of_work=c.place_of_work,
                source_of_funds=c.source_of_funds,
                purpose_of_purchase=c.purpose_of_purchase,
                transaction_frequency=c.transaction_frequency,
                politically_exposed=c.politically_exposed,
                pep_details=c.pep_details,
                known_sanctions=c.known_sanctions,
                sanctions_details=c.sanctions_details,
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


@router.post("", response_model=CustomerOut, status_code=201)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
) -> Customer:
    """Create a new customer for a miner. Auto-flags PEP customers."""
    risk_level, is_flagged, flag_reason = _assess_risk(
        payload.politically_exposed, payload.known_sanctions
    )
    customer = Customer(
        **payload.model_dump(),
        risk_level=risk_level,
        is_flagged=is_flagged,
        flag_reason=flag_reason,
        first_seen=dt_date.today(),
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.get("", response_model=list[CustomerOut])
def list_customers(
    miner_reg_number: str | None = None,
    risk_level: str | None = None,
    is_flagged: bool | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
) -> list[Customer]:
    """List customers. Pass miner_reg_number to scope to a single miner."""
    q = db.query(Customer)
    if miner_reg_number:
        q = q.filter(Customer.miner_reg_number == miner_reg_number)
    if risk_level:
        q = q.filter(Customer.risk_level == risk_level)
    if is_flagged is not None:
        q = q.filter(Customer.is_flagged.is_(is_flagged))
    if search:
        term = f"%{search}%"
        q = q.filter(
            Customer.full_name.ilike(term) | Customer.national_id.ilike(term)
        )
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
    """Update customer details. Re-runs risk assessment if PEP status changes."""
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(customer, field, value)

    # Re-run risk assessment when PEP status was updated
    if "politically_exposed" in data or "known_sanctions" in data:
        risk_level, is_flagged, flag_reason = _assess_risk(
            customer.politically_exposed, customer.known_sanctions
        )
        customer.risk_level = risk_level
        if is_flagged and not customer.is_flagged:
            customer.is_flagged = True
            customer.flag_reason = flag_reason

    db.commit()
    db.refresh(customer)
    return customer
