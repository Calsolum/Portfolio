/**
 * Every Smash Up release that brought bases or factions, in the order the
 * Smash Up Wiki lists them (https://smashup.fandom.com/wiki/Bases, read
 * 2026-10-22; wiki content is CC BY-SA). Players tick the ones they own and the
 * pickers offer only what those contain. The TITANS kits are left out: titans
 * join existing factions and bring no bases.
 */

export type SetKind = "main" | "big-box" | "event-kit" | "booster";

export interface GameSet {
  id: string;
  /** As the wiki spells it. */
  name: string;
  kind: SetKind;
}

export const SETS: readonly GameSet[] = [
  { id: "core", name: "Core Set", kind: "main" },
  { id: "awesome-level-9000", name: "Awesome Level 9000", kind: "main" },
  { id: "obligatory-cthulhu", name: "The Obligatory Cthulhu Set", kind: "main" },
  { id: "science-fiction-double-feature", name: "Science Fiction Double Feature", kind: "main" },
  { id: "big-geeky-box", name: "The Big Geeky Box", kind: "big-box" },
  { id: "monster-smash", name: "Monster Smash", kind: "main" },
  { id: "pretty-pretty-smash-up", name: "Pretty Pretty Smash Up", kind: "main" },
  { id: "munchkin", name: "Smash Up: Munchkin", kind: "main" },
  { id: "its-your-fault", name: "It’s Your Fault!", kind: "main" },
  { id: "cease-and-desist", name: "Cease and Desist", kind: "main" },
  { id: "what-were-we-thinking", name: "What Were We Thinking?", kind: "main" },
  { id: "all-stars", name: "All Stars Event Kit", kind: "event-kit" },
  { id: "big-in-japan", name: "Big in Japan", kind: "main" },
  { id: "sheep", name: "Smash Up Sheep Promo", kind: "booster" },
  { id: "that-70s-expansion", name: "That ’70s Expansion", kind: "main" },
  { id: "bigger-geekier-box", name: "The Bigger Geekier Box", kind: "big-box" },
  { id: "oops-you-did-it-again", name: "Oops, You Did It Again", kind: "main" },
  { id: "international-incident", name: "World Tour: International Incident", kind: "main" },
  { id: "penguins", name: "Smash Up Penguins", kind: "booster" },
  { id: "culture-shock", name: "World Tour: Culture Shock", kind: "main" },
  { id: "dead-reckoning", name: "Dead Reckoning Promo", kind: "booster" },
  { id: "marvel", name: "Smash Up: Marvel", kind: "main" },
  { id: "goblins", name: "Smash Up Goblins", kind: "booster" },
  { id: "knights", name: "Smash Up Knights of the Round Table", kind: "booster" },
  { id: "disney", name: "Smash Up: Disney Edition", kind: "main" },
  { id: "10th-anniversary", name: "10th Anniversary", kind: "main" },
  { id: "excellent-movies-dudes", name: "Excellent Movies, Dudes!", kind: "main" },
  { id: "teens", name: "Smash Up Teens", kind: "booster" },
  { id: "half-the-battle", name: "Half the Battle", kind: "main" },
  { id: "slashers", name: "Smash Up Slashers", kind: "booster" },
  { id: "clowns", name: "Smash Up Clowns", kind: "booster" },
];
