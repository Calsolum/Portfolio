"use client";

import { type ReactNode, useEffect, useState } from "react";

export const CLASS_LABEL: Record<string, string> = {
  saber: "Saber",
  archer: "Archer",
  lancer: "Lancer",
  rider: "Rider",
  caster: "Caster",
  assassin: "Assassin",
  berserker: "Berserker",
  shielder: "Shielder",
  ruler: "Ruler",
  alterEgo: "Alter Ego",
  avenger: "Avenger",
  moonCancer: "Moon Cancer",
  foreigner: "Foreigner",
  pretender: "Pretender",
  beast: "Beast",
};

export const classLabel = (c: string) =>
  CLASS_LABEL[c] ?? c.replace(/^grand(.)/, (_, x: string) => `Grand ${x.toUpperCase()}`);

export const stars = (n: number) => "★".repeat(Math.max(0, n));

/** Game art is hotlinked from Atlas's static host, so the Next image optimiser is not involved. */
export function Face({ src, alt, size = 40 }: { src?: string; alt: string; size?: number }) {
  if (!src) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center border border-edge bg-surface font-mono text-[0.6rem] text-muted"
        style={{ width: size, height: size }}
        aria-hidden
      >
        ?
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 border border-edge bg-surface object-cover"
      style={{ width: size, height: size }}
    />
  );
}

export function Button({
  children,
  onClick,
  variant = "ghost",
  disabled,
  type = "button",
  className = "",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  title?: string;
}) {
  const styles = {
    primary: "border-accent bg-accent text-bg hover:bg-transparent hover:text-accent",
    ghost: "border-edge text-ink hover:border-accent hover:text-accent",
    danger: "border-edge text-muted hover:border-accent2 hover:text-accent2",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`min-h-9 border px-3 py-1.5 font-mono text-xs uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted">{children}</span>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  width = "w-16",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  width?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <Label>{label}</Label>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)));
        }}
        className={`${width} border border-edge bg-bg px-2 py-1.5 font-mono text-sm text-ink focus:border-accent focus:outline-none`}
      />
    </label>
  );
}

export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <Label>{label}</Label>
      <select
        value={String(value)}
        onChange={(e) => {
          const picked = options.find((o) => String(o.value) === e.target.value);
          if (picked) onChange(picked.value);
        }}
        className="border border-edge bg-bg px-2 py-1.5 font-mono text-sm text-ink focus:border-accent focus:outline-none"
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label: string;
}) {
  return (
    <label className="flex flex-1 flex-col gap-1">
      <Label>{label}</Label>
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-edge bg-bg px-3 py-2 font-mono text-sm text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none"
      />
    </label>
  );
}

export function Panel({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border border-edge bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-edge px-4 py-3">
        <h2 className="font-display text-2xl tracking-wide text-ink">{title}</h2>
        {aside}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Notice({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "error" }) {
  return (
    <p
      className={`border-l-2 px-3 py-2 font-mono text-xs leading-relaxed ${
        tone === "error" ? "border-accent2 text-accent2" : "border-edge text-muted"
      }`}
    >
      {children}
    </p>
  );
}

/** Loads a promise once and exposes its state; `retry` re-runs it. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({
    loading: true,
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({ ...s, loading: true, error: undefined }));
    load()
      .then((data) => live && setState({ data, loading: false }))
      .catch(
        (err: unknown) =>
          live &&
          setState({
            loading: false,
            error: err instanceof Error ? err.message : "Could not reach Atlas Academy.",
          }),
      );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);
  return { ...state, retry: () => setAttempt((a) => a + 1) };
}

export function LoadError({ error, retry }: { error: string; retry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Notice tone="error">Couldn&apos;t load game data from Atlas Academy: {error}</Notice>
      <Button onClick={retry}>Retry</Button>
    </div>
  );
}
