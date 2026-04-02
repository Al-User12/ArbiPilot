import type { ReactNode } from "react";

export function CardShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 shadow-[0_0_0_1px_rgba(56,189,248,0.08)] backdrop-blur-sm">
      <header className="mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-cyan-200/90">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  );
}
