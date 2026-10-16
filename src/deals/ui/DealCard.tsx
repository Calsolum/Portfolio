import { describeDays } from "../lib/days";
import { directionsUrl, formatDistance, mapSearchUrl } from "../lib/geo";
import { hostKey } from "../lib/url";
import type { DealView } from "../types";

const checkedFormat = new Intl.DateTimeFormat("en-CA", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const endsFormat = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });

function mapLink(deal: DealView, areaLabel?: string): string {
  if (deal.lat !== undefined && deal.lon !== undefined) return directionsUrl({ lat: deal.lat, lon: deal.lon });
  return mapSearchUrl([deal.place, deal.address ?? areaLabel].filter(Boolean).join(" "));
}

export function DealCard({ deal, areaLabel }: { deal: DealView; areaLabel?: string }) {
  const sourceHost = hostKey(deal.sourceUrl);
  const moreNearby = deal.chain && deal.locations && deal.locations > 1 ? deal.locations - 1 : 0;

  return (
    <article className="flex h-full flex-col border border-edge bg-card p-4 transition-colors hover:border-accent/60 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-serif text-xl leading-tight text-ink">{deal.place}</h3>
        {deal.distanceKm !== undefined ? (
          <p className="shrink-0 font-mono text-xs text-muted">{formatDistance(deal.distanceKm)} away</p>
        ) : null}
      </div>
      {deal.address ? <p className="mt-1 font-mono text-[0.7rem] text-muted">{deal.address}</p> : null}

      <p className="mt-3 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-accent">{deal.title}</p>
      <p className="mt-2 font-mono text-sm leading-relaxed text-ink/90">{deal.details}</p>

      <ul className="mt-3 flex flex-wrap gap-2 font-mono text-[0.65rem] uppercase tracking-[0.1em]">
        <li className="border border-accent/40 px-2 py-1 text-accent">{describeDays(deal.days)}</li>
        {deal.hours ? <li className="border border-edge px-2 py-1 text-muted">{deal.hours}</li> : null}
        {deal.price ? <li className="border border-edge px-2 py-1 text-ink">{deal.price}</li> : null}
        {deal.until ? (
          <li className="border border-accent2/50 px-2 py-1 text-accent2">
            Ends {endsFormat.format(new Date(`${deal.until}T00:00:00Z`))}
          </li>
        ) : null}
      </ul>

      {deal.conditions ? (
        <p className="mt-3 font-mono text-xs leading-relaxed text-muted">{deal.conditions}</p>
      ) : null}
      {deal.chain ? (
        <p className="mt-2 font-mono text-xs leading-relaxed text-muted">
          Chain deal: only some locations take part
          {moreNearby > 0 ? `, and ${moreNearby} more ${moreNearby === 1 ? "branch is" : "branches are"} nearby` : ""}. Check
          with the restaurant.
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-x-5 pt-2 font-mono text-xs uppercase tracking-[0.12em]">
        <a
          href={deal.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Source for ${deal.place}: ${deal.title} (opens in a new tab)`}
          className="inline-flex min-h-11 items-center text-accent transition-opacity hover:opacity-75"
        >
          Source ↗
          {sourceHost ? <span className="ml-2 normal-case tracking-normal text-muted">{sourceHost}</span> : null}
        </a>
        <a
          href={mapLink(deal, areaLabel)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Directions to ${deal.place} (opens in a new tab)`}
          className="inline-flex min-h-11 items-center text-muted transition-colors hover:text-accent"
        >
          Directions ↗
        </a>
      </div>

      <p
        className={`font-mono text-[0.65rem] leading-relaxed ${deal.stale ? "text-accent2" : "text-muted"}`}
      >
        {deal.origin === "curated" && deal.verified
          ? deal.stale
            ? `Last checked ${checkedFormat.format(new Date(`${deal.verified}T00:00:00Z`))}. May be out of date.`
            : `Checked ${checkedFormat.format(new Date(`${deal.verified}T00:00:00Z`))}`
          : "Found on the web by Claude. Confirm with the restaurant before you go."}
      </p>
    </article>
  );
}
