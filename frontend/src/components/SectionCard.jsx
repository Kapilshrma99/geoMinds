export function SectionCard({ title, subtitle, helper, right, children, className = "" }) {
  return (
    <section className={`glass-panel noise-overlay rounded-[2rem] border border-white/10 p-6 shadow-panel ${className}`}>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.34em] text-fog">{title}</div>
          {subtitle ? <h2 className="mt-2 max-w-3xl font-display text-2xl font-semibold text-haze">{subtitle}</h2> : null}
          {helper ? <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{helper}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}
