import type { ReactNode } from "react";

export function CardShell({
  title,
  subtitle,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`relative rounded-[24px] bg-[#09090b]/45 border border-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_8px_28px_rgba(0,0,0,0.42)] backdrop-blur-md overflow-hidden p-6 lg:p-8 transition-[border-color,transform] duration-300 ease-out hover:border-white/[0.08] hover:-translate-y-0.5 ${className}`}>
      {/* Subtle organic inner glare */}
      <div className="absolute inset-x-0 top-0 h-[100px] w-full bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />
      <div className="absolute -inset-x-1/4 -inset-y-1/3 bg-gradient-to-br from-cyan-500/[0.012] to-emerald-500/[0.012] opacity-40 blur-2xl pointer-events-none" />
      
      {(title || subtitle) && (
        <header className="relative mb-6 flex flex-col gap-2 border-b border-white/[0.04] pb-5 z-10">
          {title && <h3 className="text-sm font-semibold tracking-wide text-slate-100">{title}</h3>}
          {subtitle && <div className="text-[13px] text-slate-400 leading-relaxed font-light">{subtitle}</div>}
        </header>
      )}
      <div className="relative z-10">{children}</div>
    </section>
  );
}
