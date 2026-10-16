"use client";

import { useEffect, useState } from "react";

import { Button, Label, Notice } from "@/components/ui/controls";

// The generic controls moved to src/components/ui/controls.tsx so other pages can use them.
// They are re-exported here so the FGO panels keep importing from "./common".
export { Button, Label, Notice, Panel, Select, TextInput } from "@/components/ui/controls";

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
