from __future__ import annotations

import json
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import ConflictReport, ExtractedPropertyData, LandParcel, PropertyMatch


def parcel_to_geojson_row(db: Session, parcel_id: int) -> dict[str, Any] | None:
    row = db.execute(
        text(
            """
            SELECT id, khasra_no, owner_name, village, district, area, risk_hint,
                   ST_AsGeoJSON(geom) AS geojson
            FROM land_parcels
            WHERE id = :parcel_id
            """
        ),
        {"parcel_id": parcel_id},
    ).mappings().first()
    if not row:
        return None
    return {
        "id": row["id"],
        "khasra_no": row["khasra_no"],
        "owner_name": row["owner_name"],
        "village": row["village"],
        "district": row["district"],
        "area": row["area"],
        "risk_hint": row["risk_hint"],
        "geojson": json.loads(row["geojson"]) if row["geojson"] else None,
    }


def find_best_match(db: Session, extracted: ExtractedPropertyData) -> PropertyMatch | None:
    conditions: list[str] = []
    params: dict[str, Any] = {}
    if extracted.khasra_no:
        conditions.append("khasra_no = :khasra_no")
        params["khasra_no"] = extracted.khasra_no
    if extracted.village:
        conditions.append("village ILIKE :village")
        params["village"] = f"%{extracted.village}%"
    if not conditions:
        return None

    order_by = "id"
    if extracted.khasra_no:
        order_by = "CASE WHEN khasra_no = :khasra_no THEN 0 ELSE 1 END, id"

    parcel = db.execute(
        text(
            f"""
            SELECT id, khasra_no, owner_name, village, district, area
            FROM land_parcels
            WHERE {" OR ".join(conditions)}
            ORDER BY {order_by}
            LIMIT 1
            """
        ),
        params,
    ).mappings().first()
    if not parcel:
        return None

    score = 60.0
    reasons = []
    if extracted.khasra_no and extracted.khasra_no == parcel["khasra_no"]:
        score += 25
        reasons.append("Khasra number matched")
    if extracted.village and extracted.village.lower() in parcel["village"].lower():
        score += 10
        reasons.append("Village matched")
    if extracted.owner_name and extracted.owner_name.lower() in parcel["owner_name"].lower():
        score += 5
        reasons.append("Owner name matched")

    match = PropertyMatch(
        property_data_id=extracted.id,
        parcel_id=parcel["id"],
        match_score=min(score, 99),
        match_reason=", ".join(reasons) or "Fuzzy parcel match based on location metadata",
    )
    db.add(match)
    db.commit()
    db.refresh(match)
    return match


def detect_conflicts(db: Session, extracted: ExtractedPropertyData, match: PropertyMatch | None) -> list[ConflictReport]:
    conflicts: list[ConflictReport] = []
    if not match:
        conflict = ConflictReport(
            property_data_id=extracted.id,
            parcel_id=None,
            conflict_type="missing_match",
            severity="high",
            details="No parcel could be matched from uploaded property metadata.",
            conflict_metadata={"signal": "No matching parcel found"},
        )
        db.add(conflict)
        db.commit()
        db.refresh(conflict)
        return [conflict]

    parcel = db.get(LandParcel, match.parcel_id)
    if extracted.owner_name and parcel and extracted.owner_name.lower() != parcel.owner_name.lower():
        conflicts.append(
            ConflictReport(
                property_data_id=extracted.id,
                parcel_id=parcel.id,
                conflict_type="ownership_mismatch",
                severity="high",
                details=f"Document owner '{extracted.owner_name}' differs from parcel owner '{parcel.owner_name}'.",
                conflict_metadata={"document_owner": extracted.owner_name, "parcel_owner": parcel.owner_name},
            )
        )

    if extracted.area and parcel:
        diff = abs(extracted.area - parcel.area)
        if diff > 0.2:
            conflicts.append(
                ConflictReport(
                    property_data_id=extracted.id,
                    parcel_id=parcel.id,
                    conflict_type="area_difference",
                    severity="medium",
                    details=f"Area differs by {diff:.2f} acres/hectares from the mapped parcel.",
                    conflict_metadata={"area_difference": diff},
                )
            )

    duplicate_rows = db.execute(
        text(
            """
            SELECT COUNT(*) AS duplicate_count
            FROM land_parcels
            WHERE khasra_no = :khasra_no AND district = :district
            """
        ),
        {"khasra_no": extracted.khasra_no, "district": extracted.district},
    ).mappings().first()
    if duplicate_rows and duplicate_rows["duplicate_count"] > 1:
        conflicts.append(
            ConflictReport(
                property_data_id=extracted.id,
                parcel_id=match.parcel_id,
                conflict_type="duplicate_khasra",
                severity="medium",
                details="Duplicate khasra numbers exist in the district records.",
                conflict_metadata={"duplicate_count": duplicate_rows["duplicate_count"]},
            )
        )

    overlap_rows = db.execute(
        text(
            """
            SELECT COUNT(*) AS overlap_count
            FROM land_parcels lp1
            JOIN land_parcels lp2 ON lp1.id <> lp2.id
            WHERE lp1.id = :parcel_id
              AND ST_Intersects(lp1.geom, lp2.geom)
            """
        ),
        {"parcel_id": match.parcel_id},
    ).mappings().first()
    if overlap_rows and overlap_rows["overlap_count"] > 0:
        conflicts.append(
            ConflictReport(
                property_data_id=extracted.id,
                parcel_id=match.parcel_id,
                conflict_type="boundary_intersection",
                severity="high",
                details="The matched parcel intersects nearby parcel boundaries.",
                conflict_metadata={"overlap_count": overlap_rows["overlap_count"]},
            )
        )

    if not conflicts:
        conflicts.append(
            ConflictReport(
                property_data_id=extracted.id,
                parcel_id=match.parcel_id,
                conflict_type="clean_record",
                severity="low",
                details="No material ownership or geometry conflicts detected.",
                conflict_metadata={"status": "clear"},
            )
        )

    for conflict in conflicts:
        db.add(conflict)
    db.commit()
    for conflict in conflicts:
        db.refresh(conflict)
    return conflicts


def conversational_gis_context(db: Session, extracted: ExtractedPropertyData | None, limit: int = 5) -> list[dict[str, Any]]:
    if extracted and extracted.khasra_no:
        rows = db.execute(
            text(
                """
                SELECT id, khasra_no, owner_name, village, district, area, risk_hint
                FROM land_parcels
                WHERE khasra_no = :khasra_no OR village = :village
                ORDER BY id
                LIMIT :limit
                """
            ),
            {"khasra_no": extracted.khasra_no, "village": extracted.village, "limit": limit},
        ).mappings().all()
    else:
        rows = db.execute(
            text(
                """
                SELECT id, khasra_no, owner_name, village, district, area, risk_hint
                FROM land_parcels
                ORDER BY id
                LIMIT :limit
                """
            ),
            {"limit": limit},
        ).mappings().all()
    return [dict(row) for row in rows]
