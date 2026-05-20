import { AlertTriangle, Filter, Layers3, MessageSquare } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { MapPanel } from "../components/MapPanel";
import { SectionCard } from "../components/SectionCard";
import { api } from "../lib/api";

export function MapIntelligencePage() {
  const navigate = useNavigate();
  const [parcels, setParcels] = useState([]);
  const [filters, setFilters] = useState({ khasra: "", village: "", district: "", risk: "" });
  const [selectedParcel, setSelectedParcel] = useState(null);
  const [geoserverLayers, setGeoserverLayers] = useState(null);

  useEffect(() => {
    api.get("/gis/parcels").then((res) => setParcels(res.data));
    api.get("/gis/geoserver/layers").then((res) => setGeoserverLayers(res.data)).catch(() => undefined);
  }, []);

  const filtered = useMemo(
    () =>
      parcels.filter((parcel) => {
        const khasraMatch = !filters.khasra || parcel.khasra_no.toLowerCase().includes(filters.khasra.toLowerCase());
        const villageMatch = !filters.village || parcel.village.toLowerCase().includes(filters.village.toLowerCase());
        const districtMatch = !filters.district || parcel.district.toLowerCase().includes(filters.district.toLowerCase());
        const riskMatch = !filters.risk || String(parcel.risk_hint).toLowerCase() === filters.risk;
        return khasraMatch && villageMatch && districtMatch && riskMatch;
      }),
    [filters, parcels]
  );

  const selectedContext = useMemo(() => {
    if (!selectedParcel) return filtered.slice(0, 10);
    return filtered.filter((parcel) => parcel.id === selectedParcel.id || parcel.village === selectedParcel.village).slice(0, 12);
  }, [filtered, selectedParcel]);

  const openChat = () => {
    const parcelQuestion = selectedParcel
      ? `Analyze parcel khasra ${selectedParcel.khasra_no} in ${selectedParcel.village}, ${selectedParcel.district}. Explain the risk and nearby context.`
      : "Analyze the selected parcel and explain its risk signals.";
    navigate("/chat", {
      state: {
        question: parcelQuestion,
        parcelContext: selectedParcel
          ? {
              id: selectedParcel.id,
              khasra_no: selectedParcel.khasra_no,
              owner_name: selectedParcel.owner_name,
              village: selectedParcel.village,
              district: selectedParcel.district,
              area: selectedParcel.area,
              risk_hint: selectedParcel.risk_hint,
            }
          : null,
      },
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
      <SectionCard title="Parcel Theatre" subtitle="Risk-coded map operations with GeoServer overlay control and parcel fly-to">
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <label className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-fog">
              <Filter size={12} />
              Khasra
            </div>
            <input placeholder="Search khasra" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500" onChange={(e) => setFilters({ ...filters, khasra: e.target.value })} />
          </label>
          <label className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="mb-2 text-[11px] uppercase tracking-[0.28em] text-fog">Village</div>
            <input placeholder="Village" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500" onChange={(e) => setFilters({ ...filters, village: e.target.value })} />
          </label>
          <label className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="mb-2 text-[11px] uppercase tracking-[0.28em] text-fog">District</div>
            <input placeholder="District" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500" onChange={(e) => setFilters({ ...filters, district: e.target.value })} />
          </label>
          <label className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="mb-2 text-[11px] uppercase tracking-[0.28em] text-fog">Risk band</div>
            <select className="w-full bg-transparent text-sm text-white outline-none" onChange={(e) => setFilters({ ...filters, risk: e.target.value })}>
              <option value="">All risks</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>
        <div className="mb-4 flex justify-end">
          <button
            onClick={openChat}
            className="inline-flex items-center gap-2 rounded-2xl border border-mint/20 bg-mint/10 px-4 py-3 text-sm font-medium text-mint transition hover:bg-mint/20"
          >
            <MessageSquare size={16} />
            Open in chat
          </button>
        </div>
        <MapPanel parcels={selectedContext} selectedParcelId={selectedParcel?.id} height="640px" geoserverLayerUrl={geoserverLayers?.wms} />
      </SectionCard>

      <div className="space-y-6">
        <SectionCard title="Parcel Queue" subtitle="Select a parcel to inspect spatial and ownership signals">
          <div className="space-y-3">
            {filtered.map((parcel) => (
              <button
                key={parcel.id}
                onClick={() => setSelectedParcel(parcel)}
                className={`w-full rounded-[1.6rem] border p-4 text-left transition ${
                  selectedParcel?.id === parcel.id ? "border-mint/30 bg-mint/10 shadow-glow" : "border-white/10 bg-white/5 hover:bg-white/[0.07]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-haze">Khasra {parcel.khasra_no}</div>
                    <div className="mt-1 text-sm text-slate-400">{parcel.owner_name}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.2em] text-fog">
                      {parcel.village}, {parcel.district}
                    </div>
                  </div>
                  <div className="rounded-full border border-white/10 bg-storm px-3 py-1 text-xs text-white">{parcel.risk_hint}</div>
                </div>
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Analyst Overlay" subtitle="A compact parcel intelligence readout for narration">
          {selectedParcel ? (
            <div className="space-y-3">
              {[
                ["Owner", selectedParcel.owner_name],
                ["Khasra", selectedParcel.khasra_no],
                ["Village", selectedParcel.village],
                ["District", selectedParcel.district],
                ["Area", selectedParcel.area],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-fog">{label}</div>
                  <div className="mt-1 text-sm text-slate-200">{value}</div>
                </div>
              ))}
              <div className="rounded-[1.6rem] border border-gold/20 bg-gold/10 p-4 text-sm text-slate-200">
                <div className="flex items-center gap-2 font-medium">
                  <Layers3 size={16} />
                  Map cue
                </div>
                <p className="mt-2 leading-6">
                  Use this panel while the map is focused on the selected parcel to narrate owner, area, and village context before moving into conflict evidence.
                </p>
              </div>
              <button
                onClick={openChat}
                className="inline-flex w-full items-center justify-center gap-2 rounded-[1.4rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10"
              >
                <MessageSquare size={16} />
                Ask about this parcel in chat
              </button>
            </div>
          ) : (
            <div className="rounded-[1.6rem] border border-coral/20 bg-coral/10 p-4 text-sm text-slate-200">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle size={16} />
                Awaiting parcel selection
              </div>
              <p className="mt-2 leading-6">Choose a parcel from the queue to activate fly-to, highlight geometry, and display its map intelligence summary.</p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
