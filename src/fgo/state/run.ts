"use client";

import {
  getEquip,
  getMysticCode,
  getQuestPhase,
  getServant,
  getTables,
  loadMany,
} from "../atlas/client";
import { compileQuest } from "../engine/compile";
import type { UnitSpec } from "../engine/model";
import { spawnOptimizer } from "../engine/spawn";
import {
  type FriendSpec,
  type NearMiss,
  type OptimizeInput,
  type OptimizeResult,
  type OwnedCe,
  mergePlans,
} from "../engine/optimize";
import type { SavedServant, SavedState } from "./store";

export type RunStatus =
  | { phase: "loading"; message: string; done: number; total: number }
  | { phase: "searching"; result: OptimizeResult }
  | { phase: "done"; result: OptimizeResult }
  | { phase: "error"; message: string };

function toSpec(s: SavedServant, servant: UnitSpec["servant"], isFriend: boolean): UnitSpec {
  return {
    key: s.key,
    label: isFriend ? `${s.name} (friend)` : s.name,
    servant,
    isFriend,
    level: s.level,
    fou: s.fou,
    npLevel: s.npLevel,
    skillLevels: s.skillLevels,
    skillIds: s.skillIds,
    npId: s.npId,
    appendLevels: s.appendLevels,
  };
}

/** Pulls every record the search needs from Atlas (or the cache) into one input. */
export async function buildInput(
  saved: SavedState,
  onProgress: (status: RunStatus) => void,
): Promise<{ input: OptimizeInput; missing: string[] }> {
  if (!saved.quest) throw new Error("Pick a quest first.");
  const missing: string[] = [];

  const servantIds = [...new Set([...saved.servants, ...saved.friends].map((s) => s.id))];
  const ceIds = [
    ...new Set([
      ...saved.ces.map((c) => c.id),
      ...saved.friends.flatMap((f) => (f.ce ? [f.ce.id] : [])),
    ]),
  ];
  const total = servantIds.length + ceIds.length + saved.mysticCodes.length + 2;
  let done = 0;
  const tick = (message: string) => onProgress({ phase: "loading", message, done: ++done, total });

  const [tables, phase] = await Promise.all([
    getTables().finally(() => tick("Class tables")),
    getQuestPhase(saved.quest.id, saved.quest.phase).finally(() => tick("Quest")),
  ]);

  const servants = await loadMany(servantIds, getServant, () => tick("Servants"));
  const equips = await loadMany(ceIds, getEquip, () => tick("Craft essences"));
  const mcs = await loadMany(saved.mysticCodes.map((m) => m.id), getMysticCode, () =>
    tick("Mystic codes"),
  );

  const roster: UnitSpec[] = [];
  for (const s of saved.servants) {
    const servant = servants.get(s.id);
    if (servant) roster.push(toSpec(s, servant, false));
    else missing.push(s.name);
  }
  const friends: FriendSpec[] = [];
  for (const f of saved.friends) {
    const servant = servants.get(f.id);
    if (!servant) {
      missing.push(`${f.name} (friend)`);
      continue;
    }
    const ceEquip = f.ce ? equips.get(f.ce.id) : undefined;
    friends.push({
      ...toSpec(f, servant, true),
      ce: ceEquip && f.ce ? { equip: ceEquip, mlb: f.ce.mlb } : undefined,
    });
  }
  const ces: OwnedCe[] = [];
  for (const c of saved.ces) {
    const equip = equips.get(c.id);
    if (equip) ces.push({ equip, mlb: c.mlb, count: c.count });
    else missing.push(c.name);
  }
  const mysticCodes = saved.mysticCodes.flatMap((m) => {
    const mc = mcs.get(m.id);
    return mc ? [{ mc, level: m.level }] : [];
  });

  return {
    input: {
      roster,
      friends,
      ces,
      mysticCodes,
      quest: compileQuest(phase),
      tables,
      options: {
        safety: saved.settings.safety,
        maxResults: saved.settings.maxResults,
        timeBudgetMs: saved.settings.timeBudgetSec * 1000,
      },
    },
    missing,
  };
}

function mergeResults(parts: (OptimizeResult | undefined)[], max: number): OptimizeResult {
  const present = parts.filter((p): p is OptimizeResult => Boolean(p));
  const nearMisses: NearMiss[] = present
    .flatMap((p) => p.nearMisses)
    .sort((a, b) => b.score - a.score)
    .filter((m, i, all) => all.findIndex((x) => x.id === m.id) === i)
    .slice(0, 5);
  const sum = (f: (r: OptimizeResult) => number) => present.reduce((s, r) => s + f(r), 0);
  return {
    plans: mergePlans(present.flatMap((p) => p.plans), max),
    nearMisses,
    progress: {
      loadouts: sum((r) => r.progress.loadouts),
      nodes: sum((r) => r.progress.nodes),
      tried: sum((r) => r.progress.tried),
      total: sum((r) => r.progress.total),
      elapsedMs: Math.max(0, ...present.map((r) => r.progress.elapsedMs)),
      done: present.length === parts.length && present.every((r) => r.progress.done),
    },
  };
}

/**
 * Runs the search across a few Web Workers, each taking a share of the team
 * shapes, and streams the merged results. Returns a function that cancels it.
 */
export function runSearch(
  input: OptimizeInput,
  onStatus: (status: RunStatus) => void,
): () => void {
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 2 : 2;
  const count = Math.max(1, Math.min(4, cores - 1));
  const parts: (OptimizeResult | undefined)[] = Array.from({ length: count }, () => undefined);
  const max = input.options?.maxResults ?? 12;
  const workers: Worker[] = [];
  let finished = 0;

  for (let index = 0; index < count; index++) {
    const worker = spawnOptimizer();
    workers.push(worker);
    worker.onmessage = (event: MessageEvent<{ type: string; result?: OptimizeResult; message?: string }>) => {
      const { type, result, message } = event.data;
      if (type === "error") {
        workers.forEach((w) => w.terminate());
        onStatus({ phase: "error", message: message ?? "The search failed." });
        return;
      }
      parts[index] = result;
      if (type === "done") {
        finished++;
        worker.terminate();
      }
      const merged = mergeResults(parts, max);
      onStatus({ phase: finished === count ? "done" : "searching", result: merged });
    };
    worker.onerror = (event) => {
      workers.forEach((w) => w.terminate());
      onStatus({ phase: "error", message: event.message || "The search worker crashed." });
    };
    worker.postMessage({
      ...input,
      options: { ...input.options, shard: { index, count } },
    } satisfies OptimizeInput);
  }

  return () => workers.forEach((w) => w.terminate());
}
