import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { WorkCard } from "@/components/works/WorkCard";
import type { Work } from "@/data/site";

export function CategoryPage({
  index,
  title,
  titleLine2,
  intro,
  entries,
}: {
  index: string;
  title: string;
  titleLine2: string;
  intro: string;
  entries: Work[];
}) {
  return (
    <div className="py-16 md:py-24">
      <Container>
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-xs tracking-[0.2em] text-accent">{index} —</span>
          <h1 className="font-serif text-5xl leading-[0.95] text-ink sm:text-6xl md:text-7xl">
            {title}
            <br />
            {titleLine2}
          </h1>
        </div>

        <p className="mt-8 max-w-2xl font-mono text-sm leading-relaxed text-muted">{intro}</p>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {entries.map((entry, i) => (
            <Reveal key={entry.slug} delay={i * 80}>
              <WorkCard work={entry} />
            </Reveal>
          ))}
        </div>
      </Container>
    </div>
  );
}
