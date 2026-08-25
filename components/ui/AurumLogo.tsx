export default function AurumLogo({ className = "h-8 w-auto", dark = false }: { className?: string; dark?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* Precision Geometric Architectural A Crest */}
      <svg
        width="38"
        height="38"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        <rect width="48" height="48" rx="0" fill={dark ? "#ffffff" : "#ec3013"} />
        <path
          d="M24 8L36 38H30L27.5 31.5H20.5L18 38H12L24 8ZM24 16.8L22 25.8H26L24 16.8Z"
          fill={dark ? "#ec3013" : "#ffffff"}
        />
        <path
          d="M31 16L38 16L40 21L33 21L31 16Z"
          fill={dark ? "#ec3013" : "#ffffff"}
          opacity="0.8"
        />
      </svg>
      <div className="flex flex-col">
        <span className={`font-heading font-extrabold text-2xl tracking-tight leading-none ${dark ? "text-white" : "text-[#201e1d]"}`}>
          AURUM
        </span>
        <span className={`text-[9.5px] font-bold tracking-[0.2em] uppercase leading-tight mt-0.5 ${dark ? "text-white/80" : "text-neutral-500"}`}>
          Real Estate
        </span>
      </div>
    </div>
  );
}
