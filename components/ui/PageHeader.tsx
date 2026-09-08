export default function PageHeader({
  title, description, actions, compact = false, className = "",
}: { title: string; description?: string; actions?: React.ReactNode; compact?: boolean; className?: string }) {
  return (
    <div className={`page-transition flex flex-wrap items-end justify-between gap-4 ${compact ? "mb-0" : "mb-6"} ${className}`}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900"><span className="font-extrabold">{title.toUpperCase()}</span></h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
