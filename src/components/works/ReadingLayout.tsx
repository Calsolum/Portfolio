import Link from "next/link";

import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import type { ExternalLink } from "@/data/site";

export function ReadingLayout({
  kind,
  title,
  intro,
  body,
  backHref,
  backLabel,
  links,
}: {
  kind: string;
  title: string;
  intro: string;
  body: string;
  backHref: string;
  backLabel: string;
  links?: ExternalLink[];
}) {
  return (
    <article className="py-16 md:py-24">
      <Container>
        <Link
          href={backHref}
          className="font-mono text-xs uppercase tracking-[0.15em] text-muted transition-colors hover:text-accent"
        >
          ← {backLabel}
        </Link>

        <header className="mt-10 border-b border-edge pb-10">
          <Eyebrow>{kind}</Eyebrow>
          <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-[1.05] text-ink sm:text-5xl md:text-6xl">
            {title}
          </h1>

          {intro ? (
            <div
              className="prose-intro mt-8 max-w-2xl"
              dangerouslySetInnerHTML={{ __html: intro }}
            />
          ) : null}

          {links?.length ? (
            <div className="mt-8 flex flex-wrap gap-4">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="border border-edge px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:border-accent hover:text-accent"
                  {...(link.href.startsWith("http")
                    ? { target: "_blank", rel: "noreferrer noopener" }
                    : {})}
                >
                  {link.label} →
                </a>
              ))}
            </div>
          ) : null}
        </header>

        <div
          className="prose-reading mt-14 max-w-[68ch]"
          dangerouslySetInnerHTML={{ __html: body }}
        />

        <div className="mt-20 max-w-[68ch] border-t border-edge pt-10">
          <Link
            href={backHref}
            className="font-mono text-xs uppercase tracking-[0.15em] text-accent transition-opacity hover:opacity-75"
          >
            ← {backLabel}
          </Link>
        </div>
      </Container>
    </article>
  );
}
