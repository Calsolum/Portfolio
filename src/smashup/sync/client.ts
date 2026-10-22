import { isRecord, parseEntries } from "../lib/actions";
import type { Entry } from "../types";

/**
 * Keeping one shared game in step across phones. Each phone shows the entries
 * the server has confirmed, in the server's order, followed by its own taps
 * that are still on their way. Taps are sent one at a time, in order, so an
 * entry never arrives before the one it depends on (a tap on a base placed a
 * moment earlier). Between taps the phone polls: quickly just after anything
 * happens, slowly when the table is quiet, and not at all while hidden.
 */

export const FAST_POLL_MS = 1500;
export const SLOW_POLL_MS = 4000;
/** How long after the last change polling stays fast. */
export const ACTIVE_MS = 20_000;
const RETRY_START_MS = 1000;
const RETRY_MAX_MS = 15_000;

export interface Page {
  entries: Entry[];
  /** The position to read from next. */
  cursor: number;
  /** How many entries the room holds. */
  total: number;
}

/** Why a request failed: offline and busy are worth retrying; the rest are final. */
export type FailureKind = "offline" | "busy" | "gone" | "full" | "bad";

export class SyncError extends Error {
  constructor(
    readonly kind: FailureKind,
    message: string,
  ) {
    super(message);
    this.name = "SyncError";
  }
}

export interface Transport {
  create(entries: readonly Entry[]): Promise<{ code: string; cursor: number }>;
  read(code: string, since: number): Promise<Page>;
  append(code: string, entry: Entry, since: number): Promise<Page>;
}

const BASE = "/api/smash-up/rooms";

async function request(fetchImpl: typeof fetch, url: string, init?: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchImpl(url, { cache: "no-store", ...init });
  } catch {
    throw new SyncError("offline", "Can't reach the server.");
  }
  const body: unknown = await res.json().catch(() => null);
  if (res.ok) return body;
  const message = isRecord(body) && typeof body.message === "string" ? body.message : `HTTP ${res.status}`;
  const kind: FailureKind =
    res.status === 404 ? "gone" : res.status === 409 ? "full" : res.status === 400 || res.status === 403 ? "bad" : "busy";
  throw new SyncError(kind, message);
}

function toPage(body: unknown): Page {
  if (!isRecord(body) || typeof body.cursor !== "number" || typeof body.total !== "number") {
    throw new SyncError("busy", "The server's answer couldn't be read.");
  }
  return { entries: parseEntries(body.entries), cursor: body.cursor, total: body.total };
}

export function httpTransport(fetchImpl: typeof fetch = (...args) => fetch(...args)): Transport {
  const post = (url: string, body: unknown) =>
    request(fetchImpl, url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  return {
    async create(entries) {
      const body = await post(BASE, { entries });
      if (!isRecord(body) || typeof body.code !== "string" || typeof body.cursor !== "number") {
        throw new SyncError("busy", "The server's answer couldn't be read.");
      }
      return { code: body.code, cursor: body.cursor };
    },
    async read(code, since) {
      return toPage(await request(fetchImpl, `${BASE}/${encodeURIComponent(code)}?since=${since}`));
    },
    async append(code, entry, since) {
      return toPage(await post(`${BASE}/${encodeURIComponent(code)}`, { entry, since }));
    },
  };
}

/** Whether this site has sharing switched on; false if the server can't be asked. */
export async function sharingAvailable(fetchImpl: typeof fetch = (...args) => fetch(...args)): Promise<boolean> {
  try {
    const body = await request(fetchImpl, `${BASE}?status=1`, { cache: "default" });
    return isRecord(body) && body.sync === true;
  } catch {
    return false;
  }
}

/** Live: in step. Offline: retrying. Gone: the room expired. Full: the room can take no more. */
export type SyncStatus = "live" | "offline" | "gone" | "full";

/** What a phone keeps so a reload rejoins without starting over. */
export interface SavedRoom {
  code: string;
  confirmed: Entry[];
  pending: Entry[];
  cursor: number;
}

export interface SyncSnapshot extends SavedRoom {
  status: SyncStatus;
  /** Confirmed entries, then this phone's taps still on their way. */
  entries: Entry[];
}

export class RoomSync {
  private confirmed: Entry[];
  private ids: Set<string>;
  private pending: Entry[];
  /** Taps the server has accepted but this phone hasn't read back yet; never sent twice. */
  private sent = new Set<string>();
  private cursor: number;
  private status: SyncStatus = "live";
  private running = false;
  private visible = true;
  private sending = false;
  private polling = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastActivity = Date.now();
  private retryMs = RETRY_START_MS;
  private listeners = new Set<() => void>();
  private snapshot: SyncSnapshot;

  constructor(
    readonly code: string,
    private readonly transport: Transport,
    saved?: Pick<SavedRoom, "confirmed" | "pending" | "cursor">,
  ) {
    this.confirmed = [...(saved?.confirmed ?? [])];
    this.ids = new Set(this.confirmed.map((entry) => entry.id));
    this.pending = (saved?.pending ?? []).filter((entry) => !this.ids.has(entry.id));
    this.cursor = saved?.cursor ?? 0;
    this.snapshot = this.makeSnapshot();
  }

  /* For useSyncExternalStore: a new snapshot object only when something changed. */

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): SyncSnapshot => this.snapshot;

  private makeSnapshot(): SyncSnapshot {
    return {
      code: this.code,
      confirmed: this.confirmed,
      pending: this.pending,
      cursor: this.cursor,
      status: this.status,
      entries: this.pending.length ? [...this.confirmed, ...this.pending] : this.confirmed,
    };
  }

  private changed() {
    this.snapshot = this.makeSnapshot();
    for (const listener of this.listeners) listener();
  }

  private get stopped() {
    return this.status === "gone" || this.status === "full";
  }

  start() {
    if (this.running) return;
    this.running = true;
    void this.poll();
    void this.flush();
  }

  stop() {
    this.running = false;
    clearTimeout(this.timer);
  }

  /** Hidden tabs don't poll; coming back catches up at once. */
  setVisible(visible: boolean) {
    this.visible = visible;
    clearTimeout(this.timer);
    if (visible && this.running) void this.poll();
  }

  add(entry: Entry) {
    if (this.stopped) return;
    this.pending = [...this.pending, entry];
    this.lastActivity = Date.now();
    this.changed();
    void this.flush();
  }

  /**
   * Takes in a page from the server; anything already seen is ignored. Each page
   * starts at or before this phone's position, so nothing is ever skipped.
   * Returns true when there is more to read straight away.
   */
  private merge(page: Page, since: number): boolean {
    if (page.total < this.cursor) {
      // The room holds fewer entries than this phone has read, so it is not the room it was. Read it again from the start.
      this.confirmed = [];
      this.ids = new Set();
      this.cursor = 0;
      this.changed();
      return true;
    }
    const fresh = page.entries.filter((entry) => !this.ids.has(entry.id));
    if (fresh.length) {
      for (const entry of fresh) {
        this.ids.add(entry.id);
        this.sent.delete(entry.id);
      }
      this.confirmed = [...this.confirmed, ...fresh];
      this.pending = this.pending.filter((entry) => !this.ids.has(entry.id));
      this.lastActivity = Date.now();
    }
    const moved = page.cursor > this.cursor;
    this.cursor = Math.max(this.cursor, page.cursor);
    if (fresh.length || moved) this.changed();
    // A long game arrives in pages.
    return page.cursor > since && this.cursor < page.total;
  }

  private fail(err: unknown) {
    const kind = err instanceof SyncError ? err.kind : "offline";
    if (kind === "gone" || kind === "full") {
      this.status = kind;
      clearTimeout(this.timer);
      this.changed();
      return;
    }
    if (this.status !== "offline" && kind === "offline") {
      this.status = "offline";
      this.changed();
    }
  }

  private recovered() {
    this.retryMs = RETRY_START_MS;
    if (this.status === "offline") {
      this.status = "live";
      this.changed();
    }
  }

  private schedule() {
    clearTimeout(this.timer);
    if (!this.running || !this.visible || this.stopped) return;
    const idle = Date.now() - this.lastActivity;
    const delay = this.status === "offline" ? this.retryMs : idle < ACTIVE_MS ? FAST_POLL_MS : SLOW_POLL_MS;
    this.timer = setTimeout(() => void this.poll(), delay);
  }

  private async poll() {
    if (this.polling || this.stopped || !this.running) return;
    this.polling = true;
    let more = false;
    try {
      const since = this.cursor;
      const page = await this.transport.read(this.code, since);
      more = this.merge(page, since);
      this.recovered();
    } catch (err) {
      this.fail(err);
      this.retryMs = Math.min(RETRY_MAX_MS, this.retryMs * 2);
    } finally {
      this.polling = false;
    }
    if (more) void this.poll();
    else this.schedule();
    // Taps queued while offline go out once the server answers again.
    if (this.status === "live" && this.pending.some((entry) => !this.sent.has(entry.id))) void this.flush();
  }

  private async flush() {
    if (this.sending || !this.running) return;
    this.sending = true;
    try {
      for (;;) {
        if (this.stopped) return;
        const next = this.pending.find((entry) => !this.sent.has(entry.id));
        if (!next) return;
        try {
          const since = this.cursor;
          const page = await this.transport.append(this.code, next, since);
          this.sent.add(next.id);
          if (this.merge(page, since)) void this.poll();
          this.recovered();
        } catch (err) {
          if (err instanceof SyncError && err.kind === "bad") {
            // The server will never take it, so it would block every tap behind it.
            console.warn("[smash-up] dropped a change the server refused", err.message);
            this.pending = this.pending.filter((entry) => entry.id !== next.id);
            this.changed();
            continue;
          }
          this.fail(err);
          // Offline or busy: the next poll that gets through sends it again.
          this.schedule();
          return;
        }
      }
    } finally {
      this.sending = false;
    }
  }
}
