import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReadingLayout } from "@/components/works/ReadingLayout";
import { projects } from "@/data/site";
import { getContent, getProject } from "@/lib/content";

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};
  return { title: project.title, description: project.blurb };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);

  if (!project) {
    notFound();
  }

  const { intro, body } = getContent(project.slug);

  return (
    <ReadingLayout
      kind={project.kind}
      title={project.title}
      intro={intro}
      body={body}
      backHref="/projects"
      backLabel="Technical Projects"
      links={project.app ? [{ label: "Launch app", href: project.app }] : undefined}
    />
  );
}
