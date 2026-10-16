/**
 * URLs reach this page from two places that anyone can influence: OpenStreetMap
 * edits and whatever Claude read on the web. Nothing becomes an `href` without
 * passing through here.
 */

const TRACKING_PARAM = /^(utm_|mc_|fbclid$|gclid$|ref$|ref_src$)/i;

/** The URL normalised, or undefined for anything that is not a plain http(s) link to a real host. */
export function safeHttpUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const text = raw.trim();
  if (!text || text.length > 2000) return undefined;

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
  if (!url.hostname.includes(".")) return undefined;
  if (url.username || url.password) return undefined;

  url.hash = "";
  return url.toString();
}

/** The host without a leading "www.", lower case. */
export function hostKey(raw: string): string | undefined {
  const safe = safeHttpUrl(raw);
  return safe ? new URL(safe).hostname.replace(/^www\./, "") : undefined;
}

/**
 * A key for "is this the same page?": host without www, path without a
 * trailing slash, and the query minus tracking parameters. Two URLs that differ
 * only by those share a key.
 */
export function urlKey(raw: string): string | undefined {
  const safe = safeHttpUrl(raw);
  if (!safe) return undefined;

  const url = new URL(safe);
  const host = url.hostname.replace(/^www\./, "");
  const path = url.pathname.replace(/\/+$/, "").toLowerCase();
  const query = [...url.searchParams.entries()]
    .filter(([name]) => !TRACKING_PARAM.test(name))
    .map(([name, value]) => `${name}=${value}`)
    .sort()
    .join("&");
  return `${host}${path}${query ? `?${query}` : ""}`;
}
