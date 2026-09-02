import type { ReactNode } from "react";

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted">
      {children}
    </span>
  );
}
