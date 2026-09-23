import type { DataVal, Func, QuestPhase, Skill, Trait } from "../atlas/types";
import type {
  CeLoadout,
  CompiledNp,
  CompiledSkill,
  Enemy,
  McLoadout,
  Quest,
  ResolvedFunc,
  Unit,
  UnitSpec,
} from "./model";
import { isRelevantFunc } from "./effects";
import { CARD_TRAIT, FALLBACK_TD_RATE, TRAIT_CARD_NP, TRAIT_NAME_TO_ID, cardName } from "./tables";

export function traitIds(traits: (Trait | number)[] | undefined): number[] {
  if (!traits) return [];
  return traits.map((t) =>
    typeof t === "number" ? t : t.id || TRAIT_NAME_TO_ID[t.name] || 0,
  );
}

function clampIndex<T>(arr: T[] | undefined, level: number): T | undefined {
  if (!arr || arr.length === 0) return undefined;
  return arr[Math.max(0, Math.min(arr.length - 1, level - 1))];
}

/** Same DataVal for every overcharge level (skills, passives, CEs). */
export function resolveFlat(func: Func, level: number): ResolvedFunc {
  const val = clampIndex(func.svals, level) ?? {};
  return { func, vals: [val, val, val, val, val] };
}

/** NP DataVals: svals is overcharge 1, svals2..svals5 the higher overcharge levels. */
export function resolveNp(func: Func, npLevel: number): ResolvedFunc {
  const sets = [func.svals, func.svals2, func.svals3, func.svals4, func.svals5];
  const base = clampIndex(func.svals, npLevel) ?? {};
  const vals: DataVal[] = sets.map((set) => clampIndex(set, npLevel) ?? base);
  return { func, vals };
}

/** Newest variant of each skill slot (rank-ups and interludes), unless one was chosen. */
export function pickSkills(skills: Skill[], chosen?: Record<number, number>): Skill[] {
  const bySlot = new Map<number, Skill>();
  for (const skill of skills) {
    const slot = skill.num ?? 0;
    if (slot < 1 || slot > 3) continue;
    if (chosen?.[slot] !== undefined) {
      if (skill.id === chosen[slot]) bySlot.set(slot, skill);
      continue;
    }
    const current = bySlot.get(slot);
    if (!current || (skill.priority ?? 0) > (current.priority ?? 0) ||
      ((skill.priority ?? 0) === (current.priority ?? 0) && skill.id > current.id)) {
      bySlot.set(slot, skill);
    }
  }
  return [1, 2, 3].map((slot) => bySlot.get(slot)).filter((s): s is Skill => Boolean(s));
}

export function pickNp(spec: UnitSpec) {
  const nps = spec.servant.noblePhantasms.filter((np) => np.functions.length > 0);
  if (spec.npId !== undefined) {
    const chosen = nps.find((np) => np.id === spec.npId);
    if (chosen) return chosen;
  }
  return [...nps].sort((a, b) => b.priority - a.priority || b.id - a.id)[0];
}

/** Skills whose effects are picked from a menu split their functions by ActSelectIndex. */
function skillOptions(skill: Skill, level: number): { options: ResolvedFunc[][]; names: string[] } {
  const funcs = skill.functions.map((f) => resolveFlat(f, level));
  const select = skill.script?.SelectAddInfo as
    | { btn?: { name?: string }[] }[]
    | undefined;
  const hasIndex = funcs.some((rf) => rf.vals[0].ActSelectIndex !== undefined);
  if (!select?.length || !hasIndex) return { options: [funcs], names: [""] };

  const common = funcs.filter((rf) => rf.vals[0].ActSelectIndex === undefined);
  const indices = [...new Set(funcs.map((rf) => rf.vals[0].ActSelectIndex).filter(
    (i): i is number => typeof i === "number",
  ))].sort((a, b) => a - b);
  const buttons = select[0]?.btn ?? [];
  return {
    options: indices.map((i) => [
      ...common,
      ...funcs.filter((rf) => rf.vals[0].ActSelectIndex === i),
    ]),
    names: indices.map((i, n) => buttons[n]?.name ?? `Option ${i + 1}`),
  };
}

export function compileSkill(skill: Skill, level: number, owner: number, slot: number): CompiledSkill {
  const { options, names } = skillOptions(skill, level);
  const all = options.flat();
  return {
    owner,
    slot,
    name: skill.name,
    cooldown: clampIndex(skill.coolDown, level) ?? 0,
    options,
    optionNames: names,
    needsTarget: all.some((rf) =>
      ["ptOne", "ptOneOther", "ptOneAnotherRandom"].includes(rf.func.funcTargetType),
    ),
    relevant: all.some((rf) => isRelevantFunc(rf.func)),
  };
}

/** The CE skills in force at this limit break: the highest condLimitCount per slot. */
export function ceSkills(ce: CeLoadout): Skill[] {
  const limit = ce.mlb ? 4 : 0;
  const bySlot = new Map<number, Skill>();
  for (const skill of ce.equip.skills) {
    if (skill.condLimitCount > limit) continue;
    const slot = skill.num ?? 1;
    const current = bySlot.get(slot);
    if (!current || skill.condLimitCount > current.condLimitCount ||
      (skill.condLimitCount === current.condLimitCount && (skill.priority ?? 0) > (current.priority ?? 0))) {
      bySlot.set(slot, skill);
    }
  }
  return [...bySlot.values()];
}

export function ceAtk(ce: CeLoadout): number {
  const { equip } = ce;
  if (ce.level && equip.atkGrowth?.length) {
    return equip.atkGrowth[Math.min(equip.atkGrowth.length, ce.level) - 1];
  }
  return ce.mlb ? equip.atkMax : equip.atkBase;
}

export function servantAtk(spec: UnitSpec): number {
  const growth = spec.servant.atkGrowth;
  const base = growth?.length
    ? growth[Math.max(0, Math.min(growth.length, spec.level) - 1)]
    : spec.servant.atkMax;
  return base + spec.fou;
}

export function compileNp(spec: UnitSpec): CompiledNp | null {
  const np = pickNp(spec);
  if (!np) return null;
  const funcs = np.functions.map((f) => resolveNp(f, spec.npLevel));
  const damageIndex = funcs.findIndex((rf) => rf.func.funcType.startsWith("damageNp"));
  const card = cardName(np.card);
  const target = damageIndex >= 0 ? funcs[damageIndex].func.funcTargetType : "";
  return {
    np,
    card,
    aoe: target === "enemyAll" || target === "enemyFull",
    funcs,
    damageIndex,
    hits: np.npDistribution?.length ? np.npDistribution : [100],
    npRate: clampIndex(np.npGain?.np, spec.npLevel) ?? 0,
    traits: [...new Set([...traitIds(np.individuality), CARD_TRAIT[card], TRAIT_CARD_NP])],
  };
}

export function compileUnit(spec: UnitSpec, index: number, ce?: CeLoadout): Unit {
  const { servant } = spec;
  const skills = pickSkills(servant.skills, spec.skillIds).map((skill) =>
    compileSkill(skill, spec.skillLevels[(skill.num ?? 1) - 1] ?? 10, index, skill.num ?? 1),
  );

  const passives: Unit["passives"] = servant.classPassive.map((skill) => ({
    name: skill.name,
    funcs: skill.functions.map((f) => resolveFlat(f, 1)),
  }));

  const appends = [...(servant.appendPassive ?? [])].sort((a, b) => a.num - b.num);
  appends.forEach((append, i) => {
    const level = spec.appendLevels?.[i + 1] ?? 0;
    if (level > 0) {
      passives.push({
        name: append.skill.name,
        funcs: append.skill.functions.map((f) => resolveFlat(f, level)),
      });
    }
  });

  if (ce) {
    for (const skill of ceSkills(ce)) {
      passives.push({
        name: `${ce.equip.name}`,
        funcs: skill.functions.map((f) => resolveFlat(f, 1)),
      });
    }
  }

  return {
    key: spec.key,
    label: spec.label,
    servantId: servant.id,
    isFriend: spec.isFriend,
    className: servant.className,
    attribute: servant.attribute,
    traits: traitIds(servant.traits),
    atk: servantAtk(spec) + (ce ? ceAtk(ce) : 0),
    np: compileNp(spec),
    skills,
    passives,
    ceName: ce?.equip.name,
    maxGauge: 30000,
  };
}

export function compileMysticCode(mc: McLoadout): CompiledSkill[] {
  return mc.mc.skills
    .slice()
    .sort((a, b) => (a.num ?? 0) - (b.num ?? 0))
    .map((skill, i) => compileSkill(skill, mc.level, -1, i + 1));
}

/** The enemies that are on the field when a wave starts: the first N by deck position. */
export function compileQuest(phase: QuestPhase): Quest {
  const fieldTraits = traitIds(phase.individuality);
  const waves = [...phase.stages]
    .sort((a, b) => a.wave - b.wave)
    .map((stage) => {
      const notes: string[] = [];
      const all = stage.enemies
        .filter((e) => e.deck === "enemy")
        .sort((a, b) => a.deckId - b.deckId);
      const fieldCount = stage.enemyFieldPosCount ?? 3;
      if (all.length > fieldCount) {
        notes.push(
          `${all.length - fieldCount} more enemies arrive as reinforcements; only the first ${fieldCount} are planned for.`,
        );
      }
      const enemies: Enemy[] = all.slice(0, fieldCount).map((e) => {
        if (e.enemyScript?.shift?.length) {
          notes.push(`${e.name} has extra HP bars; only the first bar is planned for.`);
        }
        const className = e.svt.className;
        const passives = [
          ...(e.classPassive?.classPassive ?? []),
          ...(e.classPassive?.addPassive ?? []),
        ].flatMap((skill) => skill.functions.map((f) => resolveFlat(f, 1)));
        return {
          name: e.name,
          className,
          attribute: (e.enemyScript?.changeAttri as string | undefined) ?? e.svt.attribute,
          traits: traitIds(e.traits),
          hp: e.hp,
          tdRate: e.serverMod?.tdRate ?? FALLBACK_TD_RATE[className] ?? 1000,
          passives,
        };
      });
      return { enemies, notes };
    });
  return { id: phase.id, phase: phase.phase, name: phase.name, fieldTraits, waves };
}
