"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Everything the player enters, kept in localStorage on their device. Game
 * data (skills, NPs, CE effects) is never stored here; it is looked up from
 * Atlas by id, so a buff rework is picked up without re-entering anything.
 */

export interface SavedServant {
  key: string;
  id: number;
  name: string;
  className: string;
  rarity: number;
  face?: string;
  level: number;
  fou: number;
  npLevel: number;
  skillLevels: number[];
  appendLevels: Record<number, number>;
  skillIds?: Record<number, number>;
  npId?: number;
}

export interface SavedCe {
  id: number;
  name: string;
  rarity: number;
  face?: string;
  mlb: boolean;
  count: number;
}

export interface SavedFriend extends SavedServant {
  ce?: { id: number; name: string; face?: string; mlb: boolean };
}

export interface SavedMysticCode {
  id: number;
  name: string;
  icon?: string;
  level: number;
}

export interface SavedQuest {
  id: number;
  phase: number;
  name: string;
  spotName?: string;
  warLongName?: string;
}

export interface Settings {
  /** Minimum-roll damage as a multiple of enemy HP. */
  safety: number;
  maxResults: number;
  timeBudgetSec: number;
  /** Defaults applied to newly added servants. */
  defaultSkills: number;
  defaultNp: number;
  defaultFou: number;
}

export interface SavedState {
  version: 1;
  servants: SavedServant[];
  ces: SavedCe[];
  friends: SavedFriend[];
  mysticCodes: SavedMysticCode[];
  quest?: SavedQuest;
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  safety: 1,
  maxResults: 12,
  timeBudgetSec: 20,
  defaultSkills: 10,
  defaultNp: 1,
  defaultFou: 1000,
};

export const EMPTY_STATE: SavedState = {
  version: 1,
  servants: [],
  ces: [],
  friends: [],
  mysticCodes: [],
  settings: DEFAULT_SETTINGS,
};

const KEY = "fgo-team-builder:v1";

export function parseState(text: string): SavedState {
  const raw = JSON.parse(text) as Partial<SavedState>;
  if (!raw || raw.version !== 1) throw new Error("Not a team builder backup.");
  return {
    ...EMPTY_STATE,
    ...raw,
    settings: { ...DEFAULT_SETTINGS, ...raw.settings },
  } as SavedState;
}

function load(): SavedState {
  try {
    const text = localStorage.getItem(KEY);
    return text ? parseState(text) : EMPTY_STATE;
  } catch {
    return EMPTY_STATE;
  }
}

export function useSavedState() {
  const [state, setState] = useState<SavedState>(EMPTY_STATE);
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
      // Storage full or blocked: the export button is the backup.
    }
  }, [state, loaded]);

  const update = useCallback((fn: (s: SavedState) => SavedState) => setState(fn), []);
  return { state, update, loaded };
}
