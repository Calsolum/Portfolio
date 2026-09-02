import Link from "next/link";

import { Container } from "@/components/ui/Container";
import { profile, projects, works } from "@/data/site";

/** The five works surfaced beside the hero, in the order the landing page reads. */
const featured = [
  { slug: "mansion-of-fate", type: "Visual Novel", href: "/games" },
  { slug: "choices", type: "RPG", href: "/games" },
  { slug: "the-infinite-cycle", type: "Novel Series", href: "/fiction/the-infinite-cycle" },
  { slug: "veritas-case-files", type: "Novella", href: "/fiction/veritas-case-files" },
  { slug: "overlooked", type: "Short Film", href: "/scripts/overlooked" },
];

export function Hero() {
  const titles = new Map(
    [...works, ...projects].map((entry) => [entry.slug, entry.title] as const),
  );

  return (
    <section className="border-b border-edge">
      <Container className="grid gap-12 py-20 md:grid-cols-[1.2fr_1fr] md:gap-16 md:py-28">
        <div className="animate-fade-up">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">
            {profile.role}
          </p>

          <h1 className="mt-6 font-display text-[clamp(4rem,16vw,10rem)] leading-[0.82] tracking-tight text-ink">
            Tariq
            <br />
            Singh
          </h1>

          <p className="mt-8 font-serif text-2xl text-ink sm:text-3xl">{profile.tagline}</p>

          <p className="mt-4 max-w-md font-mono text-sm leading-relaxed text-muted">
            {profile.intro}
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/fiction"
              className="border border-accent bg-accent px-6 py-3 font-mono text-xs uppercase tracking-[0.15em] text-bg transition-opacity hover:opacity-85"
            >
              Read the fiction
            </Link>
            <Link
              href="/projects"
              className="border border-edge px-6 py-3 font-mono text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:border-accent hover:text-accent"
            >
              Play the projects
            </Link>
          </div>
        </div>

        <div className="flex animate-fade-up flex-col gap-2 [animation-delay:400ms] md:pt-4">
          {featured.map((item) => (
            <Link
              key={item.slug}
              href={item.href}
              className="flex items-center gap-3 border border-edge px-4 py-3 transition-colors hover:border-accent"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span className="flex-1 font-serif text-[0.95rem] text-ink">
                {titles.get(item.slug)}
              </span>
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-muted">
                {item.type}
              </span>
            </Link>
          ))}
          <p className="px-4 py-2 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-muted">
            + Poetry, stage play &amp; 3 projects →
          </p>
        </div>
      </Container>
    </section>
  );
}
