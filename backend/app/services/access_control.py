from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy.orm import Session

from app.models import PageAccessRule, User

PAGE_DEFINITIONS = [
    {"key": "dashboard", "label": "Dashboard"},
    {"key": "upload", "label": "Upload & Analyze"},
    {"key": "map", "label": "Map Intelligence"},
    {"key": "chat", "label": "Evidence Chat"},
    {"key": "reports", "label": "Reports"},
    {"key": "property-detail", "label": "Property Detail"},
    {"key": "admin", "label": "Admin"},
]

ROLE_ORDER = ["user", "analyst", "admin"]

DEFAULT_PAGE_ACCESS: dict[str, set[str]] = {
    "dashboard": {"user", "analyst", "admin"},
    "upload": {"user", "analyst", "admin"},
    "map": {"analyst", "admin"},
    "chat": {"user", "analyst", "admin"},
    "reports": {"analyst", "admin"},
    "property-detail": {"user", "analyst", "admin"},
    "admin": {"admin"},
}


def page_labels() -> list[dict[str, str]]:
    return PAGE_DEFINITIONS


def ensure_page_access_rules(db: Session) -> None:
    existing = {
        (row.page_key, row.role)
        for row in db.query(PageAccessRule.page_key, PageAccessRule.role).all()
    }
    created = False
    for page_key, roles in DEFAULT_PAGE_ACCESS.items():
        for role in ROLE_ORDER:
            key = (page_key, role)
            if key in existing:
                continue
            db.add(PageAccessRule(page_key=page_key, role=role, can_view=role in roles))
            created = True
    if created:
        db.commit()


def _default_visible_pages_for_role(role: str) -> set[str]:
    return {page_key for page_key, roles in DEFAULT_PAGE_ACCESS.items() if role in roles}


def resolve_visible_pages(db: Session, user: User) -> list[str]:
    allowed = _default_visible_pages_for_role(user.role)
    rows = db.query(PageAccessRule).filter(PageAccessRule.role == user.role).all()
    if rows:
        allowed = {row.page_key for row in rows if row.can_view}
    return [item["key"] for item in PAGE_DEFINITIONS if item["key"] in allowed]


def access_matrix(db: Session) -> list[dict[str, object]]:
    ensure_page_access_rules(db)
    rows = db.query(PageAccessRule).all()
    index = {(row.page_key, row.role): row.can_view for row in rows}
    matrix = []
    for page in PAGE_DEFINITIONS:
        page_row: dict[str, object] = {"page_key": page["key"], "label": page["label"]}
        for role in ROLE_ORDER:
            page_row[role] = index.get((page["key"], role), role in DEFAULT_PAGE_ACCESS.get(page["key"], set()))
        matrix.append(page_row)
    return matrix


def upsert_access_rules(db: Session, updates: Iterable[dict[str, object]]) -> list[dict[str, object]]:
    ensure_page_access_rules(db)
    for item in updates:
        page_key = str(item["page_key"])
        role = str(item["role"])
        can_view = bool(item["can_view"])
        row = db.query(PageAccessRule).filter(PageAccessRule.page_key == page_key, PageAccessRule.role == role).first()
        if row:
            row.can_view = can_view
        else:
            db.add(PageAccessRule(page_key=page_key, role=role, can_view=can_view))
    db.commit()
    return access_matrix(db)
