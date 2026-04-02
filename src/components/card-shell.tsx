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
    <section className={`relative rounded-[20px] bg-[#09090b]/80 border border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-3xl overflow-hidden p-6 ${className}`}>
      {(title || subtitle) && (
        <header className="mb-6 flex flex-col gap-1.5 border-b border-white/[0.04] pb-4">
          {title && <h3 className="text-sm font-medium text-slate-100">{title}</h3>}
          {subtitle && <div className="text-sm text-slate-500 leading-relaxed">{subtitle}</div>}
        </header>
      )}
      <div className="relative z-10">{children}</div>
    </section>
  );
}
