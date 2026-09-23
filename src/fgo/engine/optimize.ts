import type { NiceEquip } from "../atlas/types";
import {
  type Battle,
  type EnemyHit,
  cloneState,
  endTurn,
  fireNp,
  initialState,
  startWave,
  castSkill,
} from "./battle";
import { ceSkills, compileMysticCode, compileUnit, resolveFlat } from "./compile";
import { isRelevantFunc } from "./effects";
import type {
  BattleState,
  CeLoadout,
  CompiledSkill,
  McLoadout,
  Quest,
  Unit,
  UnitSpec,
} from "./model";
import type { Tables } from "./tables";

export interface OwnedCe {
  equip: NiceEquip;
  mlb: boolean;
  count: number;
  level?: number;
}

export interface FriendSpec extends UnitSpec {
  ce?: CeLoadout;
}

export interface OptimizeOptions {
  /** Minimum-roll damage must reach this multiple of each enemy's HP. */
  safety: number;
  maxResults: number;
  timeBudgetMs: number;
  /** Stop a single loadout's skill search after this many simulated turns. */
  nodeBudget: number;
  /** Roster keys that must be in the team. */
  include: string[];
  /** Roster keys that must not be used. */
  exclude: string[];
  /** Split the team shapes across workers: this run takes every `count`th one from `index`. */
  shard?: { index: number; count: number };
}

export const DEFAULT_OPTIONS: OptimizeOptions = {
  safety: 1,
  maxResults: 12,
  timeBudgetMs: 15000,
  nodeBudget: 6000,
  include: [],
  exclude: [],
};

export interface OptimizeInput {
  roster: UnitSpec[];
  friends: FriendSpec[];
  ces: OwnedCe[];
  mysticCodes: McLoadout[];
  quest: Quest;
  tables: Tables;
  options?: Partial<OptimizeOptions>;
}

export interface PlanAction {
  actor: string;
  skill: string;
  option?: string;
  target?: string;
}

export interface PlanTurn {
  wave: number;
  actions: PlanAction[];
  attacker: string;
  np: string;
  oc: number;
  gaugeBefore: number;
  refund: number;
  hits: EnemyHit[];
}

export interface PlanMember {
  key: string;
  label: string;
  servantId: number;
  isFriend: boolean;
  ce?: string;
  role: "attacker" | "support";
}

export interface Plan {
  id: string;
  team: PlanMember[];
  mysticCode?: string;
  turns: PlanTurn[];
  taps: number;
  minRatio: number;
  ignored: string[];
  notes: string[];
}

export interface NearMiss {
  id: string;
  team: PlanMember[];
  mysticCode?: string;
  wave: number;
  reason: string;
  /** How far off the loadout falls even with every skill used on the attacker. */
  score: number;
}

export interface Progress {
  /** Loadouts simulated and turns simulated across them. */
  loadouts: number;
  nodes: number;
  tried: number;
  total: number;
  elapsedMs: number;
  done: boolean;
}

export interface OptimizeResult {
  plans: Plan[];
  nearMisses: NearMiss[];
  progress: Progress;
}

interface Candidate {
  spec: UnitSpec;
  ce?: CeLoadout;
  friendCe?: CeLoadout;
}

/* ------------------------------------------------------------------ */
/* Heuristics used only to decide what to try first.                  */
/* ------------------------------------------------------------------ */

function relevantFuncCount(unit: Unit): number {
  return unit.skills.reduce(
    (n, s) =>
      n +
      s.options[0].filter(
        (rf) => isRelevantFunc(rf.func) && rf.func.funcTargetType !== "self",
      ).length,
    0,
  );
}

function supportScore(unit: Unit): number {
  let score = 0;
  for (const skill of unit.skills) {
    for (const rf of skill.options[0]) {
      if (!isRelevantFunc(rf.func) || rf.func.funcTargetType === "self") continue;
      const v = rf.vals[0];
      if (rf.func.funcType === "gainNp") score += (v.Value ?? 0) / 1000;
      else score += Math.min(10, (v.Value ?? 0) / 100) * Math.min(3, Math.max(1, v.Turn ?? 1)) / 3;
    }
  }
  return score;
}

/** Starting NP gauge a CE gives its holder, in hundredths of a percent. */
export function ceCharge(ce: CeLoadout): number {
  let charge = 0;
  for (const skill of ceSkills(ce)) {
    for (const f of skill.functions) {
      if (f.funcType === "gainNp" && ["self", "ptAll", "ptFull"].includes(f.funcTargetType)) {
        charge += resolveFlat(f, 1).vals[0].Value ?? 0;
      }
    }
  }
  return charge;
}

function ceIsRelevant(ce: CeLoadout): boolean {
  return ceSkills(ce).some((s) =>
    s.functions.some(
      (f) => f.funcType === "gainNp" || (isRelevantFunc(f) && f.funcTargetType !== "enemyAll"),
    ),
  );
}

/** Damage ratio of a lone servant against a wave with every one of its own skills used. */
function soloRatio(unit: Unit, quest: Quest, tables: Tables, wave: number): number {
  const battle: Battle = { units: [unit], mc: [], quest, tables, ignored: new Set() };
  const state = initialState(battle);
  startWave(battle, state, quest.waves[wave]);
  for (const skill of unit.skills) {
    if (skill.relevant) castSkill(battle, state, skill, 0, 0);
  }
  state.units[0].gauge = Math.max(10000, state.units[0].gauge);
  const res = fireNp(battle, state, 0);
  if (!res) return 0;
  const hits = res.hits;
  return hits.length ? Math.min(...hits.map((h) => h.ratio)) : 0;
}

function canHitWave(unit: Unit, quest: Quest, wave: number): boolean {
  if (!unit.np || unit.np.damageIndex < 0) return false;
  return unit.np.aoe || quest.waves[wave].enemies.length <= 1;
}

/* ------------------------------------------------------------------ */
/* Search                                                             */
/* ------------------------------------------------------------------ */

interface Loadout {
  members: Candidate[];
  /** Index into members of the attacker for each wave. */
  attackers: number[];
  mc: McLoadout | null;
}

interface SearchState {
  best: { taps: number; ratio: number; turns: PlanTurn[] } | null;
  nodes: number;
}

function* combinations<T>(items: T[], k: number, start = 0): Generator<T[]> {
  if (k === 0) {
    yield [];
    return;
  }
  for (let i = start; i <= items.length - k; i++) {
    for (const rest of combinations(items, k - 1, i + 1)) yield [items[i], ...rest];
  }
}

interface Choice {
  skill: CompiledSkill;
  option: number;
  target: number | null;
}

function choicesFor(skill: CompiledSkill, targets: number[]): Choice[] {
  const out: Choice[] = [];
  skill.options.forEach((_, option) => {
    if (skill.needsTarget) for (const target of targets) out.push({ skill, option, target });
    else out.push({ skill, option, target: skill.owner < 0 ? targets[0] ?? null : null });
  });
  return out;
}

function* cartesian(lists: Choice[][], i = 0, acc: Choice[] = []): Generator<Choice[]> {
  if (i === lists.length) {
    yield acc;
    return;
  }
  for (const c of lists[i]) yield* cartesian(lists, i + 1, [...acc, c]);
}

const shortensLast = (c: Choice) =>
  c.skill.options[c.option].some((rf) => rf.func.funcType === "shortenSkill") ? 1 : 0;

function describe(b: Battle, c: Choice): PlanAction {
  const actor = c.skill.owner < 0 ? "Mystic Code" : b.units[c.skill.owner].label;
  return {
    actor,
    skill: `S${c.skill.slot} ${c.skill.name}`,
    option: c.skill.options.length > 1 ? c.skill.optionNames[c.option] : undefined,
    target: c.skill.needsTarget && c.target !== null ? b.units[c.target].label : undefined,
  };
}

/**
 * Branch-and-bound over which skills to press on which turn. Subsets are
 * tried smallest first, so the first clear found per turn uses the fewest
 * taps, and the bound stops anything that cannot beat the best so far.
 */
function searchSchedule(
  b: Battle,
  attackers: number[],
  safety: number,
  tapCap: number,
  nodeBudget: number,
): SearchState {
  const search: SearchState = { best: null, nodes: 0 };
  const allSkills = usefulSkills(b, attackers);
  search.nodes += allSkills.length * b.quest.waves.length;

  const dfs = (wave: number, state: BattleState, taps: number, log: PlanTurn[], ratio: number) => {
    if (wave === b.quest.waves.length) {
      const best = search.best;
      if (!best || taps < best.taps || (taps === best.taps && ratio > best.ratio)) {
        search.best = { taps, ratio, turns: log };
      }
      return;
    }
    const attacker = attackers[wave];
    const futureTargets = [...new Set(attackers.slice(wave))];
    const available = allSkills.filter((s) =>
      s.owner < 0 ? state.mcCd[s.slot - 1] === 0 : state.units[s.owner].cd[s.slot - 1] === 0,
    );
    const limit = Math.min(available.length, (search.best?.taps ?? tapCap) - taps);
    if (limit < 0) return;

    // If pressing everything that is off cooldown can't clear this wave, no subset can.
    search.nodes++;
    const probe = cloneState(state);
    startWave(b, probe, b.quest.waves[wave]);
    for (const s of available) s.options.forEach((_, o) => castSkill(b, probe, s, o, attacker));
    const reach = fireNp(b, probe, attacker);
    if (!reach || reach.minRatio < safety) return;

    for (let k = 0; k <= limit; k++) {
      for (const subset of combinations(available, k)) {
        const lists = subset.map((s) => choicesFor(s, futureTargets));
        for (const choice of cartesian(lists)) {
          if (search.nodes >= nodeBudget) return;
          // Only strictly fewer taps are worth looking for once a clear is known.
          if (search.best && taps + k >= search.best.taps) return;
          search.nodes++;

          const next = cloneState(state);
          startWave(b, next, b.quest.waves[wave]);
          const ordered = [...choice].sort((x, y) => shortensLast(x) - shortensLast(y));
          for (const c of ordered) castSkill(b, next, c.skill, c.option, c.target);
          const res = fireNp(b, next, attacker);
          if (!res || res.minRatio < safety) continue;

          const turn: PlanTurn = {
            wave: wave + 1,
            actions: ordered.map((c) => describe(b, c)),
            attacker: b.units[attacker].label,
            np: b.units[attacker].np?.np.name ?? "",
            oc: res.oc,
            gaugeBefore: res.gaugeBefore,
            refund: res.refund,
            hits: res.hits,
          };
          endTurn(b, next);
          dfs(wave + 1, next, taps + k, [...log, turn], Math.min(ratio, res.minRatio));
        }
      }
    }
  };

  dfs(0, initialState(b), 0, [], Infinity);
  return search;
}

/** A fingerprint of what the attacker achieves on a wave: damage, refund and gauges after. */
function probe(b: Battle, attackers: number[], wave: number, skill?: CompiledSkill, option = 0) {
  const a = attackers[wave];
  const state = initialState(b);
  startWave(b, state, b.quest.waves[wave]);
  if (skill) castSkill(b, state, skill, option, a);
  const cds = state.units.map((u) => u.cd.join(",")).join(";");
  state.units[a].gauge += 10000;
  const res = fireNp(b, state, a);
  endTurn(b, state);
  return [
    res?.hits.map((h) => h.damage).join(","),
    res?.refund,
    state.units.map((u) => u.gauge).join(","),
    skill?.options[option].some((rf) => rf.func.funcType === "shortenSkill") ? cds : "",
  ].join("|");
}

/**
 * Skills that change anything for this team's attackers. A Buster buff on an
 * Arts looper, or a battery that can only target its user, never needs a tap,
 * and leaving them out shrinks the search a lot.
 */
function usefulSkills(b: Battle, attackers: number[]): CompiledSkill[] {
  const waves = b.quest.waves.map((_, w) => w);
  const baseline = waves.map((w) => probe(b, attackers, w));
  return [...b.units.flatMap((u) => u.skills), ...b.mc].filter(
    (skill) =>
      skill.relevant &&
      skill.options.some((_, o) => waves.some((w) => probe(b, attackers, w, skill, o) !== baseline[w])),
  );
}

/**
 * Best case for each wave: every relevant skill in the team used on that
 * wave's attacker, ignoring cooldowns. If a wave still fails, no schedule can
 * clear it, and the reason becomes a near miss.
 */
function upperBound(
  b: Battle,
  attackers: number[],
  safety: number,
): { ok: true } | { ok: false; wave: number; reason: string; score: number } {
  const base = initialState(b);
  for (let w = 0; w < b.quest.waves.length; w++) {
    const a = attackers[w];
    const state = cloneState(base);
    startWave(b, state, b.quest.waves[w]);
    for (const skill of [...b.units.flatMap((u) => u.skills), ...b.mc]) {
      if (!skill.relevant) continue;
      skill.options.forEach((_, o) => castSkill(b, state, skill, o, a));
    }
    const firedBefore = attackers.slice(0, w).includes(a);
    if (firedBefore) state.units[a].gauge = b.units[a].maxGauge;
    if (state.units[a].gauge < 10000) {
      return {
        ok: false,
        wave: w + 1,
        reason: `${b.units[a].label} only reaches ${Math.floor(state.units[a].gauge / 100)}% NP gauge by wave ${w + 1}.`,
        score: state.units[a].gauge / 10000,
      };
    }
    const res = fireNp(b, state, a);
    if (!res || res.minRatio < safety) {
      const ratio = res?.minRatio ?? 0;
      const weakest = res?.hits.reduce((m, h) => (h.ratio < m.ratio ? h : m), res.hits[0]);
      return {
        ok: false,
        wave: w + 1,
        reason: `Wave ${w + 1}: ${b.units[a].label} tops out at ${Math.round(ratio * 100)}% of ${weakest?.name ?? "the enemy"}'s HP even with every buff.`,
        score: ratio,
      };
    }
  }
  return { ok: true };
}

function memberOf(c: Candidate, unit: Unit, role: PlanMember["role"]): PlanMember {
  return {
    key: c.spec.key,
    label: c.spec.label,
    servantId: c.spec.servant.id,
    isFriend: c.spec.isFriend,
    ce: unit.ceName,
    role,
  };
}

function loadoutId(l: Loadout): string {
  return [
    ...l.members.map((m) => `${m.spec.key}+${(m.ce ?? m.friendCe)?.equip.id ?? 0}`),
    l.attackers.join(""),
    l.mc?.mc.id ?? 0,
  ].join("|");
}

/* ------------------------------------------------------------------ */
/* Entry point                                                        */
/* ------------------------------------------------------------------ */

export function optimize(
  input: OptimizeInput,
  onUpdate?: (result: OptimizeResult) => void,
): OptimizeResult {
  const opts = { ...DEFAULT_OPTIONS, ...input.options };
  const started = Date.now();
  const { quest, tables } = input;
  const waves = quest.waves.length;

  const excluded = new Set(opts.exclude);
  const own = input.roster.filter((s) => !excluded.has(s.key));
  const friends = input.friends.filter((s) => !excluded.has(s.key));
  const everyone: Candidate[] = [
    ...own.map((spec) => ({ spec })),
    ...friends.map((spec) => ({ spec, friendCe: spec.ce })),
  ];

  // Compile once without CE (friends with theirs) for the heuristics.
  const bare = new Map<string, Unit>();
  for (const c of everyone) bare.set(c.spec.key, compileUnit(c.spec, 0, c.friendCe));

  // Attackers: anyone whose NP can clear at least one wave, ranked by solo damage.
  const solo = new Map<string, number[]>();
  for (const c of everyone) {
    const unit = bare.get(c.spec.key)!;
    solo.set(
      c.spec.key,
      quest.waves.map((_, w) => (canHitWave(unit, quest, w) ? soloRatio(unit, quest, tables, w) : 0)),
    );
  }
  const attackers = everyone
    .filter((c) => solo.get(c.spec.key)!.some((r) => r > 0))
    .sort((a, b) => Math.max(...solo.get(b.spec.key)!) - Math.max(...solo.get(a.spec.key)!))
    .slice(0, 24);

  const supports = everyone
    .filter((c) => relevantFuncCount(bare.get(c.spec.key)!) > 0)
    .sort((a, b) => supportScore(bare.get(b.spec.key)!) - supportScore(bare.get(a.spec.key)!))
    .slice(0, 14);

  // CE shortlist per attacker: the ones that give starting charge, then the rest by relevance.
  const ceShortlist = input.ces
    .filter((ce) => ce.count > 0 && ceIsRelevant(ce))
    .map((ce) => ({ ce, charge: ceCharge(ce) }));
  const ceOptions = new Map<string, (OwnedCe | undefined)[]>();
  for (const c of attackers) {
    if (c.spec.isFriend) {
      ceOptions.set(c.spec.key, [undefined]);
      continue;
    }
    const ranked = ceShortlist
      .map(({ ce, charge }) => {
        const unit = compileUnit(c.spec, 0, ce);
        const dmg = quest.waves.reduce(
          (s, _, w) => s + (canHitWave(unit, quest, w) ? soloRatio(unit, quest, tables, w) : 0),
          0,
        );
        return { ce, charge, dmg };
      })
      .sort((a, b) => b.charge - a.charge || b.dmg - a.dmg);
    const picks: OwnedCe[] = [];
    const seenCharge = new Set<number>();
    for (const r of ranked) {
      if (seenCharge.has(r.charge)) continue;
      seenCharge.add(r.charge);
      picks.push(r.ce);
      if (picks.length >= 2) break;
    }
    const topDamage = [...ranked].sort((a, b) => b.dmg - a.dmg)[0];
    if (topDamage && !picks.includes(topDamage.ce)) picks.push(topDamage.ce);
    ceOptions.set(c.spec.key, picks.length ? picks : [undefined]);
  }

  const mcs: (McLoadout | null)[] = input.mysticCodes.filter((mc) =>
    compileMysticCode(mc).some((s) => s.relevant),
  );
  if (mcs.length === 0) mcs.push(null);

  // Team shapes: which attacker takes which wave, supports filling the other slots.
  interface Shape {
    attackerKeys: string[];
    pattern: number[];
    supportKeys: string[];
    score: number;
  }
  const shapes: Shape[] = [];
  const supportScoreOf = (key: string) => supportScore(bare.get(key)!);
  const isFriend = (key: string) => key.startsWith("friend:");

  const patterns = (k: number): number[][] => {
    const out: number[][] = [];
    const rec = (acc: number[]) => {
      if (acc.length === waves) {
        if (new Set(acc).size === k) out.push(acc);
        return;
      }
      // Canonical form: attacker i first appears before attacker i+1.
      const maxUsed = acc.length ? Math.max(...acc) : -1;
      for (let a = 0; a <= Math.min(k - 1, maxUsed + 1); a++) rec([...acc, a]);
    };
    rec([]);
    return out;
  };

  const maxAttackers = Math.min(3, waves);
  for (let k = 1; k <= maxAttackers; k++) {
    const pool = k === 1 ? attackers : attackers.slice(0, k === 2 ? 12 : 8);
    for (const group of combinations(pool, k)) {
      const keys = group.map((g) => g.spec.key);
      if (keys.filter(isFriend).length > 1) continue;
      const orders = k === 1 ? [keys] : permutations(keys);
      for (const pattern of patterns(k)) {
        for (const order of orders) {
          // Every wave's attacker must at least be able to hit it.
          const ratios = pattern.map((a, w) => solo.get(order[a])![w]);
          if (ratios.some((r) => r <= 0)) continue;
          const supportPool = supports.filter((s) => !keys.includes(s.spec.key));
          const friendUsed = keys.some(isFriend);
          const friendOk = (keys: string[]) =>
            (friendUsed ? 1 : 0) + keys.filter(isFriend).length <= 1;
          for (const sup of supportSets(supportPool, 3 - k, friendOk)) {
            const supKeys = sup.map((s) => s.spec.key);
            const all = [...keys, ...supKeys];
            if (opts.include.some((inc) => !all.includes(inc))) continue;
            const boost = 1 + supKeys.reduce((s, key) => s + supportScoreOf(key), 0) / 10;
            shapes.push({
              attackerKeys: order,
              pattern,
              supportKeys: supKeys,
              score: (Math.min(...ratios) * boost) / (1 + (k - 1) * 0.15),
            });
          }
        }
        if (shapes.length > 60000) break;
      }
    }
  }
  shapes.sort((a, b) => b.score - a.score);

  const byKey = new Map(everyone.map((c) => [c.spec.key, c]));
  const plans: Plan[] = [];
  const nearMisses: NearMiss[] = [];
  let tried = 0;
  let loadouts = 0;
  let nodes = 0;
  let lastUpdate = Date.now();

  const snapshot = (done: boolean): OptimizeResult => ({
    plans: plans.slice(),
    nearMisses: nearMisses.slice(0, 5),
    progress: {
      loadouts,
      nodes,
      tried,
      total: mine.length,
      elapsedMs: Date.now() - started,
      done,
    },
  });

  const worstKept = () =>
    plans.length >= opts.maxResults ? plans[plans.length - 1].taps : Infinity;

  const addPlan = (plan: Plan) => {
    const next = mergePlans([...plans, plan], opts.maxResults);
    plans.length = 0;
    plans.push(...next);
  };

  const shard = opts.shard ?? { index: 0, count: 1 };
  const mine = shapes.filter((_, i) => i % shard.count === shard.index);

  outer: for (const shape of mine) {
    tried++;
    if (Date.now() - started > opts.timeBudgetMs) break;
    if (onUpdate && Date.now() - lastUpdate > 400) {
      lastUpdate = Date.now();
      onUpdate(snapshot(false));
    }

    const attackerCands = shape.attackerKeys.map((k) => byKey.get(k)!);
    const supportCands = shape.supportKeys.map((k) => byKey.get(k)!);

    for (const ceCombo of ceCombos(attackerCands, ceOptions, input.ces)) {
      for (const mc of mcs) {
        if (Date.now() - started > opts.timeBudgetMs) break outer;
        const members: Candidate[] = [
          ...attackerCands.map((c, i) => ({ ...c, ce: ceCombo[i] })),
          ...supportCands,
        ];
        const units = members.map((m, i) => compileUnit(m.spec, i, m.ce ?? m.friendCe));
        const battle: Battle = {
          units,
          mc: mc ? compileMysticCode(mc) : [],
          quest,
          tables,
          ignored: new Set(),
        };
        const loadout: Loadout = { members, attackers: shape.pattern, mc };
        const id = loadoutId(loadout);

        loadouts++;
        const ub = upperBound(battle, shape.pattern, opts.safety);
        const team = members.map((m, i) =>
          memberOf(m, units[i], shape.pattern.includes(i) ? "attacker" : "support"),
        );
        if (!ub.ok) {
          if (nearMisses.length < 50) {
            nearMisses.push({
              id,
              team,
              mysticCode: mc?.mc.name,
              wave: ub.wave,
              reason: ub.reason,
              score: ub.wave * 10 + ub.score,
            });
            nearMisses.sort((a, b) => b.score - a.score);
          }
          continue;
        }

        // With the list full, only loadouts that need fewer taps than the worst kept plan
        // can get in. Shapes are tried best-first, so ties would rarely win on margin anyway.
        const cap = worstKept() === Infinity ? 99 : worstKept() - 1;
        if (cap < 0) continue;
        const found = searchSchedule(battle, shape.pattern, opts.safety, cap, opts.nodeBudget);
        nodes += found.nodes;
        if (!found.best) continue;
        addPlan({
          id,
          team,
          mysticCode: mc?.mc.name,
          turns: found.best.turns,
          taps: found.best.taps,
          minRatio: found.best.ratio,
          ignored: [...battle.ignored].sort(),
          notes: quest.waves.flatMap((w) => w.notes),
        });
      }
    }
  }

  const result = snapshot(true);
  onUpdate?.(result);
  return result;
}

export function comparePlans(a: Plan, b: Plan): number {
  return a.taps - b.taps || b.minRatio - a.minRatio;
}

/**
 * Ranks plans and keeps the list varied: at most two per exact front line and
 * four per set of attackers, so one strong nuker cannot fill every slot.
 */
export function mergePlans(all: Plan[], max: number): Plan[] {
  const seen = new Set<string>();
  const perTeam = new Map<string, number>();
  const perAttackers = new Map<string, number>();
  const out: Plan[] = [];
  for (const plan of [...all].sort(comparePlans)) {
    if (seen.has(plan.id)) continue;
    const team = plan.team.map((m) => m.key).sort().join(",");
    const attackers = plan.team
      .filter((m) => m.role === "attacker")
      .map((m) => m.key)
      .sort()
      .join(",");
    if ((perTeam.get(team) ?? 0) >= 2 || (perAttackers.get(attackers) ?? 0) >= 4) continue;
    seen.add(plan.id);
    perTeam.set(team, (perTeam.get(team) ?? 0) + 1);
    perAttackers.set(attackers, (perAttackers.get(attackers) ?? 0) + 1);
    out.push(plan);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Support line-ups of up to `size`, largest first. A smaller set is only kept
 * when nothing else could join it, since an extra support never hurts.
 */
function supportSets(
  pool: Candidate[],
  size: number,
  valid: (keys: string[]) => boolean,
): Candidate[][] {
  const out: Candidate[][] = [];
  for (let n = Math.min(size, pool.length); n >= 0; n--) {
    for (const set of combinations(pool, n)) {
      const keys = set.map((c) => c.spec.key);
      if (!valid(keys)) continue;
      const extendable =
        n < size && pool.some((c) => !set.includes(c) && valid([...keys, c.spec.key]));
      if (!extendable) out.push(set);
    }
  }
  return out;
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}

/** CE assignments for the attackers that respect how many copies of each CE the player owns. */
function* ceCombos(
  attackers: Candidate[],
  options: Map<string, (OwnedCe | undefined)[]>,
  owned: OwnedCe[],
): Generator<(CeLoadout | undefined)[]> {
  const lists = attackers.map((a) => options.get(a.spec.key) ?? [undefined]);
  const rec = function* (i: number, acc: (OwnedCe | undefined)[]): Generator<(CeLoadout | undefined)[]> {
    if (i === lists.length) {
      yield acc;
      return;
    }
    for (const ce of lists[i]) {
      if (ce) {
        const usedCopies = acc.filter((x) => x === ce).length;
        const copies = owned.find((o) => o === ce)?.count ?? 1;
        if (usedCopies >= copies) continue;
      }
      yield* rec(i + 1, [...acc, ce]);
    }
  };
  yield* rec(0, []);
}
