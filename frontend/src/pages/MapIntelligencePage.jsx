import { useEffect, useMemo, useState } from "react";

import { MapPanel } from "../components/MapPanel";
import { SectionCard } from "../components/SectionCard";
import { api } from "../lib/api";

export function MapIntelligencePage() {
  const [parcels, setParcels] = useState([]);
  const [filters, setFilters] = useState({ khasra: "", village: "", district: "", risk: "" });
  const [selectedParcel, setSelectedParcel] = useState(null);

  useEffect(() => {
    api.get("/gis/parcels").then((res) => setParcels(res.data));
  }, []);

  const filtered = useMemo(
    () =>
      parcels.filter((parcel) => {
        const khasraMatch = !filters.khasra || parcel.khasra_no.toLowerCase().includes(filters.khasra.toLowerCase());
        const villageMatch = !filters.village || parcel.village.toLowerCase().includes(filters.village.toLowerCase());
        const districtMatch = !filters.district || parcel.district.toLowerCase().includes(filters.district.toLowerCase());
        const riskMatch = !filters.risk || parcel.risk_hint === filters.risk;
        return khasraMatch && villageMatch && districtMatch && riskMatch;
      }),
    [filters, parcels]
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
      <SectionCard title="Parcel Intelligence Map" subtitle="Risk-colored parcels with ownership and cadastral context">
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <input placeholder="Search khasra" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900" onChange={(e) => setFilters({ ...filters, khasra: e.target.value })} />
          <input placeholder="Village" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900" onChange={(e) => setFilters({ ...filters, village: e.target.value })} />
          <input placeholder="District" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900" onChange={(e) => setFilters({ ...filters, district: e.target.value })} />
          <select className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900" onChange={(e) => setFilters({ ...filters, risk: e.target.value })}>
            <option value="">All risks</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <MapPanel parcels={filtered} selectedParcelId={selectedParcel?.id} />
      </SectionCard>

      <SectionCard title="Parcel Results" subtitle="Select a parcel to inspect key land intelligence signals">
        <div className="space-y-3">
          {filtered.map((parcel) => (
            <button
              key={parcel.id}
              onClick={() => setSelectedParcel(parcel)}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                selectedParcel?.id === parcel.id
                  ? "border-ink bg-slate-100 dark:border-mint dark:bg-slate-800"
                  : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">Khasra {parcel.khasra_no}</div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{parcel.owner_name}</div>
                </div>
                <div className="rounded-full bg-slate-900 px-3 py-1 text-xs text-white dark:bg-slate-100 dark:text-slate-900">{parcel.risk_hint}</div>
              </div>
            </button>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
