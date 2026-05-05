from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_SQLITE_PATH = BACKEND_DIR / "ssm_cdd_kyc.db"
DEFAULT_DATABASE_URL = f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}"
DEFAULT_UPLOADS_DIR = BACKEND_DIR / "uploads"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = DEFAULT_DATABASE_URL
    uploads_dir: str = str(DEFAULT_UPLOADS_DIR)
    api_secret: str = "change-me-in-production"  # override with env API_SECRET

    jwt_secret_key: str = "change-jwt-secret-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 480
    default_admin_email: str = "nyashaadmin1112@gmail.com"
    default_admin_password: str = "Nyashamukono1112@"
    default_admin_name: str = "Nyasha"


settings = Settings()

