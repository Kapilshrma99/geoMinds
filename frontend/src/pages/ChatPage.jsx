import { Compass, Mic, MicOff, SearchCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { AgentTimeline } from "../components/AgentTimeline";
import { MapPanel } from "../components/MapPanel";
import { SectionCard } from "../components/SectionCard";
import { api, streamChat } from "../lib/api";
import { useAuth } from "../state/AuthContext";

const suggestions = [
  "Why is this parcel risky?",
  "Show nearby disputed parcels",
  "Which geometries overlap?",
  "Generate ownership summary",
  "Explain area mismatch",
];

const LAST_BATCH_STORAGE_KEY = "geomind:last-upload-batch";

export function ChatPage() {
  const location = useLocation();
  const { token } = useAuth();
  const [question, setQuestion] = useState(suggestions[0]);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const [propertyId, setPropertyId] = useState(1);
  const [scope, setScope] = useState("single");
  const [latestBatch, setLatestBatch] = useState(null);
  const [listening, setListening] = useState(false);
  const [parcels, setParcels] = useState([]);
  const [match, setMatch] = useState(null);
  const [geoserverLayers, setGeoserverLayers] = useState(null);
  const [incomingParcelContext, setIncomingParcelContext] = useState(null);

  useEffect(() => {
    const load = async () => {
      const [reportsRes, parcelsRes, geoserverRes] = await Promise.all([
        api.get("/reports"),
        api.get("/gis/parcels"),
        api.get("/gis/geoserver/layers").catch(() => ({ data: null })),
      ]);
      setReports(reportsRes.data);
      setParcels(parcelsRes.data);
      setGeoserverLayers(geoserverRes.data);
      if (reportsRes.data[0]?.property_data_id) setPropertyId(reportsRes.data[0].property_data_id);
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem(LAST_BATCH_STORAGE_KEY);
        if (stored) {
          try {
            setLatestBatch(JSON.parse(stored));
          } catch {
            setLatestBatch(null);
          }
        }
      }
    };
    load();
  }, []);

  useEffect(() => {
    const routeState = location.state;
    if (!routeState) return;

    if (routeState.question) {
      setQuestion(routeState.question);
    }
    if (routeState.propertyId) {
      setPropertyId(routeState.propertyId);
      setScope("single");
    }
    if (routeState.parcelContext) {
      setIncomingParcelContext(routeState.parcelContext);
    } else {
      setIncomingParcelContext(null);
    }
  }, [location.state]);

  useEffect(() => {
    if (!propertyId) {
      setMatch(null);
      return;
    }

    let active = true;

    const loadMatch = async () => {
      try {
        const { data } = await api.post(`/gis/match-property?property_id=${propertyId}`);
        if (active) setMatch(data);
      } catch {
        if (active) setMatch(null);
      }
    };

    loadMatch();

    return () => {
      active = false;
    };
  }, [propertyId]);

  const ask = async (text = question) => {
    setLoading(true);
    setResponse({ answer: "", citations: [], agent_log: [] });
    const payload =
      scope === "all"
        ? { question: text, use_all_properties: true }
        : scope === "batch" && latestBatch?.propertyIds?.length
          ? { question: text, property_ids: latestBatch.propertyIds }
          : { question: text, property_id: propertyId };
    try {
      await streamChat({
        ...payload,
        token,
        onEvent: (event) => {
          if (event.type === "meta") {
            setResponse((current) => ({
              answer: current?.answer || "",
              citations: event.citations || [],
              agent_log: event.agent_log || [],
            }));
          }
          if (event.type === "chunk") {
            setResponse((current) => ({
              ...(current || { citations: [], agent_log: [] }),
              answer: `${current?.answer || ""}${event.delta || ""}`,
            }));
          }
          if (event.type === "done") {
            setResponse((current) => ({
              ...(current || {}),
              answer: event.answer || current?.answer || "",
              citations: event.citations || current?.citations || [],
            }));
          }
        },
      });
    } catch {
      const { data } = await api.post("/ai/chat", payload);
      setResponse(data);
    } finally {
      setLoading(false);
    }
  };

  const selectedReport = useMemo(() => reports.find((report) => String(report.property_data_id) === String(propertyId)), [reports, propertyId]);
  const selectedParcel = useMemo(() => {
    if (!match?.parcel_id) return null;
    return parcels.find((parcel) => String(parcel.id) === String(match.parcel_id)) || null;
  }, [match, parcels]);
  const selectedPropertyCoordinates = selectedReport?.report_json?.property_summary?.coordinates || null;
  const mapContextParcels = useMemo(() => {
    if (!selectedParcel) return parcels.slice(0, 8);
    return parcels.filter((parcel) => parcel.id !== selectedParcel.id && parcel.village === selectedParcel.village).slice(0, 12);
  }, [parcels, selectedParcel]);
  const nearbyParcels = useMemo(() => {
    return mapContextParcels.slice(0, 4);
  }, [mapContextParcels]);
  const scopeSummary = useMemo(() => {
    if (scope === "all") return "All of your analyzed properties will be used as chat context.";
    if (scope === "batch" && latestBatch?.propertyIds?.length) {
      return `${latestBatch.propertyIds.length} properties from the latest upload batch are available for cross-document questions.`;
    }
    return selectedReport?.summary || "Choose a report to ground the conversation.";
  }, [scope, latestBatch, selectedReport]);

  const toggleVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    if (listening) {
      setListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) {
        setQuestion(transcript);
      }
    };
    recognition.onend = () => setListening(false);
    recognition.start();
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
      <SectionCard title="Evidence Chat" subtitle="Conversational GIS reasoning grounded in document snippets, parcel context, and risk evidence">
        <div className="rounded-[1.8rem] border border-white/10 bg-white/5 p-4">
          <div className="mb-4 grid gap-3 md:grid-cols-[0.55fr_0.65fr_1fr]">
            <label className="rounded-2xl border border-white/10 bg-storm/80 px-4 py-3">
              <div className="mb-2 text-[11px] uppercase tracking-[0.28em] text-fog">Chat scope</div>
              <select value={scope} onChange={(e) => setScope(e.target.value)} className="w-full bg-transparent text-sm text-white outline-none">
                <option value="single">Single property</option>
                {latestBatch?.propertyIds?.length ? <option value="batch">Latest upload batch</option> : null}
                <option value="all">All uploaded results</option>
              </select>
            </label>
            <label className="rounded-2xl border border-white/10 bg-storm/80 px-4 py-3">
              <div className="mb-2 text-[11px] uppercase tracking-[0.28em] text-fog">Property context</div>
              <select value={propertyId} onChange={(e) => setPropertyId(Number(e.target.value))} disabled={scope !== "single"} className="w-full bg-transparent text-sm text-white outline-none disabled:opacity-50">
                {reports.map((report) => (
                  <option key={report.id} value={report.property_data_id}>
                    Property {report.property_data_id} | Report {report.id} | {report.risk_level}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-2xl border border-white/10 bg-storm/80 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.28em] text-fog">Selected report summary</div>
              <div className="mt-2 text-sm text-slate-200">{scopeSummary}</div>
            </div>
          </div>

          {incomingParcelContext ? (
            <div className="mb-4 rounded-[1.4rem] border border-sky-300/20 bg-sky-400/10 px-4 py-3 text-sm text-slate-100">
              Chat opened from Parcel Theatre for khasra {incomingParcelContext.khasra_no} in {incomingParcelContext.village}, {incomingParcelContext.district}.
            </div>
          ) : null}

          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={5}
            className="w-full rounded-[1.7rem] border border-white/10 bg-black/20 p-4 text-sm text-white outline-none placeholder:text-slate-500"
            placeholder="Ask why a parcel is risky, which geometries overlap, or what evidence supports the score"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {suggestions.map((item) => (
              <button key={item} onClick={() => setQuestion(item)} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                {item}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={() => ask()} className="rounded-2xl bg-mint px-5 py-3 text-sm font-semibold text-slate-950">
              {loading ? "Streaming analysis..." : "Ask GeoMind AI"}
            </button>
            <button onClick={toggleVoice} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white">
              {listening ? <MicOff size={16} /> : <Mic size={16} />}
              {listening ? "Listening..." : "Voice query"}
            </button>
          </div>
        </div>

        {response ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-[1.8rem] border border-mint/20 bg-mint/10 p-5">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-mint">
                <Sparkles size={12} />
                AI Answer
              </div>
              <div className="mt-3 text-lg leading-8 text-haze">{response.answer}</div>
            </div>
            <div className="rounded-[1.8rem] border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-fog">
                <SearchCheck size={12} />
                Evidence citations
              </div>
              <div className="mt-3 grid gap-2">
                {(response.citations || []).map((citation) => (
                  <div key={citation} className="rounded-2xl border border-white/10 bg-storm/80 px-3 py-2 text-sm text-slate-200">
                    {citation}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </SectionCard>

      <div className="space-y-6">
        <SectionCard title="Property Map" subtitle="See the selected property on the map along with nearby parcels for quick spatial context">
          <MapPanel
            parcels={mapContextParcels}
            selectedPoint={selectedPropertyCoordinates}
            selectedPointLabel={`Property ${propertyId}`}
            height="420px"
            geoserverLayerUrl={geoserverLayers?.wms}
          />

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-fog">
                <Compass size={12} />
                Selected property
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-200">
                <div>Khasra: {selectedReport?.report_json?.property_summary?.khasra_no || selectedParcel?.khasra_no || "Not matched yet"}</div>
                <div>Owner: {selectedReport?.report_json?.property_summary?.owner_name || selectedParcel?.owner_name || "Unavailable"}</div>
                <div>Village: {selectedReport?.report_json?.property_summary?.village || selectedParcel?.village || "Unavailable"}</div>
                <div>Area: {selectedReport?.report_json?.property_summary?.area || selectedParcel?.area || "Unavailable"}</div>
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-[0.28em] text-fog">Nearby properties</div>
              <div className="mt-3 space-y-2">
                {nearbyParcels.length ? (
                  nearbyParcels.map((parcel) => (
                    <div key={parcel.id} className="rounded-2xl border border-white/10 bg-storm/80 px-3 py-2 text-sm text-slate-200">
                      {parcel.khasra_no} | {parcel.owner_name} | {parcel.risk_hint || "Unknown risk"}
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-400">No nearby properties available for this selection yet.</div>
                )}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Reasoning Trace" subtitle="Planner, retrieval, and chat agent activity for every answer">
          <AgentTimeline items={response?.agent_log || []} />
        </SectionCard>
      </div>
    </div>
  );
}
