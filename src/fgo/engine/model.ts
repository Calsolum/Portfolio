import type {
  DataVal,
  Func,
  NiceEquip,
  NiceMysticCode,
  NiceServant,
  NoblePhantasm,
  QuestPhase,
  Skill,
} from "../atlas/types";

/** One servant as the player has built them, plus the CE they would carry. */
export interface UnitSpec {
  /** Unique per roster entry: "own:<servantId>" or "friend:<n>". */
  key: string;
  label: string;
  servant: NiceServant;
  isFriend: boolean;
  level: number;
  fou: number;
  npLevel: number;
  skillLevels: number[];
  /** Chosen skill id per slot (1-3) where a servant has upgrades; defaults to the newest. */
  skillIds?: Record<number, number>;
  /** Chosen NP id where a servant has more than one; defaults to the newest. */
  npId?: number;
  /** Append skill level keyed by the append's 1-based position; 0 or missing = locked. */
  appendLevels?: Record<number, number>;
}

export interface CeLoadout {
  equip: NiceEquip;
  mlb: boolean;
  level?: number;
}

export interface McLoadout {
  mc: NiceMysticCode;
  level: number;
}

/** A skill or passive with the DataVals already picked for its level. */
export interface ResolvedFunc {
  func: Func;
  /** DataVal per overcharge level 1-5 (skills repeat the same one). */
  vals: DataVal[];
}

export interface CompiledSkill {
  /** Unit index in the team, or -1 for the mystic code. */
  owner: number;
  slot: number;
  name: string;
  cooldown: number;
  /** Most skills have one option; "choose an effect" skills have several. */
  options: ResolvedFunc[][];
  optionNames: string[];
  needsTarget: boolean;
  relevant: boolean;
}

export interface CompiledNp {
  np: NoblePhantasm;
  card: "arts" | "buster" | "quick";
  aoe: boolean;
  /** Functions with DataVals for NP level; index by overcharge inside ResolvedFunc.vals. */
  funcs: ResolvedFunc[];
  damageIndex: number;
  hits: number[];
  npRate: number;
  traits: number[];
}

export interface Unit {
  key: string;
  label: string;
  servantId: number;
  isFriend: boolean;
  className: string;
  attribute: string;
  traits: number[];
  atk: number;
  np: CompiledNp | null;
  skills: CompiledSkill[];
  /** Passives, append skills and CE effects, applied at battle start. */
  passives: { name: string; funcs: ResolvedFunc[] }[];
  ceName?: string;
  maxGauge: number;
}

export interface Enemy {
  name: string;
  className: string;
  attribute: string;
  traits: number[];
  hp: number;
  tdRate: number;
  passives: ResolvedFunc[];
}

export interface Wave {
  enemies: Enemy[];
  notes: string[];
}

export interface Quest {
  id: number;
  phase: number;
  name: string;
  fieldTraits: number[];
  waves: Wave[];
}

export interface ActiveBuff {
  name: string;
  type: string;
  value: number;
  turns: number;
  count: number;
  ckSelf: number[];
  ckOp: number[];
  and: boolean;
  /** Buff only works while the holder (or field) has one of these traits. */
  cond: number[];
  /** The buff's own traits, which some NPs deal supereffective damage against. */
  traits: number[];
}

export interface UnitState {
  gauge: number;
  cd: number[];
  buffs: ActiveBuff[];
}

export interface EnemyState {
  enemy: Enemy;
  buffs: ActiveBuff[];
}

export interface BattleState {
  units: UnitState[];
  mcCd: number[];
  enemies: EnemyState[];
  field: number[];
}

export type { NiceEquip, NiceMysticCode, NiceServant, QuestPhase, Skill };
