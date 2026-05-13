import { AlertTriangle, FileSearch, Landmark, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { AgentTimeline } from "../components/AgentTimeline";
import { MapPanel } from "../components/MapPanel";
import { SectionCard } from "../components/SectionCard";
import { api } from "../lib/api";

export function PropertyDetailPage() {
  const { id } = useParams();
  const [conflicts, setConflicts] = useState([]);
  const [report, setReport] = useState(null);
  const [match, setMatch] = useState(null);
  const [parcels, setParcels] = useState([]);
  const [geoserverLayers, setGeoserverLayers] = useState(null);

  useEffect(() => {
    const load = async () => {
      const [reportsRes, parcelsRes, geoserverRes] = await Promise.all([api.get("/reports"), api.get("/gis/parcels"), api.get("/gis/geoserver/layers")]);
      const target = reportsRes.data.find((item) => String(item.property_data_id) === String(id));
      setParcels(parcelsRes.data);
      setGeoserverLayers(geoserverRes.data);
      if (target) {
        setReport(target);
        const [conflictsRes, matchRes] = await Promise.all([api.get(`/gis/conflicts/${id}`), api.post(`/gis/match-property?property_id=${id}`)]);
        setConflicts(conflictsRes.data);
        setMatch(matchRes.data);
      }
    };
    load();
  }, [id]);

  const focusParcels = useMemo(() => {
    if (!match?.parcel_id) return parcels.slice(0, 8);
    const selected = parcels.find((parcel) => String(parcel.id) === String(match.parcel_id));
    if (!selected) return parcels.slice(0, 8);
    return parcels.filter((parcel) => parcel.id === selected.id || parcel.village === selected.village).slice(0, 10);
  }, [parcels, match]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <SectionCard title={`Property Intelligence #${id}`} subtitle="Detailed risk posture, parcel evidence, and decision guidance">
          {report ? (
            <div className="space-y-4">
              <div className="rounded-[1.9rem] border border-white/10 bg-gradient-to-r from-storm via-slategeo to-tide p-5">
                <div className="text-[11px] uppercase tracking-[0.34em] text-fog">Executive Summary</div>
                <div className="mt-3 font-display text-3xl text-haze">
                  {report.report_json.executive_summary || `${report.risk_level} risk parcel requiring due diligence review`}
                </div>
                <div className="mt-3 text-sm leading-7 text-slate-200">{report.summary}</div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-fog">Risk Score</div>
                  <div className="mt-3 font-display text-5xl text-haze">{report.risk_score}</div>
                </div>
                <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-fog">Risk Level</div>
                  <div className="mt-3 text-2xl text-slate-200">{report.risk_level}</div>
                </div>
                <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-fog">Parcel Match</div>
                  <div className="mt-3 text-2xl text-slate-200">{match?.parcel_id ? `Parcel ${match.parcel_id}` : "Unresolved"}</div>
                </div>
              </div>

              <MapPanel parcels={focusParcels} selectedParcelId={match?.parcel_id} height="460px" geoserverLayerUrl={geoserverLayers?.wms} />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-fog">
                    <Landmark size={12} />
                    Ownership Analysis
                  </div>
                  <div className="mt-3 text-sm leading-7 text-slate-200">{report.report_json.ownership_analysis}</div>
                </div>
                <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-fog">
                    <ShieldCheck size={12} />
                    Boundary Analysis
                  </div>
                  <div className="mt-3 text-sm leading-7 text-slate-200">{report.report_json.boundary_analysis}</div>
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-fog">
                  <FileSearch size={12} />
                  Recommendations
                </div>
                <div className="mt-3 text-sm leading-7 text-slate-200">{report.report_json.recommendation}</div>
                <div className="mt-3 space-y-2">
                  {(report.report_json.recommended_actions || []).map((item) => (
                    <div key={item} className="rounded-2xl border border-white/10 bg-storm/80 px-3 py-2 text-sm text-slate-300">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-300">No report available yet for this property.</div>
          )}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Conflict Signals" subtitle="Why the parcel triggered investigation">
            <div className="space-y-3">
              {conflicts.map((conflict) => (
                <div key={conflict.id} className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-haze">
                    <AlertTriangle size={16} className="text-coral" />
                    {conflict.conflict_type}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-300">{conflict.details}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Agent Trail" subtitle="How GeoMind reached the final conclusion">
            <AgentTimeline
              items={[
                { agent: "Planner Agent", message: "Coordinated document extraction, parcel match, and conflict evaluation workflow.", metadata: { progress: 0.12 } },
                { agent: "Conflict Agent", message: "Focused on duplicate khasra and boundary overlap anomalies in the parcel cluster.", metadata: { progress: 0.75 } },
                { agent: "Risk Agent", message: "Weighted legal and spatial anomalies into a stakeholder-ready risk index.", metadata: { progress: 0.88 } },
                { agent: "Report Agent", message: "Packaged the result into a shareable property intelligence brief.", metadata: { progress: 1 } },
              ]}
            />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
