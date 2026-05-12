import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.deps import get_current_user
from app.models import ConflictReport, ExtractedPropertyData, LandParcel, PropertyMatch, User
from app.services.geoserver import geoserver_layer_urls, publish_layer_payload
from app.services.gis import parcel_to_geojson_row

router = APIRouter()


@router.get("/parcels")
def get_parcels(
    village: str | None = None,
    district: str | None = None,
    risk: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = """
        SELECT id, khasra_no, owner_name, village, district, area, risk_hint, ST_AsGeoJSON(geom) AS geojson
        FROM land_parcels
        WHERE (:village IS NULL OR village ILIKE :village)
          AND (:district IS NULL OR district ILIKE :district)
          AND (:risk IS NULL OR risk_hint = :risk)
        ORDER BY id
    """
    rows = db.execute(
        text(query),
        {
            "village": f"%{village}%" if village else None,
            "district": f"%{district}%" if district else None,
            "risk": risk,
        },
    ).mappings().all()
    return [
        {
            "id": row["id"],
            "khasra_no": row["khasra_no"],
            "owner_name": row["owner_name"],
            "village": row["village"],
            "district": row["district"],
            "area": row["area"],
            "risk_hint": row["risk_hint"],
            "geojson": json.loads(row["geojson"]) if row["geojson"] else None,
        }
        for row in rows
    ]


@router.get("/parcels/{parcel_id}")
def get_parcel(parcel_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    parcel = parcel_to_geojson_row(db, parcel_id)
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")
    return parcel


@router.get("/search")
def search_parcel(khasra: str = Query(""), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(LandParcel).filter(LandParcel.khasra_no.ilike(f"%{khasra}%")).limit(10).all()
    return [{"id": row.id, "khasra_no": row.khasra_no, "owner_name": row.owner_name, "village": row.village} for row in rows]


@router.post("/match-property")
def match_property(property_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    extracted = db.get(ExtractedPropertyData, property_id)
    if not extracted:
        raise HTTPException(status_code=404, detail="Property data not found")
    match = db.query(PropertyMatch).filter(PropertyMatch.property_data_id == extracted.id).order_by(PropertyMatch.id.desc()).first()
    return match


@router.get("/conflicts/{property_id}")
def get_conflicts(property_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(ConflictReport).filter(ConflictReport.property_data_id == property_id).all()


@router.get("/geoserver/publish")
def publish_geoserver_layer(current_user: User = Depends(get_current_user)):
    return publish_layer_payload()


@router.get("/geoserver/layers")
def geoserver_layers(current_user: User = Depends(get_current_user)):
    return geoserver_layer_urls()
