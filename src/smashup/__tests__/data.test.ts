import { describe, expect, it } from "vitest";

import { BASES } from "../data/bases";
import { FACTIONS } from "../data/factions";
import { SETS } from "../data/sets";
import { BASE_BY_ID, FACTION_BY_ID, ownedIn, searchBases, searchKey, snapshotOf } from "../lib/catalog";

/**
 * Bases and factions per set, from the Smash Up Wiki (each faction brings two
 * bases; Polynesian Voyagers bring three; the Dead Reckoning promo is a single
 * base). The two first-printing entries add one each to their sets. A lost or
 * doubled entry fails here.
 */
const EXPECTED: Record<string, { bases: number; factions: number }> = {
  core: { bases: 16, factions: 8 },
  "awesome-level-9000": { bases: 8, factions: 4 },
  "obligatory-cthulhu": { bases: 8, factions: 4 },
  "science-fiction-double-feature": { bases: 9, factions: 4 },
  "big-geeky-box": { bases: 2, factions: 1 },
  "monster-smash": { bases: 9, factions: 4 },
  "pretty-pretty-smash-up": { bases: 8, factions: 4 },
  munchkin: { bases: 16, factions: 8 },
  "its-your-fault": { bases: 10, factions: 5 },
  "cease-and-desist": { bases: 8, factions: 4 },
  "what-were-we-thinking": { bases: 8, factions: 4 },
  "all-stars": { bases: 2, factions: 1 },
  "big-in-japan": { bases: 8, factions: 4 },
  sheep: { bases: 2, factions: 1 },
  "that-70s-expansion": { bases: 8, factions: 4 },
  "bigger-geekier-box": { bases: 0, factions: 0 },
  "oops-you-did-it-again": { bases: 8, factions: 4 },
  "international-incident": { bases: 8, factions: 4 },
  penguins: { bases: 2, factions: 1 },
  "culture-shock": { bases: 11, factions: 5 },
  "dead-reckoning": { bases: 1, factions: 0 },
  marvel: { bases: 16, factions: 8 },
  goblins: { bases: 2, factions: 1 },
  knights: { bases: 2, factions: 1 },
  disney: { bases: 16, factions: 8 },
  "10th-anniversary": { bases: 6, factions: 3 },
  "excellent-movies-dudes": { bases: 8, factions: 4 },
  teens: { bases: 2, factions: 1 },
  "half-the-battle": { bases: 8, factions: 4 },
  slashers: { bases: 2, factions: 1 },
  clowns: { bases: 2, factions: 1 },
};

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const setIds = new Set(SETS.map((set) => set.id));

describe("base, faction and set lists", () => {
  it("give everything a unique kebab-case id", () => {
    for (const list of [SETS, BASES, FACTIONS]) {
      const ids = list.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(SLUG);
    }
  });

  it("put every base and faction in known sets", () => {
    for (const item of [...BASES, ...FACTIONS]) {
      expect(setIds.has(item.set), item.id).toBe(true);
      for (const other of item.alsoIn ?? []) {
        expect(setIds.has(other), item.id).toBe(true);
        expect(other, item.id).not.toBe(item.set);
      }
    }
  });

  it("have the expected number of bases and factions in each set", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual([...setIds].sort());
    for (const set of SETS) {
      expect(BASES.filter((base) => base.set === set.id).length, set.name).toBe(EXPECTED[set.id].bases);
      expect(FACTIONS.filter((faction) => faction.set === set.id).length, set.name).toBe(EXPECTED[set.id].factions);
    }
    expect(BASES).toHaveLength(216);
    expect(FACTIONS).toHaveLength(106);
  });

  it("offer something for every set a player can tick", () => {
    for (const set of SETS) {
      const owned = new Set([set.id]);
      expect([...BASES, ...FACTIONS].some((item) => ownedIn(item, owned)), set.name).toBe(true);
    }
  });

  it("keep breakpoints and VP within sensible numbers", () => {
    for (const base of BASES) {
      expect(Number.isInteger(base.breakpoint) && base.breakpoint >= 1 && base.breakpoint <= 40, base.id).toBe(true);
      expect(base.vps, base.id).toHaveLength(3);
      for (const vp of base.vps) expect(Number.isInteger(vp) && vp >= 0 && vp <= 9, base.id).toBe(true);
      if (base.monsters !== undefined) {
        expect(base.set, base.id).toBe("munchkin");
        expect(base.monsters >= 1 && base.monsters <= 3, base.id).toBe(true);
      }
    }
    expect(BASES.filter((base) => base.set === "munchkin").every((base) => base.monsters)).toBe(true);
  });

  it("have tidy names, unique within each set", () => {
    for (const item of [...SETS, ...BASES, ...FACTIONS]) {
      expect(item.name, item.id).toBe(item.name.trim());
      expect(item.name, item.id).not.toMatch(/\s{2,}|\[|\]|''/);
    }
    for (const set of SETS) {
      const names = BASES.filter((base) => base.set === set.id).map((base) => base.name);
      expect(new Set(names).size, set.name).toBe(names.length);
    }
  });

  it("ties each base to a faction from the same release, two bases each", () => {
    const perFaction = new Map<string, number>();
    for (const base of BASES) {
      if (!base.faction) {
        // Only the Dead Reckoning promo base came without a faction.
        expect(base.id).toBe("deepreef-crag");
        continue;
      }
      const faction = FACTION_BY_ID.get(base.faction);
      expect(faction, base.id).toBeDefined();
      expect(faction?.set, base.id).toBe(base.set);
      expect(faction?.alsoIn ?? [], base.id).toEqual(base.alsoIn ?? []);
      perFaction.set(base.faction, (perFaction.get(base.faction) ?? 0) + 1);
    }
    const unusual = Object.fromEntries([...perFaction].filter(([, count]) => count !== 2));
    // Polynesian Voyagers bring three; the other two have a first printing listed as well.
    expect(unusual).toEqual({ "time-travelers": 3, "mad-scientists": 3, "polynesian-voyagers": 3 });
    expect(FACTIONS.every((faction) => perFaction.has(faction.id))).toBe(true);
  });

  it("matches the printed cards it was spot-checked against", () => {
    const numbers = (id: string) => {
      const base = BASE_BY_ID.get(id);
      return base ? [base.breakpoint, ...base.vps] : undefined;
    };
    expect(numbers("the-homeworld")).toEqual([23, 4, 2, 1]);
    expect(numbers("jungle-oasis")).toEqual([12, 2, 0, 0]);
    expect(numbers("ninja-dojo")).toEqual([18, 2, 3, 2]);
    expect(numbers("rhodes-plaza-mall")).toEqual([24, 0, 0, 0]);
    expect(numbers("the-nexus")).toEqual([19, 4, 3, 2]);
    expect(numbers("the-nexus-first-printing")).toEqual([19, 3, 3, 2]);
    expect(numbers("golem-schloss-first-printing")).toEqual([22, 3, 3, 2]);
    expect(numbers("cuzcu")).toEqual([30, 5, 3, 2]);
    expect(BASE_BY_ID.get("rhodes-plaza-mall")?.bonus).toBe("vp-per-minion");
    expect(BASE_BY_ID.get("garrison")).toMatchObject({ monsters: 2, bonus: "top-three-vp-at-22-power" });
    expect(BASE_BY_ID.get("sheep-shrine")).toMatchObject({ set: "sheep", alsoIn: ["10th-anniversary"] });
  });
});

describe("catalog", () => {
  it("offers a reprinted base to owners of either release", () => {
    const stadium = BASE_BY_ID.get("stadium")!;
    expect(ownedIn(stadium, new Set(["all-stars"]))).toBe(true);
    expect(ownedIn(stadium, new Set(["bigger-geekier-box"]))).toBe(true);
    expect(ownedIn(stadium, new Set(["core"]))).toBe(false);
  });

  it("searches names without minding case, accents or apostrophes", () => {
    const all = new Set(SETS.map((set) => set.id));
    expect(searchKey("Tsar’s Palace")).toBe("tsars palace");
    expect(searchBases("golem schloss", all).map((base) => base.id)).toEqual([
      "golem-schloss",
      "golem-schloss-first-printing",
    ]);
    expect(searchBases("tsars", all).map((base) => base.id)).toEqual(["tsars-palace"]);
    expect(searchBases("SHIELD", all).map((base) => base.id)).toEqual(["shield-base"]);
    // Names that start with the query come first.
    expect(searchBases("the", new Set(["core"]))[0].name.startsWith("The")).toBe(true);
    expect(searchBases("tortuga", new Set(["marvel"]))).toEqual([]);
  });

  it("copies a base's numbers into a snapshot for the game log", () => {
    expect(snapshotOf(BASE_BY_ID.get("factory-436-1337")!)).toEqual({
      card: "factory-436-1337",
      name: "Factory 436-1337",
      breakpoint: 25,
      vps: [2, 2, 1],
      bonus: "winner-vp-per-5-power",
    });
    expect(snapshotOf(BASE_BY_ID.get("tortuga")!)).not.toHaveProperty("bonus");
  });
});
