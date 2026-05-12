from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from pgvector.psycopg import register_vector

from app.core.config import settings

engine = create_engine(settings.database_url, future=True)


@event.listens_for(engine, "connect")
def connect(dbapi_connection, connection_record):
    register_vector(dbapi_connection)


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
