import Link from "next/link";

import { Eyebrow } from "@/components/ui/Eyebrow";
import { Reveal } from "@/components/ui/Reveal";
import type { DevLogEntry } from "@/data/devlog";
import { type DevLogMonth, formatDay } from "@/lib/devlog";

function ProjectName({ entry }: { entry: DevLogEntry }) {
  return entry.href ? (
    <Link href={entry.href} className="transition-colors hover:text-accent">
      {entry.project}
    </Link>
  ) : (
    <>{entry.project}</>
  );
}

function MoreLink({ entry }: { entry: DevLogEntry }) {
  return entry.more ? (
    <a
      href={entry.more.href}
      target="_blank"
      rel="noreferrer noopener"
      className="mt-3 inline-block font-mono text-xs uppercase tracking-[0.15em] text-accent transition-opacity hover:opacity-75"
    >
      {entry.more.label} →
    </a>
  ) : null;
}

const entryKey = (entry: DevLogEntry) => `${entry.date}-${entry.project}`;

/** A: timeline. Big month headings, week labels, entries hung off a vertical rule. */
export function TimelineLayout({ months }: { months: DevLogMonth[] }) {
  return (
    <div className="mt-14 space-y-16">
      {months.map((month) => (
        <section key={month.key}>
          <h2 className="font-serif text-4xl text-ink md:text-5xl">{month.label}</h2>
          <div className="mt-8 space-y-10">
            {month.weeks.map((week) => (
              <div key={week.start}>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
                  {week.label}
                </p>
                <ol className="mt-5 border-l border-edge">
                  {week.entries.map((entry) => (
                    <li key={entryKey(entry)} className="relative pb-8 pl-6 last:pb-0 md:pl-10">
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1.5 h-2.5 w-2.5 -translate-x-1/2 border border-accent bg-bg"
                      />
                      <Reveal>
                        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                          <time
                            dateTime={entry.date}
                            className="font-mono text-xs uppercase tracking-[0.15em] text-muted"
                          >
                            {formatDay(entry.date, { weekday: "short" })}
                          </time>
                          <Eyebrow>{entry.tag}</Eyebrow>
                        </div>
                        <h3 className="mt-2 font-serif text-2xl text-ink md:text-3xl">
                          <ProjectName entry={entry} />
                        </h3>
                        <p className="mt-3 max-w-3xl font-mono text-sm leading-relaxed text-muted">
                          {entry.summary}
                        </p>
                        <MoreLink entry={entry} />
                      </Reveal>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** B: cards. Month banner, week row, entries as bordered cards in a grid. */
export function CardsLayout({ months }: { months: DevLogMonth[] }) {
  return (
    <div className="mt-14 space-y-16">
      {months.map((month) => (
        <section key={month.key}>
          <div className="flex items-center gap-4">
            <h2 className="font-display text-3xl tracking-wide text-ink md:text-4xl">
              {month.label}
            </h2>
            <span aria-hidden="true" className="h-px flex-1 bg-edge" />
          </div>
          <div className="mt-8 space-y-10">
            {month.weeks.map((week) => (
              <div key={week.start}>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
                  {week.label}
                </p>
                <ul className="mt-4 grid gap-4 md:grid-cols-2">
                  {week.entries.map((entry) => (
                    <li key={entryKey(entry)}>
                      <Reveal className="h-full">
                        <article className="flex h-full flex-col border border-edge bg-card p-6 transition-colors hover:border-accent">
                          <div className="flex items-center justify-between gap-4">
                            <time
                              dateTime={entry.date}
                              className="font-mono text-xs uppercase tracking-[0.15em] text-accent"
                            >
                              {formatDay(entry.date, { weekday: "short" })}
                            </time>
                            <span className="border border-edge px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted">
                              {entry.tag}
                            </span>
                          </div>
                          <h3 className="mt-4 font-serif text-2xl text-ink">
                            <ProjectName entry={entry} />
                          </h3>
                          <p className="mt-3 font-mono text-sm leading-relaxed text-muted">
                            {entry.summary}
                          </p>
                          <MoreLink entry={entry} />
                        </article>
                      </Reveal>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** C: ledger. Compact changelog: month heading, week in a side column, one row per entry. */
export function LedgerLayout({ months }: { months: DevLogMonth[] }) {
  return (
    <div className="mt-14 space-y-14">
      {months.map((month) => (
        <section key={month.key}>
          <h2 className="border-b border-accent pb-3 font-mono text-sm uppercase tracking-[0.25em] text-accent">
            {month.label}
          </h2>
          <div className="divide-y divide-edge">
            {month.weeks.map((week) => (
              <div key={week.start} className="grid gap-3 py-6 md:grid-cols-[10rem_1fr] md:gap-8">
                <p className="font-mono text-xs uppercase tracking-[0.15em] text-muted">
                  {week.label}
                </p>
                <ul className="space-y-5">
                  {week.entries.map((entry) => (
                    <li
                      key={entryKey(entry)}
                      className="grid gap-1 sm:grid-cols-[6.5rem_1fr] sm:gap-4"
                    >
                      <time
                        dateTime={entry.date}
                        className="font-mono text-xs uppercase tracking-[0.15em] whitespace-nowrap text-accent sm:pt-1"
                      >
                        {formatDay(entry.date, { weekday: "short" })}
                      </time>
                      <div>
                        <p className="font-serif text-xl text-ink">
                          <ProjectName entry={entry} />
                          <span className="ml-3 align-middle font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted">
                            {entry.tag}
                          </span>
                        </p>
                        <p className="mt-1 font-mono text-sm leading-relaxed text-muted">
                          {entry.summary}
                        </p>
                        <MoreLink entry={entry} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
