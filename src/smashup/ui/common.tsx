"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Six colours that stay apart on the dark page; a name always goes with one, so colour is never the only cue. */
export const PLAYER_COLORS = ["#60a5fa", "#f472b6", "#fb923c", "#4ade80", "#a78bfa", "#e5e5e5"];

export const playerColor = (index: number) => PLAYER_COLORS[index % PLAYER_COLORS.length];

export function PlayerDot({ index, className = "" }: { index: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: playerColor(index) }}
    />
  );
}

export const vpText = (vps: readonly number[]) => vps.join("·");

export const ordinal = (place: number) => ["1st", "2nd", "3rd"][place - 1] ?? `${place}th`;

/** A square −/+ button, big enough for a thumb. */
export function StepButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-11 shrink-0 items-center justify-center border border-edge font-mono text-lg text-ink transition-colors hover:border-accent hover:text-accent active:bg-accent active:text-bg disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/** A number with −/+ either side, for VP awards, targets and counts. */
export function Stepper({
  value,
  onChange,
  min = -99,
  max = 99,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <StepButton label={`${label}: one less`} onClick={() => onChange(value - 1)} disabled={value <= min}>
        −
      </StepButton>
      <span className="w-10 text-center font-mono text-lg tabular-nums text-ink" aria-live="polite">
        {value}
      </span>
      <StepButton label={`${label}: one more`} onClick={() => onChange(value + 1)} disabled={value >= max}>
        +
      </StepButton>
    </div>
  );
}

/**
 * A modal on the browser's own <dialog>, which traps focus and closes on Escape.
 * It is shown while mounted, so callers render it only when it should be open.
 * Opening it focuses the close button, or the element marked data-autofocus.
 */
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
      // showModal focuses the first control it finds, which is the close button.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // A tap on the backdrop (the dialog element itself, outside its panel) closes it.
        if (e.target === ref.current) onClose();
      }}
      className="m-auto max-h-[90dvh] w-[min(36rem,calc(100vw-2rem))] border border-edge bg-card p-0 text-ink backdrop:bg-black/75"
    >
      <div className="flex flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-edge bg-card px-4 py-3">
          <h2 className="font-display text-2xl tracking-wide text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center font-mono text-xl text-muted hover:text-accent"
          >
            ×
          </button>
        </header>
        <div className="p-4">{children}</div>
      </div>
    </dialog>
  );
}

/** A button that asks for a second tap before doing something that can't be taken back. */
export function ConfirmButton({
  children,
  confirmText,
  onConfirm,
  className = "",
}: {
  children: ReactNode;
  confirmText: string;
  onConfirm: () => void;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
      className={`min-h-11 border px-3 py-1.5 font-mono text-xs uppercase tracking-[0.12em] transition-colors ${
        armed ? "border-accent2 text-accent2" : "border-edge text-muted hover:border-accent2 hover:text-accent2"
      } ${className}`}
    >
      {armed ? confirmText : children}
    </button>
  );
}
