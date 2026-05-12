import "leaflet/dist/leaflet.css";

import { motion } from "framer-motion";
import { MapContainer, Polygon, Popup, TileLayer } from "react-leaflet";

function toLeafletPolygon(geojson) {
  if (!geojson?.coordinates?.length) return [];
  return geojson.coordinates[0][0].map(([lng, lat]) => [lat, lng]);
}

function riskColor(risk) {
  if (risk === "high" || risk === "High") return "#ef4444";
  if (risk === "medium" || risk === "Medium") return "#f59e0b";
  return "#16a34a";
}

export function MapPanel({ parcels = [], selectedParcelId = null, height = "520px" }) {
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 dark:border-slate-800">
      <div className="pointer-events-none absolute inset-0 z-[401] bg-topo opacity-50 dark:opacity-70" />
      <div className="pointer-events-none absolute left-4 top-4 z-[402] rounded-2xl border border-white/15 bg-slate-950/75 px-4 py-3 text-white backdrop-blur">
        <div className="text-[11px] uppercase tracking-[0.35em] text-mint">GeoMind Layer</div>
        <div className="mt-1 text-sm text-slate-200">{parcels.length} parcels in current intelligence view</div>
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="pointer-events-none absolute bottom-4 left-4 z-[402] flex gap-2"
      >
        {[
          ["Low", "#22c55e"],
          ["Medium", "#f59e0b"],
          ["High", "#ef4444"],
        ].map(([label, color]) => (
          <div key={label} className="rounded-full border border-white/15 bg-slate-950/70 px-3 py-2 text-xs text-slate-100 backdrop-blur">
            <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            {label}
          </div>
        ))}
      </motion.div>
      <MapContainer center={[26.8467, 80.9462]} zoom={11} style={{ height, width: "100%" }} zoomControl={false}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="OpenStreetMap, CARTO"
        />
        {parcels.map((parcel) => (
          <Polygon
            key={parcel.id}
            positions={toLeafletPolygon(parcel.geojson)}
            pathOptions={{
              color: riskColor(parcel.risk_hint),
              weight: parcel.id === selectedParcelId ? 4 : 2.2,
              fillOpacity: parcel.id === selectedParcelId ? 0.5 : 0.3,
            }}
          >
            <Popup>
              <div className="space-y-1 text-sm">
                <div><strong>Khasra:</strong> {parcel.khasra_no}</div>
                <div><strong>Owner:</strong> {parcel.owner_name}</div>
                <div><strong>Village:</strong> {parcel.village}</div>
                <div><strong>Area:</strong> {parcel.area}</div>
                <div><strong>Risk:</strong> {parcel.risk_hint}</div>
              </div>
            </Popup>
          </Polygon>
        ))}
      </MapContainer>
    </div>
  );
}
