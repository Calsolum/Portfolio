import Link from "next/link";

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

/** Compact changelog: month heading, week in a side column, one row per entry. */
export function DevLogLedger({ months }: { months: DevLogMonth[] }) {
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
