import { Container } from "@/components/ui/Container";
import { stats } from "@/data/site";

export function Stats() {
  return (
    <section className="border-b border-edge">
      <Container className="grid grid-cols-2 gap-y-8 py-12 sm:grid-cols-4 lg:grid-cols-7">
        {stats.map((stat) => (
          <div key={stat.label}>
            <p className="font-display text-4xl leading-none text-accent">{stat.value}</p>
            <p className="mt-2 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted">
              {stat.label}
            </p>
          </div>
        ))}
      </Container>
    </section>
  );
}
