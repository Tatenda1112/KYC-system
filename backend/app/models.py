import enum
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(50), default="miner")
    district: Mapped[str | None] = mapped_column(String(120), nullable=True)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    kyc_registrations: Mapped[list["KycRegistration"]] = relationship(back_populates="created_by")


class KycRegistration(Base):
    """CDD/KYC onboarding record for a miner or dealer (filed by a logged-in user)."""

    __tablename__ = "kyc_registrations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    full_name: Mapped[str] = mapped_column(String(200))
    date_of_birth: Mapped[date] = mapped_column(Date)
    national_id_passport: Mapped[str] = mapped_column(String(80))
    nationality: Mapped[str] = mapped_column(String(80))
    phone: Mapped[str] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    physical_address: Mapped[str] = mapped_column(Text)

    miner_category: Mapped[str] = mapped_column(String(80))
    mining_licence_no: Mapped[str] = mapped_column(String(120))
    fgr_registration_no: Mapped[str | None] = mapped_column(String(120), nullable=True)
    mmcz_registration_no: Mapped[str | None] = mapped_column(String(120), nullable=True)
    primary_operating_province: Mapped[str] = mapped_column(String(80))
    primary_mineral: Mapped[str] = mapped_column(String(80))

    operating_as: Mapped[str] = mapped_column(String(80))
    beneficial_owners_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    pep_status: Mapped[str] = mapped_column(String(80))
    high_risk_area: Mapped[bool] = mapped_column(Boolean)
    additional_risk_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_by: Mapped["User"] = relationship(back_populates="kyc_registrations")


class QuestionSection(str, enum.Enum):
    awareness = "awareness"
    compliance = "compliance"
    barriers = "barriers"


class QuestionType(str, enum.Enum):
    likert_5 = "likert_5"
    yes_no = "yes_no"
    text = "text"


class Miner(Base):
    __tablename__ = "miners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    registration_ref: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    province: Mapped[str] = mapped_column(String(80))
    district: Mapped[str | None] = mapped_column(String(120), nullable=True)
    years_in_operation: Mapped[int | None] = mapped_column(Integer, nullable=True)
    primary_commodity: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    responses: Mapped[list["SurveyResponse"]] = relationship(back_populates="miner")


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    section: Mapped[QuestionSection] = mapped_column(
        Enum(QuestionSection, values_callable=lambda x: [e.value for e in x], native_enum=False),
        index=True,
    )
    code: Mapped[str] = mapped_column(String(40), unique=True)
    text: Mapped[str] = mapped_column(Text)
    question_type: Mapped[QuestionType] = mapped_column(
        Enum(QuestionType, values_callable=lambda x: [e.value for e in x], native_enum=False),
    )
    display_order: Mapped[int] = mapped_column(Integer, default=0)

    answers: Mapped[list["Answer"]] = relationship(back_populates="question")


class SurveyResponse(Base):
    __tablename__ = "survey_responses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    miner_id: Mapped[int | None] = mapped_column(ForeignKey("miners.id"), nullable=True, index=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    miner: Mapped["Miner | None"] = relationship(back_populates="responses")
    answers: Mapped[list["Answer"]] = relationship(back_populates="response", cascade="all, delete-orphan")


class Answer(Base):
    __tablename__ = "answers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    response_id: Mapped[int] = mapped_column(ForeignKey("survey_responses.id"), index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"), index=True)
    likert_value: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bool_value: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    text_value: Mapped[str | None] = mapped_column(Text, nullable=True)

    response: Mapped["SurveyResponse"] = relationship(back_populates="answers")
    question: Mapped["Question"] = relationship(back_populates="answers")


class MinerRegistration(Base):
    """Full KYC/CDD registration submitted by a small-scale miner across 3 steps."""

    __tablename__ = "miner_registrations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Generated reference e.g. REG-SHU-2026-0042
    reg_number: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    account_email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    # Step 1 — Personal details
    full_name: Mapped[str] = mapped_column(String(200))
    national_id: Mapped[str] = mapped_column(String(80))
    district: Mapped[str] = mapped_column(String(80))
    years_of_operation: Mapped[str] = mapped_column(String(50))
    education_level: Mapped[str] = mapped_column(String(80))
    registration_type: Mapped[str] = mapped_column(String(80))
    mining_reg_number: Mapped[str] = mapped_column(String(120))

    # Step 2 — Beneficial owner
    owner_full_name: Mapped[str] = mapped_column(String(200))
    owner_national_id: Mapped[str] = mapped_column(String(80))
    owner_relationship: Mapped[str] = mapped_column(String(80))
    owner_phone: Mapped[str] = mapped_column(String(40))
    owner_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    owner_address: Mapped[str] = mapped_column(Text)
    declaration_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)

    # KYC status (updated by compliance officer after document review)
    kyc_status: Mapped[str] = mapped_column(String(20), default="Pending")  # Pending/Verified/Flagged/Rejected
    score: Mapped[int] = mapped_column(Integer, default=50)                  # 0–100 compliance score
    risk: Mapped[str] = mapped_column(String(20), default="Medium")          # High/Medium/Low

    # Document storage keys / filenames (populated after upload)
    national_id_doc: Mapped[str | None] = mapped_column(String(255), nullable=True)
    registration_cert_doc: Mapped[str | None] = mapped_column(String(255), nullable=True)
    proof_of_address_doc: Mapped[str | None] = mapped_column(String(255), nullable=True)


class AuditLog(Base):
    """Immutable record of system events for the audit trail."""

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    # What happened
    action: Mapped[str] = mapped_column(String(80), index=True)
    # "miner_registered" | "kyc_status_updated" | "transaction_created" | "transaction_flagged"

    # What it affected
    entity_type: Mapped[str] = mapped_column(String(40))   # "miner" | "transaction"
    entity_ref: Mapped[str] = mapped_column(String(80))    # reg_number or TXN-XXXX

    # Who did it
    actor: Mapped[str] = mapped_column(String(120), default="system")

    # Human-readable description
    detail: Mapped[str] = mapped_column(Text)


class Customer(Base):
    """Gold buyer (customer) recorded by a miner for CDD compliance."""

    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Linked miner (by KYC reg number, consistent with GoldTransaction pattern)
    miner_reg_number: Mapped[str | None] = mapped_column(String(60), nullable=True, index=True)

    # Identity
    full_name: Mapped[str] = mapped_column(String(200))
    national_id: Mapped[str] = mapped_column(String(80), index=True)
    phone_number: Mapped[str | None] = mapped_column(String(40), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    physical_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    occupation: Mapped[str | None] = mapped_column(String(120), nullable=True)
    source_of_funds: Mapped[str | None] = mapped_column(String(200), nullable=True)
    purpose_of_purchase: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # PEP
    politically_exposed: Mapped[bool] = mapped_column(Boolean, default=False)
    pep_details: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Risk assessment
    risk_level: Mapped[str] = mapped_column(String(20), default="medium")  # high / medium / low
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    flag_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Transaction statistics (updated on each transaction)
    first_seen: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_transaction: Mapped[date | None] = mapped_column(Date, nullable=True)
    total_transactions: Mapped[int] = mapped_column(Integer, default=0)
    total_value_usd: Mapped[float] = mapped_column(Float, default=0.0)


class GoldTransaction(Base):
    """Gold sale transaction recorded by a miner."""

    __tablename__ = "gold_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    transaction_date: Mapped[date] = mapped_column(Date)
    gold_weight_grams: Mapped[float] = mapped_column(Float)
    sale_amount_usd: Mapped[float] = mapped_column(Float)
    buying_centre: Mapped[str] = mapped_column(String(200))
    buyer_name: Mapped[str] = mapped_column(String(200))
    payment_method: Mapped[str] = mapped_column(String(50))   # cash / bank / mobile
    buyer_verified: Mapped[bool] = mapped_column(Boolean)
    cdd_completed: Mapped[bool] = mapped_column(Boolean)

    # Miner who recorded the sale (set from their KYC reg number)
    miner_reg_number: Mapped[str | None] = mapped_column(String(60), nullable=True, index=True)

    # Customer link (added via startup migration for existing databases)
    customer_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("customers.id"), nullable=True)
    customer_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    customer_id_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    customer_id_number: Mapped[str | None] = mapped_column(String(80), nullable=True)

    # Auto-computed compliance flags
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    flag_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
