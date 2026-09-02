import { Container } from "@/components/ui/Container";
import { profile } from "@/data/site";

const social = [
  { label: "Email", href: `mailto:${profile.email}` },
  { label: "itch.io", href: profile.links.itch },
  { label: "LinkedIn", href: profile.links.linkedin },
  { label: "Blog", href: profile.links.wordpress },
];

export function Footer() {
  return (
    <footer className="border-t border-edge py-12">
      <Container className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-display text-xl tracking-wide text-ink">
            Tariq<span className="text-accent">Singh</span>
          </p>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.15em] text-muted">
            Writer · Developer · Storyteller
          </p>
        </div>

        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {social.map((item) => (
            <li key={item.label}>
              <a
                href={item.href}
                className="font-mono text-xs uppercase tracking-[0.15em] text-muted transition-colors hover:text-accent"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>

        <p className="font-mono text-xs text-muted">
          © {new Date().getFullYear()} {profile.name}
        </p>
      </Container>
    </footer>
  );
}
