from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.router import api_router
from app.core.config import settings
from app.db.database import Base, engine
from app.db.seed import ensure_seed_data
from app.db.database import SessionLocal
from app.services.access_control import ensure_page_access_rules

app = FastAPI(
    title="GeoMind AI",
    version="0.1.0",
    description="AI-powered land intelligence and GIS conflict detection platform.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE conflict_reports ALTER COLUMN parcel_id DROP NOT NULL"))
        connection.execute(text("ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS layer_id INTEGER"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_land_parcels_layer_id ON land_parcels (layer_id)"))
        connection.execute(
            text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint
                        WHERE conname = 'fk_land_parcels_layer_id'
                    ) THEN
                        ALTER TABLE land_parcels
                        ADD CONSTRAINT fk_land_parcels_layer_id
                        FOREIGN KEY (layer_id) REFERENCES reference_layers (id);
                    END IF;
                END $$;
                """
            )
        )
    ensure_seed_data()
    db = SessionLocal()
    try:
        ensure_page_access_rules(db)
    finally:
        db.close()


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api_router)
