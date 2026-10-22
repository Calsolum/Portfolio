import type { BaseBonus, Vps } from "../types";

/**
 * Every Smash Up base, from the Smash Up Wiki's list of bases
 * (https://smashup.fandom.com/wiki/Bases, read 2026-10-22; wiki content is
 * CC BY-SA). Names and numbers only: the ability text is AEG's and stays on the
 * cards.
 *
 * - `set` is the release that first had the base; `alsoIn` lists the later boxes
 *   that reprint it, so owning either one offers it.
 * - Where errata changed only the wording there is one entry. The Nexus and
 *   Golem Schloß were reprinted as 4/3/2 instead of 3/3/2, so their first
 *   printings have entries of their own: pick the one that matches the card.
 * - `monsters` is how many monsters a Smash Up: Munchkin base starts with; their
 *   power adds to the breakpoint.
 * - `bonus` marks the few bases whose extra VP the tracker can work out from
 *   power and minion counts (see lib/scoring.ts).
 */

export interface BaseCard {
  id: string;
  name: string;
  /** A GameSet id. */
  set: string;
  alsoIn?: readonly string[];
  /** A Faction id: the faction the wiki lists the base under. */
  faction?: string;
  breakpoint: number;
  vps: Vps;
  monsters?: number;
  bonus?: BaseBonus;
}

export const BASES: readonly BaseCard[] = [
  // Core Set
  { id: "the-homeworld", name: "The Homeworld", set: "core", faction: "aliens", breakpoint: 23, vps: [4, 2, 1] },
  { id: "the-mothership", name: "The Mothership", set: "core", faction: "aliens", breakpoint: 20, vps: [4, 2, 1] },
  { id: "jungle-oasis", name: "Jungle Oasis", set: "core", faction: "dinosaurs", breakpoint: 12, vps: [2, 0, 0] },
  { id: "tar-pits", name: "Tar Pits", set: "core", faction: "dinosaurs", breakpoint: 16, vps: [4, 3, 2] },
  { id: "ninja-dojo", name: "Ninja Dojo", set: "core", faction: "ninjas", breakpoint: 18, vps: [2, 3, 2] },
  { id: "temple-of-goju", name: "Temple of Goju", set: "core", faction: "ninjas", breakpoint: 18, vps: [2, 3, 2] },
  { id: "the-grey-opal", name: "The Grey Opal", set: "core", faction: "pirates", breakpoint: 17, vps: [3, 1, 1] },
  { id: "tortuga", name: "Tortuga", set: "core", faction: "pirates", breakpoint: 21, vps: [4, 3, 2] },
  { id: "factory-436-1337", name: "Factory 436-1337", set: "core", faction: "robots", breakpoint: 25, vps: [2, 2, 1], bonus: "winner-vp-per-5-power" },
  { id: "the-central-brain", name: "The Central Brain", set: "core", faction: "robots", breakpoint: 19, vps: [4, 2, 1] },
  { id: "cave-of-shinies", name: "Cave of Shinies", set: "core", faction: "tricksters", breakpoint: 23, vps: [4, 2, 1] },
  { id: "mushroom-kingdom", name: "Mushroom Kingdom", set: "core", faction: "tricksters", breakpoint: 20, vps: [5, 3, 2] },
  { id: "school-of-wizardry", name: "School of Wizardry", set: "core", faction: "wizards", breakpoint: 20, vps: [3, 2, 1] },
  { id: "the-great-library", name: "The Great Library", set: "core", faction: "wizards", breakpoint: 22, vps: [4, 2, 1] },
  { id: "evans-city-cemetery", name: "Evans City Cemetery", set: "core", faction: "zombies", breakpoint: 20, vps: [5, 3, 2] },
  { id: "rhodes-plaza-mall", name: "Rhodes Plaza Mall", set: "core", faction: "zombies", breakpoint: 24, vps: [0, 0, 0], bonus: "vp-per-minion" },

  // Awesome Level 9000
  { id: "field-of-honor", name: "Field of Honor", set: "awesome-level-9000", faction: "bear-cavalry", breakpoint: 18, vps: [3, 2, 1] },
  { id: "tsars-palace", name: "Tsar’s Palace", set: "awesome-level-9000", faction: "bear-cavalry", breakpoint: 22, vps: [5, 3, 2] },
  { id: "haunted-house", name: "Haunted House", set: "awesome-level-9000", faction: "ghosts", breakpoint: 18, vps: [4, 3, 2] },
  { id: "the-dread-gazebo", name: "The Dread Gazebo", set: "awesome-level-9000", faction: "ghosts", breakpoint: 20, vps: [4, 2, 1] },
  { id: "secret-grove", name: "Secret Grove", set: "awesome-level-9000", faction: "killer-plants", breakpoint: 21, vps: [3, 2, 1] },
  { id: "the-greenhouse", name: "The Greenhouse", set: "awesome-level-9000", faction: "killer-plants", breakpoint: 24, vps: [4, 2, 1] },
  { id: "inventors-salon", name: "Inventor’s Salon", set: "awesome-level-9000", faction: "steampunks", breakpoint: 22, vps: [4, 2, 1] },
  { id: "workshop", name: "Workshop", set: "awesome-level-9000", faction: "steampunks", breakpoint: 20, vps: [4, 2, 1] },

  // The Obligatory Cthulhu Set
  { id: "antarctic-base", name: "Antarctic Base", set: "obligatory-cthulhu", faction: "elder-things", breakpoint: 24, vps: [5, 3, 2] },
  { id: "plateau-of-leng", name: "Plateau of Leng", set: "obligatory-cthulhu", faction: "elder-things", breakpoint: 18, vps: [3, 2, 1] },
  { id: "innsmouth", name: "Innsmouth", set: "obligatory-cthulhu", faction: "innsmouth", breakpoint: 23, vps: [5, 3, 2] },
  { id: "ritual-site", name: "Ritual Site", set: "obligatory-cthulhu", faction: "innsmouth", breakpoint: 20, vps: [4, 2, 2] },
  { id: "mountains-of-madness", name: "Mountains of Madness", set: "obligatory-cthulhu", faction: "minions-of-cthulhu", breakpoint: 20, vps: [6, 4, 3] },
  { id: "rlyeh", name: "R’lyeh", set: "obligatory-cthulhu", faction: "minions-of-cthulhu", breakpoint: 18, vps: [4, 2, 1] },
  { id: "asylum", name: "Asylum", set: "obligatory-cthulhu", faction: "miskatonic-university", breakpoint: 16, vps: [3, 1, 1] },
  { id: "miskatonic-university", name: "Miskatonic University", set: "obligatory-cthulhu", faction: "miskatonic-university", breakpoint: 24, vps: [3, 3, 2] },

  // Science Fiction Double Feature
  { id: "monkey-lab", name: "Monkey Lab", set: "science-fiction-double-feature", faction: "cyborg-apes", breakpoint: 23, vps: [4, 2, 1] },
  { id: "primate-park", name: "Primate Park", set: "science-fiction-double-feature", faction: "cyborg-apes", breakpoint: 20, vps: [3, 2, 1] },
  { id: "faceless-city", name: "Faceless City", set: "science-fiction-double-feature", faction: "shapeshifters", breakpoint: 20, vps: [4, 2, 1] },
  { id: "the-vats", name: "The Vats", set: "science-fiction-double-feature", faction: "shapeshifters", breakpoint: 15, vps: [3, 1, 1] },
  { id: "isis-swingin-pad", name: "ISI’s Swingin’ Pad", set: "science-fiction-double-feature", faction: "super-spies", breakpoint: 21, vps: [4, 2, 1] },
  { id: "secret-volcano-headquarters", name: "Secret Volcano Headquarters", set: "science-fiction-double-feature", faction: "super-spies", breakpoint: 18, vps: [4, 3, 2] },
  { id: "portal-room", name: "Portal Room", set: "science-fiction-double-feature", faction: "time-travelers", breakpoint: 22, vps: [2, 3, 1] },
  { id: "the-nexus", name: "The Nexus", set: "science-fiction-double-feature", faction: "time-travelers", breakpoint: 19, vps: [4, 3, 2] },
  { id: "the-nexus-first-printing", name: "The Nexus (first printing)", set: "science-fiction-double-feature", faction: "time-travelers", breakpoint: 19, vps: [3, 3, 2] },

  // The Big Geeky Box
  { id: "tabletop", name: "TableTop", set: "big-geeky-box", alsoIn: ["bigger-geekier-box"], faction: "geeks", breakpoint: 20, vps: [4, 2, 1] },
  { id: "the-con", name: "The Con", set: "big-geeky-box", alsoIn: ["bigger-geekier-box"], faction: "geeks", breakpoint: 24, vps: [5, 3, 2] },

  // Monster Smash
  { id: "egg-chamber", name: "Egg Chamber", set: "monster-smash", faction: "giant-ants", breakpoint: 17, vps: [3, 1, 1] },
  { id: "the-hill", name: "The Hill", set: "monster-smash", faction: "giant-ants", breakpoint: 23, vps: [4, 2, 1] },
  { id: "golem-schloss", name: "Golem Schloß", set: "monster-smash", faction: "mad-scientists", breakpoint: 22, vps: [4, 3, 2] },
  { id: "golem-schloss-first-printing", name: "Golem Schloß (first printing)", set: "monster-smash", faction: "mad-scientists", breakpoint: 22, vps: [3, 3, 2] },
  { id: "laboratorium", name: "Laboratorium", set: "monster-smash", faction: "mad-scientists", breakpoint: 25, vps: [5, 3, 3] },
  { id: "castle-blood", name: "Castle Blood", set: "monster-smash", faction: "vampires", breakpoint: 18, vps: [3, 1, 1] },
  { id: "crypt", name: "Crypt", set: "monster-smash", faction: "vampires", breakpoint: 20, vps: [4, 2, 2] },
  { id: "moot-site", name: "Moot Site", set: "monster-smash", faction: "werewolves", breakpoint: 15, vps: [2, 1, 0] },
  { id: "standing-stones", name: "Standing Stones", set: "monster-smash", faction: "werewolves", breakpoint: 20, vps: [4, 2, 1] },

  // Pretty Pretty Smash Up
  { id: "enchanted-glen", name: "Enchanted Glen", set: "pretty-pretty-smash-up", faction: "fairies", breakpoint: 20, vps: [4, 2, 1] },
  { id: "fairy-circle", name: "Fairy Circle", set: "pretty-pretty-smash-up", faction: "fairies", breakpoint: 26, vps: [4, 3, 2] },
  { id: "cool-cats-alley", name: "Cool Cats’ Alley", set: "pretty-pretty-smash-up", faction: "kitty-cats", breakpoint: 18, vps: [3, 2, 1] },
  { id: "the-house-of-nine-lives", name: "The House of Nine Lives", set: "pretty-pretty-smash-up", faction: "kitty-cats", breakpoint: 20, vps: [4, 2, 1] },
  { id: "equaria", name: "Equaria", set: "pretty-pretty-smash-up", faction: "mythic-horses", breakpoint: 25, vps: [5, 3, 2] },
  { id: "pony-land", name: "Pony Land", set: "pretty-pretty-smash-up", faction: "mythic-horses", breakpoint: 18, vps: [3, 2, 1] },
  { id: "beautiful-castle", name: "Beautiful Castle", set: "pretty-pretty-smash-up", faction: "princesses", breakpoint: 22, vps: [4, 2, 1] },
  { id: "ice-castle", name: "Ice Castle", set: "pretty-pretty-smash-up", faction: "princesses", breakpoint: 15, vps: [3, 2, 2] },

  // Smash Up: Munchkin
  { id: "hotel-of-holiness", name: "Hotel of Holiness", set: "munchkin", faction: "clerics", breakpoint: 15, vps: [4, 3, 2], monsters: 2 },
  { id: "whack-a-ghoul", name: "Whack-A-Ghoul", set: "munchkin", faction: "clerics", breakpoint: 12, vps: [3, 2, 1], monsters: 3 },
  { id: "the-mines", name: "The Mines", set: "munchkin", faction: "dwarves", breakpoint: 18, vps: [4, 2, 1], monsters: 2 },
  { id: "treasure-bath", name: "Treasure Bath", set: "munchkin", faction: "dwarves", breakpoint: 12, vps: [2, 0, 0], monsters: 1 },
  { id: "helpers-hollow", name: "Helper’s Hollow", set: "munchkin", faction: "elves", breakpoint: 17, vps: [3, 2, 1], monsters: 2 },
  { id: "treehouse", name: "Treehouse", set: "munchkin", faction: "elves", breakpoint: 15, vps: [4, 2, 1], monsters: 2 },
  { id: "birthday-party", name: "Birthday Party", set: "munchkin", faction: "halflings", breakpoint: 20, vps: [4, 2, 1], monsters: 1 },
  { id: "subterranean-lair", name: "Subterranean Lair", set: "munchkin", faction: "halflings", breakpoint: 23, vps: [5, 3, 2], monsters: 1 },
  { id: "dimension-doors", name: "Dimension Doors", set: "munchkin", faction: "mages", breakpoint: 20, vps: [4, 2, 1], monsters: 1 },
  { id: "mages-tower", name: "Mage’s Tower", set: "munchkin", faction: "mages", breakpoint: 18, vps: [4, 3, 2], monsters: 1 },
  { id: "garrison", name: "Garrison", set: "munchkin", faction: "orcs", breakpoint: 12, vps: [3, 2, 1], monsters: 2, bonus: "top-three-vp-at-22-power" },
  { id: "the-pits", name: "The Pits", set: "munchkin", faction: "orcs", breakpoint: 16, vps: [4, 2, 1], monsters: 2 },
  { id: "the-coffers", name: "The Coffers", set: "munchkin", faction: "thieves", breakpoint: 18, vps: [4, 2, 1], monsters: 2 },
  { id: "thieves-guild", name: "Thieves’ Guild", set: "munchkin", faction: "thieves", breakpoint: 19, vps: [4, 3, 2], monsters: 1 },
  { id: "bastion", name: "Bastion", set: "munchkin", faction: "warriors", breakpoint: 11, vps: [3, 2, 2], monsters: 3 },
  { id: "the-gauntlet", name: "The Gauntlet", set: "munchkin", faction: "warriors", breakpoint: 14, vps: [5, 3, 2], monsters: 3 },

  // It’s Your Fault!
  { id: "dragons-lair", name: "Dragon’s Lair", set: "its-your-fault", faction: "dragons", breakpoint: 18, vps: [2, 2, 1] },
  { id: "wyrms-desolation", name: "Wyrm’s Desolation", set: "its-your-fault", faction: "dragons", breakpoint: 20, vps: [5, 3, 2] },
  { id: "oracle-at-delphi", name: "Oracle at Delphi", set: "its-your-fault", faction: "mythic-greeks", breakpoint: 18, vps: [4, 2, 1] },
  { id: "wooden-horse", name: "Wooden Horse", set: "its-your-fault", faction: "mythic-greeks", breakpoint: 21, vps: [3, 2, 1] },
  { id: "shark-reef", name: "Shark Reef", set: "its-your-fault", faction: "sharks", breakpoint: 20, vps: [4, 2, 1] },
  { id: "the-deep", name: "The Deep", set: "its-your-fault", faction: "sharks", breakpoint: 16, vps: [3, 2, 2] },
  { id: "converted-cave", name: "Converted Cave", set: "its-your-fault", faction: "superheroes", breakpoint: 18, vps: [4, 3, 2] },
  { id: "crystal-fortress", name: "Crystal Fortress", set: "its-your-fault", faction: "superheroes", breakpoint: 19, vps: [3, 1, 1] },
  { id: "tornado-alley", name: "Tornado Alley", set: "its-your-fault", faction: "tornados", breakpoint: 25, vps: [4, 3, 2] },
  { id: "trailer-park", name: "Trailer Park", set: "its-your-fault", faction: "tornados", breakpoint: 20, vps: [4, 2, 1] },

  // Cease and Desist
  { id: "hive-of-scum-and-villainy", name: "Hive of Scum and Villainy", set: "cease-and-desist", faction: "astroknights", breakpoint: 18, vps: [4, 2, 1] },
  { id: "no-moontm", name: "No-Moon™", set: "cease-and-desist", faction: "astroknights", breakpoint: 25, vps: [5, 3, 3] },
  { id: "changing-room", name: "Changing Room", set: "cease-and-desist", faction: "changerbots", breakpoint: 22, vps: [5, 3, 2] },
  { id: "unicrave", name: "Unicrave", set: "cease-and-desist", faction: "changerbots", breakpoint: 19, vps: [0, 0, 0] },
  { id: "spikey-chair-room", name: "Spikey Chair Room", set: "cease-and-desist", faction: "ignobles", breakpoint: 20, vps: [4, 2, 1] },
  { id: "wintersquashed", name: "Wintersquashed", set: "cease-and-desist", faction: "ignobles", breakpoint: 16, vps: [2, 4, 1] },
  { id: "neutral-space", name: "Neutral Space", set: "cease-and-desist", faction: "star-roamers", breakpoint: 18, vps: [3, 2, 1] },
  { id: "uss-undertaking", name: "USS Undertaking", set: "cease-and-desist", faction: "star-roamers", breakpoint: 22, vps: [4, 2, 1] },

  // What Were We Thinking?
  { id: "ancient-temple", name: "Ancient Temple", set: "what-were-we-thinking", faction: "explorers", breakpoint: 20, vps: [4, 2, 1] },
  { id: "city-of-gold", name: "City of Gold", set: "what-were-we-thinking", faction: "explorers", breakpoint: 16, vps: [3, 1, 1] },
  { id: "grandmas-house", name: "Grandma’s House", set: "what-were-we-thinking", faction: "grannies", breakpoint: 25, vps: [5, 3, 2] },
  { id: "retirement-community", name: "Retirement Community", set: "what-were-we-thinking", faction: "grannies", breakpoint: 20, vps: [4, 2, 1] },
  { id: "lake-minnetonka", name: "Lake Minnetonka", set: "what-were-we-thinking", faction: "rock-stars", breakpoint: 26, vps: [5, 3, 2] },
  { id: "palooza", name: "Palooza", set: "what-were-we-thinking", faction: "rock-stars", breakpoint: 27, vps: [6, 4, 3] },
  { id: "out-in-the-woods", name: "Out in the Woods", set: "what-were-we-thinking", faction: "teddy-bears", breakpoint: 18, vps: [3, 2, 1] },
  { id: "under-the-bed", name: "Under the Bed", set: "what-were-we-thinking", faction: "teddy-bears", breakpoint: 22, vps: [4, 2, 1] },

  // All Stars Event Kit
  { id: "locker-room", name: "Locker Room", set: "all-stars", alsoIn: ["bigger-geekier-box"], faction: "smash-up-all-stars", breakpoint: 23, vps: [3, 2, 2] },
  { id: "stadium", name: "Stadium", set: "all-stars", alsoIn: ["bigger-geekier-box"], faction: "smash-up-all-stars", breakpoint: 17, vps: [3, 2, 1] },

  // Big in Japan
  { id: "critter-combat-club", name: "Critter Combat Club", set: "big-in-japan", faction: "itty-critters", breakpoint: 23, vps: [4, 3, 1] },
  { id: "itty-city", name: "Itty City", set: "big-in-japan", faction: "itty-critters", breakpoint: 20, vps: [3, 1, 1] },
  { id: "kaiju-island", name: "Kaiju Island", set: "big-in-japan", faction: "kaiju", breakpoint: 22, vps: [4, 2, 1] },
  { id: "tokyo", name: "Tokyo", set: "big-in-japan", faction: "kaiju", breakpoint: 25, vps: [5, 3, 2] },
  { id: "akihabara-high", name: "Akihabara High", set: "big-in-japan", faction: "magical-girls", breakpoint: 20, vps: [3, 2, 1] },
  { id: "q-point", name: "Q Point", set: "big-in-japan", faction: "magical-girls", breakpoint: 25, vps: [5, 4, 3] },
  { id: "juice-bar", name: "Juice Bar", set: "big-in-japan", faction: "mega-troopers", breakpoint: 20, vps: [3, 2, 1] },
  { id: "moon-dumpster", name: "Moon Dumpster", set: "big-in-japan", faction: "mega-troopers", breakpoint: 24, vps: [4, 2, 2] },

  // Smash Up Sheep Promo
  { id: "sheep-shrine", name: "Sheep Shrine", set: "sheep", alsoIn: ["10th-anniversary"], faction: "sheep", breakpoint: 19, vps: [4, 2, 1] },
  { id: "the-pasture", name: "The Pasture", set: "sheep", alsoIn: ["10th-anniversary"], faction: "sheep", breakpoint: 25, vps: [5, 3, 2] },

  // That ’70s Expansion
  { id: "boogie-wonderland", name: "Boogie Wonderland", set: "that-70s-expansion", faction: "disco-dancers", breakpoint: 21, vps: [4, 2, 1] },
  { id: "funky-town", name: "Funky Town", set: "that-70s-expansion", faction: "disco-dancers", breakpoint: 23, vps: [4, 3, 2] },
  { id: "ancient-dojo", name: "Ancient Dojo", set: "that-70s-expansion", faction: "kung-fu-fighters", breakpoint: 25, vps: [5, 4, 3] },
  { id: "tournament-site", name: "Tournament Site", set: "that-70s-expansion", faction: "kung-fu-fighters", breakpoint: 19, vps: [2, 0, 0], bonus: "winner-vp-per-powerless-player" },
  { id: "the-greasy-spoon", name: "The Greasy Spoon", set: "that-70s-expansion", faction: "truckers", breakpoint: 20, vps: [4, 2, 1] },
  { id: "truck-stop", name: "Truck Stop", set: "that-70s-expansion", faction: "truckers", breakpoint: 18, vps: [3, 2, 1] },
  { id: "hideout", name: "Hideout", set: "that-70s-expansion", faction: "vigilantes", breakpoint: 18, vps: [3, 1, 1] },
  { id: "the-mean-streets", name: "The Mean Streets", set: "that-70s-expansion", faction: "vigilantes", breakpoint: 25, vps: [5, 3, 2] },

  // Oops, You Did It Again
  { id: "pyramids", name: "Pyramids", set: "oops-you-did-it-again", faction: "ancient-egyptians", breakpoint: 21, vps: [4, 2, 1] },
  { id: "star-portal", name: "Star Portal", set: "oops-you-did-it-again", faction: "ancient-egyptians", breakpoint: 17, vps: [3, 1, 1] },
  { id: "saloon", name: "Saloon", set: "oops-you-did-it-again", faction: "cowboys", breakpoint: 20, vps: [3, 2, 1] },
  { id: "so-so-corral", name: "So-So Corral", set: "oops-you-did-it-again", faction: "cowboys", breakpoint: 19, vps: [4, 2, 1] },
  { id: "sakura-garden", name: "Sakura Garden", set: "oops-you-did-it-again", faction: "samurai", breakpoint: 18, vps: [3, 2, 1] },
  { id: "shoguns-palace", name: "Shogun’s Palace", set: "oops-you-did-it-again", faction: "samurai", breakpoint: 23, vps: [4, 3, 1] },
  { id: "drakkar", name: "Drakkar", set: "oops-you-did-it-again", faction: "vikings", breakpoint: 21, vps: [4, 2, 1] },
  { id: "longhouse", name: "Longhouse", set: "oops-you-did-it-again", faction: "vikings", breakpoint: 25, vps: [5, 3, 2] },

  // World Tour: International Incident
  { id: "ringside", name: "Ringside", set: "international-incident", faction: "luchadors", breakpoint: 21, vps: [4, 2, 1] },
  { id: "the-squared-circle", name: "The Squared Circle", set: "international-incident", faction: "luchadors", breakpoint: 18, vps: [3, 1, 1] },
  { id: "great-white-north-eh", name: "Great White North, Eh?", set: "international-incident", faction: "mounties", breakpoint: 21, vps: [2, 3, 1] },
  { id: "strategic-syrup-reserve", name: "Strategic Syrup Reserve", set: "international-incident", faction: "mounties", breakpoint: 23, vps: [4, 2, 1] },
  { id: "bastion-saint-gervais", name: "Bastion Saint-Gervais", set: "international-incident", faction: "musketeers", breakpoint: 25, vps: [5, 4, 3] },
  { id: "the-golden-lily", name: "The Golden Lily", set: "international-incident", faction: "musketeers", breakpoint: 18, vps: [3, 2, 2] },
  { id: "heya-training-stable", name: "Heya Training Stable", set: "international-incident", faction: "sumo-wrestlers", breakpoint: 23, vps: [4, 2, 1] },
  { id: "the-dohyo", name: "The Dohyo", set: "international-incident", faction: "sumo-wrestlers", breakpoint: 17, vps: [3, 2, 1] },

  // Smash Up Penguins
  { id: "ice-floe", name: "Ice Floe", set: "penguins", faction: "penguins", breakpoint: 20, vps: [3, 2, 1] },
  { id: "the-colony", name: "The Colony", set: "penguins", faction: "penguins", breakpoint: 24, vps: [4, 2, 1] },

  // World Tour: Culture Shock
  { id: "anansis-web", name: "Anansi’s Web", set: "culture-shock", faction: "anansi-tales", breakpoint: 17, vps: [3, 2, 1] },
  { id: "storytellers-hut", name: "Storyteller’s Hut", set: "culture-shock", faction: "anansi-tales", breakpoint: 24, vps: [4, 2, 1] },
  { id: "cuzcu", name: "Cuzcu", set: "culture-shock", faction: "ancient-incas", breakpoint: 30, vps: [5, 3, 2] },
  { id: "machu-picchu", name: "Machu Picchu", set: "culture-shock", faction: "ancient-incas", breakpoint: 20, vps: [4, 2, 1] },
  { id: "gingerbread-house", name: "Gingerbread House", set: "culture-shock", faction: "grimms-fairy-tales", breakpoint: 21, vps: [4, 2, 1] },
  { id: "woodland-cottage", name: "Woodland Cottage", set: "culture-shock", faction: "grimms-fairy-tales", breakpoint: 19, vps: [3, 1, 1] },
  { id: "island-chain", name: "Island Chain", set: "culture-shock", faction: "polynesian-voyagers", breakpoint: 17, vps: [3, 1, 1] },
  { id: "island-peak", name: "Island Peak", set: "culture-shock", faction: "polynesian-voyagers", breakpoint: 23, vps: [4, 2, 1] },
  { id: "tropical-paradise", name: "Tropical Paradise", set: "culture-shock", faction: "polynesian-voyagers", breakpoint: 20, vps: [3, 2, 1] },
  { id: "giant-turnip", name: "Giant Turnip", set: "culture-shock", faction: "russian-fairy-tales", breakpoint: 30, vps: [5, 3, 3] },
  { id: "transformation-spring", name: "Transformation Spring", set: "culture-shock", faction: "russian-fairy-tales", breakpoint: 19, vps: [4, 2, 1] },

  // Dead Reckoning Promo
  { id: "deepreef-crag", name: "Deepreef Crag", set: "dead-reckoning", alsoIn: ["10th-anniversary"], breakpoint: 18, vps: [3, 1, 1], bonus: "winner-vp-at-exact-breakpoint" },

  // Smash Up: Marvel
  { id: "avengers-tower", name: "Avengers Tower", set: "marvel", faction: "avengers", breakpoint: 22, vps: [4, 2, 1] },
  { id: "starks-lab", name: "Stark’s Lab", set: "marvel", faction: "avengers", breakpoint: 18, vps: [3, 2, 1] },
  { id: "hydra-lab", name: "Hydra Lab", set: "marvel", faction: "hydra", breakpoint: 23, vps: [4, 2, 1] },
  { id: "ichor-base", name: "Ichor Base", set: "marvel", faction: "hydra", breakpoint: 25, vps: [5, 3, 2] },
  { id: "hala", name: "Hala", set: "marvel", faction: "kree", breakpoint: 22, vps: [4, 2, 1] },
  { id: "kree-lar", name: "Kree-Lar", set: "marvel", faction: "kree", breakpoint: 17, vps: [3, 1, 1] },
  { id: "castle-zemo", name: "Castle Zemo", set: "marvel", faction: "masters-of-evil", breakpoint: 20, vps: [4, 2, 1] },
  { id: "symkaria", name: "Symkaria", set: "marvel", faction: "masters-of-evil", breakpoint: 21, vps: [4, 0, 0], bonus: "others-vp-per-minion" },
  { id: "helicarrier", name: "Helicarrier", set: "marvel", faction: "shield", breakpoint: 24, vps: [5, 3, 2] },
  { id: "shield-base", name: "S.H.I.E.L.D. Base", set: "marvel", faction: "shield", breakpoint: 22, vps: [4, 2, 1] },
  { id: "downtown", name: "Downtown", set: "marvel", faction: "sinister-six", breakpoint: 18, vps: [3, 1, 1] },
  { id: "new-york-landmark", name: "New York Landmark", set: "marvel", faction: "sinister-six", breakpoint: 23, vps: [4, 2, 1] },
  { id: "manhattan", name: "Manhattan", set: "marvel", faction: "spider-verse", breakpoint: 20, vps: [4, 3, 2] },
  { id: "the-daily-bugle", name: "The Daily Bugle", set: "marvel", faction: "spider-verse", breakpoint: 18, vps: [4, 2, 1] },
  { id: "exo-space", name: "Exo-Space", set: "marvel", faction: "ultimates", breakpoint: 20, vps: [4, 2, 1] },
  { id: "the-triskelion", name: "The Triskelion", set: "marvel", faction: "ultimates", breakpoint: 23, vps: [4, 3, 1] },

  // Smash Up Goblins
  { id: "goblin-caves", name: "Goblin Caves", set: "goblins", faction: "goblins", breakpoint: 17, vps: [3, 1, 1] },
  { id: "goblin-town", name: "Goblin Town", set: "goblins", faction: "goblins", breakpoint: 21, vps: [4, 2, 1] },

  // Smash Up Knights of the Round Table
  { id: "camelot", name: "Camelot", set: "knights", faction: "knights-of-the-round-table", breakpoint: 22, vps: [5, 3, 2] },
  { id: "round-table", name: "Round Table", set: "knights", faction: "knights-of-the-round-table", breakpoint: 21, vps: [4, 2, 1] },

  // Smash Up: Disney Edition
  { id: "agrabah-bazaar", name: "Agrabah Bazaar", set: "disney", faction: "aladdin", breakpoint: 22, vps: [4, 2, 1] },
  { id: "sultans-palace", name: "Sultan’s Palace", set: "disney", faction: "aladdin", breakpoint: 18, vps: [3, 2, 1] },
  { id: "enchanted-castle", name: "Enchanted Castle", set: "disney", faction: "beauty-and-the-beast", breakpoint: 23, vps: [4, 3, 2] },
  { id: "gastons-tavern", name: "Gaston’s Tavern", set: "disney", faction: "beauty-and-the-beast", breakpoint: 26, vps: [5, 3, 2] },
  { id: "krei-tech", name: "Krei Tech", set: "disney", faction: "big-hero-6", breakpoint: 20, vps: [3, 1, 1] },
  { id: "sfit-robotics-lab", name: "SFIT Robotics Lab", set: "disney", faction: "big-hero-6", breakpoint: 24, vps: [4, 2, 1] },
  { id: "arendelle", name: "Arendelle", set: "disney", faction: "frozen", breakpoint: 20, vps: [3, 2, 1] },
  { id: "ice-palace", name: "Ice Palace", set: "disney", faction: "frozen", breakpoint: 22, vps: [4, 2, 1] },
  { id: "forbidden-city", name: "Forbidden City", set: "disney", faction: "mulan", breakpoint: 19, vps: [3, 3, 2] },
  { id: "training-camp", name: "Training Camp", set: "disney", faction: "mulan", breakpoint: 25, vps: [5, 3, 2] },
  { id: "jungle-paradise", name: "Jungle Paradise", set: "disney", faction: "the-lion-king", breakpoint: 22, vps: [4, 3, 1] },
  { id: "pride-rock", name: "Pride Rock", set: "disney", faction: "the-lion-king", breakpoint: 19, vps: [3, 2, 1] },
  { id: "halloween-town", name: "Halloween Town", set: "disney", faction: "the-nightmare-before-christmas", breakpoint: 25, vps: [5, 3, 2] },
  { id: "spiral-hill", name: "Spiral Hill", set: "disney", faction: "the-nightmare-before-christmas", breakpoint: 23, vps: [4, 2, 1] },
  { id: "the-dump", name: "The Dump", set: "disney", faction: "wreck-it-ralph", breakpoint: 20, vps: [4, 2, 2] },
  { id: "the-power-strip", name: "The Power Strip", set: "disney", faction: "wreck-it-ralph", breakpoint: 22, vps: [4, 2, 1] },

  // 10th Anniversary
  { id: "mermaid-pool", name: "Mermaid Pool", set: "10th-anniversary", faction: "mermaids", breakpoint: 23, vps: [4, 2, 1] },
  { id: "mermaid-reef", name: "Mermaid Reef", set: "10th-anniversary", faction: "mermaids", breakpoint: 17, vps: [3, 1, 1] },
  { id: "boneyard", name: "Boneyard", set: "10th-anniversary", faction: "skeletons", breakpoint: 22, vps: [4, 2, 1] },
  { id: "ossuary", name: "Ossuary", set: "10th-anniversary", faction: "skeletons", breakpoint: 20, vps: [3, 2, 1] },
  { id: "arena", name: "Arena", set: "10th-anniversary", faction: "world-champs", breakpoint: 23, vps: [4, 3, 1] },
  { id: "hall-of-fame", name: "Hall of Fame", set: "10th-anniversary", faction: "world-champs", breakpoint: 20, vps: [4, 2, 1] },

  // Excellent Movies, Dudes!
  { id: "building-rooftop", name: "Building Rooftop", set: "excellent-movies-dudes", faction: "action-heroes", breakpoint: 20, vps: [3, 1, 1], bonus: "vp-for-one-minion" },
  { id: "jungle-camp", name: "Jungle Camp", set: "excellent-movies-dudes", faction: "action-heroes", breakpoint: 20, vps: [3, 2, 1] },
  { id: "alternate-present", name: "Alternate Present", set: "excellent-movies-dudes", faction: "backtimers", breakpoint: 20, vps: [4, 2, 2] },
  { id: "time-traveling-car", name: "Time-Traveling Car", set: "excellent-movies-dudes", faction: "backtimers", breakpoint: 22, vps: [3, 2, 1] },
  { id: "ancient-crashed-ship", name: "Ancient Crashed Ship", set: "excellent-movies-dudes", faction: "extramorphs", breakpoint: 21, vps: [4, 2, 1] },
  { id: "brood-hive", name: "Brood Hive", set: "excellent-movies-dudes", faction: "extramorphs", breakpoint: 22, vps: [4, 2, 1] },
  { id: "rooftop-portal", name: "Rooftop Portal", set: "excellent-movies-dudes", faction: "wraithrustlers", breakpoint: 22, vps: [5, 3, 2] },
  { id: "wraithrustlers-hq", name: "Wraithrustlers HQ", set: "excellent-movies-dudes", faction: "wraithrustlers", breakpoint: 20, vps: [4, 2, 1] },

  // Smash Up Teens
  { id: "cabin-in-the-woods", name: "Cabin in the Woods", set: "teens", faction: "teens", breakpoint: 24, vps: [4, 3, 1] },
  { id: "montridge-high", name: "Montridge High", set: "teens", faction: "teens", breakpoint: 20, vps: [4, 2, 1] },

  // Half the Battle
  { id: "sewer-hideout", name: "Sewer Hideout", set: "half-the-battle", faction: "adolescent-epic-geckos", breakpoint: 21, vps: [4, 2, 1] },
  { id: "technoball", name: "Technoball", set: "half-the-battle", faction: "adolescent-epic-geckos", breakpoint: 22, vps: [4, 2, 1] },
  { id: "gi-geralds-base", name: "G.I. Gerald’s Base", set: "half-the-battle", faction: "gi-gerald", breakpoint: 22, vps: [5, 3, 2] },
  { id: "uss-banner", name: "USS Banner", set: "half-the-battle", faction: "gi-gerald", breakpoint: 20, vps: [4, 2, 1] },
  { id: "concert-venue", name: "Concert Venue", set: "half-the-battle", faction: "pearl-and-the-images", breakpoint: 20, vps: [3, 1, 1] },
  { id: "recording-studio", name: "Recording Studio", set: "half-the-battle", faction: "pearl-and-the-images", breakpoint: 23, vps: [4, 2, 1] },
  { id: "power-castle", name: "Power Castle", set: "half-the-battle", faction: "rulers-of-the-cosmos", breakpoint: 20, vps: [4, 2, 1] },
  { id: "slime-pool", name: "Slime Pool", set: "half-the-battle", faction: "rulers-of-the-cosmos", breakpoint: 20, vps: [3, 2, 1] },

  // Smash Up Slashers
  { id: "camp-clear-lake", name: "Camp Clear Lake", set: "slashers", faction: "slashers", breakpoint: 20, vps: [4, 3, 1] },
  { id: "nightmare-realm", name: "Nightmare Realm", set: "slashers", faction: "slashers", breakpoint: 22, vps: [5, 3, 2] },

  // Smash Up Clowns
  { id: "clown-college", name: "Clown College", set: "clowns", faction: "clowns", breakpoint: 18, vps: [3, 2, 2] },
  { id: "the-big-top", name: "The Big Top", set: "clowns", faction: "clowns", breakpoint: 21, vps: [4, 2, 1] },
];
