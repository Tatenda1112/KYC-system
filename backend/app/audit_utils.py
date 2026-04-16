"""Utility for writing audit log entries from any router."""

from sqlalchemy.orm import Session

from app.models import AuditLog


def log_event(
    db: Session,
    *,
    action: str,
    entity_type: str,
    entity_ref: str,
    detail: str,
    actor: str = "system",
) -> None:
    """Append one immutable audit entry.  Called inside an already-open transaction;
    the caller is responsible for committing."""
    entry = AuditLog(
        action=action,
        entity_type=entity_type,
        entity_ref=entity_ref,
        actor=actor,
        detail=detail,
    )
    db.add(entry)
