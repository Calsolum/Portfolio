import type { Metadata } from "next";

import { CategoryPage } from "@/components/works/CategoryPage";
import { sections } from "@/data/site";
import { worksInCategory } from "@/lib/content";

const section = sections.find((entry) => entry.id === "poetry")!;

export const metadata: Metadata = {
  title: `${section.title} ${section.titleLine2}`.trim(),
  description: section.intro,
};

export default function Page() {
  return (
    <CategoryPage
      index={section.index}
      title={section.title}
      titleLine2={section.titleLine2}
      intro={section.intro}
      entries={worksInCategory("poetry")}
    />
  );
}
