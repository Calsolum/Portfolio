import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Reveal } from "@/components/ui/Reveal";
import { projects, sections } from "@/data/site";

const section = sections.find((entry) => entry.id === "projects")!;

export const metadata: Metadata = {
  title: "Technical Projects",
  description: section.intro,
};

export default function Page() {
  return (
    <div className="py-16 md:py-24">
      <Container>
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-xs tracking-[0.2em] text-accent">{section.index} —</span>
          <h1 className="font-serif text-5xl leading-[0.95] text-ink sm:text-6xl md:text-7xl">
            {section.title}
            <br />
            {section.titleLine2}
          </h1>
        </div>

        <p className="mt-8 max-w-2xl font-mono text-sm leading-relaxed text-muted">
          {section.intro}
        </p>

        <div className="mt-14 grid gap-6">
          {projects.map((project, i) => (
            <Reveal key={project.slug} delay={i * 80}>
              <article className="border border-edge bg-card p-6 transition-colors hover:border-accent md:p-8">
                <Eyebrow>{project.kind}</Eyebrow>

                <h2 className="mt-3 font-serif text-3xl text-ink md:text-4xl">{project.title}</h2>

                <p className="mt-4 max-w-3xl font-mono text-sm leading-relaxed text-muted">
                  {project.blurb}
                </p>

                <p className="mt-6 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-muted">
                  {project.stack}
                </p>

                <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
                  <Link
                    href={`/projects/${project.slug}`}
                    className="font-mono text-xs uppercase tracking-[0.15em] text-accent transition-opacity hover:opacity-75"
                  >
                    Read the write-up →
                  </Link>
                  {project.app ? (
                    <a
                      href={project.app}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-mono text-xs uppercase tracking-[0.15em] text-muted transition-colors hover:text-accent"
                    >
                      Launch app →
                    </a>
                  ) : null}
                  {project.links?.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-mono text-xs uppercase tracking-[0.15em] text-muted transition-colors hover:text-accent"
                    >
                      {link.label} →
                    </a>
                  ))}
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </div>
  );
}
