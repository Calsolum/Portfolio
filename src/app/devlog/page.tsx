import type { Metadata } from "next";

import { Container } from "@/components/ui/Container";
import { devlog, devlogIntro } from "@/data/devlog";
import { profile } from "@/data/site";
import { groupDevLog } from "@/lib/devlog";

import { DevLogLedger } from "./DevLogLedger";

export const metadata: Metadata = {
  title: "Dev Log",
  description: devlogIntro,
};

export default function Page() {
  const months = groupDevLog(devlog);

  return (
    <div className="py-16 md:py-24">
      <Container>
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-xs tracking-[0.2em] text-accent">Log —</span>
          <h1 className="font-serif text-5xl leading-[0.95] text-ink sm:text-6xl md:text-7xl">
            Dev
            <br />
            Log
          </h1>
        </div>

        <p className="mt-8 max-w-2xl font-mono text-sm leading-relaxed text-muted">
          {devlogIntro}{" "}
          Longer write-ups go on{" "}
          <a
            href={profile.links.wordpress}
            target="_blank"
            rel="noreferrer noopener"
            className="text-accent transition-opacity hover:opacity-75"
          >
            the blog
          </a>
          .
        </p>

        <DevLogLedger months={months} />
      </Container>
    </div>
  );
}
