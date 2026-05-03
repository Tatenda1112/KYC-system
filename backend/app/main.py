from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from pathlib import Path

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.routers import admin, analytics, audit, auth, compliance, customers, kyc, miners, questions, reports, surveys, transactions
from app.seed import seed_default_admin, seed_questions


def run_startup_migrations() -> None:
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    statements: list[str] = []

    if "users" in tables:
        existing_user_columns = {column["name"] for column in inspector.get_columns("users")}

        if "role" not in existing_user_columns:
            statements.append("ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'miner'")
        if "district" not in existing_user_columns:
            statements.append("ALTER TABLE users ADD COLUMN district VARCHAR(120)")
        if "must_change_password" not in existing_user_columns:
            statements.append("ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 1")

    if "miner_registrations" in tables:
        existing_registration_columns = {
            column["name"] for column in inspector.get_columns("miner_registrations")
        }
        if "account_email" not in existing_registration_columns:
            statements.append("ALTER TABLE miner_registrations ADD COLUMN account_email VARCHAR(255)")

    if "customers" in tables:
        existing_customer_columns = {
            column["name"] for column in inspector.get_columns("customers")
        }
        if "customer_number" not in existing_customer_columns:
            statements.append("ALTER TABLE customers ADD COLUMN customer_number VARCHAR(60)")
        if "district" not in existing_customer_columns:
            statements.append("ALTER TABLE customers ADD COLUMN district VARCHAR(80)")
        if "id_document_type" not in existing_customer_columns:
            statements.append("ALTER TABLE customers ADD COLUMN id_document_type VARCHAR(60)")
        if "employer" not in existing_customer_columns:
            statements.append("ALTER TABLE customers ADD COLUMN employer VARCHAR(200)")
        if "place_of_work" not in existing_customer_columns:
            statements.append("ALTER TABLE customers ADD COLUMN place_of_work VARCHAR(200)")
        if "source_of_wealth" not in existing_customer_columns:
            statements.append("ALTER TABLE customers ADD COLUMN source_of_wealth VARCHAR(200)")
        if "has_payslip" not in existing_customer_columns:
            statements.append("ALTER TABLE customers ADD COLUMN has_payslip BOOLEAN DEFAULT 0")
        if "payslip_ref" not in existing_customer_columns:
            statements.append("ALTER TABLE customers ADD COLUMN payslip_ref VARCHAR(255)")
        if "proof_of_residence_ref" not in existing_customer_columns:
            statements.append("ALTER TABLE customers ADD COLUMN proof_of_residence_ref VARCHAR(255)")
        if "financial_statements_ref" not in existing_customer_columns:
            statements.append("ALTER TABLE customers ADD COLUMN financial_statements_ref VARCHAR(255)")
        if "date_of_birth" not in existing_customer_columns:
            statements.append("ALTER TABLE customers ADD COLUMN date_of_birth DATE")
        if "nationality" not in existing_customer_columns:
            statements.append("ALTER TABLE customers ADD COLUMN nationality VARCHAR(80)")
        if "transaction_frequency" not in existing_customer_columns:
            statements.append("ALTER TABLE customers ADD COLUMN transaction_frequency VARCHAR(50)")
        if "known_sanctions" not in existing_customer_columns:
            statements.append(
                "ALTER TABLE customers ADD COLUMN known_sanctions BOOLEAN DEFAULT 0"
            )
        if "sanctions_details" not in existing_customer_columns:
            statements.append("ALTER TABLE customers ADD COLUMN sanctions_details TEXT")
        if "pep_position" not in existing_customer_columns:
            statements.append("ALTER TABLE customers ADD COLUMN pep_position VARCHAR(200)")
        if "pep_organization" not in existing_customer_columns:
            statements.append("ALTER TABLE customers ADD COLUMN pep_organization VARCHAR(200)")
        if "pep_since" not in existing_customer_columns:
            statements.append("ALTER TABLE customers ADD COLUMN pep_since DATE")
        if "pep_relationship" not in existing_customer_columns:
            statements.append("ALTER TABLE customers ADD COLUMN pep_relationship VARCHAR(120)")
        if "pep_source_of_wealth_explained" not in existing_customer_columns:
            statements.append("ALTER TABLE customers ADD COLUMN pep_source_of_wealth_explained BOOLEAN DEFAULT 0")
        if "is_minor" not in existing_customer_columns:
            statements.append("ALTER TABLE customers ADD COLUMN is_minor BOOLEAN DEFAULT 0")
        if "guardian_full_name" not in existing_customer_columns:
            statements.append("ALTER TABLE customers ADD COLUMN guardian_full_name VARCHAR(200)")
        if "guardian_national_id" not in existing_customer_columns:
            statements.append("ALTER TABLE customers ADD COLUMN guardian_national_id VARCHAR(80)")
        if "guardian_phone" not in existing_customer_columns:
            statements.append("ALTER TABLE customers ADD COLUMN guardian_phone VARCHAR(40)")

    if "gold_transactions" in tables:
        existing_txn_columns = {
            column["name"] for column in inspector.get_columns("gold_transactions")
        }
        if "customer_id" not in existing_txn_columns:
            statements.append("ALTER TABLE gold_transactions ADD COLUMN customer_id INTEGER")
        if "customer_name" not in existing_txn_columns:
            statements.append("ALTER TABLE gold_transactions ADD COLUMN customer_name VARCHAR(200)")
        if "customer_id_verified" not in existing_txn_columns:
            statements.append(
                "ALTER TABLE gold_transactions ADD COLUMN customer_id_verified BOOLEAN DEFAULT 0"
            )
        if "customer_id_number" not in existing_txn_columns:
            statements.append("ALTER TABLE gold_transactions ADD COLUMN customer_id_number VARCHAR(80)")

    if not statements:
        return

    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))
        if "miner_registrations" in tables:
            conn.execute(
                text(
                    """
                    UPDATE miner_registrations
                    SET account_email = lower(owner_email)
                    WHERE account_email IS NULL
                      AND owner_email IS NOT NULL
                      AND trim(owner_email) <> ''
                    """
                )
            )


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    run_startup_migrations()
    Path(settings.uploads_dir).mkdir(parents=True, exist_ok=True)
    db = SessionLocal()
    try:
        seed_questions(db)
        seed_default_admin(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="SSM CDD/KYC Research API",
    description="Data collection for assessing CDD/KYC implementation among registered small-scale miners (Zimbabwe PMPS sector).",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router)
app.include_router(auth.router)
app.include_router(kyc.router)
app.include_router(questions.router)
app.include_router(miners.router)
app.include_router(surveys.router)
app.include_router(analytics.router)
app.include_router(transactions.router)
app.include_router(customers.router)
app.include_router(compliance.router)
app.include_router(reports.router)
app.include_router(audit.router)


@app.get("/health")
def health():
    return {"status": "ok"}
