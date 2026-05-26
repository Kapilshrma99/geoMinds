import { motion } from "framer-motion";
import { ArrowRight, AudioLines, Orbit, ShieldAlert, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { AgentTimeline } from "../components/AgentTimeline";
import { MapPanel } from "../components/MapPanel";
import { SectionCard } from "../components/SectionCard";
import { Skeleton } from "../components/Skeleton";
import { StatCard } from "../components/StatCard";
import { api, openAgentFeed } from "../lib/api";
import { useAuth } from "../state/AuthContext";

export function DashboardPage() {
  const { token } = useAuth();
  const [summary, setSummary] = useState(null);
  const [parcels, setParcels] = useState([]);
  const [agentFeed, setAgentFeed] = useState([]);
  const [geoserverLayers, setGeoserverLayers] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [summaryRes, parcelsRes, geoserverRes] = await Promise.all([api.get("/dashboard/summary"), api.get("/gis/parcels"), api.get("/gis/geoserver/layers")]);
        setSummary(summaryRes.data);
        setParcels(parcelsRes.data);
        setAgentFeed(summaryRes.data.recent_agent_activity || []);
        setGeoserverLayers(geoserverRes.data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    const controller = new AbortController();

    openAgentFeed({
      token,
      signal: controller.signal,
      onEvent: (event) => {
        setAgentFeed((current) => [event, ...current.filter((item) => item.id !== event.id)].slice(0, 14));
      },
    }).catch(() => undefined);

    return () => controller.abort();
  }, [token]);

  const highRiskParcels = useMemo(() => parcels.filter((parcel) => String(parcel.risk_hint).toLowerCase() === "high").length, [parcels]);
  const mediumRiskParcels = useMemo(() => parcels.filter((parcel) => String(parcel.risk_hint).toLowerCase() === "medium").length, [parcels]);
  const selectedParcel = useMemo(() => parcels.find((parcel) => String(parcel.risk_hint).toLowerCase() === "high") || parcels[0], [parcels]);

  return (
    <div className="space-y-6">
      <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-[2.2rem] border border-white/10 bg-command p-6 shadow-panel">
        <div className="absolute inset-0 bg-topo opacity-50" />
        <div className="relative grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-mint/20 bg-mint/10 px-3 py-1 text-[11px] uppercase tracking-[0.34em] text-mint">
              <Orbit size={12} />
              Autonomous Operations Layer
            </div>
            <h1 className="mt-5 max-w-4xl font-display text-4xl font-semibold leading-tight text-haze md:text-6xl">
              Turn raw land records into a live parcel intelligence narrative in one command surface.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200">
              GeoMind AI coordinates document extraction, cadastral matching, GIS conflict detection, and boardroom-grade risk reporting with a map-first execution story.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/upload" className="inline-flex items-center gap-2 rounded-2xl bg-mint px-5 py-3 text-sm font-semibold text-slate-950">
                Start live intake
                <ArrowRight size={16} />
              </Link>
              <Link to="/chat" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white">
                Ask evidence chat
                <AudioLines size={16} />
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            {loading ? (
              <>
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
              </>
            ) : (
              <>
                <div className="rounded-[1.7rem] border border-white/10 bg-white/5 p-5">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-fog">Parcel coverage</div>
                  <div className="mt-3 font-display text-4xl">{parcels.length}</div>
                  <div className="mt-2 text-sm text-slate-300">Mapped from live PostGIS records and GeoServer overlays.</div>
                </div>
                <div className="rounded-[1.7rem] border border-white/10 bg-white/5 p-5">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-fog">High-risk cases</div>
                  <div className="mt-3 font-display text-4xl">{highRiskParcels}</div>
                  <div className="mt-2 text-sm text-slate-300">Immediate escalation candidates across ownership and geometry anomalies.</div>
                </div>
                <div className="rounded-[1.7rem] border border-white/10 bg-white/5 p-5">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-fog">Agent events</div>
                  <div className="mt-3 font-display text-4xl">{agentFeed.length}</div>
                  <div className="mt-2 text-sm text-slate-300">Streaming autonomous execution evidence for the live demo.</div>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <>
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </>
        ) : (
          <>
            <StatCard title="Uploaded Dossiers" value={summary?.total_uploaded_properties ?? "--"} hint="Land documents ingested into the command layer." color="from-mint/18 via-transparent to-transparent" />
            <StatCard title="Matched Parcels" value={summary?.total_matched_parcels ?? "--"} hint="Properties resolved against parcel geometry and metadata." color="from-sky-400/14 via-transparent to-transparent" />
            <StatCard title="Conflict Signals" value={summary?.conflict_count ?? "--"} hint="Ownership, overlap, duplicate khasra, and area anomalies." color="from-gold/16 via-transparent to-transparent" />
            <StatCard title="Medium Risk Band" value={mediumRiskParcels} hint="Properties requiring deeper legal and field verification." color="from-coral/16 via-transparent to-transparent" />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.65fr_0.95fr]">
        <SectionCard
          title="Map Section"
          subtitle="Parcel map with risk colors and GeoServer overlays"
          helper="Use this area to see where the selected parcel is located, how risky it is, and what nearby parcels may affect it."
          right={
            <div className="rounded-full border border-mint/15 bg-mint/10 px-3 py-2 text-xs uppercase tracking-[0.2em] text-mint">
              Map intelligence online
            </div>
          }
        >
          {loading ? (
            <Skeleton className="h-[520px] w-full rounded-[1.75rem]" />
          ) : (
            <MapPanel
              parcels={parcels}
              selectedParcelId={selectedParcel?.id}
              height="520px"
              geoserverLayerUrl={geoserverLayers?.wms}
              label="Parcel map"
              helper="Highlighted parcel boundaries represent land records. Colors show risk level and optional overlays add reference data."
            />
          )}
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              ["Matched parcel", selectedParcel ? `Khasra ${selectedParcel.khasra_no}` : "Awaiting parcel selection"],
              ["Risk spotlight", selectedParcel ? `${selectedParcel.risk_hint} risk near ${selectedParcel.village}` : "No spotlight active"],
              ["GeoServer", geoserverLayers?.wms ? "WMS overlay ready for demo" : "Overlay endpoint unavailable"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] uppercase tracking-[0.28em] text-fog">{label}</div>
                <div className="mt-2 text-sm text-slate-200">{value}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Activity Section"
          subtitle="Live agent timeline for the current system activity"
          helper="Use this panel to understand which backend component is running now and what work it has already completed."
        >
          {loading ? <Skeleton className="h-[700px] w-full rounded-[1.75rem]" /> : <AgentTimeline items={agentFeed} />}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Reports Section"
          subtitle="Recent analysis reports and risk summaries"
          helper="Open any report here to review the latest findings for a property and move into its detailed page."
          right={
            <Link to="/reports" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white">
              Open report library
            </Link>
          }
        >
          <div className="space-y-3">
            {(summary?.recent_analysis_reports || []).map((report) => (
              <Link key={report.id} to={`/properties/${report.property_data_id}`} className="block rounded-[1.6rem] border border-white/10 bg-white/5 p-4 transition hover:-translate-y-0.5 hover:bg-white/[0.07]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm uppercase tracking-[0.24em] text-fog">Report #{report.id}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-200">{report.summary}</div>
                  </div>
                  <div className="rounded-full border border-white/10 bg-storm px-3 py-1 text-xs text-white">
                    {report.risk_level} {report.risk_score}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="How To Use"
          subtitle="A simple five-step flow for understanding the product"
          helper="This section explains how the main components connect so a user can quickly learn where to upload, inspect, and ask questions."
        >
          <div className="space-y-3">
            {[
              ["1", "Mission intake", "Upload the property PDF and show the scanner and parser awaken."],
              ["2", "Agent orchestration", "Let Planner, Document, GIS, Conflict, Risk, and Report agents stream their work."],
              ["3", "Spatial reveal", "Fly directly to the parcel, nearby parcels, and overlap indicators on the map."],
              ["4", "Intelligence brief", "Present the executive summary, score, evidence, and recommendations."],
              ["5", "Grounded Q&A", "Use voice or text chat to justify risk with citations from the file and GIS layer."],
            ].map(([step, title, detail]) => (
              <div key={step} className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-mint text-sm font-semibold text-slate-950">{step}</div>
                  <div>
                    <div className="font-medium text-haze">{title}</div>
                    <div className="mt-1 text-sm leading-6 text-slate-300">{detail}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-[1.6rem] border border-coral/15 bg-coral/10 p-4 text-sm text-slate-200">
            <div className="flex items-center gap-2 font-medium">
              <ShieldAlert size={16} />
              Hackathon positioning
            </div>
            <p className="mt-2 leading-6">
              Keep the dashboard on screen while you trigger an upload in another tab. The simultaneous agent feed, parcel fly-to, and report generation makes the autonomy story immediately legible.
            </p>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Why This Matters"
        subtitle="What each major capability adds to the workflow"
        helper="Read this area as a quick explanation of the product’s core building blocks and why they are useful."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Evidence-grounded AI", "RAG citations, structured report output, and parcel context keep answers anchored in land records."],
            ["Operational storytelling", "Every stage reveals itself with visible agent states, timings, and map consequences."],
            ["GIS-native decisions", "The product centers parcel geometry, overlaps, nearby disputes, and cadastral intelligence rather than forms."],
          ].map(([title, detail], index) => (
            <motion.div key={title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }} className="rounded-[1.7rem] border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-2 text-mint">
                <Sparkles size={16} />
                <span className="font-medium text-haze">{title}</span>
              </div>
              <div className="mt-3 text-sm leading-6 text-slate-300">{detail}</div>
            </motion.div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
