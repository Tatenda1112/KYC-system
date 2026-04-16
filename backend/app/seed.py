from sqlalchemy.orm import Session

from app.auth_utils import hash_password
from app.config import settings
from app.models import Question, QuestionSection, QuestionType, User


def seed_questions(db: Session) -> None:
    if db.query(Question).first():
        return

    rows: list[tuple[QuestionSection, str, str, QuestionType, int]] = [
        (
            QuestionSection.awareness,
            "A1",
            "I understand what Customer Due Diligence (CDD) means in the context of selling gold or precious minerals.",
            QuestionType.likert_5,
            1,
        ),
        (
            QuestionSection.awareness,
            "A2",
            "I am aware of national requirements to verify identity when transacting with buyers or agents.",
            QuestionType.likert_5,
            2,
        ),
        (
            QuestionSection.awareness,
            "A3",
            "I know where to find official guidance on KYC obligations for registered small-scale miners.",
            QuestionType.likert_5,
            3,
        ),
        (
            QuestionSection.awareness,
            "A4",
            "Training or information on AML/CDD has been provided to me or my association in the last two years.",
            QuestionType.yes_no,
            4,
        ),
        (
            QuestionSection.compliance,
            "C1",
            "My operation keeps records of gold sales and receipts in line with formal buying procedures.",
            QuestionType.likert_5,
            1,
        ),
        (
            QuestionSection.compliance,
            "C2",
            "Beneficial ownership and identity documentation are available when requested by an authorised buyer or regulator.",
            QuestionType.likert_5,
            2,
        ),
        (
            QuestionSection.compliance,
            "C3",
            "Transactions are mainly documented (not only cash with no paper trail).",
            QuestionType.likert_5,
            3,
        ),
        (
            QuestionSection.compliance,
            "C4",
            "I can describe the main steps my operation follows before delivering gold to a buying centre or agent.",
            QuestionType.text,
            4,
        ),
        (
            QuestionSection.barriers,
            "B1",
            "Distance to buying centres or agents makes consistent documentation difficult.",
            QuestionType.likert_5,
            1,
        ),
        (
            QuestionSection.barriers,
            "B2",
            "Institutional coordination between mining and financial supervisors is sufficient to support compliance.",
            QuestionType.likert_5,
            2,
        ),
        (
            QuestionSection.barriers,
            "B3",
            "Cost or time burden of compliance is a major obstacle for my operation.",
            QuestionType.likert_5,
            3,
        ),
        (
            QuestionSection.barriers,
            "B4",
            "Briefly describe the main institutional or practical barrier to CDD/KYC in your experience.",
            QuestionType.text,
            4,
        ),
    ]

    for section, code, text, qtype, order in rows:
        db.add(
            Question(
                section=section,
                code=code,
                text=text,
                question_type=qtype,
                display_order=order,
            )
        )
    db.commit()


def seed_default_admin(db: Session) -> None:
    # Always update or create admin user with correct credentials
    existing_user = db.query(User).filter(User.email == settings.default_admin_email.strip().lower()).first()
    if existing_user:
        # Update existing admin user password
        existing_user.hashed_password = hash_password(settings.default_admin_password)
        existing_user.is_active = True
        existing_user.role = "admin"
        existing_user.must_change_password = False
    else:
        # Create new admin user
        db.add(
            User(
                email=settings.default_admin_email.strip().lower(),
                full_name=settings.default_admin_name,
                role="admin",
                must_change_password=False,
                hashed_password=hash_password(settings.default_admin_password),
                is_active=True,
            )
        )
    db.commit()
