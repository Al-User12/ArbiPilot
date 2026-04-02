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
    <section className={`glass-panel rounded-2xl p-5 ${className}`}>
      {(title || subtitle) && (
        <header className="mb-4">
          {title && <h3 className="text-sm font-semibold uppercase tracking-widest text-cyan-400 font-display">{title}</h3>}
          {subtitle && <div className="mt-1.5 text-sm text-slate-400 leading-relaxed">{subtitle}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
