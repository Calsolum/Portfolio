import type { ActiveBuff, BattleState, CompiledSkill, Quest, ResolvedFunc, Unit, Wave } from "./model";
import {
  BUFF,
  BUFF_CATEGORY,
  type BuffCategory,
  applyFunc,
  buffApplies,
  signedValue,
  traitsOfEnemy,
  traitsOfUnit,
} from "./effects";
import {
  CARD_DAMAGE,
  CARD_NP_GAIN,
  type Tables,
  attributeMod,
  classAdvantage,
  classAttackMod,
} from "./tables";

/** The lowest damage roll. Every damage figure the planner shows assumes it. */
export const MIN_ROLL = 0.9;

export interface Battle {
  units: Unit[];
  mc: CompiledSkill[];
  quest: Quest;
  tables: Tables;
  ignored: Set<string>;
}

export function cloneState(s: BattleState): BattleState {
  // Buff objects are never mutated in place, so the arrays can share them.
  return {
    units: s.units.map((u) => ({ gauge: u.gauge, cd: u.cd.slice(), buffs: u.buffs.slice() })),
    mcCd: s.mcCd.slice(),
    enemies: s.enemies.map((e) => ({ enemy: e.enemy, buffs: e.buffs.slice() })),
    field: s.field.slice(),
  };
}

export function initialState(b: Battle): BattleState {
  const state: BattleState = {
    units: b.units.map((u) => ({ gauge: 0, cd: u.skills.map(() => 0), buffs: [] })),
    mcCd: b.mc.map(() => 0),
    enemies: [],
    field: b.quest.fieldTraits.slice(),
  };
  b.units.forEach((unit, i) => {
    for (const passive of unit.passives) {
      for (const rf of passive.funcs) {
        applyFunc(rf, {
          units: b.units,
          state,
          caster: i,
          target: null,
          oc: 1,
          ignored: b.ignored,
          source: `${unit.label} · ${passive.name}`,
        });
      }
    }
  });
  return state;
}

/** Enemy passives only matter when they make the enemy tougher, so only self-buffs are applied. */
export function startWave(b: Battle, state: BattleState, wave: Wave): void {
  state.enemies = wave.enemies.map((enemy) => ({ enemy, buffs: [] }));
  state.enemies.forEach((e) => {
    for (const rf of e.enemy.passives) {
      const buff = rf.func.buffs[0];
      if (!buff || rf.func.funcTargetType !== "self") continue;
      if (rf.func.funcType !== "addState" && rf.func.funcType !== "addStateShort") continue;
      if (![...BUFF.def, ...BUFF.cardRes, ...BUFF.specialDef].includes(buff.type as never)) continue;
      const val = rf.vals[0];
      e.buffs.push({
        name: buff.name,
        type: buff.type,
        value: val.Value ?? 0,
        turns: -1,
        count: -1,
        ckSelf: buff.ckSelfIndv.map((t) => t.id),
        ckOp: buff.ckOpIndv.map((t) => t.id),
        and: buff.script?.checkIndvType === 1,
        cond: [],
        traits: buff.vals.map((t) => t.id),
      });
    }
  });
}

export function castSkill(
  b: Battle,
  state: BattleState,
  skill: CompiledSkill,
  option: number,
  target: number | null,
): void {
  const caster = skill.owner < 0 ? (target ?? 0) : skill.owner;
  const source = skill.owner < 0 ? `Mystic Code · ${skill.name}` : `${b.units[skill.owner].label} · ${skill.name}`;
  for (const rf of skill.options[option] ?? skill.options[0]) {
    applyFunc(rf, { units: b.units, state, caster, target, oc: 1, ignored: b.ignored, source });
  }
  if (skill.owner < 0) state.mcCd[skill.slot - 1] = skill.cooldown;
  else state.units[skill.owner].cd[skill.slot - 1] = skill.cooldown;
}

type Sums = Record<BuffCategory, number>;

const emptySums = (): Sums => {
  const sums = {} as Sums;
  for (const cat of Object.keys(BUFF) as BuffCategory[]) sums[cat] = 0;
  return sums;
};

/** Every buff category summed in one pass over the holder's buffs. */
function sumAll(
  buffs: ActiveBuff[],
  holder: Set<number>,
  self: Set<number>,
  op: Set<number>,
  used?: Set<ActiveBuff>,
): Sums {
  const sums = emptySums();
  for (const buff of buffs) {
    const cat = BUFF_CATEGORY.get(buff.type);
    if (!cat) continue;
    if (!buffApplies(buff, holder, self, op)) continue;
    sums[cat] += signedValue(buff);
    if (cat !== "regain" && cat !== "trait" && cat !== "field") used?.add(buff);
  }
  return sums;
}

function sumBuffs(
  buffs: ActiveBuff[],
  types: readonly string[],
  holder: Set<number>,
  self: Set<number>,
  op: Set<number>,
  used?: Set<ActiveBuff>,
): number {
  let total = 0;
  for (const buff of buffs) {
    if (!types.includes(buff.type)) continue;
    if (!buffApplies(buff, holder, self, op)) continue;
    total += signedValue(buff);
    used?.add(buff);
  }
  return total;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export interface EnemyHit {
  name: string;
  hp: number;
  damage: number;
  /** Minimum-roll damage over HP. At or above 1 the enemy always dies. */
  ratio: number;
  refund: number;
}

export interface NpResult {
  attacker: number;
  oc: number;
  gaugeBefore: number;
  refund: number;
  hits: EnemyHit[];
  minRatio: number;
}

/** Supereffective multiplier from the NP's damage function against one enemy. */
function superEffective(rf: ResolvedFunc, oc: number, enemyTraits: Set<number>, b: Battle, source: string) {
  const val = rf.vals[oc - 1];
  const correction = (val.Correction ?? 1000) / 1000;
  switch (rf.func.funcType) {
    case "damageNpIndividual":
    case "damageNpStateIndividual":
    case "damageNpStateIndividualFix":
      return val.Target !== undefined && enemyTraits.has(val.Target) ? correction : 1;
    case "damageNpAndOrCheckIndividuality": {
      const groups = val.AndOrCheckIndividualityList ?? [];
      return groups.some((g) => g.every((t) => enemyTraits.has(t))) ? correction : 1;
    }
    case "damageNp":
    case "damageNpPierce":
    case "damageNpSafe":
      return 1;
    default:
      // Scaling NPs (by trait count, HP, rarity) are planned at their base multiplier.
      b.ignored.add(`${source}: bonus damage from ${rf.func.funcType} not counted`);
      return 1;
  }
}

/**
 * Fires the attacker's NP at the current wave: pre-damage NP effects, damage
 * at the minimum roll, refund, then post-damage effects. Mutates state.
 */
export function fireNp(b: Battle, state: BattleState, attacker: number): NpResult | null {
  const unit = b.units[attacker];
  const us = state.units[attacker];
  const np = unit.np;
  if (!np || np.damageIndex < 0 || us.gauge < 10000) return null;

  const holder0 = traitsOfUnit({ units: b.units, state }, attacker);
  const ocUp = sumBuffs(us.buffs, BUFF.overcharge, holder0, holder0, new Set());
  const bars = Math.floor(us.gauge / 10000);
  const oc = clamp(bars + ocUp, 1, 5);
  const gaugeBefore = us.gauge;
  us.gauge -= bars * 10000;

  const source = `${unit.label} · ${np.np.name}`;
  const ctx = { units: b.units, state, caster: attacker, target: null, oc, ignored: b.ignored, source };
  np.funcs.slice(0, np.damageIndex).forEach((rf) => applyFunc(rf, ctx));

  const dmgFunc = np.funcs[np.damageIndex];
  const mult = (dmgFunc.vals[oc - 1].Value ?? 0) / 1000;
  const card = np.card;
  const pierceFunc = dmgFunc.func.funcType === "damageNpPierce";

  const holder = traitsOfUnit({ units: b.units, state }, attacker);
  const self = new Set([...holder, ...np.traits]);
  const used = new Set<ActiveBuff>();

  const targets = np.aoe ? state.enemies.map((_, i) => i) : state.enemies.length === 1 ? [0] : [];
  const hits: EnemyHit[] = state.enemies.map((e) => ({
    name: e.enemy.name,
    hp: e.enemy.hp,
    damage: 0,
    ratio: 0,
    refund: 0,
  }));

  let refund = 0;
  for (const i of targets) {
    const enemy = state.enemies[i];
    const op = traitsOfEnemy(state, i);
    const both = new Set([...op, ...self]);

    const mine = sumAll(us.buffs, holder, self, op, used);
    const theirs = sumAll(enemy.buffs, op, both, both);
    const atkUp = mine.atk / 1000;
    const cardUp = mine.card / 1000;
    const npUp = mine.np / 1000;
    const powerUp = mine.power / 1000;
    const dmgPlus = mine.dmgPlus;
    const npGainUp = mine.npGain / 1000;
    const pierce = pierceFunc || mine.pierce > 0;

    let def = theirs.def / 1000;
    if (pierce) def = Math.min(def, 0);
    const cardRes = theirs.cardRes / 1000;
    const specialDef = theirs.specialDef / 1000;

    const cardMod = clamp(cardUp - cardRes, -1, 4);
    const atkMod = clamp(atkUp, -1, 4) - Math.max(def, -1);
    const se = superEffective(dmgFunc, oc, op, b, source);

    const damage = Math.max(
      0,
      Math.floor(
        unit.atk *
          0.23 *
          mult *
          CARD_DAMAGE[card] *
          (1 + cardMod) *
          classAttackMod(b.tables, unit.className) *
          classAdvantage(b.tables, unit.className, enemy.enemy.className) *
          attributeMod(b.tables, unit.attribute, enemy.enemy.attribute) *
          MIN_ROLL *
          Math.max(0, 1 + atkMod) *
          Math.max(0, 1 - clamp(specialDef, -1, 1)) *
          Math.max(0.001, 1 + clamp(powerUp, -1, 10) + clamp(npUp, -1, 5)) *
          se,
      ) + dmgPlus,
    );

    // Refund per hit; hits after the enemy is already dead get the overkill bonus.
    const perHit =
      np.npRate * CARD_NP_GAIN[card] * (1 + cardMod) * (enemy.enemy.tdRate / 1000) *
      (1 + clamp(npGainUp, -1, 4));
    const total = np.hits.reduce((a, h) => a + h, 0) || 100;
    let dealt = 0;
    let gained = 0;
    for (const share of np.hits) {
      const overkill = dealt >= enemy.enemy.hp;
      gained += Math.floor(perHit * (overkill ? 1.5 : 1));
      dealt += Math.floor((damage * share) / total);
    }

    refund += gained;
    hits[i] = {
      name: enemy.enemy.name,
      hp: enemy.enemy.hp,
      damage,
      ratio: enemy.enemy.hp > 0 ? damage / enemy.enemy.hp : Infinity,
      refund: gained,
    };
  }

  us.gauge = Math.min(unit.maxGauge, us.gauge + refund);

  // Limited-use buffs are spent by the attack.
  us.buffs = us.buffs
    .map((buff) => (used.has(buff) && buff.count > 0 ? { ...buff, count: buff.count - 1 } : buff))
    .filter((buff) => buff.count !== 0);

  np.funcs.slice(np.damageIndex + 1).forEach((rf) => applyFunc(rf, ctx));

  return {
    attacker,
    oc,
    gaugeBefore,
    refund,
    hits,
    minRatio: hits.reduce((m, h) => Math.min(m, h.ratio), Infinity),
  };
}

/** End of the player's turn: per-turn NP gain, then buff durations and cooldowns tick down. */
export function endTurn(b: Battle, state: BattleState): void {
  state.units.forEach((us, i) => {
    const holder = traitsOfUnit({ units: b.units, state }, i);
    const regain = sumBuffs(us.buffs, BUFF.regain, holder, holder, new Set());
    us.gauge = Math.min(b.units[i].maxGauge, us.gauge + Math.max(0, regain));
    us.buffs = us.buffs
      .map((buff) => (buff.turns > 0 ? { ...buff, turns: buff.turns - 1 } : buff))
      .filter((buff) => buff.turns !== 0);
    us.cd = us.cd.map((c) => Math.max(0, c - 1));
  });
  state.mcCd = state.mcCd.map((c) => Math.max(0, c - 1));
  state.enemies = [];
}
