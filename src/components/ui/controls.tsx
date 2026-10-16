"use client";

import type { ReactNode } from "react";

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
