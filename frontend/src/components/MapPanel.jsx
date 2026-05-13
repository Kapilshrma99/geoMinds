import "leaflet/dist/leaflet.css";

import { motion } from "framer-motion";
import { Layers, LocateFixed, Radar } from "lucide-react";
import { useEffect, useMemo } from "react";
import { CircleMarker, LayersControl, MapContainer, Polygon, Popup, TileLayer, Tooltip, WMSTileLayer, useMap } from "react-leaflet";

function toLeafletPolygon(geojson) {
  if (!geojson?.coordinates?.length) return [];
  return geojson.coordinates[0][0].map(([lng, lat]) => [lat, lng]);
}

function riskColor(risk) {
  if (String(risk).toLowerCase() === "high") return "#ff6f7d";
  if (String(risk).toLowerCase() === "medium") return "#ffbf69";
  return "#67f7c4";
}

function getBoundsForParcels(parcels) {
  const points = parcels.flatMap((parcel) => toLeafletPolygon(parcel.geojson));
  if (!points.length) return null;
  let minLat = points[0][0];
  let maxLat = points[0][0];
  let minLng = points[0][1];
  let maxLng = points[0][1];
  for (const [lat, lng] of points) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

function normalizeWmsUrl(url) {
  if (!url) return null;
  return url.split("?")[0];
}

function ParcelViewport({ parcels, selectedParcel }) {
  const map = useMap();

  useEffect(() => {
    const focusParcels = selectedParcel ? [selectedParcel] : parcels.slice(0, Math.min(parcels.length, 8));
    const bounds = getBoundsForParcels(focusParcels);
    if (bounds) {
      map.flyToBounds(bounds, { padding: [48, 48], duration: 1.4 });
    }
  }, [map, parcels, selectedParcel]);

  return null;
}

export function MapPanel({
  parcels = [],
  selectedParcelId = null,
  height = "520px",
  geoserverLayerUrl = null,
  showGeoServerLayer = true,
}) {
  const selectedParcel = parcels.find((parcel) => String(parcel.id) === String(selectedParcelId)) || null;
  const nearbyParcels = useMemo(() => (selectedParcel ? parcels.filter((parcel) => parcel.id !== selectedParcel.id).slice(0, 4) : parcels.slice(0, 4)), [parcels, selectedParcel]);

  return (
    <div className="relative overflow-hidden rounded-[1.8rem] border border-white/10">
      <div className="pointer-events-none absolute inset-0 z-[401] bg-topo opacity-50" />
      <div className="pointer-events-none absolute left-4 top-4 z-[402] rounded-2xl border border-white/10 bg-black/45 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.34em] text-mint">
          <Radar size={12} />
          GeoMind Parcel Theatre
        </div>
        <div className="mt-2 text-sm text-slate-200">
          {selectedParcel ? `Tracking khasra ${selectedParcel.khasra_no}` : `${parcels.length} parcels in live intelligence view`}
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pointer-events-none absolute bottom-4 left-4 z-[402] flex flex-wrap gap-2">
        {[
          ["Low", "#67f7c4"],
          ["Medium", "#ffbf69"],
          ["High", "#ff6f7d"],
        ].map(([label, color]) => (
          <div key={label} className="rounded-full border border-white/10 bg-black/45 px-3 py-2 text-xs text-slate-100 backdrop-blur">
            <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            {label}
          </div>
        ))}
      </motion.div>

      <div className="pointer-events-none absolute bottom-4 right-4 z-[402] hidden max-w-xs rounded-[1.5rem] border border-white/10 bg-black/45 p-4 backdrop-blur lg:block">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-fog">
          <LocateFixed size={12} />
          Nearby Context
        </div>
        <div className="mt-3 space-y-2 text-sm text-slate-200">
          {nearbyParcels.map((parcel) => (
            <div key={parcel.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <span>{parcel.khasra_no}</span>
              <span style={{ color: riskColor(parcel.risk_hint) }}>{parcel.risk_hint}</span>
            </div>
          ))}
        </div>
      </div>

      <MapContainer center={[26.8467, 80.9462]} zoom={11} style={{ height, width: "100%" }} zoomControl={false}>
        <ParcelViewport parcels={parcels} selectedParcel={selectedParcel} />
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Dark Intelligence">
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="OpenStreetMap, CARTO" />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Light Survey">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="OpenStreetMap" />
          </LayersControl.BaseLayer>
          {geoserverLayerUrl && showGeoServerLayer ? (
            <LayersControl.Overlay checked name="GeoServer WMS">
              <WMSTileLayer url={normalizeWmsUrl(geoserverLayerUrl)} layers="geomind:land_parcels" format="image/png" transparent />
            </LayersControl.Overlay>
          ) : null}
        </LayersControl>

        {parcels.map((parcel) => {
          const positions = toLeafletPolygon(parcel.geojson);
          const isSelected = parcel.id === selectedParcelId;
          if (!positions.length) return null;
          return (
            <Polygon
              key={parcel.id}
              positions={positions}
              pathOptions={{
                color: riskColor(parcel.risk_hint),
                weight: isSelected ? 4 : 2.3,
                fillOpacity: isSelected ? 0.42 : 0.22,
                dashArray: isSelected ? "6 8" : undefined,
                className: isSelected ? "pulse-path" : "",
              }}
            >
              <Tooltip sticky direction="top">
                <div className="space-y-1 text-xs">
                  <div className="font-semibold text-haze">Khasra {parcel.khasra_no}</div>
                  <div>{parcel.owner_name}</div>
                  <div>{parcel.village}</div>
                </div>
              </Tooltip>
              <Popup>
                <div className="space-y-1 text-sm">
                  <div>
                    <strong>Khasra:</strong> {parcel.khasra_no}
                  </div>
                  <div>
                    <strong>Owner:</strong> {parcel.owner_name}
                  </div>
                  <div>
                    <strong>Village:</strong> {parcel.village}
                  </div>
                  <div>
                    <strong>Area:</strong> {parcel.area}
                  </div>
                  <div>
                    <strong>Risk:</strong> {parcel.risk_hint}
                  </div>
                </div>
              </Popup>
            </Polygon>
          );
        })}

        {selectedParcel ? (
          <CircleMarker center={toLeafletPolygon(selectedParcel.geojson)[0]} radius={7} pathOptions={{ color: "#67f7c4", fillColor: "#67f7c4", fillOpacity: 1 }}>
            <Tooltip permanent direction="right">
              Active parcel
            </Tooltip>
          </CircleMarker>
        ) : null}
      </MapContainer>

      <div className="pointer-events-none absolute right-4 top-4 z-[402] rounded-full border border-white/10 bg-black/45 px-3 py-2 text-[11px] uppercase tracking-[0.28em] text-fog backdrop-blur">
        <span className="inline-flex items-center gap-2">
          <Layers size={12} />
          Map overlays active
        </span>
      </div>
    </div>
  );
}
