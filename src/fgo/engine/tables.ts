import type { ClassAttackRate, ClassRelation } from "../atlas/types";

/**
 * Battle constants. The live values come from Atlas's NiceClassRelation /
 * NiceClassAttackRate / NiceAttributeRelation exports; the tables below are
 * the fallback for the standard classes if those fail to load, and are what
 * the unit tests run against.
 */
export interface Tables {
  classRelation: ClassRelation;
  classAttackRate: ClassAttackRate;
  attributeRelation: ClassRelation;
}

const KNIGHTS = ["saber", "archer", "lancer"];
const CAVALRY = ["rider", "caster", "assassin"];
const STANDARD = [
  ...KNIGHTS,
  ...CAVALRY,
  "berserker",
  "shielder",
  "ruler",
  "avenger",
  "moonCancer",
  "alterEgo",
  "foreigner",
  "pretender",
];

function buildFallbackRelation(): ClassRelation {
  const rel: ClassRelation = {};
  const set = (atk: string, def: string, rate: number) => {
    rel[atk] ??= {};
    rel[atk][def] = rate;
  };

  for (const atk of STANDARD) {
    for (const def of STANDARD) set(atk, def, 1000);
    // Everyone hits Berserker for double; Shielder hits and is hit neutrally.
    set(atk, "berserker", 2000);
    set(atk, "shielder", 1000);
  }
  for (const def of STANDARD) set("berserker", def, 2000);
  set("berserker", "shielder", 1000);
  for (const def of STANDARD) set("shielder", def, 1000);

  const triangle: [string, string][] = [
    ["saber", "lancer"],
    ["lancer", "archer"],
    ["archer", "saber"],
    ["rider", "caster"],
    ["caster", "assassin"],
    ["assassin", "rider"],
    ["ruler", "moonCancer"],
    ["moonCancer", "avenger"],
    ["avenger", "ruler"],
  ];
  for (const [strong, weak] of triangle) {
    set(strong, weak, 2000);
    set(weak, strong, 500);
  }
  for (const atk of [...KNIGHTS, ...CAVALRY]) set(atk, "ruler", 500);

  for (const def of CAVALRY) set("alterEgo", def, 1500);
  for (const def of KNIGHTS) set("alterEgo", def, 500);
  for (const def of KNIGHTS) set("pretender", def, 1500);
  for (const def of CAVALRY) set("pretender", def, 500);
  set("alterEgo", "foreigner", 2000);
  set("foreigner", "alterEgo", 500);
  set("foreigner", "foreigner", 2000);
  set("foreigner", "pretender", 2000);
  set("pretender", "foreigner", 500);
  set("pretender", "alterEgo", 2000);
  set("alterEgo", "pretender", 500);
  return rel;
}

export const FALLBACK_TABLES: Tables = {
  classRelation: buildFallbackRelation(),
  classAttackRate: {
    saber: 1000,
    archer: 950,
    lancer: 1050,
    rider: 1000,
    caster: 900,
    assassin: 900,
    berserker: 1100,
    shielder: 1000,
    ruler: 1100,
    alterEgo: 1000,
    avenger: 1100,
    moonCancer: 1000,
    foreigner: 1000,
    pretender: 1000,
  },
  attributeRelation: {
    human: { sky: 1100, earth: 900 },
    sky: { earth: 1100, human: 900 },
    earth: { human: 1100, sky: 900 },
    star: { beast: 1100 },
    beast: { star: 1100 },
  },
};

/** Grand classes and the like fall back to their base class when a table lacks them. */
function baseClass(name: string): string {
  if (name.startsWith("grand") && name.length > 5) {
    const rest = name.slice(5);
    const base = rest.charAt(0).toLowerCase() + rest.slice(1);
    return base === "alterego" ? "alterEgo" : base;
  }
  return name;
}

function lookup(table: ClassRelation, atk: string, def: string): number | undefined {
  return table[atk]?.[def] ?? table[baseClass(atk)]?.[def] ?? table[atk]?.[baseClass(def)] ??
    table[baseClass(atk)]?.[baseClass(def)];
}

export function classAdvantage(tables: Tables, atk: string, def: string): number {
  return (lookup(tables.classRelation, atk, def) ?? 1000) / 1000;
}

export function classAttackMod(tables: Tables, cls: string): number {
  return (tables.classAttackRate[cls] ?? tables.classAttackRate[baseClass(cls)] ?? 1000) / 1000;
}

export function attributeMod(tables: Tables, atk: string, def: string): number {
  return (tables.attributeRelation[atk]?.[def] ?? 1000) / 1000;
}

/** NP gain rate of the enemy class when its server mod is missing. */
export const FALLBACK_TD_RATE: Record<string, number> = {
  rider: 1100,
  caster: 1200,
  assassin: 900,
  berserker: 800,
  moonCancer: 1200,
};

export const CARD_DAMAGE: Record<string, number> = { buster: 1.5, arts: 1, quick: 0.8 };
export const CARD_NP_GAIN: Record<string, number> = { buster: 0, arts: 3, quick: 1 };

/** Atlas trait IDs for command card types. */
export const CARD_TRAIT: Record<string, number> = {
  arts: 4001,
  buster: 4002,
  quick: 4003,
  extra: 4004,
};
export const TRAIT_CARD_NP = 4007;

export const TRAIT_NAME_TO_ID: Record<string, number> = {
  cardArts: 4001,
  cardBuster: 4002,
  cardQuick: 4003,
  cardExtra: 4004,
  cardNP: 4007,
};

/** Normalises Atlas's card field, which is "arts" in nice data and "1" in raw data. */
export function cardName(card: string): "arts" | "buster" | "quick" {
  switch (card) {
    case "1":
    case "arts":
      return "arts";
    case "2":
    case "buster":
      return "buster";
    default:
      return "quick";
  }
}
