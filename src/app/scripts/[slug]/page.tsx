import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReadingLayout } from "@/components/works/ReadingLayout";
import { sections } from "@/data/site";
import { getContent, getWork, worksInCategory } from "@/lib/content";

const section = sections.find((entry) => entry.id === "scripts")!;
const label = `${section.title} ${section.titleLine2}`.trim();

export function generateStaticParams() {
  return worksInCategory("scripts").map((work) => ({ slug: work.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const work = getWork(slug);
  if (!work) return {};
  return { title: work.title, description: work.blurb };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const work = getWork(slug);

  if (!work || work.category !== "scripts") {
    notFound();
  }

  const { intro, body } = getContent(work.slug);

  return (
    <ReadingLayout
      kind={work.kind}
      title={work.title}
      intro={intro}
      body={body}
      backHref="/scripts"
      backLabel={label}
      links={work.links}
    />
  );
}
