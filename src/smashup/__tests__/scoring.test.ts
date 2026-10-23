import { describe, expect, it } from "vitest";

import { breakpointOf, isReady, standings, suggestedAwards, totalPower } from "../lib/scoring";
import {
  FACTORY,
  FOUR_PLAYERS,
  NINJA_DOJO,
  PLAYERS,
  RHODES_PLAZA_MALL,
  THE_HOMEWORLD,
  TORTUGA,
  baseWith,
} from "./fixtures";

/** Each player's place and VP, in player order, as "place:vp" ("-:0" for nothing). */
function placesOf(rows: ReturnType<typeof standings>, players = FOUR_PLAYERS) {
  return players.map((player) => {
    const row = rows.find((r) => r.player === player.id)!;
    return `${row.place ?? "-"}:${row.vp}`;
  });
}

describe("standings", () => {
  it("pays 1st, 2nd and 3rd by power, and nothing in 4th", () => {
    const base = baseWith(THE_HOMEWORLD, {
      p1: { power: 10, minions: 3 },
      p2: { power: 8, minions: 2 },
      p3: { power: 5, minions: 2 },
      p4: { power: 2, minions: 1 },
    });
    expect(placesOf(standings(base, FOUR_PLAYERS))).toEqual(["1:4", "2:2", "3:1", "-:0"]);
  });

  it("gives tied players the best place they tied for and uses up the places they fill", () => {
    // The rulebook's example: 10, 10 and 5 power pays 1st, 1st and 3rd.
    const base = baseWith(THE_HOMEWORLD, {
      p1: { power: 10, minions: 2 },
      p2: { power: 10, minions: 3 },
      p3: { power: 5, minions: 1 },
    });
    expect(placesOf(standings(base, PLAYERS), PLAYERS)).toEqual(["1:4", "1:4", "3:1"]);
  });

  it("leaves nobody in 3rd when two players tie for 2nd", () => {
    const base = baseWith(THE_HOMEWORLD, {
      p1: { power: 10, minions: 2 },
      p2: { power: 8, minions: 2 },
      p3: { power: 8, minions: 2 },
      p4: { power: 5, minions: 1 },
    });
    expect(placesOf(standings(base, FOUR_PLAYERS))).toEqual(["1:4", "2:2", "2:2", "-:0"]);
  });

  it("pays everyone in a three-way tie for 1st, and nothing after", () => {
    const base = baseWith(TORTUGA, {
      p1: { power: 7, minions: 2 },
      p2: { power: 7, minions: 2 },
      p3: { power: 7, minions: 2 },
      p4: { power: 6, minions: 2 },
    });
    expect(placesOf(standings(base, FOUR_PLAYERS))).toEqual(["1:4", "1:4", "1:4", "-:0"]);
  });

  it("needs a minion or at least 1 power to score", () => {
    const base = baseWith(TORTUGA, {
      p1: { power: 6, minions: 2 },
      // A minion with 0 power still counts.
      p2: { power: 0, minions: 1 },
      // No minion and no power: nothing, even with 3rd place free.
      p3: { power: 0, minions: 0 },
      // Power without a minion (a titan, say) counts too.
      p4: { power: 1, minions: 0 },
    });
    const rows = standings(base, FOUR_PLAYERS);
    expect(placesOf(rows)).toEqual(["1:4", "3:2", "-:0", "2:3"]);
    expect(rows.find((row) => row.player === "p3")?.eligible).toBe(false);
    expect(rows.map((row) => row.player)).toEqual(["p1", "p4", "p2", "p3"]);
  });

  it("counts power this turn, without taking a player below 0", () => {
    const base = baseWith(TORTUGA, {
      p1: { power: 3, temp: 2, minions: 1 },
      p2: { power: 3, temp: -5, minions: 1 },
      p3: { power: 4, minions: 1 },
    });
    const rows = standings(base, PLAYERS);
    expect(rows.map((row) => [row.player, row.power])).toEqual([
      ["p1", 5],
      ["p3", 4],
      ["p2", 0],
    ]);
    expect(totalPower(base)).toBe(9);
  });

  it("follows the base's own numbers, even when 2nd pays more than 1st", () => {
    const base = baseWith(NINJA_DOJO, { p1: { power: 9, minions: 2 }, p2: { power: 9, minions: 3 }, p3: { power: 2, minions: 1 } });
    expect(placesOf(standings(base, PLAYERS), PLAYERS)).toEqual(["1:2", "1:2", "3:2"]);
  });

  it("adds 1 VP per minion on a vp-per-minion base", () => {
    const base = baseWith(RHODES_PLAZA_MALL, {
      p1: { power: 12, minions: 3 },
      p2: { power: 4, minions: 1 },
      p3: { power: 0, minions: 0 },
    });
    const rows = standings(base, PLAYERS);
    expect(rows.map((row) => [row.player, row.vp, row.bonus])).toEqual([
      ["p1", 0, 3],
      ["p2", 0, 1],
      ["p3", 0, 0],
    ]);
    expect(suggestedAwards(rows)).toEqual([
      { player: "p1", vp: 3 },
      { player: "p2", vp: 1 },
    ]);
  });

  it("gives each winner 1 VP per 5 power on a winner-vp-per-5-power base", () => {
    const alone = standings(baseWith(FACTORY, { p1: { power: 13, minions: 3 }, p2: { power: 9, minions: 2 } }), PLAYERS);
    expect(suggestedAwards(alone)).toEqual([
      { player: "p1", vp: 4 },
      { player: "p2", vp: 2 },
    ]);

    const tied = standings(baseWith(FACTORY, { p1: { power: 10, minions: 3 }, p2: { power: 10, minions: 2 } }), PLAYERS);
    expect(tied.map((row) => row.bonus)).toEqual([2, 2, 0]);
  });

  it("gives each winner 1 VP per player with no power here (Tournament Site)", () => {
    const base = baseWith(
      { name: "Tournament Site", breakpoint: 19, vps: [2, 0, 0], bonus: "winner-vp-per-powerless-player" },
      { p1: { power: 8, minions: 2 }, p2: { power: 0, minions: 1 }, p4: { power: 3, minions: 1 } },
    );
    expect(suggestedAwards(standings(base, FOUR_PLAYERS))).toEqual([{ player: "p1", vp: 4 }]);
  });

  it("gives everyone but the winner 1 VP per minion (Symkaria)", () => {
    const base = baseWith(
      { name: "Symkaria", breakpoint: 21, vps: [4, 0, 0], bonus: "others-vp-per-minion" },
      { p1: { power: 10, minions: 2 }, p2: { power: 6, minions: 3 }, p3: { power: 0, minions: 1 } },
    );
    expect(suggestedAwards(standings(base, PLAYERS))).toEqual([
      { player: "p1", vp: 4 },
      { player: "p2", vp: 3 },
      { player: "p3", vp: 1 },
    ]);
  });

  it("gives the winner 1 more VP only when the total equals the breakpoint (Deepreef Crag)", () => {
    const crag = { name: "Deepreef Crag", breakpoint: 18, vps: [3, 1, 1] as const, bonus: "winner-vp-at-exact-breakpoint" as const };
    const exact = baseWith(crag, { p1: { power: 11, minions: 2 }, p2: { power: 7, minions: 2 } });
    expect(suggestedAwards(standings(exact, PLAYERS))).toEqual([
      { player: "p1", vp: 4 },
      { player: "p2", vp: 1 },
    ]);
    const over = baseWith(crag, { p1: { power: 12, minions: 2 }, p2: { power: 7, minions: 2 } });
    expect(standings(over, PLAYERS)[0].bonus).toBe(0);
    // A changed breakpoint counts.
    const lowered = baseWith(crag, { p1: { power: 10, minions: 2 }, p2: { power: 6, minions: 2 } }, -2);
    expect(standings(lowered, PLAYERS)[0].bonus).toBe(1);
  });

  it("gives the top three 1 more VP when the total reaches 22 (Garrison)", () => {
    const garrison = { name: "Garrison", breakpoint: 12, vps: [3, 2, 1] as const, bonus: "top-three-vp-at-22-power" as const };
    const counts = { p1: { power: 8, minions: 2 }, p2: { power: 7, minions: 2 }, p3: { power: 5, minions: 1 }, p4: { power: 2, minions: 1 } };
    expect(standings(baseWith(garrison, counts), FOUR_PLAYERS).map((row) => row.bonus)).toEqual([1, 1, 1, 0]);
    const short = { ...counts, p4: { power: 1, minions: 1 } };
    expect(standings(baseWith(garrison, short), FOUR_PLAYERS).map((row) => row.bonus)).toEqual([0, 0, 0, 0]);
  });

  it("gives 1 more VP to each player with exactly one minion (Building Rooftop)", () => {
    const base = baseWith(
      { name: "Building Rooftop", breakpoint: 20, vps: [3, 1, 1], bonus: "vp-for-one-minion" },
      { p1: { power: 9, minions: 1 }, p2: { power: 8, minions: 2 }, p3: { power: 0, minions: 1 } },
    );
    expect(standings(base, PLAYERS).map((row) => [row.player, row.vp, row.bonus])).toEqual([
      ["p1", 3, 1],
      ["p2", 1, 0],
      ["p3", 1, 1],
    ]);
  });

  it("suggests nothing for players whose total is 0", () => {
    const rows = standings(baseWith(NINJA_DOJO, { p1: { power: 5, minions: 1 } }), PLAYERS);
    expect(suggestedAwards(rows)).toEqual([{ player: "p1", vp: 2 }]);
  });
});

describe("breakpoints", () => {
  it("is ready when the total power reaches the breakpoint, changes included", () => {
    const base = baseWith(TORTUGA, { p1: { power: 12 }, p2: { power: 7, temp: 1 } });
    expect(totalPower(base)).toBe(20);
    expect(isReady(base)).toBe(false);
    expect(isReady(baseWith(TORTUGA, { p1: { power: 21 } }))).toBe(true);
    const lowered = baseWith(TORTUGA, { p1: { power: 12 }, p2: { power: 7, temp: 1 } }, -1);
    expect(breakpointOf(lowered)).toBe(20);
    expect(isReady(lowered)).toBe(true);
  });

  it("never drops a breakpoint below 0", () => {
    expect(breakpointOf(baseWith(TORTUGA, {}, -40))).toBe(0);
  });
});
