import Link from "next/link";

import { Eyebrow } from "@/components/ui/Eyebrow";
import type { Work } from "@/data/site";

function readingHref(work: Work) {
  return `/${work.category}/${work.slug}`;
}

export function WorkCard({ work, showRead = true }: { work: Work; showRead?: boolean }) {
  return (
    <article className="flex h-full flex-col border border-edge bg-card p-6 transition-colors hover:border-accent md:p-8">
      <div className="flex items-center justify-between gap-4">
        <Eyebrow>{work.kind}</Eyebrow>
        {work.status ? (
          <span className="shrink-0 border border-accent/40 px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.15em] text-accent">
            {work.status}
          </span>
        ) : null}
      </div>

      <h3 className="mt-3 font-serif text-2xl leading-tight text-ink md:text-3xl">
        {work.title}
      </h3>

      <p className="mt-4 flex-1 font-mono text-sm leading-relaxed text-muted">{work.blurb}</p>

      {work.tags?.length ? (
        <ul className="mt-6 flex flex-wrap gap-2">
          {work.tags.map((tag) => (
            <li
              key={tag}
              className="border border-edge px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-[0.1em] text-muted"
            >
              {tag}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
        {showRead ? (
          <Link
            href={readingHref(work)}
            className="font-mono text-xs uppercase tracking-[0.15em] text-accent transition-opacity hover:opacity-75"
          >
            Read →
          </Link>
        ) : null}
        {work.links?.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="font-mono text-xs uppercase tracking-[0.15em] text-muted transition-colors hover:text-accent"
            {...(link.href.startsWith("http")
              ? { target: "_blank", rel: "noreferrer noopener" }
              : {})}
          >
            {link.label} →
          </a>
        ))}
      </div>
    </article>
  );
}
