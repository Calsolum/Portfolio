import type { Metadata } from "next";

import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { DealsApp } from "@/deals/ui/DealsApp";

export const metadata: Metadata = {
  title: "Daily Deals",
  description:
    "Weekday food specials near you or any place you type: wing nights, taco Tuesdays and lunch combos, from a hand-checked list.",
};

export default function Page() {
  return (
    <div className="pb-16 pt-24 md:pb-24 md:pt-28">
      <Container>
        <header className="mb-8">
          <Eyebrow>Food · Weekday specials</Eyebrow>
          <h1 className="mt-3 font-serif text-4xl leading-[1.05] text-ink sm:text-5xl">Daily Deals</h1>
          <p className="mt-4 max-w-2xl font-mono text-xs leading-relaxed text-muted">
            Wing nights, taco Tuesdays and weekday lunch combos near you, by day of the week. Pick a place or use your
            location.
          </p>
        </header>
        <DealsApp />
      </Container>
    </div>
  );
}
