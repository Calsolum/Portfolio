/**
 * Every Smash Up faction, from the Smash Up Wiki's faction list
 * (https://smashup.fandom.com/wiki/Category:Factions, read 2026-10-22; wiki
 * content is CC BY-SA). `set` is the release that first had the faction and
 * `alsoIn` lists later boxes that reprint it.
 */

export interface Faction {
  id: string;
  name: string;
  /** A GameSet id. */
  set: string;
  alsoIn?: readonly string[];
}

export const FACTIONS: readonly Faction[] = [
  // Core Set
  { id: "aliens", name: "Aliens", set: "core" },
  { id: "dinosaurs", name: "Dinosaurs", set: "core" },
  { id: "ninjas", name: "Ninjas", set: "core" },
  { id: "pirates", name: "Pirates", set: "core" },
  { id: "robots", name: "Robots", set: "core" },
  { id: "tricksters", name: "Tricksters", set: "core" },
  { id: "wizards", name: "Wizards", set: "core" },
  { id: "zombies", name: "Zombies", set: "core" },

  // Awesome Level 9000
  { id: "bear-cavalry", name: "Bear Cavalry", set: "awesome-level-9000" },
  { id: "ghosts", name: "Ghosts", set: "awesome-level-9000" },
  { id: "killer-plants", name: "Killer Plants", set: "awesome-level-9000" },
  { id: "steampunks", name: "Steampunks", set: "awesome-level-9000" },

  // The Obligatory Cthulhu Set
  { id: "elder-things", name: "Elder Things", set: "obligatory-cthulhu" },
  { id: "innsmouth", name: "Innsmouth", set: "obligatory-cthulhu" },
  { id: "minions-of-cthulhu", name: "Minions of Cthulhu", set: "obligatory-cthulhu" },
  { id: "miskatonic-university", name: "Miskatonic University", set: "obligatory-cthulhu" },

  // Science Fiction Double Feature
  { id: "cyborg-apes", name: "Cyborg Apes", set: "science-fiction-double-feature" },
  { id: "shapeshifters", name: "Shapeshifters", set: "science-fiction-double-feature" },
  { id: "super-spies", name: "Super Spies", set: "science-fiction-double-feature" },
  { id: "time-travelers", name: "Time Travelers", set: "science-fiction-double-feature" },

  // The Big Geeky Box
  { id: "geeks", name: "Geeks", set: "big-geeky-box", alsoIn: ["bigger-geekier-box"] },

  // Monster Smash
  { id: "giant-ants", name: "Giant Ants", set: "monster-smash" },
  { id: "mad-scientists", name: "Mad Scientists", set: "monster-smash" },
  { id: "vampires", name: "Vampires", set: "monster-smash" },
  { id: "werewolves", name: "Werewolves", set: "monster-smash" },

  // Pretty Pretty Smash Up
  { id: "fairies", name: "Fairies", set: "pretty-pretty-smash-up" },
  { id: "kitty-cats", name: "Kitty Cats", set: "pretty-pretty-smash-up" },
  { id: "mythic-horses", name: "Mythic Horses", set: "pretty-pretty-smash-up" },
  { id: "princesses", name: "Princesses", set: "pretty-pretty-smash-up" },

  // Smash Up: Munchkin
  { id: "clerics", name: "Clerics", set: "munchkin" },
  { id: "dwarves", name: "Dwarves", set: "munchkin" },
  { id: "elves", name: "Elves", set: "munchkin" },
  { id: "halflings", name: "Halflings", set: "munchkin" },
  { id: "mages", name: "Mages", set: "munchkin" },
  { id: "orcs", name: "Orcs", set: "munchkin" },
  { id: "thieves", name: "Thieves", set: "munchkin" },
  { id: "warriors", name: "Warriors", set: "munchkin" },

  // It’s Your Fault!
  { id: "dragons", name: "Dragons", set: "its-your-fault" },
  { id: "mythic-greeks", name: "Mythic Greeks", set: "its-your-fault" },
  { id: "sharks", name: "Sharks", set: "its-your-fault" },
  { id: "superheroes", name: "Superheroes", set: "its-your-fault" },
  { id: "tornados", name: "Tornados", set: "its-your-fault" },

  // Cease and Desist
  { id: "astroknights", name: "Astroknights", set: "cease-and-desist" },
  { id: "changerbots", name: "Changerbots", set: "cease-and-desist" },
  { id: "ignobles", name: "Ignobles", set: "cease-and-desist" },
  { id: "star-roamers", name: "Star Roamers", set: "cease-and-desist" },

  // What Were We Thinking?
  { id: "explorers", name: "Explorers", set: "what-were-we-thinking" },
  { id: "grannies", name: "Grannies", set: "what-were-we-thinking" },
  { id: "rock-stars", name: "Rock Stars", set: "what-were-we-thinking" },
  { id: "teddy-bears", name: "Teddy Bears", set: "what-were-we-thinking" },

  // All Stars Event Kit
  { id: "smash-up-all-stars", name: "Smash Up All Stars", set: "all-stars", alsoIn: ["bigger-geekier-box"] },

  // Big in Japan
  { id: "itty-critters", name: "Itty Critters", set: "big-in-japan" },
  { id: "kaiju", name: "Kaiju", set: "big-in-japan" },
  { id: "magical-girls", name: "Magical Girls", set: "big-in-japan" },
  { id: "mega-troopers", name: "Mega Troopers", set: "big-in-japan" },

  // Smash Up Sheep Promo
  { id: "sheep", name: "Sheep", set: "sheep", alsoIn: ["10th-anniversary"] },

  // That ’70s Expansion
  { id: "disco-dancers", name: "Disco Dancers", set: "that-70s-expansion" },
  { id: "kung-fu-fighters", name: "Kung Fu Fighters", set: "that-70s-expansion" },
  { id: "truckers", name: "Truckers", set: "that-70s-expansion" },
  { id: "vigilantes", name: "Vigilantes", set: "that-70s-expansion" },

  // Oops, You Did It Again
  { id: "ancient-egyptians", name: "Ancient Egyptians", set: "oops-you-did-it-again" },
  { id: "cowboys", name: "Cowboys", set: "oops-you-did-it-again" },
  { id: "samurai", name: "Samurai", set: "oops-you-did-it-again" },
  { id: "vikings", name: "Vikings", set: "oops-you-did-it-again" },

  // World Tour: International Incident
  { id: "luchadors", name: "Luchadors", set: "international-incident" },
  { id: "mounties", name: "Mounties", set: "international-incident" },
  { id: "musketeers", name: "Musketeers", set: "international-incident" },
  { id: "sumo-wrestlers", name: "Sumo Wrestlers", set: "international-incident" },

  // Smash Up Penguins
  { id: "penguins", name: "Penguins", set: "penguins" },

  // World Tour: Culture Shock
  { id: "anansi-tales", name: "Anansi Tales", set: "culture-shock" },
  { id: "ancient-incas", name: "Ancient Incas", set: "culture-shock" },
  { id: "grimms-fairy-tales", name: "Grimms’ Fairy Tales", set: "culture-shock" },
  { id: "polynesian-voyagers", name: "Polynesian Voyagers", set: "culture-shock" },
  { id: "russian-fairy-tales", name: "Russian Fairy Tales", set: "culture-shock" },

  // Smash Up: Marvel
  { id: "avengers", name: "Avengers", set: "marvel" },
  { id: "hydra", name: "Hydra", set: "marvel" },
  { id: "kree", name: "Kree", set: "marvel" },
  { id: "masters-of-evil", name: "Masters of Evil", set: "marvel" },
  { id: "shield", name: "S.H.I.E.L.D.", set: "marvel" },
  { id: "sinister-six", name: "Sinister Six", set: "marvel" },
  { id: "spider-verse", name: "Spider-Verse", set: "marvel" },
  { id: "ultimates", name: "Ultimates", set: "marvel" },

  // Smash Up Goblins
  { id: "goblins", name: "Goblins", set: "goblins" },

  // Smash Up Knights of the Round Table
  { id: "knights-of-the-round-table", name: "Knights of the Round Table", set: "knights" },

  // Smash Up: Disney Edition
  { id: "aladdin", name: "Aladdin", set: "disney" },
  { id: "beauty-and-the-beast", name: "Beauty and the Beast", set: "disney" },
  { id: "big-hero-6", name: "Big Hero 6", set: "disney" },
  { id: "frozen", name: "Frozen", set: "disney" },
  { id: "mulan", name: "Mulan", set: "disney" },
  { id: "the-lion-king", name: "The Lion King", set: "disney" },
  { id: "the-nightmare-before-christmas", name: "The Nightmare Before Christmas", set: "disney" },
  { id: "wreck-it-ralph", name: "Wreck-It Ralph", set: "disney" },

  // 10th Anniversary
  { id: "mermaids", name: "Mermaids", set: "10th-anniversary" },
  { id: "skeletons", name: "Skeletons", set: "10th-anniversary" },
  { id: "world-champs", name: "World Champs", set: "10th-anniversary" },

  // Excellent Movies, Dudes!
  { id: "action-heroes", name: "Action Heroes", set: "excellent-movies-dudes" },
  { id: "backtimers", name: "Backtimers", set: "excellent-movies-dudes" },
  { id: "extramorphs", name: "Extramorphs", set: "excellent-movies-dudes" },
  { id: "wraithrustlers", name: "Wraithrustlers", set: "excellent-movies-dudes" },

  // Smash Up Teens
  { id: "teens", name: "Teens", set: "teens" },

  // Half the Battle
  { id: "adolescent-epic-geckos", name: "Adolescent Epic Geckos", set: "half-the-battle" },
  { id: "gi-gerald", name: "G.I. Gerald", set: "half-the-battle" },
  { id: "pearl-and-the-images", name: "Pearl and the Images", set: "half-the-battle" },
  { id: "rulers-of-the-cosmos", name: "Rulers of the Cosmos", set: "half-the-battle" },

  // Smash Up Slashers
  { id: "slashers", name: "Slashers", set: "slashers" },

  // Smash Up Clowns
  { id: "clowns", name: "Clowns", set: "clowns" },
];
