/** The `01 — Interactive Worlds` heading motif used at the top of each section. */
export function SectionRule({
  index,
  title,
  titleLine2,
  intro,
}: {
  index: string;
  title: string;
  titleLine2: string;
  intro?: string;
}) {
  return (
    <div className="border-t border-edge pt-8">
      <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <h2 className="flex items-baseline gap-4">
          <span className="font-mono text-xs tracking-[0.2em] text-accent">{index} —</span>
          <span className="font-serif text-4xl leading-[0.95] text-ink sm:text-5xl md:text-6xl">
            {title}
            <br />
            {titleLine2}
          </span>
        </h2>
        {intro ? (
          <p className="max-w-sm font-mono text-sm leading-relaxed text-muted md:pt-2 md:text-right">
            {intro}
          </p>
        ) : null}
      </div>
    </div>
  );
}
