/**
 * Atlas "nice" records carry lore, materials, assets and reverse lookups the
 * planner never reads. Stripping them keeps the IndexedDB cache and the data
 * posted to the optimizer workers a fraction of the size.
 */
import type {
  Buff,
  Func,
  NiceEquip,
  NiceMysticCode,
  NiceServant,
  NoblePhantasm,
  QuestEnemy,
  QuestPhase,
  Skill,
  Trait,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = any;

const traits = (list: Raw): Trait[] =>
  Array.isArray(list)
    ? list.map((t: Raw) => ({ id: t.id, name: t.name, ...(t.negative ? { negative: true } : {}) }))
    : [];

function trimBuff(b: Raw): Buff {
  const script: Raw = {};
  for (const key of ["checkIndvType", "INDIVIDUALITIE", "INDIVIDUALITIE_AND", "INDIVIDUALITIE_OR"]) {
    if (b.script?.[key] !== undefined) script[key] = b.script[key];
  }
  return {
    id: b.id,
    name: b.name,
    type: b.type,
    icon: b.icon,
    vals: traits(b.vals),
    tvals: traits(b.tvals),
    ckSelfIndv: traits(b.ckSelfIndv),
    ckOpIndv: traits(b.ckOpIndv),
    script,
  };
}

function trimVals(list: Raw) {
  if (!Array.isArray(list)) return undefined;
  return list.map((v: Raw) => {
    const out: Raw = {};
    for (const [k, val] of Object.entries(v)) {
      if (k === "DependFunc") continue;
      out[k] = val;
    }
    return out;
  });
}

export function trimFunc(f: Raw): Func {
  return {
    funcId: f.funcId,
    funcType: f.funcType,
    funcTargetType: f.funcTargetType,
    funcTargetTeam: f.funcTargetTeam,
    funcPopupText: f.funcPopupText,
    functvals: traits(f.functvals),
    funcquestTvals: (f.funcquestTvals ?? []).map((t: Raw) => (typeof t === "number" ? t : t.id)),
    buffs: (f.buffs ?? []).map(trimBuff),
    svals: trimVals(f.svals) ?? [],
    svals2: trimVals(f.svals2),
    svals3: trimVals(f.svals3),
    svals4: trimVals(f.svals4),
    svals5: trimVals(f.svals5),
  };
}

export function trimSkill(s: Raw): Skill {
  return {
    id: s.id,
    num: s.num,
    name: s.name,
    detail: s.detail,
    icon: s.icon,
    priority: s.priority,
    strengthStatus: s.strengthStatus,
    condQuestId: s.condQuestId,
    condLimitCount: s.condLimitCount ?? 0,
    coolDown: s.coolDown ?? [],
    functions: (s.functions ?? []).map(trimFunc),
    script: s.script?.SelectAddInfo ? { SelectAddInfo: s.script.SelectAddInfo } : undefined,
  };
}

function trimNp(np: Raw): NoblePhantasm {
  return {
    id: np.id,
    num: np.num,
    card: np.card,
    name: np.name,
    rank: np.rank,
    type: np.type,
    detail: np.detail,
    priority: np.priority,
    strengthStatus: np.strengthStatus,
    npGain: {
      buster: np.npGain?.buster ?? [],
      arts: np.npGain?.arts ?? [],
      quick: np.npGain?.quick ?? [],
      np: np.npGain?.np ?? [],
    },
    npDistribution: np.npDistribution ?? [],
    individuality: traits(np.individuality),
    functions: (np.functions ?? []).map(trimFunc),
  };
}

function face(raw: Raw): string | undefined {
  const faces = raw.extraAssets?.faces?.ascension ?? raw.extraAssets?.faces?.equip;
  if (!faces) return undefined;
  const first = Object.keys(faces).sort()[0];
  return first ? faces[first] : undefined;
}

export function trimServant(s: Raw): NiceServant {
  return {
    id: s.id,
    collectionNo: s.collectionNo,
    name: s.name,
    className: s.className,
    rarity: s.rarity,
    attribute: s.attribute,
    lvMax: s.lvMax,
    atkBase: s.atkBase,
    atkMax: s.atkMax,
    atkGrowth: s.atkGrowth ?? [],
    traits: traits(s.traits),
    skills: (s.skills ?? []).map(trimSkill),
    classPassive: (s.classPassive ?? []).map(trimSkill),
    appendPassive: (s.appendPassive ?? []).map((a: Raw) => ({
      num: a.num,
      priority: a.priority,
      skill: trimSkill(a.skill),
    })),
    noblePhantasms: (s.noblePhantasms ?? []).map(trimNp),
    face: face(s),
  };
}

export function trimEquip(e: Raw): NiceEquip {
  return {
    id: e.id,
    collectionNo: e.collectionNo,
    name: e.name,
    rarity: e.rarity,
    atkBase: e.atkBase,
    atkMax: e.atkMax,
    atkGrowth: e.atkGrowth ?? [],
    skills: (e.skills ?? []).map(trimSkill),
    face: face(e),
  };
}

export function trimMysticCode(mc: Raw): NiceMysticCode {
  return {
    id: mc.id,
    name: mc.name,
    detail: mc.detail,
    maxLv: mc.maxLv ?? 10,
    skills: (mc.skills ?? []).map(trimSkill),
    icon: mc.extraAssets?.item?.female ?? mc.extraAssets?.item?.male,
  };
}

function trimEnemy(e: Raw): QuestEnemy {
  return {
    deck: e.deck,
    deckId: e.deckId,
    npcId: e.npcId,
    name: e.name,
    roleType: e.roleType,
    svt: {
      id: e.svt?.id,
      name: e.svt?.name,
      className: e.svt?.className,
      attribute: e.svt?.attribute,
      face: e.svt?.face,
    },
    lv: e.lv,
    hp: e.hp,
    traits: traits(e.traits),
    serverMod: e.serverMod,
    classPassive: {
      classPassive: (e.classPassive?.classPassive ?? []).map(trimSkill),
      addPassive: (e.classPassive?.addPassive ?? []).map(trimSkill),
    },
    enemyScript: {
      shift: e.enemyScript?.shift,
      changeAttri: e.enemyScript?.changeAttri,
    },
  };
}

export function trimQuestPhase(q: Raw): QuestPhase {
  return {
    id: q.id,
    phase: q.phase,
    name: q.name,
    type: q.type,
    spotName: q.spotName,
    warLongName: q.warLongName,
    consume: q.consume,
    recommendLv: q.recommendLv,
    individuality: traits(q.individuality),
    stages: (q.stages ?? []).map((s: Raw) => ({
      wave: s.wave,
      enemyFieldPosCount: s.enemyFieldPosCount,
      enemies: (s.enemies ?? []).map(trimEnemy),
    })),
  };
}
