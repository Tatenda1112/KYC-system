from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth_utils import decode_token
from app.config import settings
from app.database import get_db
from app.models import User

security_bearer = HTTPBearer()


def verify_researcher_token(x_api_secret: str | None = Header(default=None, alias="X-API-Secret")) -> None:
    if not x_api_secret or x_api_secret != settings.api_secret:
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Secret")


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(security_bearer),
    db: Session = Depends(get_db),
) -> User:
    try:
        uid = decode_token(creds.credentials)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.get(User, uid)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user
