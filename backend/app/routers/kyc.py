from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import KycRegistration, User
from app.schemas import KycRegistrationCreate, KycRegistrationOut

router = APIRouter(prefix="/kyc", tags=["kyc"])


@router.post("/registrations", response_model=KycRegistrationOut)
def create_registration(
    payload: KycRegistrationCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    existing = (
        db.query(KycRegistration)
        .filter(KycRegistration.national_id_passport == payload.national_id_passport)
        .order_by(KycRegistration.created_at.desc())
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail="KYC registration already exists for this national ID/passport.",
        )

    row = KycRegistration(
        created_by_user_id=current.id,
        **payload.model_dump(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/registrations", response_model=list[KycRegistrationOut])
def list_my_registrations(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return (
        db.query(KycRegistration)
        .filter(KycRegistration.created_by_user_id == current.id)
        .order_by(KycRegistration.created_at.desc())
        .all()
    )
