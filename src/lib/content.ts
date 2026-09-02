import fs from "node:fs";
import path from "node:path";

import { projects, works, type Project, type Work } from "@/data/site";

const CONTENT_DIR = path.join(process.cwd(), "src", "content");

/**
 * The imported fragments open with a standfirst (kind line + blurb) followed by
 * an `<hr />` and then the work itself. Splitting there lets the reading page
 * style the introduction differently from the prose.
 */
export interface WorkContent {
  intro: string;
  body: string;
}

export function getContent(slug: string): WorkContent {
  const raw = fs.readFileSync(path.join(CONTENT_DIR, `${slug}.html`), "utf8");
  const separator = raw.indexOf("<hr />");

  if (separator === -1) {
    return { intro: raw.trim(), body: "" };
  }

  return {
    intro: raw.slice(0, separator).trim(),
    body: raw.slice(separator + "<hr />".length).trim(),
  };
}

export function getWork(slug: string): Work | undefined {
  return works.find((work) => work.slug === slug);
}

export function getProject(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}

export function worksInCategory(category: Work["category"]): Work[] {
  return works.filter((work) => work.category === category);
}
