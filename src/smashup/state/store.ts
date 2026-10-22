"use client";

import { useCallback, useEffect, useState } from "react";

import { isRecord, parseEntries } from "../lib/actions";
import { ALL_SET_IDS } from "../lib/catalog";
import type { HistoryEntry } from "../lib/history";
import { newId, parseRoomCode } from "../lib/ids";
import type { SavedRoom } from "../sync/client";
import type { Entry } from "../types";

/**
 * Everything the tracker keeps, in localStorage on this device: settings, the
 * game in progress (its entries, or for a shared game the room and what this
 * phone has read of it) and the history of finished games. Storage is read
 * after hydration and checked on the way in, like anything from outside.
 */

export interface Settings {
  /** Signs this device's entries, so undo can find its own taps in a shared game. */
  device: string;
  /** Set ids the player owns; every set until they say otherwise. */
  owned: string[];
  /** The names from the last game, to start the next one quickly. */
  names: string[];
  keepAwake: boolean;
}

export type SavedGame = { kind: "local"; entries: Entry[] } | { kind: "shared"; room: SavedRoom };

export interface SavedState {
  version: 1;
  settings: Settings;
  game: SavedGame | null;
  history: HistoryEntry[];
}

const KEY = "smash-up-tracker:v1";

const defaults = (): SavedState => ({
  version: 1,
  settings: { device: newId(), owned: [...ALL_SET_IDS], names: [], keepAwake: false },
  game: null,
  history: [],
});

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

function parseGame(value: unknown): SavedGame | null {
  if (!isRecord(value)) return null;
  if (value.kind === "local") {
    const entries = parseEntries(value.entries);
    return entries.length ? { kind: "local", entries } : null;
  }
  const room = isRecord(value.room) ? value.room : null;
  const code = parseRoomCode(room?.code);
  if (value.kind !== "shared" || !room || !code) return null;
  const cursor = typeof room.cursor === "number" && Number.isInteger(room.cursor) && room.cursor >= 0 ? room.cursor : 0;
  return {
    kind: "shared",
    room: { code, confirmed: parseEntries(room.confirmed), pending: parseEntries(room.pending), cursor },
  };
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.endedAt === "number" &&
    typeof value.winner === "string" &&
    Array.isArray(value.players) &&
    Array.isArray(value.bases)
  );
}

export function parseState(text: string): SavedState {
  const raw: unknown = JSON.parse(text);
  const fresh = defaults();
  if (!isRecord(raw) || raw.version !== 1) return fresh;
  const settings = isRecord(raw.settings) ? raw.settings : {};
  const known = new Set(ALL_SET_IDS);
  return {
    version: 1,
    settings: {
      device: typeof settings.device === "string" && settings.device.length >= 8 ? settings.device : fresh.settings.device,
      owned: Array.isArray(settings.owned) ? strings(settings.owned).filter((id) => known.has(id)) : fresh.settings.owned,
      names: strings(settings.names).slice(0, 6),
      keepAwake: settings.keepAwake === true,
    },
    game: parseGame(raw.game),
    history: Array.isArray(raw.history) ? raw.history.filter(isHistoryEntry) : [],
  };
}

function load(): SavedState {
  try {
    const text = localStorage.getItem(KEY);
    return text ? parseState(text) : defaults();
  } catch {
    return defaults();
  }
}

export function useSavedState() {
  const [state, setState] = useState<SavedState>(defaults);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // localStorage is only readable after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(load());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Storage full or blocked: the game carries on in memory.
    }
  }, [state, loaded]);

  const update = useCallback((fn: (s: SavedState) => SavedState) => setState(fn), []);
  return { state, update, loaded };
}
