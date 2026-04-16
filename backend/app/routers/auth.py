from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth_utils import create_access_token, hash_password, verify_password
from app.database import get_db
from app.deps import get_current_user
from app.models import MinerRegistration, User
from app.schemas import ChangePasswordBody, LoginBody, TokenOut, UserOut, UserRegister

router = APIRouter(prefix="/auth", tags=["auth"])


def _serialize_user(user: User, db: Session) -> UserOut:
    linked_registration = None
    if user.role == "miner":
        # Primary: explicit account link for the logged-in miner
        linked_registration = (
            db.query(MinerRegistration)
            .filter(MinerRegistration.account_email == user.email)
            .order_by(MinerRegistration.created_at.desc())
            .first()
        )
        if not linked_registration:
            linked_registration = (
                db.query(MinerRegistration)
                .filter(MinerRegistration.owner_email == user.email)
                .order_by(MinerRegistration.created_at.desc())
                .first()
            )
        if not linked_registration:
            linked_registration = (
                db.query(MinerRegistration)
                .filter(
                    MinerRegistration.account_email.is_(None),
                    MinerRegistration.owner_email.is_(None),
                    MinerRegistration.full_name == user.full_name,
                )
                .order_by(MinerRegistration.created_at.desc())
                .first()
            )

    return UserOut.model_validate(
        {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "district": user.district,
            "must_change_password": user.must_change_password,
            "miner_registration_id": linked_registration.id if linked_registration else None,
            "miner_reg_number": linked_registration.reg_number if linked_registration else None,
            "miner_kyc_status": linked_registration.kyc_status if linked_registration else None,
            "is_active": user.is_active,
            "created_at": user.created_at,
        }
    )


@router.post("/login", response_model=TokenOut)
def login(body: LoginBody, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    return TokenOut(access_token=create_access_token(user.id))


@router.post("/register", response_model=UserOut)
def register(body: UserRegister, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    u = User(
        email=email,
        full_name=body.full_name.strip(),
        role="miner",
        must_change_password=False,
        hashed_password=hash_password(body.password),
        is_active=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return _serialize_user(u, db)


@router.get("/me", response_model=UserOut)
def me(
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    refreshed = db.get(User, current.id)
    return _serialize_user(refreshed, db)


@router.post("/change-password", response_model=UserOut)
def change_password(
    body: ChangePasswordBody,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if not verify_password(body.current_password, current.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if body.current_password == body.new_password:
        raise HTTPException(status_code=400, detail="New password must be different from current password")

    current.hashed_password = hash_password(body.new_password)
    current.must_change_password = False
    db.commit()
    db.refresh(current)
    return _serialize_user(current, db)
