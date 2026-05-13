import { motion } from "framer-motion";

export function StatCard({ title, value, hint, color = "from-mint/18 via-transparent to-transparent" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.25 }}
      className={`relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-gradient-to-br ${color} from-0% p-5 shadow-panel`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_45%)]" />
      <div className="relative">
        <div className="text-[11px] uppercase tracking-[0.28em] text-fog">{title}</div>
        <div className="mt-3 font-display text-4xl font-semibold text-haze">{value}</div>
        <div className="mt-2 text-sm leading-6 text-slate-300">{hint}</div>
      </div>
    </motion.div>
  );
}
