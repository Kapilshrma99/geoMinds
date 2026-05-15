import json
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from shapely.geometry import MultiPolygon, shape
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.deps import require_roles
from app.models import LandParcel, ReferenceLayer, User
from app.schemas import LayerImportResponse, PageAccessMatrixRow, PageAccessRuleUpdate, ReferenceLayerOut
from app.services.access_control import access_matrix, upsert_access_rules

router = APIRouter()


def _normalize_text(value, fallback: str | None = None) -> str | None:
    if value is None:
        return fallback
    text = str(value).strip()
    return text or fallback


def _normalize_float(value, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _normalize_record(raw: dict, default_district: str | None = None) -> dict:
    properties = raw.get("properties", raw)
    geometry = raw.get("geometry")
    khasra_no = _normalize_text(properties.get("khasra_no") or properties.get("khasra") or properties.get("survey_no"))
    owner_name = _normalize_text(properties.get("owner_name") or properties.get("owner") or properties.get("name"), "Unknown owner")
    village = _normalize_text(properties.get("village"), "Unknown village")
    district = _normalize_text(properties.get("district"), default_district or "Unknown district")
    if not khasra_no:
        raise HTTPException(status_code=400, detail="Each layer feature must include khasra_no, khasra, or survey_no.")

    geom_wkt = None
    if geometry:
        parsed_geometry = shape(geometry).buffer(0)
        if parsed_geometry.geom_type == "Polygon":
            parsed_geometry = MultiPolygon([parsed_geometry])
        geom_wkt = parsed_geometry.wkt

    return {
        "khasra_no": khasra_no,
        "owner_name": owner_name,
        "village": village,
        "district": district,
        "area": _normalize_float(properties.get("area")),
        "risk_hint": _normalize_text(properties.get("risk_hint") or properties.get("risk"), "low"),
        "geom_wkt": geom_wkt,
    }


def _load_layer_records(payload: bytes, default_district: str | None = None) -> list[dict]:
    try:
        parsed = json.loads(payload.decode("utf-8"))
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="Layer file must be UTF-8 encoded JSON or GeoJSON.") from exc
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Layer file must be valid JSON or GeoJSON.") from exc

    if isinstance(parsed, dict) and parsed.get("type") == "FeatureCollection":
        source = parsed.get("features", [])
    elif isinstance(parsed, list):
        source = parsed
    elif isinstance(parsed, dict) and isinstance(parsed.get("records"), list):
        source = parsed["records"]
    else:
        raise HTTPException(status_code=400, detail="Use a GeoJSON FeatureCollection or a JSON array of parcel records.")

    if not source:
        raise HTTPException(status_code=400, detail="Layer file does not contain any parcel records.")

    return [_normalize_record(item, default_district=default_district) for item in source]


@router.get("/layers", response_model=list[ReferenceLayerOut])
def list_reference_layers(
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    return db.query(ReferenceLayer).order_by(ReferenceLayer.created_at.desc()).all()


@router.post("/layers/import", response_model=LayerImportResponse)
async def import_layer(
    name: str = Form(...),
    description: str = Form(""),
    default_district: str = Form(""),
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    existing = db.query(ReferenceLayer).filter(ReferenceLayer.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="A reference layer with this name already exists.")

    upload_dir = Path(settings.upload_dir) / "layers"
    upload_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "layer.json").suffix or ".json"
    target = upload_dir / f"{uuid4().hex}{suffix}"
    payload = await file.read()
    target.write_bytes(payload)
    records = _load_layer_records(payload, default_district=default_district or None)

    layer = ReferenceLayer(
        name=name.strip(),
        description=description.strip() or None,
        source_filename=file.filename or target.name,
        uploaded_by=current_user.id,
        feature_count=len(records),
        is_active=True,
    )
    db.add(layer)
    db.flush()

    for record in records:
        db.add(
            LandParcel(
                khasra_no=record["khasra_no"],
                owner_name=record["owner_name"],
                village=record["village"],
                district=record["district"],
                area=record["area"],
                risk_hint=record["risk_hint"],
                geom=None if not record["geom_wkt"] else f"SRID=4326;{record['geom_wkt']}",
                layer_id=layer.id,
            )
        )

    db.commit()
    db.refresh(layer)
    return LayerImportResponse(layer=layer, imported_parcels=len(records), analyzed_against="Uploaded user documents will now be matched against this preloaded parcel dataset.")


@router.get("/access-rules", response_model=list[PageAccessMatrixRow])
def get_access_rules(
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    return access_matrix(db)


@router.put("/access-rules", response_model=list[PageAccessMatrixRow])
def update_access_rules(
    payload: list[PageAccessRuleUpdate],
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    return upsert_access_rules(db, [item.model_dump() for item in payload])
