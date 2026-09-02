export function PullQuote({ text, attribution }: { text: string; attribution: string }) {
  return (
    <figure className="border-l-2 border-accent py-2 pl-6">
      <blockquote className="whitespace-pre-line font-[family-name:var(--font-baskerville)] text-lg italic leading-relaxed text-ink">
        {text}
      </blockquote>
      <figcaption className="mt-4 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted">
        — {attribution}
      </figcaption>
    </figure>
  );
}
