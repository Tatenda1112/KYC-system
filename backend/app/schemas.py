from datetime import date, datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class QuestionSectionEnum(str, Enum):
    awareness = "awareness"
    compliance = "compliance"
    barriers = "barriers"


class QuestionTypeEnum(str, Enum):
    likert_5 = "likert_5"
    yes_no = "yes_no"
    text = "text"


class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    section: QuestionSectionEnum
    code: str
    text: str
    question_type: QuestionTypeEnum
    display_order: int


class MinerCreate(BaseModel):
    registration_ref: str = Field(..., min_length=3, max_length=120)
    province: str = Field(..., min_length=2, max_length=80)
    district: str | None = Field(None, max_length=120)
    years_in_operation: int | None = Field(None, ge=0, le=80)
    primary_commodity: str | None = Field(None, max_length=80)


class MinerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    registration_ref: str
    province: str
    district: str | None
    years_in_operation: int | None
    primary_commodity: str | None
    created_at: datetime


class AnswerItem(BaseModel):
    question_id: int
    likert_value: int | None = Field(None, ge=1, le=5)
    bool_value: bool | None = None
    text_value: str | None = None


class SurveySubmit(BaseModel):
    miner_id: int | None = None
    notes: str | None = None
    answers: list[AnswerItem]


class SurveyResponseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    miner_id: int | None
    submitted_at: datetime
    notes: str | None


class SectionSummary(BaseModel):
    section: str
    mean_likert: float | None
    response_count: int


class DashboardSummary(BaseModel):
    total_responses: int
    total_miners: int
    by_province: dict[str, int]
    section_summaries: list[SectionSummary]


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginBody(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=200)


class UserRegister(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=8, max_length=200)
    full_name: str = Field(..., min_length=2, max_length=200)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: str
    district: str | None
    must_change_password: bool
    miner_registration_id: int | None = None
    miner_reg_number: str | None = None
    miner_kyc_status: str | None = None
    is_active: bool
    created_at: datetime


class ChangePasswordBody(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=200)
    new_password: str = Field(..., min_length=8, max_length=200)


class KycRegistrationCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=200)
    date_of_birth: date
    national_id_passport: str = Field(..., min_length=3, max_length=80)
    nationality: str = Field(..., min_length=2, max_length=80)
    phone: str = Field(..., min_length=5, max_length=40)
    email: str | None = Field(None, max_length=255)
    physical_address: str = Field(..., min_length=5)

    miner_category: str = Field(..., min_length=2, max_length=80)
    mining_licence_no: str = Field(..., min_length=3, max_length=120)
    fgr_registration_no: str | None = Field(None, max_length=120)
    mmcz_registration_no: str | None = Field(None, max_length=120)
    primary_operating_province: str = Field(..., min_length=2, max_length=80)
    primary_mineral: str = Field(..., min_length=2, max_length=80)

    operating_as: str = Field(..., min_length=2, max_length=80)
    beneficial_owners_text: str | None = None

    pep_status: str = Field(..., min_length=2, max_length=80)
    high_risk_area: bool
    additional_risk_notes: str | None = None

    @field_validator(
        "email",
        "fgr_registration_no",
        "mmcz_registration_no",
        "beneficial_owners_text",
        "additional_risk_notes",
        mode="before",
    )
    @classmethod
    def blank_to_none(cls, v: object) -> object:
        if isinstance(v, str) and not v.strip():
            return None
        return v


class KycRegistrationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_by_user_id: int
    created_at: datetime
    full_name: str
    date_of_birth: date
    national_id_passport: str
    nationality: str
    phone: str
    email: str | None
    physical_address: str
    miner_category: str
    mining_licence_no: str
    fgr_registration_no: str | None
    mmcz_registration_no: str | None
    primary_operating_province: str
    primary_mineral: str
    operating_as: str
    beneficial_owners_text: str | None
    pep_status: str
    high_risk_area: bool
    additional_risk_notes: str | None


# ── Miner KYC Portal Registration (3-step wizard) ────────────────────────────

class MinerRegistrationCreate(BaseModel):
    account_email: str | None = Field(None, max_length=255)

    # Step 1 — Personal details
    full_name: str = Field(..., min_length=2, max_length=200)
    national_id: str = Field(..., min_length=3, max_length=80)
    district: str = Field(..., min_length=2, max_length=80)
    years_of_operation: str = Field(..., min_length=1, max_length=50)
    education_level: str = Field(..., min_length=2, max_length=80)
    registration_type: str = Field(..., min_length=2, max_length=80)
    mining_reg_number: str = Field(..., min_length=3, max_length=120)

    # Step 2 — Beneficial owner
    owner_full_name: str = Field(..., min_length=2, max_length=200)
    owner_national_id: str = Field(..., min_length=3, max_length=80)
    owner_relationship: str = Field(..., min_length=2, max_length=80)
    owner_phone: str = Field(..., min_length=5, max_length=40)
    owner_email: str | None = Field(None, max_length=255)
    owner_address: str = Field(..., min_length=5)
    declaration_confirmed: bool

    # Document filenames recorded at upload time (actual bytes handled separately)
    national_id_doc: str | None = None
    registration_cert_doc: str | None = None
    proof_of_address_doc: str | None = None

    @field_validator("account_email", "owner_email", mode="before")
    @classmethod
    def blank_to_none(cls, v: object) -> object:
        if isinstance(v, str) and not v.strip():
            return None
        return v


class MinerRegistrationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    reg_number: str
    account_email: str | None
    created_at: datetime
    full_name: str
    national_id: str
    district: str
    years_of_operation: str
    education_level: str
    registration_type: str
    mining_reg_number: str
    owner_full_name: str
    owner_national_id: str
    owner_relationship: str
    owner_phone: str
    owner_email: str | None
    owner_address: str
    declaration_confirmed: bool
    kyc_status: str
    score: int
    risk: str
    national_id_doc: str | None
    registration_cert_doc: str | None
    proof_of_address_doc: str | None


class KycStatusUpdate(BaseModel):
    kyc_status: Literal["Pending", "Verified", "Flagged", "Rejected"]
    score: int | None = Field(None, ge=0, le=100)


# ── Customer (Gold Buyer) Management ──────────────────────────────────────────

class CustomerCreate(BaseModel):
    miner_reg_number: str | None = Field(None, max_length=60)
    # Identity
    full_name: str = Field(..., min_length=2, max_length=200)
    national_id: str = Field(..., min_length=3, max_length=80)
    date_of_birth: date | None = None
    nationality: str | None = Field(None, max_length=80)
    district: str | None = Field(None, max_length=80)
    id_document_type: str | None = Field(None, max_length=60)
    # Contact
    phone_number: str | None = Field(None, max_length=40)
    email: str | None = Field(None, max_length=255)
    physical_address: str | None = None
    # Financial
    occupation: str | None = Field(None, max_length=120)
    employer: str | None = Field(None, max_length=200)
    place_of_work: str | None = Field(None, max_length=200)
    source_of_funds: str | None = Field(None, max_length=200)
    source_of_wealth: str | None = Field(None, max_length=200)
    has_payslip: bool = False
    payslip_ref: str | None = Field(None, max_length=255)
    purpose_of_purchase: str | None = Field(None, max_length=200)
    transaction_frequency: str | None = Field(None, max_length=50)
    proof_of_residence_ref: str | None = Field(None, max_length=255)
    financial_statements_ref: str | None = Field(None, max_length=255)
    # Risk
    politically_exposed: bool = False
    pep_details: str | None = None
    pep_position: str | None = Field(None, max_length=200)
    pep_organization: str | None = Field(None, max_length=200)
    pep_since: date | None = None
    pep_relationship: str | None = Field(None, max_length=120)
    pep_source_of_wealth_explained: bool = False
    known_sanctions: bool = False
    sanctions_details: str | None = None
    is_minor: bool = False
    guardian_full_name: str | None = Field(None, max_length=200)
    guardian_national_id: str | None = Field(None, max_length=80)
    guardian_phone: str | None = Field(None, max_length=40)

    @field_validator(
        "nationality", "district", "id_document_type", "phone_number", "email",
        "physical_address", "occupation", "employer", "place_of_work",
        "source_of_funds", "source_of_wealth", "payslip_ref", "purpose_of_purchase",
        "transaction_frequency", "proof_of_residence_ref", "financial_statements_ref",
        "pep_details", "pep_position", "pep_organization", "pep_relationship",
        "guardian_full_name", "guardian_national_id", "guardian_phone", "sanctions_details",
        mode="before",
    )
    @classmethod
    def blank_to_none(cls, v: object) -> object:
        if isinstance(v, str) and not v.strip():
            return None
        return v


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
    miner_reg_number: str | None
    customer_number: str | None
    # Identity
    full_name: str
    national_id: str
    date_of_birth: date | None
    nationality: str | None
    district: str | None
    id_document_type: str | None
    # Contact
    phone_number: str | None
    email: str | None
    physical_address: str | None
    # Financial
    occupation: str | None
    employer: str | None
    place_of_work: str | None
    source_of_funds: str | None
    source_of_wealth: str | None
    has_payslip: bool
    payslip_ref: str | None
    purpose_of_purchase: str | None
    transaction_frequency: str | None
    proof_of_residence_ref: str | None
    financial_statements_ref: str | None
    # Risk
    politically_exposed: bool
    pep_details: str | None
    pep_position: str | None
    pep_organization: str | None
    pep_since: date | None
    pep_relationship: str | None
    pep_source_of_wealth_explained: bool
    known_sanctions: bool
    sanctions_details: str | None
    is_minor: bool
    guardian_full_name: str | None
    guardian_national_id: str | None
    guardian_phone: str | None
    risk_level: str
    is_flagged: bool
    flag_reason: str | None
    first_seen: date | None
    last_transaction: date | None
    total_transactions: int
    total_value_usd: float


class CustomerUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=200)
    date_of_birth: date | None = None
    nationality: str | None = Field(None, max_length=80)
    district: str | None = Field(None, max_length=80)
    id_document_type: str | None = Field(None, max_length=60)
    phone_number: str | None = Field(None, max_length=40)
    email: str | None = Field(None, max_length=255)
    physical_address: str | None = None
    occupation: str | None = Field(None, max_length=120)
    employer: str | None = Field(None, max_length=200)
    place_of_work: str | None = Field(None, max_length=200)
    source_of_funds: str | None = Field(None, max_length=200)
    source_of_wealth: str | None = Field(None, max_length=200)
    has_payslip: bool | None = None
    payslip_ref: str | None = Field(None, max_length=255)
    purpose_of_purchase: str | None = Field(None, max_length=200)
    transaction_frequency: str | None = Field(None, max_length=50)
    proof_of_residence_ref: str | None = Field(None, max_length=255)
    financial_statements_ref: str | None = Field(None, max_length=255)
    politically_exposed: bool | None = None
    pep_details: str | None = None
    pep_position: str | None = Field(None, max_length=200)
    pep_organization: str | None = Field(None, max_length=200)
    pep_since: date | None = None
    pep_relationship: str | None = Field(None, max_length=120)
    pep_source_of_wealth_explained: bool | None = None
    known_sanctions: bool | None = None
    sanctions_details: str | None = None
    is_minor: bool | None = None
    guardian_full_name: str | None = Field(None, max_length=200)
    guardian_national_id: str | None = Field(None, max_length=80)
    guardian_phone: str | None = Field(None, max_length=40)

    @field_validator(
        "nationality", "district", "id_document_type", "phone_number", "email",
        "physical_address", "occupation", "employer", "place_of_work",
        "source_of_funds", "source_of_wealth", "payslip_ref", "purpose_of_purchase",
        "transaction_frequency", "proof_of_residence_ref", "financial_statements_ref",
        "pep_details", "pep_position", "pep_organization", "pep_relationship",
        "guardian_full_name", "guardian_national_id", "guardian_phone", "sanctions_details",
        mode="before",
    )
    @classmethod
    def blank_to_none(cls, v: object) -> object:
        if isinstance(v, str) and not v.strip():
            return None
        return v


class CustomerAdminRow(BaseModel):
    """CustomerOut enriched with linked miner info for the admin overview."""

    id: int
    created_at: datetime
    updated_at: datetime
    miner_reg_number: str | None
    customer_number: str | None
    # Identity
    full_name: str
    national_id: str
    date_of_birth: date | None
    nationality: str | None
    district: str | None
    id_document_type: str | None
    # Contact
    phone_number: str | None
    email: str | None
    physical_address: str | None
    # Financial
    occupation: str | None
    employer: str | None
    place_of_work: str | None
    source_of_funds: str | None
    source_of_wealth: str | None
    has_payslip: bool
    payslip_ref: str | None
    purpose_of_purchase: str | None
    transaction_frequency: str | None
    proof_of_residence_ref: str | None
    financial_statements_ref: str | None
    # Risk
    politically_exposed: bool
    pep_details: str | None
    pep_position: str | None
    pep_organization: str | None
    pep_since: date | None
    pep_relationship: str | None
    pep_source_of_wealth_explained: bool
    known_sanctions: bool
    sanctions_details: str | None
    is_minor: bool
    guardian_full_name: str | None
    guardian_national_id: str | None
    guardian_phone: str | None
    risk_level: str
    is_flagged: bool
    flag_reason: str | None
    first_seen: date | None
    last_transaction: date | None
    total_transactions: int
    total_value_usd: float
    # Joined miner info
    miner_full_name: str | None = None
    miner_district: str | None = None


class CustomerProfileTransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    transaction_date: date
    gold_weight_grams: float
    sale_amount_usd: float
    buying_centre: str
    buyer_name: str
    payment_method: str
    buyer_verified: bool
    cdd_completed: bool
    is_flagged: bool
    flag_reason: str | None
    miner_reg_number: str | None


class CustomerProfileOut(BaseModel):
    customer: CustomerOut
    miner_full_name: str | None = None
    miner_district: str | None = None
    transaction_count: int
    total_spend_usd: float
    average_spend_usd: float
    average_gold_weight_grams: float
    largest_transaction_usd: float
    last_90d_transaction_count: int
    last_90d_spend_usd: float
    transactions: list[CustomerProfileTransactionOut]


class StrReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
    reference: str
    customer_id: int
    customer_number: str | None
    customer_name: str
    customer_national_id: str
    reason: str
    note: str | None
    status: str
    filed_by: str
    reviewed_by: str | None
    reviewed_at: datetime | None


class StrReportStatusUpdate(BaseModel):
    status: Literal["Submitted", "Under Review", "Escalated", "Closed"]
    reviewed_by: str | None = Field(None, max_length=120)


# ── Gold Sale Transactions ─────────────────────────────────────────────────────

class GoldTransactionCreate(BaseModel):
    transaction_date: date
    gold_weight_grams: float = Field(..., gt=0, description="Weight in grams")
    sale_amount_usd: float = Field(..., gt=0, description="Total sale amount in USD")
    buying_centre: str = Field(..., min_length=2, max_length=200)
    buyer_name: str = Field(..., min_length=2, max_length=200)
    payment_method: Literal["cash", "bank", "mobile"]
    buyer_verified: bool
    cdd_completed: bool
    miner_reg_number: str | None = None  # from miner's KYC registration
    # Customer link (optional for backwards compatibility)
    customer_id: int | None = None
    customer_name: str | None = None
    customer_id_verified: bool = False
    customer_id_number: str | None = None


class GoldTransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    transaction_date: date
    gold_weight_grams: float
    sale_amount_usd: float
    buying_centre: str
    buyer_name: str
    payment_method: str
    buyer_verified: bool
    cdd_completed: bool
    miner_reg_number: str | None
    customer_id: int | None
    customer_name: str | None
    customer_id_verified: bool
    customer_id_number: str | None
    is_flagged: bool
    flag_reason: str | None


class TransactionStats(BaseModel):
    total_transactions: int
    total_value_usd: float
    flagged_count: int
    cdd_incomplete_count: int
