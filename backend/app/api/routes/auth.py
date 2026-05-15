from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.db.database import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas import Token, UserCreate, UserLogin, UserOut
from app.services.access_control import resolve_visible_pages

router = APIRouter()


def _user_out(db: Session, user: User) -> UserOut:
    return UserOut.model_validate(
        {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "visible_pages": resolve_visible_pages(db, user),
        }
    )


@router.post("/register", response_model=Token)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return Token(access_token=create_access_token(str(user.id)), user=_user_out(db, user))


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return Token(access_token=create_access_token(str(user.id)), user=_user_out(db, user))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _user_out(db, current_user)
