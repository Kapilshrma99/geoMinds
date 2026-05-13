import { CheckCircle2, FileScan, Orbit, ShieldAlert, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AgentTimeline } from "../components/AgentTimeline";
import { MapPanel } from "../components/MapPanel";
import { SectionCard } from "../components/SectionCard";
import { api, openAgentFeed } from "../lib/api";
import { useAuth } from "../state/AuthContext";

const missionSteps = [
  { label: "Planner Agent", detail: "Planning workflow and execution order." },
  { label: "Document Agent", detail: "Extracting cadastral identifiers and evidence." },
  { label: "GIS Agent", detail: "Matching parcel geometry and nearby context." },
  { label: "Conflict Agent", detail: "Checking overlaps, duplicates, and metadata drift." },
  { label: "Risk Agent", detail: "Weighting legal and spatial signals." },
  { label: "Report Agent", detail: "Synthesizing the intelligence brief." },
];

export function UploadPage() {
  const { token } = useAuth();
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [liveLogs, setLiveLogs] = useState([]);
  const [activeDocumentId, setActiveDocumentId] = useState(null);
  const [geoserverLayers, setGeoserverLayers] = useState(null);
  const [parcels, setParcels] = useState([]);

  useEffect(() => {
    api.get("/gis/geoserver/layers").then((res) => setGeoserverLayers(res.data)).catch(() => undefined);
    api.get("/gis/parcels").then((res) => setParcels(res.data)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    const controller = new AbortController();

    openAgentFeed({
      token,
      signal: controller.signal,
      onEvent: (event) => {
        if (!activeDocumentId || String(event.document_id) !== String(activeDocumentId)) return;
        setLiveLogs((current) => [event, ...current.filter((item) => item.id !== event.id)].slice(0, 18));
      },
    }).catch(() => undefined);

    return () => controller.abort();
  }, [token, activeDocumentId]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    setAnalysis(null);
    setLiveLogs([]);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploaded = await api.post("/documents/upload", formData);
      setActiveDocumentId(uploaded.data.id);
      const analyzed = await api.post(`/ai/analyze-document/${uploaded.data.id}`);
      setAnalysis(analyzed.data);
      setLiveLogs((current) => [...analyzed.data.agent_log, ...current].slice(0, 18));
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const progress = useMemo(() => {
    if (analysis?.agent_log?.length) return 100;
    return Math.max(...liveLogs.map((item) => Math.round((item.metadata?.progress || 0) * 100)), uploading ? 8 : 0);
  }, [analysis, liveLogs, uploading]);

  const matchedParcelId = analysis?.match?.parcel_id;
  const matchedParcel = parcels.find((parcel) => String(parcel.id) === String(matchedParcelId));
  const riskTone =
    analysis?.report?.risk_level === "High" ? "text-red-200" : analysis?.report?.risk_level === "Medium" ? "text-amber-200" : "text-mint";

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="Mission Intake" subtitle="Upload a land dossier and trigger the autonomous intelligence sequence">
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="scanline rounded-[1.9rem] border border-dashed border-mint/30 bg-white/5 p-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-mint/20 bg-mint/10 text-mint">
                <UploadCloud size={28} />
              </div>
              <h3 className="mt-4 font-display text-2xl text-haze">Property PDF intake</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Upload title documents, khasra sheets, survey extracts, or legal ownership records. The system will parse, match, verify, and score them in sequence.
              </p>
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mx-auto mt-6 block max-w-full text-sm text-slate-300" />
              <button onClick={handleUpload} disabled={!file || uploading} className="mt-6 rounded-2xl bg-mint px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
                {uploading ? "Running autonomous analysis..." : "Upload and launch mission"}
              </button>
              {error ? <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
            </div>

            <div className="rounded-[1.9rem] border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.34em] text-fog">
                <FileScan size={12} />
                Live Mission Status
              </div>
              <div className="mt-5">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Pipeline completion</span>
                  <span>{progress}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/6">
                  <div className="h-full rounded-full bg-gradient-to-r from-mint via-cyan-300 to-sky-400 transition-all duration-500" style={{ width: `${Math.max(progress, uploading ? 10 : 0)}%` }} />
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {missionSteps.map((step) => {
                  const completed = liveLogs.some((log) => log.agent === step.label && log.status !== "running") || analysis?.agent_log?.some((log) => log.agent === step.label && log.status !== "running");
                  const running = liveLogs.some((log) => log.agent === step.label && log.status === "running");
                  return (
                    <div key={step.label} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-storm/80 p-3">
                      <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-2xl border ${completed ? "border-mint/30 bg-mint/10 text-mint" : running ? "border-amber-400/30 bg-amber-400/10 text-amber-200" : "border-white/10 bg-white/5 text-slate-400"}`}>
                        {completed ? <CheckCircle2 size={16} /> : <Orbit size={16} className={running ? "animate-spin" : ""} />}
                      </div>
                      <div>
                        <div className="font-medium text-haze">{step.label}</div>
                        <div className="mt-1 text-sm leading-6 text-slate-400">{step.detail}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Autonomous Execution" subtitle="Agents stream their work, timing, and operational progress in real time">
          <AgentTimeline items={liveLogs.length ? liveLogs : analysis?.agent_log || []} />
        </SectionCard>
      </div>

      {analysis ? (
        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <SectionCard title="Parcel Resolution" subtitle="The system zooms to the matched parcel and surrounding land context">
            <MapPanel
              parcels={matchedParcel ? parcels.filter((parcel) => parcel.id === matchedParcel.id || parcel.village === matchedParcel.village).slice(0, 8) : parcels.slice(0, 8)}
              selectedParcelId={matchedParcel?.id}
              height="500px"
              geoserverLayerUrl={geoserverLayers?.wms}
            />
          </SectionCard>

          <SectionCard title="Intelligence Snapshot" subtitle="Enterprise-style summary from the generated report">
            <div className="rounded-[1.8rem] border border-white/10 bg-white/5 p-5">
              <div className="text-[11px] uppercase tracking-[0.34em] text-fog">Risk posture</div>
              <div className={`mt-3 font-display text-5xl ${riskTone}`}>{analysis.report.risk_score}</div>
              <div className="mt-1 text-sm text-slate-300">{analysis.report.risk_level} risk intelligence score</div>
              <p className="mt-4 text-sm leading-7 text-slate-200">{analysis.report.summary}</p>
            </div>

            <div className="mt-4 space-y-3">
              {[
                ["Owner", analysis.extracted_data.owner_name || "Not found"],
                ["Khasra", analysis.extracted_data.khasra_no || "Not found"],
                ["Village", analysis.extracted_data.village || "Not found"],
                ["District", analysis.extracted_data.district || "Not found"],
                ["Matched Parcel", matchedParcel ? `${matchedParcel.khasra_no} (ID ${matchedParcel.id})` : "No reliable match"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-storm/80 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-fog">{label}</div>
                  <div className="mt-1 text-sm text-slate-200">{value}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[1.6rem] border border-coral/15 bg-coral/10 p-4 text-sm text-slate-200">
              <div className="flex items-center gap-2 font-medium">
                <ShieldAlert size={16} />
                Demo talking point
              </div>
              <p className="mt-2 leading-6">
                After upload, pause on the live agent panel for two seconds, then shift attention to the parcel fly-to and score card. That transition sells the autonomy.
              </p>
            </div>
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}
