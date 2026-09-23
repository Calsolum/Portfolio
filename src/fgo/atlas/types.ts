/**
 * The subset of Atlas Academy's "nice" JSON that the team builder reads.
 * Field names match https://api.atlasacademy.io/docs exactly so raw responses
 * can be passed straight through; everything not listed here is stripped
 * before caching (see trim.ts).
 */

export interface Trait {
  id: number;
  name: string;
  negative?: boolean;
}

export interface DataVal {
  Rate?: number;
  Turn?: number;
  Count?: number;
  Value?: number;
  Value2?: number;
  Target?: number;
  Correction?: number;
  TargetList?: number[];
  TargetRarityList?: number[];
  AndOrCheckIndividualityList?: number[][];
  [key: string]: unknown;
}

export interface BuffScript {
  checkIndvType?: number;
  INDIVIDUALITIE?: Trait;
  INDIVIDUALITIE_AND?: Trait[];
  INDIVIDUALITIE_OR?: Trait[];
  [key: string]: unknown;
}

export interface Buff {
  id: number;
  name: string;
  type: string;
  icon?: string;
  vals: Trait[];
  tvals: Trait[];
  ckSelfIndv: Trait[];
  ckOpIndv: Trait[];
  script: BuffScript;
}

export interface Func {
  funcId: number;
  funcType: string;
  funcTargetType: string;
  funcTargetTeam: string;
  funcPopupText?: string;
  functvals: Trait[];
  funcquestTvals: (number | Trait)[];
  buffs: Buff[];
  svals: DataVal[];
  svals2?: DataVal[];
  svals3?: DataVal[];
  svals4?: DataVal[];
  svals5?: DataVal[];
}

export interface Skill {
  id: number;
  num?: number;
  name: string;
  detail?: string;
  icon?: string;
  priority?: number;
  strengthStatus?: number;
  condQuestId?: number;
  condLimitCount: number;
  coolDown: number[];
  functions: Func[];
  script?: { SelectAddInfo?: unknown[]; [key: string]: unknown };
}

export interface NoblePhantasm {
  id: number;
  num: number;
  card: string;
  name: string;
  rank: string;
  type: string;
  detail?: string;
  priority: number;
  strengthStatus: number;
  npGain: { buster: number[]; arts: number[]; quick: number[]; np: number[] };
  npDistribution: number[];
  individuality: Trait[];
  functions: Func[];
}

export interface AppendPassive {
  num: number;
  priority: number;
  skill: Skill;
}

export interface NiceServant {
  id: number;
  collectionNo: number;
  name: string;
  className: string;
  rarity: number;
  attribute: string;
  lvMax: number;
  atkBase: number;
  atkMax: number;
  atkGrowth: number[];
  traits: Trait[];
  skills: Skill[];
  classPassive: Skill[];
  appendPassive: AppendPassive[];
  noblePhantasms: NoblePhantasm[];
  face?: string;
}

export interface NiceEquip {
  id: number;
  collectionNo: number;
  name: string;
  rarity: number;
  atkBase: number;
  atkMax: number;
  atkGrowth: number[];
  skills: Skill[];
  face?: string;
}

export interface NiceMysticCode {
  id: number;
  name: string;
  detail?: string;
  maxLv: number;
  skills: Skill[];
  icon?: string;
}

export interface BasicEntity {
  id: number;
  collectionNo: number;
  name: string;
  type: string;
  className: string;
  rarity: number;
  atkMax: number;
  face: string;
}

export interface QuestEnemy {
  deck: string;
  deckId: number;
  npcId: number;
  name: string;
  roleType: string;
  svt: { id: number; name: string; className: string; attribute: string; face?: string };
  lv: number;
  hp: number;
  traits: Trait[];
  serverMod?: { tdRate: number; tdAttackRate: number; starRate: number };
  classPassive?: { classPassive: Skill[]; addPassive: Skill[] };
  enemyScript?: { shift?: number[]; changeAttri?: string; [key: string]: unknown };
}

export interface QuestStage {
  wave: number;
  enemyFieldPosCount?: number;
  enemies: QuestEnemy[];
}

export interface QuestPhase {
  id: number;
  phase: number;
  name: string;
  type: string;
  spotName: string;
  warLongName: string;
  consume: number;
  recommendLv: string;
  individuality: Trait[];
  stages: QuestStage[];
}

export interface BasicQuestPhase {
  id: number;
  phase: number;
  name: string;
  type: string;
  spotName: string;
  warLongName: string;
  consume: number;
  recommendLv?: string;
  individuality?: Trait[];
}

/** Class name → class name → rate in thousandths (2000 = 2×). */
export type ClassRelation = Record<string, Record<string, number>>;
/** Class name → attack rate in thousandths. */
export type ClassAttackRate = Record<string, number>;
