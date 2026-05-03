import random
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.audit_utils import log_event
from app.config import settings
from app.database import get_db
from app.deps import verify_researcher_token
from app.models import AuditLog, GoldTransaction, Miner, MinerRegistration
from app.schemas import KycStatusUpdate, MinerCreate, MinerOut, MinerRegistrationCreate, MinerRegistrationOut

router = APIRouter(prefix="/miners", tags=["miners"])

_DISTRICT_CODES: dict[str, str] = {
    "Kadoma": "KAD",
    "Ngezi": "NGZ",
    "Shurugwi": "SHU",
    "Zvishavane": "ZVI",
    "Gwanda": "GWA",
}


def _generate_reg_number(district: str, db: Session) -> str:
    code = _DISTRICT_CODES.get(district, district[:3].upper())
    year = datetime.now().year
    for _ in range(20):
        seq = random.randint(1, 9999)
        ref = f"REG-{code}-{year}-{seq:04d}"
        if not db.query(MinerRegistration).filter(MinerRegistration.reg_number == ref).first():
            return ref
    raise RuntimeError("Could not generate unique registration number")


def _save_upload(reg_number: str, upload: UploadFile | None, prefix: str) -> str | None:
    if upload is None or not upload.filename:
        return None

    uploads_root = Path(settings.uploads_dir)
    target_dir = uploads_root / reg_number
    target_dir.mkdir(parents=True, exist_ok=True)

    suffix = Path(upload.filename).suffix.lower()
    safe_name = f"{prefix}_{uuid4().hex}{suffix}"
    target_path = target_dir / safe_name

    with target_path.open("wb") as file_obj:
        file_obj.write(upload.file.read())

    return safe_name


@router.post("/register", response_model=MinerRegistrationOut, status_code=201)
def register_miner(
    account_email: str | None = Form(None),
    full_name: str = Form(...),
    national_id: str = Form(...),
    district: str = Form(...),
    years_of_operation: str = Form(...),
    education_level: str = Form(...),
    registration_type: str = Form(...),
    mining_reg_number: str = Form(...),
    owner_full_name: str = Form(...),
    owner_national_id: str = Form(...),
    owner_relationship: str = Form(...),
    owner_phone: str = Form(...),
    owner_email: str | None = Form(None),
    owner_address: str = Form(...),
    declaration_confirmed: bool = Form(...),
    national_id_file: UploadFile | None = File(None),
    registration_cert_file: UploadFile | None = File(None),
    proof_of_address_file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
) -> MinerRegistration:
    payload = MinerRegistrationCreate(
        account_email=account_email,
        full_name=full_name,
        national_id=national_id,
        district=district,
        years_of_operation=years_of_operation,
        education_level=education_level,
        registration_type=registration_type,
        mining_reg_number=mining_reg_number,
        owner_full_name=owner_full_name,
        owner_national_id=owner_national_id,
        owner_relationship=owner_relationship,
        owner_phone=owner_phone,
        owner_email=owner_email,
        owner_address=owner_address,
        declaration_confirmed=declaration_confirmed,
    )

    existing_by_national_id = (
        db.query(MinerRegistration)
        .filter(MinerRegistration.national_id == payload.national_id)
        .order_by(MinerRegistration.created_at.desc())
        .first()
    )
    if existing_by_national_id:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Miner registration already exists for this national ID "
                f"({existing_by_national_id.reg_number}). "
                "Use the existing registration instead of creating a duplicate."
            ),
        )

    normalized_account_email = payload.account_email.strip().lower() if payload.account_email else None
    existing_registration = None
    if normalized_account_email:
        existing_registration = (
            db.query(MinerRegistration)
            .filter(
                or_(
                    MinerRegistration.account_email == normalized_account_email,
                    MinerRegistration.owner_email == normalized_account_email,
                )
            )
            .order_by(MinerRegistration.created_at.desc())
            .first()
        )
    if not existing_registration:
        existing_registration = (
            db.query(MinerRegistration)
            .filter(
                MinerRegistration.account_email.is_(None),
                MinerRegistration.owner_email.is_(None),
                MinerRegistration.full_name == payload.full_name,
                MinerRegistration.district == payload.district,
            )
            .order_by(MinerRegistration.created_at.desc())
            .first()
        )

    reg_number = existing_registration.reg_number if existing_registration else _generate_reg_number(payload.district, db)
    national_id_doc = _save_upload(reg_number, national_id_file, "national_id")
    registration_cert_doc = _save_upload(reg_number, registration_cert_file, "registration_cert")
    proof_of_address_doc = _save_upload(reg_number, proof_of_address_file, "proof_of_address")
    payload_data = payload.model_dump(
        exclude={"national_id_doc", "registration_cert_doc", "proof_of_address_doc"}
    )
    payload_data["account_email"] = normalized_account_email

    if existing_registration:
        reg = existing_registration
        previous_status = reg.kyc_status
        for field, value in payload_data.items():
            setattr(reg, field, value)
        if national_id_doc:
            reg.national_id_doc = national_id_doc
        if registration_cert_doc:
            reg.registration_cert_doc = registration_cert_doc
        if proof_of_address_doc:
            reg.proof_of_address_doc = proof_of_address_doc
        reg.kyc_status = "Pending"
        reg.score = 50
        reg.risk = "Medium"
    else:
        reg = MinerRegistration(
            **payload_data,
            reg_number=reg_number,
            national_id_doc=national_id_doc,
            registration_cert_doc=registration_cert_doc,
            proof_of_address_doc=proof_of_address_doc,
        )
        db.add(reg)
        previous_status = None

    log_event(
        db,
        action="miner_registered" if previous_status is None else "miner_registration_updated",
        entity_type="miner",
        entity_ref=reg_number,
        detail=(
            f"{payload.full_name} ({reg_number}) submitted KYC registration"
            if previous_status is None
            else (
                f"{payload.full_name} ({reg_number}) updated KYC registration; "
                f"status reset from {previous_status} to Pending"
            )
        )
        + f" - district: {payload.district}",
        actor=payload.full_name,
    )
    db.commit()
    db.refresh(reg)
    return reg


@router.get("/registrations", response_model=list[MinerRegistrationOut])
def list_miner_registrations(
    db: Session = Depends(get_db),
) -> list[MinerRegistration]:
    return (
        db.query(MinerRegistration)
        .order_by(MinerRegistration.created_at.desc())
        .all()
    )


@router.get("/registrations/{reg_id}", response_model=MinerRegistrationOut)
def get_miner_registration(reg_id: int, db: Session = Depends(get_db)) -> MinerRegistration:
    reg = db.get(MinerRegistration, reg_id)
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")
    return reg


@router.patch("/registrations/{reg_id}/status", response_model=MinerRegistrationOut)
def update_registration_status(
    reg_id: int,
    payload: KycStatusUpdate,
    db: Session = Depends(get_db),
) -> MinerRegistration:
    reg = db.get(MinerRegistration, reg_id)
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")
    old_status = reg.kyc_status
    reg.kyc_status = payload.kyc_status
    if payload.score is not None:
        reg.score = payload.score
    if reg.score >= 76:
        reg.risk = "Low"
    elif reg.score >= 60:
        reg.risk = "Medium"
    else:
        reg.risk = "High"
    log_event(
        db,
        action="kyc_status_updated",
        entity_type="miner",
        entity_ref=reg.reg_number,
        detail=(
            f"KYC status for {reg.reg_number} ({reg.full_name}) changed from "
            f"{old_status} to {payload.kyc_status}; score: {reg.score}; risk: {reg.risk}"
        ),
        actor="admin",
    )
    db.commit()
    db.refresh(reg)
    return reg


@router.delete("/registrations/{reg_id}", status_code=204)
def delete_miner_registration(reg_id: int, db: Session = Depends(get_db)):
    """Delete a miner registration and all associated transactions and audit entries."""
    reg = db.get(MinerRegistration, reg_id)
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")
    try:
        db.query(GoldTransaction).filter(
            GoldTransaction.miner_reg_number == reg.reg_number
        ).delete()
        db.query(AuditLog).filter(
            AuditLog.entity_ref == reg.reg_number
        ).delete()
        db.delete(reg)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")


@router.get("/registrations/{reg_id}/documents/{doc_type}")
def download_registration_document(
    reg_id: int,
    doc_type: str,
    db: Session = Depends(get_db),
):
    reg = db.get(MinerRegistration, reg_id)
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")

    doc_map = {
        "national_id": reg.national_id_doc,
        "registration_cert": reg.registration_cert_doc,
        "proof_of_address": reg.proof_of_address_doc,
    }
    filename = doc_map.get(doc_type)
    if not filename:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = Path(settings.uploads_dir) / reg.reg_number / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Document file is missing")

    return FileResponse(path=file_path, filename=filename)


@router.post("", response_model=MinerOut)
def create_miner(payload: MinerCreate, db: Session = Depends(get_db)):
    exists = db.query(Miner).filter(Miner.registration_ref == payload.registration_ref).first()
    if exists:
        raise HTTPException(status_code=409, detail="Registration reference already exists")
    miner = Miner(**payload.model_dump())
    db.add(miner)
    db.commit()
    db.refresh(miner)
    return miner


@router.get("", response_model=list[MinerOut], dependencies=[Depends(verify_researcher_token)])
def list_miners(db: Session = Depends(get_db)):
    return db.query(Miner).order_by(Miner.created_at.desc()).all()


@router.get("/{miner_id}", response_model=MinerOut)
def get_miner(miner_id: int, db: Session = Depends(get_db)):
    miner = db.get(Miner, miner_id)
    if not miner:
        raise HTTPException(status_code=404, detail="Miner not found")
    return miner
