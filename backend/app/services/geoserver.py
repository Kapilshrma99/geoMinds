from __future__ import annotations

from app.core.config import settings


def geoserver_layer_urls(layer_name: str = "geomind:land_parcels") -> dict[str, str]:
    return {
        "wms": f"{settings.geoserver_url}/ows?service=WMS&request=GetMap&layers={layer_name}",
        "wfs": f"{settings.geoserver_url}/ows?service=WFS&request=GetFeature&typeName={layer_name}&outputFormat=application/json",
    }


def publish_layer_payload(layer_name: str = "land_parcels") -> dict:
    return {
        "workspace": "geomind",
        "store": "geomind-postgis",
        "layer_name": layer_name,
        "status": "ready_for_publish",
        "urls": geoserver_layer_urls(f"geomind:{layer_name}"),
    }
