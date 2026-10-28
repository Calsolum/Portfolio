import type { Metadata, Viewport } from "next";
import { Suspense } from "react";

import { Container } from "@/components/ui/Container";
import { Notice } from "@/components/ui/controls";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { SmashUpApp } from "@/smashup/ui/SmashUpApp";

export const metadata: Metadata = {
  title: "Smash Up Base Tracker",
  description:
    "Tracks power on every base in a game of Smash Up, scores bases by the rulebook when they break, and keeps the VP race. On one phone or on every phone at the table.",
  manifest: "/smash-up/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Smash Up", statusBarStyle: "black-translucent" },
  icons: { apple: "/smash-up/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function Page() {
  return (
    <div className="pb-16 pt-24 md:pb-24 md:pt-28">
      <Container>
        <header className="mb-8">
          <Eyebrow>Smash Up · Card game</Eyebrow>
          <h1 className="mt-3 font-serif text-4xl leading-[1.05] text-ink sm:text-5xl">Base Tracker</h1>
          <p className="mt-4 max-w-2xl font-mono text-xs leading-relaxed text-muted">
            Power on every base, scored by the rulebook the moment one breaks, and the race to 15. Pass one phone
            around the table, or share the game so everyone taps on their own.
          </p>
        </header>
        {/* The tracker reads ?room= from the address, which only the browser knows. */}
        <Suspense fallback={<Notice>Loading…</Notice>}>
          <SmashUpApp />
        </Suspense>
      </Container>
    </div>
  );
}
