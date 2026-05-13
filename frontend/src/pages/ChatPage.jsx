import { Mic, MicOff, SearchCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AgentTimeline } from "../components/AgentTimeline";
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

export function ChatPage() {
  const { token } = useAuth();
  const [question, setQuestion] = useState(suggestions[0]);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const [propertyId, setPropertyId] = useState(1);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    api.get("/reports").then((res) => {
      setReports(res.data);
      if (res.data[0]?.property_data_id) setPropertyId(res.data[0].property_data_id);
    });
  }, []);

  const ask = async (text = question) => {
    setLoading(true);
    setResponse({ answer: "", citations: [], agent_log: [] });
    try {
      await streamChat({
        question: text,
        property_id: propertyId,
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
      const { data } = await api.post("/ai/chat", { question: text, property_id: propertyId });
      setResponse(data);
    } finally {
      setLoading(false);
    }
  };

  const selectedReport = useMemo(() => reports.find((report) => String(report.property_data_id) === String(propertyId)), [reports, propertyId]);

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
          <div className="mb-4 grid gap-3 md:grid-cols-[0.75fr_1fr]">
            <label className="rounded-2xl border border-white/10 bg-storm/80 px-4 py-3">
              <div className="mb-2 text-[11px] uppercase tracking-[0.28em] text-fog">Property context</div>
              <select value={propertyId} onChange={(e) => setPropertyId(Number(e.target.value))} className="w-full bg-transparent text-sm text-white outline-none">
                {reports.map((report) => (
                  <option key={report.id} value={report.property_data_id}>
                    Property {report.property_data_id} | Report {report.id} | {report.risk_level}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-2xl border border-white/10 bg-storm/80 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.28em] text-fog">Selected report summary</div>
              <div className="mt-2 text-sm text-slate-200">{selectedReport?.summary || "Choose a report to ground the conversation."}</div>
            </div>
          </div>

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

      <SectionCard title="Reasoning Trace" subtitle="Planner, retrieval, and chat agent activity for every answer">
        <AgentTimeline items={response?.agent_log || []} />
      </SectionCard>
    </div>
  );
}
