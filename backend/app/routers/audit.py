from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuditLog

router = APIRouter(prefix="/audit", tags=["audit"])

# How many entries to return per page
PAGE_SIZE = 50


@router.get("/logs")
def list_audit_logs(
    action: str | None = None,
    entity_type: str | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = 1,
    db: Session = Depends(get_db),
):
    """Paginated audit log with optional filters."""
    q = db.query(AuditLog)

    if action:
        q = q.filter(AuditLog.action == action)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if date_from:
        q = q.filter(AuditLog.created_at >= date_from)
    if date_to:
        # include the whole of date_to day
        from datetime import datetime, timedelta, timezone
        end = datetime.combine(date_to, datetime.max.time()).replace(tzinfo=timezone.utc) + timedelta(days=1)
        q = q.filter(AuditLog.created_at < end)
    if search:
        term = f"%{search}%"
        q = q.filter(
            AuditLog.entity_ref.ilike(term)
            | AuditLog.detail.ilike(term)
            | AuditLog.actor.ilike(term)
        )

    total = q.count()
    logs = (
        q.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "page_size": PAGE_SIZE,
        "items": [
            {
                "id": log.id,
                "created_at": log.created_at.isoformat(),
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_ref": log.entity_ref,
                "actor": log.actor,
                "detail": log.detail,
            }
            for log in logs
        ],
    }


@router.get("/stats")
def audit_stats(db: Session = Depends(get_db)):
    """Quick counts by action type for the audit page header."""
    from sqlalchemy import func as sqlfunc

    rows = (
        db.query(AuditLog.action, sqlfunc.count())
        .group_by(AuditLog.action)
        .all()
    )
    return {row[0]: int(row[1]) for row in rows}
