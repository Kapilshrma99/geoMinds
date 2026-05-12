export function SectionCard({ title, subtitle, right, children, className = "" }) {
  return (
    <section className={`glass-panel rounded-[2rem] border border-white/50 p-6 shadow-panel backdrop-blur dark:border-white/10 ${className}`}>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-[0.02em]">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{subtitle}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}
