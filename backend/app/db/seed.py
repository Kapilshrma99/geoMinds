from sqlalchemy import text

from app.core.security import hash_password
from app.db.database import SessionLocal
from app.models import User


def ensure_seed_data() -> None:
    db = SessionLocal()
    try:
        if not db.query(User).first():
            db.add_all(
                [
                    User(name="Admin User", email="admin@geomind.ai", password_hash=hash_password("admin123"), role="admin"),
                    User(name="Asha Analyst", email="analyst@geomind.ai", password_hash=hash_password("analyst123"), role="analyst"),
                    User(name="Demo User", email="user@geomind.ai", password_hash=hash_password("user123"), role="user"),
                ]
            )
            db.commit()

        parcel_count = db.execute(text("SELECT COUNT(*) FROM land_parcels")).scalar_one()
        if parcel_count == 0:
            db.execute(
                text(
                    """
                    INSERT INTO land_parcels (khasra_no, owner_name, village, district, area, geom, risk_hint, created_at)
                    VALUES
                    ('245/2', 'Rohan Singh', 'Rampur', 'Lucknow', 4.50, ST_Multi(ST_GeomFromText('POLYGON((80.946 26.846, 80.950 26.846, 80.950 26.849, 80.946 26.849, 80.946 26.846))', 4326)), 'high', NOW()),
                    ('245/2', 'Shivam Gupta', 'Rampur', 'Lucknow', 4.70, ST_Multi(ST_GeomFromText('POLYGON((80.949 26.847, 80.953 26.847, 80.953 26.850, 80.949 26.850, 80.949 26.847))', 4326)), 'high', NOW()),
                    ('118/A', 'Nisha Verma', 'Haripur', 'Kanpur', 2.10, ST_Multi(ST_GeomFromText('POLYGON((80.310 26.470, 80.313 26.470, 80.313 26.473, 80.310 26.473, 80.310 26.470))', 4326)), 'low', NOW()),
                    ('310/7', 'Arjun Patel', 'Haripur', 'Kanpur', 3.20, ST_Multi(ST_GeomFromText('POLYGON((80.314 26.470, 80.318 26.470, 80.318 26.474, 80.314 26.474, 80.314 26.470))', 4326)), 'medium', NOW()),
                    ('501/C', 'Fatima Khan', 'Madhopur', 'Noida', 1.90, ST_Multi(ST_GeomFromText('POLYGON((77.390 28.535, 77.394 28.535, 77.394 28.539, 77.390 28.539, 77.390 28.535))', 4326)), 'low', NOW())
                    """
                )
            )
            db.commit()
    finally:
        db.close()
