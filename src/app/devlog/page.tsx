import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Reveal } from "@/components/ui/Reveal";
import { devlog, devlogIntro } from "@/data/devlog";
import { profile } from "@/data/site";

export const metadata: Metadata = {
  title: "Dev Log",
  description: devlogIntro,
};

function formatDate(iso: string) {
  // Dates are plain calendar days, so format in UTC to avoid shifting a day.
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function Page() {
  const entries = [...devlog].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="py-16 md:py-24">
      <Container>
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-xs tracking-[0.2em] text-accent">Log —</span>
          <h1 className="font-serif text-5xl leading-[0.95] text-ink sm:text-6xl md:text-7xl">
            Dev
            <br />
            Log
          </h1>
        </div>

        <p className="mt-8 max-w-2xl font-mono text-sm leading-relaxed text-muted">
          {devlogIntro}{" "}
          Longer write-ups go on{" "}
          <a
            href={profile.links.wordpress}
            target="_blank"
            rel="noreferrer noopener"
            className="text-accent transition-opacity hover:opacity-75"
          >
            the blog
          </a>
          .
        </p>

        <ol className="mt-14 border-l border-edge">
          {entries.map((entry, i) => (
            <li key={`${entry.date}-${entry.project}`} className="relative pb-10 pl-6 md:pl-10">
              <span
                aria-hidden="true"
                className="absolute left-0 top-1.5 h-2.5 w-2.5 -translate-x-1/2 border border-accent bg-bg"
              />
              <Reveal delay={Math.min(i, 6) * 60}>
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <time
                    dateTime={entry.date}
                    className="font-mono text-xs uppercase tracking-[0.15em] text-accent"
                  >
                    {formatDate(entry.date)}
                  </time>
                  <Eyebrow>{entry.tag}</Eyebrow>
                </div>

                <h2 className="mt-2 font-serif text-2xl text-ink md:text-3xl">
                  {entry.href ? (
                    <Link href={entry.href} className="transition-colors hover:text-accent">
                      {entry.project}
                    </Link>
                  ) : (
                    entry.project
                  )}
                </h2>

                <p className="mt-3 max-w-3xl font-mono text-sm leading-relaxed text-muted">
                  {entry.summary}
                </p>

                {entry.more ? (
                  <a
                    href={entry.more.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-4 inline-block font-mono text-xs uppercase tracking-[0.15em] text-accent transition-opacity hover:opacity-75"
                  >
                    {entry.more.label} →
                  </a>
                ) : null}
              </Reveal>
            </li>
          ))}
        </ol>
      </Container>
    </div>
  );
}
