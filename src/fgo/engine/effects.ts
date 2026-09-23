import type { Buff, DataVal, Func } from "../atlas/types";
import type { ActiveBuff, BattleState, ResolvedFunc, Unit } from "./model";

/**
 * Buff types the damage and NP-gauge model reads, grouped by the term of the
 * damage formula they feed. Anything else that shows up on a skill or NP is
 * either irrelevant to one-turn wave clears (see IGNORED_BUFFS) or reported
 * back to the player as an effect the planner did not account for.
 */
export const BUFF = {
  atk: ["upAtk", "downAtk"],
  card: ["upCommandall", "downCommandall", "upCommandatk", "downCommandatk"],
  np: ["upNpdamage", "downNpdamage"],
  power: [
    "upDamage",
    "downDamage",
    "upDamageIndividuality",
    "downDamageIndividuality",
    "upDamageIndividualityActiveonly",
    "downDamageIndividualityActiveonly",
    "upDamageSpecial",
  ],
  dmgPlus: ["addDamage", "subDamage"],
  npGain: ["upDropnp", "downDropnp"],
  regain: ["regainNp"],
  overcharge: ["upChagetd"],
  trait: ["addIndividuality"],
  field: ["fieldIndividuality"],
  pierce: ["pierceDefence"],
  // Held by enemies:
  def: ["upDefence", "downDefence"],
  cardRes: ["upDefencecommandall", "downDefencecommandall"],
  specialDef: ["upSpecialdefence", "downSpecialdefence"],
} as const;

export type BuffCategory = keyof typeof BUFF;

export const BUFF_CATEGORY = new Map<string, BuffCategory>(
  (Object.keys(BUFF) as BuffCategory[]).flatMap((cat) => BUFF[cat].map((t) => [t, cat] as const)),
);

const NEGATIVE = new Set([
  "downAtk",
  "downCommandall",
  "downCommandatk",
  "downNpdamage",
  "downDamage",
  "downDamageIndividuality",
  "downDamageIndividualityActiveonly",
  "subDamage",
  "downDropnp",
  "downDefence",
  "downDefencecommandall",
  "downSpecialdefence",
]);

const OFFENSIVE = new Set<string>([
  ...BUFF.atk,
  ...BUFF.card,
  ...BUFF.np,
  ...BUFF.power,
  ...BUFF.dmgPlus,
  ...BUFF.npGain,
  ...BUFF.regain,
  ...BUFF.overcharge,
  ...BUFF.trait,
  ...BUFF.field,
  ...BUFF.pierce,
]);
const DEFENSIVE = new Set<string>([...BUFF.def, ...BUFF.cardRes, ...BUFF.specialDef]);
export const KNOWN_BUFFS = new Set<string>([...OFFENSIVE, ...DEFENSIVE]);

/** Buffs that never change whether a wave dies to one NP. */
const IGNORED_BUFFS = new Set([
  "upCriticaldamage",
  "upCriticalpoint",
  "upCriticalrate",
  "downCriticalrate",
  "upStarweight",
  "downStarweight",
  "regainStar",
  "regainHp",
  "upHate",
  "avoidance",
  "invincible",
  "guts",
  "gutsRatio",
  "upGrantstate",
  "downGrantstate",
  "upTolerance",
  "downTolerance",
  "avoidState",
  "upResistInstantdeath",
  "upNonresistInstantdeath",
  "avoidInstantdeath",
  "downCriticaldamage",
  "upGainHp",
  "upGivegainHp",
  "upMaxhp",
  "addMaxhp",
  "donotAct",
  "donotSkill",
  "donotNoble",
  "donotRecovery",
  "upCommandstar",
  "upDropStar",
  "subSelfdamage",
  "reduceHp",
  "upToleranceSubstate",
  "upGrantInstantdeath",
  "breakAvoidance",
  "pierceInvincible",
  "specialInvincible",
  "upDamagedropnp",
  "upCriticalRateDamageTaken",
  "upCriticalStarDamageTaken",
  "delayFunction",
  "deadFunction",
  "selfturnendFunction",
  "donotActCommandtype",
  "donotSelectCommandcard",
  "upBaseHp",
  "addBaseHp",
  "preventDeathByDamage",
  "upFuncHpReduce",
  "skillRankUp",
]);

/** Function types that never change a one-NP wave clear. */
const IGNORED_FUNCS = new Set([
  "none",
  "gainStar",
  "lossStar",
  "gainHp",
  "gainHpPer",
  "lossHp",
  "lossHpSafe",
  "lossHpPer",
  "lossHpPerSafe",
  "subState",
  "releaseState",
  "instantDeath",
  "forceInstantDeath",
  "hastenNpturn",
  "delayNpturn",
  "cardReset",
  "expUp",
  "qpUp",
  "dropUp",
  "friendPointUp",
  "eventDropUp",
  "eventDropRateUp",
  "eventPointUp",
  "eventPointRateUp",
  "qpDropUp",
  "servantFriendshipUp",
  "userEquipExpUp",
  "classDropUp",
  "enemyEncountCopyRateUp",
  "enemyEncountRateUp",
  "enemyProbDown",
  "getRewardGift",
  "sendSupportFriendPoint",
  "friendPointUpDuplicate",
  "buddyPointUp",
  "displayBuffstring",
  "changeBg",
  "changeBgm",
  "quickChangeBg",
  "changeBgmCostume",
  "absorbNpturn",
  "gainHpFromTargets",
  "eventFortificationPointUp",
]);

export function isDamageFunc(func: Func): boolean {
  return func.funcType.startsWith("damageNp");
}

function isAllyTarget(func: Func) {
  return func.funcTargetTeam !== "enemy" && !func.funcTargetType.startsWith("enemy");
}

/** Would this function ever help an NP clear a wave? Decides which skills the planner considers. */
export function isRelevantFunc(func: Func): boolean {
  switch (func.funcType) {
    case "gainNp":
    case "shortenSkill":
      return isAllyTarget(func);
    case "addState":
    case "addStateShort": {
      const buff = func.buffs[0];
      if (!buff) return false;
      if (isAllyTarget(func)) return OFFENSIVE.has(buff.type) && !NEGATIVE.has(buff.type);
      return (DEFENSIVE.has(buff.type) && NEGATIVE.has(buff.type)) ||
        buff.type === "addIndividuality";
    }
    default:
      return false;
  }
}

/** Why an effect was left out of the plan, or null if the planner models it. */
export function unsupportedReason(func: Func): string | null {
  if (IGNORED_FUNCS.has(func.funcType)) return null;
  if (isDamageFunc(func)) return null;
  switch (func.funcType) {
    case "gainNp":
    case "lossNp":
    case "shortenSkill":
      return null;
    case "addState":
    case "addStateShort": {
      const buff = func.buffs[0];
      if (!buff) return null;
      if (KNOWN_BUFFS.has(buff.type) || IGNORED_BUFFS.has(buff.type)) return null;
      return buff.name || buff.type;
    }
    default:
      return func.funcPopupText || func.funcType;
  }
}

export interface ApplyContext {
  units: Unit[];
  state: BattleState;
  caster: number;
  /** Ally picked for single-target skills. */
  target: number | null;
  /** Overcharge level 1-5 for NP functions. */
  oc: number;
  ignored: Set<string>;
  source: string;
}

function hasAny(list: number[], have: Set<number>): boolean {
  return list.some((t) => have.has(t));
}

export function traitsOfUnit(ctx: { units: Unit[]; state: BattleState }, i: number): Set<number> {
  const set = new Set(ctx.units[i].traits);
  for (const b of ctx.state.units[i].buffs) {
    if (b.type === "addIndividuality") set.add(b.value);
  }
  for (const f of ctx.state.field) set.add(f);
  return set;
}

export function traitsOfEnemy(state: BattleState, i: number): Set<number> {
  const e = state.enemies[i];
  const set = new Set(e.enemy.traits);
  for (const b of e.buffs) {
    if (b.type === "addIndividuality") set.add(b.value);
    for (const t of b.traits) set.add(t);
  }
  for (const f of state.field) set.add(f);
  return set;
}

function toActiveBuff(buff: Buff, val: DataVal, source: string): ActiveBuff {
  const ids = (list: { id: number }[] | undefined) => (list ?? []).map((t) => t.id);
  const cond = [
    ...(buff.script?.INDIVIDUALITIE ? [buff.script.INDIVIDUALITIE.id] : []),
    ...ids(buff.script?.INDIVIDUALITIE_OR),
  ];
  return {
    name: buff.name || source,
    type: buff.type,
    value: val.Value ?? 0,
    turns: val.Turn ?? -1,
    count: val.Count ?? -1,
    ckSelf: ids(buff.ckSelfIndv),
    ckOp: ids(buff.ckOpIndv),
    and: buff.script?.checkIndvType === 1,
    cond,
    traits: ids(buff.vals),
  };
}

function rateSucceeds(val: DataVal): boolean {
  // Rate is in thousandths; probabilistic effects are not relied on. Negative
  // rates depend on the previous function succeeding, which the planner assumes.
  const rate = val.Rate ?? 1000;
  return Math.abs(rate) >= 1000;
}

function allyTargets(func: Func, ctx: ApplyContext): number[] {
  const all = ctx.units.map((_, i) => i);
  switch (func.funcTargetType) {
    case "self":
    case "commandTypeSelfTreasureDevice":
      return [ctx.caster];
    case "ptOne":
      return ctx.target === null ? [ctx.caster] : [ctx.target];
    case "ptAll":
    case "ptFull":
      return all;
    case "ptOther":
    case "ptOtherFull":
      return all.filter((i) => i !== ctx.caster);
    case "ptOneOther":
      return all.filter((i) => i !== (ctx.target ?? ctx.caster));
    default:
      return [];
  }
}

function enemyTargets(func: Func, ctx: ApplyContext): number[] {
  const enemies = ctx.state.enemies;
  if (enemies.length === 0) return [];
  switch (func.funcTargetType) {
    case "enemyAll":
    case "enemyFull":
      return enemies.map((_, i) => i);
    case "enemy":
    case "enemyOneNoTargetNoAction": {
      // Single-target debuffs go on the enemy with the most HP.
      let best = 0;
      enemies.forEach((e, i) => {
        if (e.enemy.hp > enemies[best].enemy.hp) best = i;
      });
      return [best];
    }
    default:
      return [];
  }
}

function passesFuncTraits(func: Func, have: Set<number>, field: number[]): boolean {
  const required = func.functvals ?? [];
  if (required.length) {
    const positive = required.filter((t) => !t.negative && t.id > 0).map((t) => t.id);
    const negative = required.filter((t) => t.negative || t.id < 0).map((t) => Math.abs(t.id));
    if (positive.length && !positive.some((t) => have.has(t))) return false;
    if (negative.some((t) => have.has(t))) return false;
  }
  const quest = (func.funcquestTvals ?? []).map((t) => (typeof t === "number" ? t : t.id));
  if (quest.length && !quest.every((t) => field.includes(t))) return false;
  return true;
}

/** Applies one skill, NP or passive function to the battle state. */
export function applyFunc(rf: ResolvedFunc, ctx: ApplyContext): void {
  const { func } = rf;
  const val = rf.vals[Math.max(0, Math.min(4, ctx.oc - 1))];
  if (isDamageFunc(func)) return;
  const reason = unsupportedReason(func);
  if (reason) {
    ctx.ignored.add(`${ctx.source}: ${reason}`);
    return;
  }
  if (!rateSucceeds(val)) return;

  const onEnemies = func.funcTargetTeam === "enemy" || func.funcTargetType.startsWith("enemy");
  if (onEnemies) {
    if (func.funcType !== "addState" && func.funcType !== "addStateShort") return;
    const buff = func.buffs[0];
    if (!buff) return;
    for (const i of enemyTargets(func, ctx)) {
      if (!passesFuncTraits(func, traitsOfEnemy(ctx.state, i), ctx.state.field)) continue;
      ctx.state.enemies[i].buffs.push(toActiveBuff(buff, val, ctx.source));
    }
    return;
  }

  for (const i of allyTargets(func, ctx)) {
    if (!passesFuncTraits(func, traitsOfUnit(ctx, i), ctx.state.field)) continue;
    const unit = ctx.state.units[i];
    switch (func.funcType) {
      case "gainNp":
        unit.gauge = Math.min(ctx.units[i].maxGauge, unit.gauge + (val.Value ?? 0));
        break;
      case "lossNp":
        unit.gauge = Math.max(0, unit.gauge - (val.Value ?? 0));
        break;
      case "shortenSkill":
        unit.cd = unit.cd.map((c) => Math.max(0, c - (val.Value ?? 0)));
        break;
      case "addState":
      case "addStateShort": {
        const buff = func.buffs[0];
        if (!buff) break;
        if (buff.type === "fieldIndividuality") {
          if (val.Value) ctx.state.field.push(val.Value);
          break;
        }
        unit.buffs.push(toActiveBuff(buff, val, ctx.source));
        break;
      }
    }
  }
}

/** Is a buff active for this attack, given who holds it and who it is used against? */
export function buffApplies(
  buff: ActiveBuff,
  holder: Set<number>,
  self: Set<number>,
  op: Set<number>,
): boolean {
  if (buff.cond.length && !hasAny(buff.cond, holder)) return false;
  const check = (list: number[], have: Set<number>) =>
    list.length === 0 || (buff.and ? list.every((t) => have.has(t)) : hasAny(list, have));
  return check(buff.ckSelf, self) && check(buff.ckOp, op);
}

export function signedValue(buff: ActiveBuff): number {
  return NEGATIVE.has(buff.type) ? -buff.value : buff.value;
}
