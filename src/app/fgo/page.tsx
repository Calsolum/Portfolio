import type { Metadata, Viewport } from "next";

import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { FgoApp } from "@/fgo/ui/FgoApp";

export const metadata: Metadata = {
  title: "FGO Team Builder",
  description:
    "Finds Fate/Grand Order (NA) loadouts that clear every wave with one NP each, using your own servants, craft essences and mystic codes.",
  manifest: "/fgo/manifest.webmanifest",
  appleWebApp: { capable: true, title: "FGO Teams", statusBarStyle: "black-translucent" },
  icons: { apple: "/fgo/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function Page() {
  return (
    <div className="pb-16 pt-24 md:pb-24 md:pt-28">
      <Container>
        <header className="mb-8">
          <Eyebrow>Fate/Grand Order · NA</Eyebrow>
          <h1 className="mt-3 font-serif text-4xl leading-[1.05] text-ink sm:text-5xl">Team Builder</h1>
          <p className="mt-4 max-w-2xl font-mono text-xs leading-relaxed text-muted">
            Enter your servants, CEs and usual friend supports once. Pick a quest, and it finds the
            teams, CEs and skill order that clear every wave with one NP each, in the fewest taps.
          </p>
        </header>
        <FgoApp />
      </Container>
    </div>
  );
}
