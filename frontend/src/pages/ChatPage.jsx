import { useState } from "react";

import { AgentTimeline } from "../components/AgentTimeline";
import { SectionCard } from "../components/SectionCard";
import { api, streamChat } from "../lib/api";
import { useAuth } from "../state/AuthContext";

const suggestions = [
  "Show disputed properties near this land",
  "Which parcels overlap with this property?",
  "Why is this property high risk?",
  "Generate report for Khasra 245/2",
];

export function ChatPage() {
  const { token } = useAuth();
  const [question, setQuestion] = useState(suggestions[2]);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const ask = async (text = question) => {
    setLoading(true);
    setResponse({ answer: "", citations: [], agent_log: [] });
    try {
      await streamChat({
        question: text,
        property_id: 1,
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
    } catch (error) {
      const { data } = await api.post("/ai/chat", { question: text, property_id: 1 });
      setResponse(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
      <SectionCard title="AI Property Chat" subtitle="Natural language reasoning grounded in document chunks and parcel intelligence">
        <div className="rounded-[1.75rem] bg-slate-50/80 p-4 dark:bg-slate-800/60">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={5}
            className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm outline-none dark:border-slate-700 dark:bg-slate-900"
            placeholder="Ask about conflicts, overlaps, risk reasons, or report generation"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {suggestions.map((item) => (
              <button key={item} onClick={() => setQuestion(item)} className="rounded-full bg-white px-3 py-2 text-xs dark:bg-slate-900">
                {item}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button onClick={() => ask()} className="rounded-2xl bg-ink px-5 py-3 text-sm text-white">
              {loading ? "Streaming..." : "Ask GeoMind AI"}
            </button>
            <button onClick={() => ask("Why is this property high risk?")} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm dark:border-slate-700">
              Demo voice query
            </button>
          </div>
        </div>

        {response ? (
          <div className="mt-6 rounded-[1.75rem] bg-ink p-5 text-white">
            <div className="text-xs uppercase tracking-[0.3em] text-mint">Answer</div>
            <div className="mt-3 text-lg leading-7">{response.answer}</div>
            <div className="mt-4 text-sm text-slate-200">Citations: {(response.citations || []).join(" | ")}</div>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Chat Agent Activity" subtitle="Planner plus retrieval trail for explainable responses">
        <AgentTimeline items={response?.agent_log || []} />
      </SectionCard>
    </div>
  );
}
