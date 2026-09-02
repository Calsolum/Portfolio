import Link from "next/link";

import { Hero } from "@/components/home/Hero";
import { Stats } from "@/components/home/Stats";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SectionRule } from "@/components/ui/SectionRule";
import { PullQuote } from "@/components/works/PullQuote";
import { WorkCard } from "@/components/works/WorkCard";
import { profile, projects, sections, works } from "@/data/site";

export default function Home() {
  return (
    <>
      <Hero />
      <Stats />

      {sections.map((section) => {
        const entries =
          section.id === "projects"
            ? projects
            : works.filter((work) => work.category === section.id);
        const quoted = entries.find((entry) => entry.quote);

        return (
          <section key={section.id} className="border-b border-edge py-16 md:py-24">
            <Container>
              <SectionRule
                index={section.index}
                title={section.title}
                titleLine2={section.titleLine2}
                intro={section.intro}
              />

              <div className="mt-12 grid gap-6 md:grid-cols-2">
                {entries.map((entry, i) => (
                  <Reveal key={entry.slug} delay={i * 80}>
                    <WorkCard work={entry} />
                  </Reveal>
                ))}
              </div>

              {quoted?.quote ? (
                <Reveal className="mt-12">
                  <PullQuote {...quoted.quote} />
                </Reveal>
              ) : null}
            </Container>
          </section>
        );
      })}

      <section id="contact" className="py-20 md:py-28">
        <Container>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">Get in touch</p>
          <h2 className="mt-6 font-serif text-5xl leading-none text-ink md:text-7xl">
            Let&apos;s talk.
          </h2>
          <p className="mt-6 max-w-lg font-mono text-sm leading-relaxed text-muted">
            For commissions, collaborations, publishing inquiries, or just to say hello. These
            works are in progress — if you&apos;re a publisher, agent, or fellow reader who&apos;d
            like to read further chapters, get in touch.
          </p>

          <a
            href={`mailto:${profile.email}`}
            className="mt-10 inline-block font-serif text-3xl text-accent underline decoration-1 underline-offset-8 transition-opacity hover:opacity-75 md:text-4xl"
          >
            {profile.email}
          </a>

          <div className="mt-10">
            <Link
              href="/about"
              className="border border-edge px-6 py-3 font-mono text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:border-accent hover:text-accent"
            >
              About &amp; experience →
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
