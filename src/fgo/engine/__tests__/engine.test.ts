import { describe, expect, it } from "vitest";

import { type Battle, endTurn, fireNp, initialState, startWave, castSkill } from "../battle";
import { compileQuest, compileUnit } from "../compile";
import type { UnitSpec } from "../model";
import { optimize } from "../optimize";
import { FALLBACK_TABLES } from "../tables";
import {
  buff,
  enemy,
  equip,
  gainNp,
  np,
  questPhase,
  servant,
  skill,
  stateFunc,
} from "./fixtures";

const spec = (key: string, s: ReturnType<typeof servant>, extra: Partial<UnitSpec> = {}): UnitSpec => ({
  key,
  label: s.name,
  servant: s,
  isFriend: key.startsWith("friend:"),
  level: 90,
  fou: 0,
  npLevel: 1,
  skillLevels: [10, 10, 10],
  ...extra,
});

function battleFor(units: UnitSpec[], waves: ReturnType<typeof enemy>[][]): Battle {
  return {
    units: units.map((u, i) => compileUnit(u, i)),
    mc: [],
    quest: compileQuest(questPhase(waves)),
    tables: FALLBACK_TABLES,
    ignored: new Set(),
  };
}

describe("NP damage", () => {
  it("matches the formula at the minimum roll with no buffs", () => {
    const saber = servant({
      name: "Saber",
      className: "saber",
      atk: 10000,
      np: np({ card: "buster", multiplier: 3000 }),
    });
    const b = battleFor([spec("own:1", saber)], [[enemy("Lancer", "lancer", 1_000_000)]]);
    const state = initialState(b);
    startWave(b, state, b.quest.waves[0]);
    state.units[0].gauge = 10000;
    const res = fireNp(b, state, 0)!;
    // 10000 × 0.23 × 3.0 × 1.5 (buster) × 2.0 (saber→lancer) × 0.9
    expect(res.hits[0].damage).toBe(Math.floor(10000 * 0.23 * 3 * 1.5 * 2 * 0.9));
  });

  it("applies attack, card, NP damage and defence-down modifiers", () => {
    const saber = servant({
      name: "Saber",
      className: "saber",
      atk: 10000,
      np: np({ card: "buster", multiplier: 3000 }),
      skills: [
        skill("Charisma", 1, 5, [stateFunc("self", buff("upAtk"), 200)]),
        skill("Mana Burst", 2, 5, [stateFunc("self", buff("upCommandall", { ckSelf: ["cardBuster"] }), 500)]),
        skill("Crest", 3, 5, [
          stateFunc("self", buff("upNpdamage"), 300),
          stateFunc("enemyAll", buff("downDefence"), 200),
        ]),
      ],
    });
    const b = battleFor([spec("own:1", saber)], [[enemy("Lancer", "lancer", 1_000_000)]]);
    const state = initialState(b);
    startWave(b, state, b.quest.waves[0]);
    for (const s of b.units[0].skills) castSkill(b, state, s, 0, null);
    state.units[0].gauge = 10000;
    const res = fireNp(b, state, 0)!;
    const expected = Math.floor(
      10000 * 0.23 * 3 * 1.5 * (1 + 0.5) * 2 * 0.9 * (1 + 0.2 + 0.2) * (1 + 0.3),
    );
    expect(res.hits[0].damage).toBe(expected);
  });

  it("ignores card buffs for the wrong card type", () => {
    const archer = servant({
      name: "Archer",
      className: "archer",
      atk: 10000,
      np: np({ card: "arts", multiplier: 4500 }),
      skills: [skill("Buster up", 1, 5, [stateFunc("self", buff("upCommandall", { ckSelf: ["cardBuster"] }), 500)])],
    });
    const b = battleFor([spec("own:1", archer)], [[enemy("Saber", "saber", 1_000_000)]]);
    const state = initialState(b);
    startWave(b, state, b.quest.waves[0]);
    castSkill(b, state, b.units[0].skills[0], 0, null);
    state.units[0].gauge = 10000;
    const res = fireNp(b, state, 0)!;
    expect(res.hits[0].damage).toBe(Math.floor(10000 * 0.23 * 4.5 * 1 * 0.95 * 2 * 0.9));
  });
});

describe("NP refund", () => {
  const caster = () =>
    servant({
      name: "Caster",
      className: "caster",
      atk: 10000,
      np: np({ card: "arts", multiplier: 4500, hits: [33, 33, 34], npRate: 87 }),
    });

  it("gains per hit per enemy", () => {
    const b = battleFor([spec("own:1", caster())], [[enemy("Big", "saber", 10_000_000)]]);
    const state = initialState(b);
    startWave(b, state, b.quest.waves[0]);
    state.units[0].gauge = 10000;
    const res = fireNp(b, state, 0)!;
    expect(res.refund).toBe(3 * 261);
    expect(state.units[0].gauge).toBe(783);
  });

  it("adds the overkill bonus to hits after the enemy dies", () => {
    const b = battleFor([spec("own:1", caster())], [[enemy("Tiny", "saber", 10)]]);
    const state = initialState(b);
    startWave(b, state, b.quest.waves[0]);
    state.units[0].gauge = 10000;
    const res = fireNp(b, state, 0)!;
    expect(res.refund).toBe(261 + 391 + 391);
  });

  it("keeps the part of the gauge above whole bars and overcharges from full bars", () => {
    const b = battleFor([spec("own:1", caster())], [[enemy("Big", "saber", 10_000_000)]]);
    const state = initialState(b);
    startWave(b, state, b.quest.waves[0]);
    state.units[0].gauge = 25000;
    const res = fireNp(b, state, 0)!;
    expect(res.oc).toBe(2);
    expect(state.units[0].gauge).toBe(5000 + 783);
  });
});

describe("turn flow", () => {
  it("counts down buffs and cooldowns", () => {
    const s = servant({
      name: "Buffer",
      className: "caster",
      atk: 8000,
      skills: [skill("Arts up", 1, 5, [stateFunc("self", buff("upAtk"), 200, 2)])],
    });
    const b = battleFor([spec("own:1", s)], [[enemy("A", "saber", 1)]]);
    const state = initialState(b);
    castSkill(b, state, b.units[0].skills[0], 0, null);
    expect(state.units[0].cd[0]).toBe(5);
    endTurn(b, state);
    expect(state.units[0].buffs).toHaveLength(1);
    expect(state.units[0].cd[0]).toBe(4);
    endTurn(b, state);
    expect(state.units[0].buffs).toHaveLength(0);
  });

  it("applies CE starting charge and passives at battle start", () => {
    const s = servant({
      name: "Nuker",
      className: "saber",
      atk: 10000,
      np: np({ card: "buster", multiplier: 3000 }),
      passives: [skill("Riding", 0, 0, [stateFunc("self", buff("upAtk"), 100, -1)])],
    });
    const ce = equip("Kaleidoscope", { atk: 500, funcs: [gainNp("self", 8000)] });
    const unit = compileUnit(spec("own:1", s), 0, { equip: ce, mlb: false });
    expect(unit.atk).toBe(10500);
    const b: Battle = {
      units: [unit],
      mc: [],
      quest: compileQuest(questPhase([[enemy("A", "saber", 1)]])),
      tables: FALLBACK_TABLES,
      ignored: new Set(),
    };
    const state = initialState(b);
    expect(state.units[0].gauge).toBe(8000);
    expect(state.units[0].buffs.map((x) => x.type)).toEqual(["upAtk"]);
  });
});

describe("optimize", () => {
  const looper = () =>
    servant({
      name: "Looper",
      className: "caster",
      atk: 11000,
      np: np({ card: "arts", multiplier: 4500, hits: [10, 20, 30, 40], npRate: 110 }),
      skills: [skill("Self charge", 1, 5, [gainNp("self", 2000)])],
    });
  const battery = (name: string) =>
    servant({
      name,
      className: "caster",
      atk: 7000,
      skills: [
        skill("Battery", 1, 6, [gainNp("ptOne", 5000)]),
        skill("Arts up", 2, 6, [stateFunc("ptAll", buff("upCommandall", { ckSelf: ["cardArts"] }), 300)]),
      ],
    });
  const kaleido = equip("Kaleidoscope", { funcs: [gainNp("self", 10000)] });

  const waves = (hp: number) => [
    [enemy("A1", "assassin", hp), enemy("A2", "assassin", hp), enemy("A3", "assassin", hp)],
    [enemy("B1", "assassin", hp), enemy("B2", "assassin", hp), enemy("B3", "assassin", hp)],
    [enemy("C1", "assassin", hp), enemy("C2", "assassin", hp), enemy("C3", "assassin", hp)],
  ];

  it("finds the fewest-tap three-turn clear", () => {
    const quest = compileQuest(questPhase(waves(1000)));
    const result = optimize({
      roster: [spec("own:1", looper()), spec("own:2", battery("Support A"))],
      friends: [spec("friend:1", battery("Support B"))],
      ces: [{ equip: kaleido, mlb: true, count: 1 }],
      mysticCodes: [],
      quest,
      tables: FALLBACK_TABLES,
    });
    expect(result.plans.length).toBeGreaterThan(0);
    const best = result.plans[0];
    expect(best.turns).toHaveLength(3);
    expect(best.turns.every((t) => t.attacker === "Looper")).toBe(true);
    expect(best.team.find((m) => m.key === "own:1")?.ce).toBe("Kaleidoscope");
    // T1 fires off the CE; overkill refund (54.45%) leaves the looper one battery short on T2 and T3.
    expect(best.taps).toBe(2);
    expect(best.minRatio).toBeGreaterThanOrEqual(1);
  });

  it("reports why nothing clears when the enemies are too tough", () => {
    const quest = compileQuest(questPhase(waves(5_000_000)));
    const result = optimize({
      roster: [spec("own:1", looper()), spec("own:2", battery("Support A"))],
      friends: [],
      ces: [{ equip: kaleido, mlb: true, count: 1 }],
      mysticCodes: [],
      quest,
      tables: FALLBACK_TABLES,
    });
    expect(result.plans).toHaveLength(0);
    expect(result.nearMisses.length).toBeGreaterThan(0);
    expect(result.nearMisses[0].reason).toMatch(/HP/);
  });
});
