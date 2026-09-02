import type { Metadata } from "next";

import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Reveal } from "@/components/ui/Reveal";
import { education, experience, profile, skillGroups } from "@/data/site";
import { getContent } from "@/lib/content";

export const metadata: Metadata = {
  title: "About",
  description:
    "Writer and self-taught technical implementer with a Creative Writing and Publishing degree and a Computer Programming diploma.",
};

export default function Page() {
  const { intro, body } = getContent("about");

  return (
    <div className="py-16 md:py-24">
      <Container>
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-xs tracking-[0.2em] text-accent">06 —</span>
          <h1 className="font-serif text-5xl leading-[0.95] text-ink sm:text-6xl md:text-7xl">
            About
          </h1>
        </div>

        <div className="mt-12 grid gap-12 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div
              className="prose-reading max-w-[62ch]"
              dangerouslySetInnerHTML={{ __html: [intro, body].filter(Boolean).join("\n") }}
            />
          </div>

          <aside className="space-y-8 lg:pt-2">
            <div className="border border-edge bg-card p-6">
              <Eyebrow>Based in</Eyebrow>
              <p className="mt-2 font-serif text-xl text-ink">{profile.location}</p>

              <div className="mt-6 space-y-2">
                <a
                  href={`mailto:${profile.email}`}
                  className="block font-mono text-sm text-accent transition-opacity hover:opacity-75"
                >
                  {profile.email}
                </a>
                <a
                  href={profile.links.linkedin}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block font-mono text-sm text-muted transition-colors hover:text-accent"
                >
                  LinkedIn →
                </a>
                <a
                  href={profile.links.itch}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block font-mono text-sm text-muted transition-colors hover:text-accent"
                >
                  itch.io →
                </a>
              </div>

              <a
                href={profile.resume}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-6 inline-block border border-edge px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:border-accent hover:text-accent"
              >
                Download resume (PDF) →
              </a>
            </div>
          </aside>
        </div>

        <section className="mt-20 border-t border-edge pt-12">
          <h2 className="font-serif text-3xl text-ink md:text-4xl">Experience</h2>

          <div className="mt-10 border-l border-edge pl-6 md:pl-10">
            {experience.map((entry, i) => (
              <Reveal key={`${entry.org}-${entry.role}`} delay={i * 60}>
                <div className="relative pb-12">
                  <span className="absolute -left-[1.9rem] top-2 h-2 w-2 rounded-full bg-accent md:-left-[2.9rem]" />
                  <p className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-muted">
                    {entry.period}
                  </p>
                  <h3 className="mt-2 font-serif text-2xl text-ink">{entry.role}</h3>
                  <p className="mt-1 font-mono text-sm text-accent">{entry.org}</p>
                  <ul className="mt-4 max-w-2xl space-y-2">
                    {entry.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="font-mono text-sm leading-relaxed text-muted before:mr-2 before:text-accent before:content-['—']"
                      >
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="mt-8 border-t border-edge pt-12">
          <h2 className="font-serif text-3xl text-ink md:text-4xl">Education</h2>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {education.map((entry) => (
              <div key={`${entry.credential}-${entry.field}`} className="border border-edge bg-card p-6">
                <div className="flex items-baseline justify-between gap-4">
                  <Eyebrow>{entry.credential}</Eyebrow>
                  <span className="font-mono text-xs text-accent">{entry.year}</span>
                </div>
                <h3 className="mt-3 font-serif text-xl leading-snug text-ink">{entry.field}</h3>
                <p className="mt-2 font-mono text-xs leading-relaxed text-muted">
                  {entry.institution}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 border-t border-edge pt-12">
          <h2 className="font-serif text-3xl text-ink md:text-4xl">Skills</h2>

          <div className="mt-10 space-y-8">
            {skillGroups.map((group) => (
              <div key={group.label} className="grid gap-4 md:grid-cols-[10rem_1fr]">
                <Eyebrow>{group.label}</Eyebrow>
                <ul className="flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <li
                      key={item}
                      className="border border-edge px-3 py-1.5 font-mono text-xs text-muted"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </Container>
    </div>
  );
}
