/**
 * Small builders for Atlas-shaped test data. Values use Atlas units:
 * buff values and NP multipliers in thousandths, NP gauge in hundredths of a percent.
 */
import type {
  Buff,
  DataVal,
  Func,
  NiceEquip,
  NiceServant,
  NoblePhantasm,
  QuestEnemy,
  QuestPhase,
  Skill,
} from "../../atlas/types";

let nextId = 1;
const id = () => nextId++;

const TRAIT_IDS: Record<string, number> = {
  cardArts: 4001,
  cardBuster: 4002,
  cardQuick: 4003,
  cardNP: 4007,
};
const trait = (name: string) => ({ id: TRAIT_IDS[name] ?? 0, name });

export function buff(type: string, opts: { ckSelf?: string[]; ckOp?: number[] } = {}): Buff {
  return {
    id: id(),
    name: type,
    type,
    vals: [],
    tvals: [],
    ckSelfIndv: (opts.ckSelf ?? []).map(trait),
    ckOpIndv: (opts.ckOp ?? []).map((t) => ({ id: t, name: String(t) })),
    script: {},
  };
}

function tenLevels(make: (lv: number) => DataVal): DataVal[] {
  return Array.from({ length: 10 }, (_, i) => make(i + 1));
}

export function stateFunc(
  target: string,
  b: Buff,
  value: number | ((lv: number) => number),
  turns = 3,
  count = -1,
): Func {
  const v = typeof value === "number" ? () => value : value;
  return {
    funcId: id(),
    funcType: "addStateShort",
    funcTargetType: target,
    funcTargetTeam: target.startsWith("enemy") ? "enemy" : "player",
    functvals: [],
    funcquestTvals: [],
    buffs: [b],
    svals: tenLevels((lv) => ({ Rate: 1000, Turn: turns, Count: count, Value: v(lv) })),
  };
}

export function gainNp(target: string, value: number): Func {
  return {
    funcId: id(),
    funcType: "gainNp",
    funcTargetType: target,
    funcTargetTeam: "player",
    functvals: [],
    funcquestTvals: [],
    buffs: [],
    svals: tenLevels(() => ({ Rate: 1000, Value: value })),
  };
}

export function skill(name: string, num: number, cooldown: number, functions: Func[]): Skill {
  return {
    id: id(),
    num,
    name,
    priority: 1,
    condLimitCount: 0,
    coolDown: Array.from({ length: 10 }, (_, i) => cooldown + (i >= 9 ? 0 : i >= 5 ? 1 : 2)),
    functions,
  };
}

export function np(opts: {
  card: "arts" | "buster" | "quick";
  multiplier: number;
  aoe?: boolean;
  hits?: number[];
  npRate?: number;
  extra?: Func[];
}): NoblePhantasm {
  const dmg: Func = {
    funcId: id(),
    funcType: "damageNp",
    funcTargetType: opts.aoe === false ? "enemy" : "enemyAll",
    funcTargetTeam: "enemy",
    functvals: [],
    funcquestTvals: [],
    buffs: [],
    svals: Array.from({ length: 5 }, (_, i) => ({ Rate: 1000, Value: opts.multiplier + i * 1500 })),
  };
  return {
    id: id(),
    num: 1,
    card: opts.card,
    name: `${opts.card} NP`,
    rank: "A",
    type: "",
    priority: 1,
    strengthStatus: 0,
    npGain: {
      buster: [],
      arts: [],
      quick: [],
      np: [opts.npRate ?? 100, opts.npRate ?? 100, opts.npRate ?? 100, opts.npRate ?? 100, opts.npRate ?? 100],
    },
    npDistribution: opts.hits ?? [16, 33, 51],
    individuality: [],
    functions: [...(opts.extra ?? []), dmg],
  };
}

export function servant(opts: {
  name: string;
  className: string;
  attribute?: string;
  atk: number;
  np?: NoblePhantasm;
  skills?: Skill[];
  passives?: Skill[];
}): NiceServant {
  return {
    id: id(),
    collectionNo: id(),
    name: opts.name,
    className: opts.className,
    rarity: 5,
    attribute: opts.attribute ?? "human",
    lvMax: 90,
    atkBase: opts.atk,
    atkMax: opts.atk,
    atkGrowth: Array.from({ length: 120 }, () => opts.atk),
    traits: [],
    skills: opts.skills ?? [],
    classPassive: opts.passives ?? [],
    appendPassive: [],
    noblePhantasms: opts.np ? [opts.np] : [],
  };
}

export function equip(name: string, opts: { atk?: number; funcs: Func[] }): NiceEquip {
  return {
    id: id(),
    collectionNo: id(),
    name,
    rarity: 5,
    atkBase: opts.atk ?? 0,
    atkMax: opts.atk ?? 0,
    atkGrowth: [],
    skills: [
      {
        id: id(),
        num: 1,
        name,
        priority: 1,
        condLimitCount: 0,
        coolDown: [0],
        functions: opts.funcs.map((f) => ({ ...f, svals: [f.svals[0]] })),
      },
    ],
  };
}

export function enemy(name: string, className: string, hp: number, attribute = "human"): QuestEnemy {
  return {
    deck: "enemy",
    deckId: id(),
    npcId: id(),
    name,
    roleType: "normal",
    svt: { id: id(), name, className, attribute },
    lv: 1,
    hp,
    traits: [],
    serverMod: { tdRate: 1000, tdAttackRate: 1000, starRate: 0 },
  };
}

export function questPhase(waves: QuestEnemy[][]): QuestPhase {
  return {
    id: 93000000 + id(),
    phase: 3,
    name: "Test Quest",
    type: "free",
    spotName: "Test Spot",
    warLongName: "Test War",
    consume: 40,
    recommendLv: "90",
    individuality: [],
    stages: waves.map((enemies, i) => ({ wave: i + 1, enemyFieldPosCount: 3, enemies })),
  };
}
