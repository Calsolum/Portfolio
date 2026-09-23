import { FALLBACK_TABLES, type Tables } from "../engine/tables";
import { cacheGet, cachePut } from "./cache";
import { trimEquip, trimMysticCode, trimQuestPhase, trimServant } from "./trim";
import type {
  BasicEntity,
  BasicQuestPhase,
  ClassAttackRate,
  ClassRelation,
  NiceEquip,
  NiceMysticCode,
  NiceServant,
  QuestPhase,
} from "./types";

export const ATLAS = "https://api.atlasacademy.io";
const REGION = "NA";

/* eslint-disable @typescript-eslint/no-explicit-any */

let versionPromise: Promise<string> | null = null;

/**
 * Atlas publishes a hash per region that changes whenever the game data
 * updates. Cached responses are tagged with it, so a new servant or a buff
 * rework shows up the next time the app loads.
 */
export function dataVersion(): Promise<string> {
  versionPromise ??= fetch(`${ATLAS}/info`)
    .then((r) => (r.ok ? r.json() : null))
    .then((info: any) => String(info?.[REGION]?.hash ?? info?.[REGION]?.timestamp ?? "offline"))
    .catch(() => "offline");
  return versionPromise;
}

const memory = new Map<string, Promise<unknown>>();

async function cached<T>(url: string, transform: (raw: any) => T = (raw) => raw as T): Promise<T> {
  const hit = memory.get(url);
  if (hit) return hit as Promise<T>;

  const promise = (async () => {
    const version = await dataVersion();
    const stored = await cacheGet(url);
    if (stored && (stored.version === version || version === "offline")) return stored.data as T;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = transform(await res.json());
      await cachePut({ url, version, data });
      return data;
    } catch (err) {
      // A stale copy beats no copy when Atlas is unreachable.
      if (stored) return stored.data as T;
      throw err;
    }
  })();
  memory.set(url, promise);
  promise.catch(() => memory.delete(url));
  return promise;
}

export interface ServantListing {
  id: number;
  collectionNo: number;
  name: string;
  className: string;
  rarity: number;
  face: string;
}

export function listServants(): Promise<ServantListing[]> {
  return cached(`${ATLAS}/export/${REGION}/basic_servant.json`, (raw: BasicEntity[]) =>
    raw
      .filter((s) => s.collectionNo > 0 && (s.type === "normal" || s.type === "heroine"))
      .map(({ id, collectionNo, name, className, rarity, face }) => ({
        id,
        collectionNo,
        name,
        className,
        rarity,
        face,
      }))
      .sort((a, b) => a.collectionNo - b.collectionNo),
  );
}

export interface EquipListing {
  id: number;
  collectionNo: number;
  name: string;
  rarity: number;
  face: string;
}

export function listEquips(): Promise<EquipListing[]> {
  return cached(`${ATLAS}/export/${REGION}/basic_equip.json`, (raw: BasicEntity[]) =>
    raw
      .filter((e) => e.collectionNo > 0 && e.type === "servantEquip")
      .map(({ id, collectionNo, name, rarity, face }) => ({ id, collectionNo, name, rarity, face }))
      .sort((a, b) => b.collectionNo - a.collectionNo),
  );
}

export interface MysticCodeListing {
  id: number;
  name: string;
  icon?: string;
}

export function listMysticCodes(): Promise<MysticCodeListing[]> {
  return cached(`${ATLAS}/export/${REGION}/basic_mystic_code.json`, (raw: any[]) =>
    raw.map((mc) => ({ id: mc.id, name: mc.name, icon: mc.item?.female ?? mc.item?.male })),
  );
}

export function getServant(id: number): Promise<NiceServant> {
  return cached(`${ATLAS}/nice/${REGION}/servant/${id}?lore=false`, trimServant);
}

export function getEquip(id: number): Promise<NiceEquip> {
  return cached(`${ATLAS}/nice/${REGION}/equip/${id}`, trimEquip);
}

export function getMysticCode(id: number): Promise<NiceMysticCode> {
  return cached(`${ATLAS}/nice/${REGION}/MC/${id}`, trimMysticCode);
}

export function getQuestPhase(id: number, phase: number): Promise<QuestPhase> {
  return cached(`${ATLAS}/nice/${REGION}/quest/${id}/${phase}`, trimQuestPhase);
}

async function searchType(name: string, type: string): Promise<any[]> {
  const params = new URLSearchParams({ name, type });
  const res = await fetch(`${ATLAS}/basic/${REGION}/quest/phase/search?${params}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Quest search failed (${res.status})`);
  return res.json();
}

/**
 * Free and event quests whose name matches, newest first. Not cached:
 * searches are cheap and varied.
 */
export async function searchQuests(name: string): Promise<BasicQuestPhase[]> {
  const raw = (await Promise.all([searchType(name, "free"), searchType(name, "event")])).flat();
  // One row per quest: the last phase is the repeatable one for free quests.
  const byQuest = new Map<number, BasicQuestPhase>();
  for (const q of raw) {
    const prev = byQuest.get(q.id);
    if (!prev || q.phase > prev.phase) byQuest.set(q.id, q);
  }
  return [...byQuest.values()].sort((a, b) => b.id - a.id);
}

export interface WarListing {
  id: number;
  name: string;
  longName: string;
}

export function listWars(): Promise<WarListing[]> {
  return cached(`${ATLAS}/export/${REGION}/basic_war.json`, (raw: any[]) =>
    raw
      .map((w) => ({ id: w.id, name: w.name, longName: w.longName ?? w.name }))
      .sort((a, b) => b.id - a.id),
  );
}

export interface WarQuest {
  id: number;
  name: string;
  spotName: string;
  phase: number;
  consume: number;
}

/** A war's free quests, each at the last phase that has enemies. */
export function getWarFreeQuests(warId: number): Promise<WarQuest[]> {
  return cached(`${ATLAS}/nice/${REGION}/war/${warId}`, (raw: any) =>
    (raw.spots ?? []).flatMap((spot: any) =>
      (spot.quests ?? [])
        .filter((q: any) => q.type === "free")
        .map((q: any) => {
          const phases: number[] = q.phasesWithEnemies?.length ? q.phasesWithEnemies : q.phases ?? [1];
          return {
            id: q.id,
            name: q.name,
            spotName: spot.name,
            phase: Math.max(...phases),
            consume: q.consume,
          };
        }),
    ),
  );
}

function isRelation(value: unknown): value is ClassRelation {
  if (!value || typeof value !== "object") return false;
  const first = Object.values(value as object)[0];
  return Boolean(first) && typeof first === "object" && typeof Object.values(first)[0] === "number";
}

function isRateTable(value: unknown): value is ClassAttackRate {
  if (!value || typeof value !== "object") return false;
  return typeof Object.values(value as object)[0] === "number";
}

/** Class affinity, class attack and attribute tables, merged over the built-in fallback. */
export async function getTables(): Promise<Tables> {
  const load = (name: string) =>
    cached<unknown>(`${ATLAS}/export/${REGION}/${name}.json`).catch(() => null);
  const [relation, attackRate, attribute] = await Promise.all([
    load("NiceClassRelation"),
    load("NiceClassAttackRate"),
    load("NiceAttributeRelation"),
  ]);
  return {
    classRelation: isRelation(relation)
      ? { ...FALLBACK_TABLES.classRelation, ...relation }
      : FALLBACK_TABLES.classRelation,
    classAttackRate: isRateTable(attackRate)
      ? { ...FALLBACK_TABLES.classAttackRate, ...attackRate }
      : FALLBACK_TABLES.classAttackRate,
    attributeRelation: isRelation(attribute) ? attribute : FALLBACK_TABLES.attributeRelation,
  };
}

/** Loads full records for many ids a few at a time, reporting progress. */
export async function loadMany<T>(
  ids: number[],
  get: (id: number) => Promise<T>,
  onProgress?: (done: number, total: number) => void,
  concurrency = 6,
): Promise<Map<number, T>> {
  const out = new Map<number, T>();
  let next = 0;
  let done = 0;
  const workers = Array.from({ length: Math.min(concurrency, ids.length) }, async () => {
    while (next < ids.length) {
      const id = ids[next++];
      try {
        out.set(id, await get(id));
      } catch {
        // Missing records are skipped; the caller reports which ones.
      }
      onProgress?.(++done, ids.length);
    }
  });
  await Promise.all(workers);
  return out;
}
