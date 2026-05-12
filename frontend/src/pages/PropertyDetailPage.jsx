import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { AgentTimeline } from "../components/AgentTimeline";
import { SectionCard } from "../components/SectionCard";
import { api } from "../lib/api";

export function PropertyDetailPage() {
  const { id } = useParams();
  const [conflicts, setConflicts] = useState([]);
  const [report, setReport] = useState(null);

  useEffect(() => {
    const load = async () => {
      const reportsRes = await api.get("/reports");
      const target = reportsRes.data.find((item) => String(item.property_data_id) === String(id));
      if (target) {
        setReport(target);
        const conflictsRes = await api.get(`/gis/conflicts/${id}`);
        setConflicts(conflictsRes.data);
      }
    };
    load();
  }, [id]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
      <SectionCard title={`Property Detail #${id}`} subtitle="Detailed risk posture, conflicts, and next-step recommendation">
        {report ? (
          <div className="space-y-4">
            <div className="rounded-[1.75rem] bg-ink p-5 text-white">
              <div className="text-xs uppercase tracking-[0.35em] text-mint">Risk Summary</div>
              <div className="mt-3 text-2xl font-semibold">
                {report.risk_level} Risk ({report.risk_score}/100)
              </div>
              <div className="mt-2 text-sm text-slate-200">{report.summary}</div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50/80 p-4 dark:bg-slate-800/60">
                <div className="font-medium">Property Summary</div>
                <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
                  {JSON.stringify(report.report_json.property_summary, null, 2)}
                </pre>
              </div>
              <div className="rounded-2xl bg-slate-50/80 p-4 dark:bg-slate-800/60">
                <div className="font-medium">Recommendation</div>
                <div className="mt-3 text-sm">{report.report_json.recommendation}</div>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50/80 p-4 dark:bg-slate-800/60">
              <div className="font-medium">Conflict Signals</div>
              <div className="mt-3 space-y-3">
                {conflicts.map((conflict) => (
                  <div key={conflict.id} className="rounded-2xl bg-white p-4 text-sm dark:bg-slate-900">
                    <div className="font-medium">{conflict.conflict_type}</div>
                    <div className="mt-1 text-slate-600 dark:text-slate-300">{conflict.details}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-600 dark:text-slate-300">No report available yet for this property.</div>
        )}
      </SectionCard>

      <SectionCard title="Agent Trail" subtitle="How GeoMind reached the current conclusion">
        <AgentTimeline
          items={[
            { agent: "Planner Agent", message: "Coordinated document extraction, parcel match, and conflict evaluation workflow." },
            { agent: "Conflict Agent", message: "Focused on duplicate khasra and boundary overlap anomalies in the parcel cluster." },
            { agent: "Risk Agent", message: "Weighted legal and spatial anomalies into a stakeholder-friendly risk index." },
            { agent: "Report Agent", message: "Packaged the result into a shareable property intelligence brief." },
          ]}
        />
      </SectionCard>
    </div>
  );
}
