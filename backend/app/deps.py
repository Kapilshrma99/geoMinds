from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.models import ExtractedPropertyData, UploadedDocument, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError as exc:
        raise credentials_exception from exc

    user = db.get(User, int(user_id))
    if not user:
        raise credentials_exception
    return user


def require_roles(*roles: str):
    def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user

    return checker


def can_access_user_document(current_user: User, document: UploadedDocument | None) -> bool:
    if document is None:
        return False
    if current_user.role == "admin":
        return True
    return document.user_id == current_user.id


def can_access_property_data(current_user: User, property_data: ExtractedPropertyData | None, db: Session) -> bool:
    if property_data is None:
        return False
    document = db.get(UploadedDocument, property_data.document_id)
    return can_access_user_document(current_user, document)


def require_document_access(current_user: User, document: UploadedDocument | None) -> UploadedDocument:
    if not can_access_user_document(current_user, document):
        raise HTTPException(status_code=404, detail="Document not found")
    return document


def require_property_access(
    current_user: User,
    property_data: ExtractedPropertyData | None,
    db: Session,
) -> ExtractedPropertyData:
    if not can_access_property_data(current_user, property_data, db):
        raise HTTPException(status_code=404, detail="Property not found")
    return property_data
