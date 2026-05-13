import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, LoaderCircle } from "lucide-react";

function statusMeta(status) {
  if (status === "running") {
    return {
      icon: LoaderCircle,
      badge: "border-amber-400/25 bg-amber-400/10 text-amber-200",
      text: "Running",
      iconClass: "animate-spin",
    };
  }
  if (status === "failed") {
    return {
      icon: AlertTriangle,
      badge: "border-red-400/25 bg-red-400/10 text-red-200",
      text: "Failed",
      iconClass: "",
    };
  }
  return {
    icon: CheckCircle2,
    badge: "border-mint/25 bg-mint/10 text-mint",
    text: "Completed",
    iconClass: "",
  };
}

export function AgentTimeline({ items = [] }) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const meta = statusMeta(item.status);
        const Icon = meta.icon;
        const progress = Math.round((item.metadata?.progress || 0) * 100);
        const duration = item.metadata?.duration_ms;
        return (
          <motion.div
            key={`${item.id || item.agent}-${index}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.04 }}
            className="rounded-[1.7rem] border border-white/10 bg-white/5 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="rounded-2xl border border-white/10 bg-storm px-3 py-2 text-mint">
                  <Icon size={16} className={meta.iconClass} />
                </span>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.34em] text-fog">{item.agent}</div>
                  <div className="mt-1 text-sm text-slate-200">{item.message}</div>
                </div>
              </div>
              <div className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] ${meta.badge}`}>
                {meta.text}
              </div>
            </div>

            {typeof item.metadata?.progress === "number" ? (
              <div className="mt-4">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/6">
                  <div className="h-full rounded-full bg-gradient-to-r from-mint via-cyan-300 to-sky-400" style={{ width: `${Math.max(progress, 6)}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                  <span>{progress}% complete</span>
                  {item.metadata?.phase ? <span>{String(item.metadata.phase).replaceAll("_", " ")}</span> : null}
                  {duration ? <span>{duration} ms</span> : null}
                </div>
              </div>
            ) : null}

            {item.created_at ? (
              <div className="mt-3 text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</div>
            ) : null}
          </motion.div>
        );
      })}
    </div>
  );
}
