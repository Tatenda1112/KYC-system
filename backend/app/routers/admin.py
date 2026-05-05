import secrets
import string
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth_utils import hash_password
from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import User, MinerRegistration, KycRegistration, AuditLog, GoldTransaction
from app.schemas import UserOut

router = APIRouter(prefix="/admin", tags=["admin"])


def generate_temp_password(length: int = 12) -> str:
    """Generate a temporary password."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    password = ''.join(secrets.choice(alphabet) for _ in range(length))
    return password


from pydantic import BaseModel

class CreateUserRequest(BaseModel):
    full_name: str
    email: str
    role: str
    registration_number: str | None = None
    registration_type: str | None = None
    district: str | None = None


class CreatedUserResponse(UserOut):
    temp_password: str
    miner_registration_id: int | None = None


@router.get("/users", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all system users (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return db.query(User).order_by(User.created_at.desc()).all()


@router.post("/users", response_model=CreatedUserResponse)
def create_user(
    request: CreateUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new user account (admin only)."""
    
    print(f"Creating user with request: {request}")
    print(f"Current user: {current_user.email if current_user else 'None'}")
    
    # Verify current user is admin
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == request.email.strip().lower()).first()
    if existing_user:
        print(f"Email {request.email} already exists for user ID {existing_user.id}")
        raise HTTPException(status_code=409, detail=f"Email '{request.email}' is already registered")
    
    # Validate role
    valid_roles = ["miner", "compliance_officer", "admin"]
    if request.role not in valid_roles:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    # Generate temporary password
    temp_password = generate_temp_password()

    if request.role == "miner":
        if not request.registration_number or not request.registration_type or not request.district:
            raise HTTPException(status_code=400, detail="Miner accounts require district, registration number and registration type")

        existing_miner = (
            db.query(MinerRegistration)
            .filter(MinerRegistration.reg_number == request.registration_number)
            .first()
        )
        if existing_miner:
            print(f"Registration number {request.registration_number} already exists for miner ID {existing_miner.id}")
            raise HTTPException(status_code=409, detail=f"Registration number '{request.registration_number}' already exists")
    
    # Create user with transaction handling
    try:
        new_user = User(
            email=request.email.strip().lower(),
            full_name=request.full_name.strip(),
            role=request.role,
            district=request.district,
            must_change_password=True,
            hashed_password=hash_password(temp_password),
            is_active=True,
        )
        
        db.add(new_user)
        db.flush()
        
        print(f"Successfully created user: {new_user.email}")
        
        miner_registration_id = None

        # If role is miner, create miner registration so it appears in the miners/compliance pages
        if request.role == "miner" and request.registration_number and request.registration_type and request.district:
            new_miner = MinerRegistration(
                reg_number=request.registration_number,
                account_email=request.email.strip().lower(),
                full_name=request.full_name.strip(),
                national_id="PENDING",
                district=request.district,
                years_of_operation="Not provided",
                education_level="Not provided",
                registration_type=request.registration_type,
                mining_reg_number=request.registration_number,
                owner_full_name=request.full_name.strip(),
                owner_national_id="PENDING",
                owner_relationship="Self",
                owner_phone="PENDING",
                owner_email=request.email.strip().lower(),
                owner_address=request.district,
                declaration_confirmed=False,
                kyc_status="Pending",
                score=50,
                risk="Medium",
            )
            
            db.add(new_miner)
            db.flush()
            miner_registration_id = new_miner.id
            print(f"Successfully created miner record: {new_miner.reg_number}")
        
        # TODO: Send welcome email with temporary password
        # For now, we'll just return user info (in production, integrate email service)
        print(f"Temporary password for {request.email}: {temp_password}")
        db.commit()
        db.refresh(new_user)
        
        return CreatedUserResponse.model_validate(
            {
                "id": new_user.id,
                "email": new_user.email,
                "full_name": new_user.full_name,
                "role": new_user.role,
                "district": new_user.district,
                "must_change_password": new_user.must_change_password,
                "is_active": new_user.is_active,
                "created_at": new_user.created_at,
                "temp_password": temp_password,
                "miner_registration_id": miner_registration_id,
            }
        )
        
    except Exception as e:
        print(f"Database error: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently delete a user and all associated data (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.email == settings.default_admin_email.strip().lower():
        raise HTTPException(status_code=400, detail="Cannot delete the super-admin account")

    try:
        # 1. Delete KYC registrations filed by this user
        db.query(KycRegistration).filter(KycRegistration.created_by_user_id == user_id).delete()

        # 2. If a miner, delete their MinerRegistration.
        #    Match by owner_email first; fall back to full_name when owner_email is NULL
        #    (self-registered miners don't always have owner_email set).
        if user.role == "miner":
            miner_reg = (
                db.query(MinerRegistration)
                .filter(MinerRegistration.account_email == user.email)
                .first()
            )
            if not miner_reg:
                miner_reg = (
                    db.query(MinerRegistration)
                    .filter(MinerRegistration.owner_email == user.email)
                    .first()
                )
            if not miner_reg:
                miner_reg = (
                    db.query(MinerRegistration)
                    .filter(
                        MinerRegistration.account_email.is_(None),
                        MinerRegistration.owner_email.is_(None),
                        MinerRegistration.full_name == user.full_name,
                    )
                    .first()
                )
            if miner_reg:
                # Delete all gold transactions recorded by this miner
                db.query(GoldTransaction).filter(
                    GoldTransaction.miner_reg_number == miner_reg.reg_number
                ).delete()
                # Delete all audit log entries referencing this miner
                db.query(AuditLog).filter(
                    AuditLog.entity_ref == miner_reg.reg_number
                ).delete()
                db.delete(miner_reg)

        # 3. Delete the user — their token becomes invalid immediately
        #    (get_current_user returns 401 when the user row is gone)
        db.delete(user)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")
