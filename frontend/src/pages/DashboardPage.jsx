import { motion } from "framer-motion";
import { ArrowRight, MapPinned, Radar, ScanSearch, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { AgentTimeline } from "../components/AgentTimeline";
import { MapPanel } from "../components/MapPanel";
import { SectionCard } from "../components/SectionCard";
import { Skeleton } from "../components/Skeleton";
import { StatCard } from "../components/StatCard";
import { api } from "../lib/api";
import { useAuth } from "../state/AuthContext";

export function DashboardPage() {
  const { token } = useAuth();
  const [summary, setSummary] = useState(null);
  const [parcels, setParcels] = useState([]);
  const [agentFeed, setAgentFeed] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [summaryRes, parcelsRes] = await Promise.all([api.get("/dashboard/summary"), api.get("/gis/parcels")]);
        setSummary(summaryRes.data);
        setParcels(parcelsRes.data);
        setAgentFeed(summaryRes.data.recent_agent_activity || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    const controller = new AbortController();

    const connectFeed = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}/dashboard/agent-feed`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });
        if (!response.ok || !response.body) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() || "";
          for (const chunk of chunks) {
            const line = chunk.split("\n").find((item) => item.startsWith("data: "));
            if (!line) continue;
            const event = JSON.parse(line.slice(6));
            setAgentFeed((current) => {
              const next = [event, ...current.filter((item) => item.id !== event.id)];
              return next.slice(0, 12);
            });
          }
        }
      } catch {
        return;
      }
    };

    connectFeed();
    return () => controller.abort();
  }, [token]);

  const highRiskParcels = useMemo(
    () => parcels.filter((parcel) => String(parcel.risk_hint).toLowerCase() === "high").length,
    [parcels]
  );

  const topMapParcels = useMemo(() => parcels.slice(0, 5), [parcels]);

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-command p-6 text-white shadow-panel"
      >
        <div className="absolute inset-0 bg-topo opacity-50" />
        <div className="relative grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-mint/25 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-mint">
              <Radar size={12} />
              GeoSpatial Command
            </div>
            <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-tight md:text-5xl">
              Enterprise land intelligence with cinematic GIS visibility and live agent operations.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200">
              Monitor parcel risk, track autonomous analysis steps, and drive the hackathon demo through a map-first control surface.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/upload" className="inline-flex items-center gap-2 rounded-2xl bg-mint px-5 py-3 text-sm font-medium text-slate-950 transition hover:scale-[1.02]">
                Start analysis
                <ArrowRight size={16} />
              </Link>
              <Link to="/map" className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm text-white backdrop-blur transition hover:bg-white/15">
                Open map intelligence
                <MapPinned size={16} />
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            {loading ? (
              <>
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </>
            ) : (
              <>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <div className="text-[11px] uppercase tracking-[0.32em] text-slate-300">Live parcels</div>
                  <div className="mt-3 font-display text-3xl">{parcels.length}</div>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <div className="text-[11px] uppercase tracking-[0.32em] text-slate-300">High risk on map</div>
                  <div className="mt-3 font-display text-3xl">{highRiskParcels}</div>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <div className="text-[11px] uppercase tracking-[0.32em] text-slate-300">Agent events</div>
                  <div className="mt-3 font-display text-3xl">{agentFeed.length}</div>
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
            <StatCard title="Uploaded Properties" value={summary?.total_uploaded_properties ?? "--"} hint="Documents ingested across analysts and legal teams" color="from-white to-mint/40" />
            <StatCard title="Matched Parcels" value={summary?.total_matched_parcels ?? "--"} hint="Mapped against PostGIS parcel intelligence" color="from-white to-sky-100" />
            <StatCard title="Conflict Count" value={summary?.conflict_count ?? "--"} hint="Ownership, geometry, duplicate, and area anomalies" color="from-white to-amber-100" />
            <StatCard title="High Risk Properties" value={summary?.high_risk_properties ?? "--"} hint="Escalated cases needing legal review" color="from-white to-rose-100" />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_0.9fr]">
        <SectionCard
          title="Map Intelligence Theatre"
          subtitle="Risk-aware parcel surface with cinematic dark basemap and operational overlays"
          className="overflow-hidden"
          right={
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 md:flex">
              <ScanSearch size={14} />
              Live GIS
            </div>
          }
        >
          {loading ? <Skeleton className="h-[430px] w-full rounded-[1.75rem]" /> : <MapPanel parcels={parcels} height="500px" />}
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {topMapParcels.map((parcel) => (
              <div key={parcel.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/60">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">Khasra {parcel.khasra_no}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{parcel.village}</div>
                  </div>
                  <div className="rounded-full bg-slate-950 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-white dark:bg-slate-100 dark:text-slate-950">
                    {parcel.risk_hint}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Live Multi-Agent Execution" subtitle="Planner to Report workflow with streaming execution states">
          {loading ? <Skeleton className="h-[640px] w-full rounded-[1.75rem]" /> : <AgentTimeline items={agentFeed} />}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          title="Recent Reports"
          subtitle="Latest property intelligence summaries"
          right={
            <Link to="/reports" className="rounded-2xl bg-ink px-4 py-2 text-sm text-white">
              Open reports
            </Link>
          }
        >
          <div className="space-y-3">
            {loading ? (
              <>
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </>
            ) : null}
            {(summary?.recent_analysis_reports || []).map((report) => (
              <Link
                key={report.id}
                to={`/properties/${report.property_data_id}`}
                className="block rounded-2xl border border-slate-200 bg-slate-50/80 p-4 transition hover:-translate-y-0.5 hover:border-slate-400 dark:border-slate-800 dark:bg-slate-800/60"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium">Report #{report.id}</div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{report.summary}</div>
                  </div>
                  <div className="rounded-full bg-slate-900 px-3 py-1 text-xs text-white dark:bg-slate-100 dark:text-slate-900">
                    {report.risk_level} ({report.risk_score})
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Demo Flow" subtitle="A polished stage path for judges and stakeholders">
          <div className="space-y-3">
            {[
              ["Upload", "Bring in the land PDF or khasra record and trigger the pipeline."],
              ["Extract", "Watch the document agent parse ownership and cadastral attributes."],
              ["Match", "See the GIS surface highlight the matched parcel and nearby context."],
              ["Explain", "Use chat to ask why the property is risky and get cited answers."],
              ["Deliver", "Generate the report package and present the decision trail."],
            ].map(([title, description], index) => (
              <div key={title} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/60">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ink text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <div>
                  <div className="font-medium">{title}</div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{description}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-[1.5rem] bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-emerald-500/10 p-4 text-sm text-slate-700 dark:text-slate-200">
            <div className="flex items-center gap-2 font-medium">
              <ShieldAlert size={16} />
              Judge-ready story
            </div>
            <p className="mt-2">Keep the dashboard open on a second screen so the live agent feed and map surface reinforce the autonomy story during the demo.</p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
