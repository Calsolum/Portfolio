/**
 * Every piece of copy, metadata and link on the site lives here.
 * Long-form prose lives alongside it as HTML fragments in src/content/,
 * imported from the WordPress export by scripts/extract-wordpress-content.py.
 */

export type WorkCategory = "games" | "poetry" | "fiction" | "scripts" | "projects";

export interface ExternalLink {
  label: string;
  href: string;
}

export interface Work {
  /** Matches the filename in src/content (`<slug>.html`). */
  slug: string;
  title: string;
  category: WorkCategory;
  /** Short kind label shown in monospace above the title. */
  kind: string;
  /** Card blurb on index pages. */
  blurb: string;
  /** Pull quote shown beside the work, where one earns its place. */
  quote?: { text: string; attribution: string };
  /** Tech or medium tags. */
  tags?: string[];
  /** Shown as a badge when a work is not finished, e.g. "In progress". */
  status?: string;
  links?: ExternalLink[];
  /** True when src/content holds the full text and the work gets a reading page. */
  readable: boolean;
}

export interface Project extends Work {
  category: "projects";
  stack: string;
  /** Path under /public/apps for projects that are playable in the browser. */
  app?: string;
}

export interface Section {
  id: WorkCategory;
  /** The 01 — 05 numeral in the section rule. */
  index: string;
  title: string;
  /** Second line of the display heading. */
  titleLine2: string;
  intro: string;
}

export const profile = {
  name: "Tariq Singh",
  role: "Writer & Storyteller",
  location: "Brampton, Ontario",
  tagline: "Words in every medium",
  intro:
    "From interactive fiction to poetry, novel to stage — a body of work that refuses to stay in one genre.",
  email: "tariq@live.ca",
  // Phone number and street address from the resume are deliberately not published here.
  links: {
    itch: "https://ns-kt.itch.io",
    linkedin: "https://www.linkedin.com/in/tariqsingh0",
    wordpress: "https://calsolum.wordpress.com",
    github: "https://github.com/calsolum",
  },
  resume: "/downloads/tariq-singh-resume.pdf",
} as const;

export const navLinks = [
  { href: "/games", label: "Games" },
  { href: "/poetry", label: "Poetry" },
  { href: "/fiction", label: "Fiction" },
  { href: "/scripts", label: "Scripts" },
  { href: "/projects", label: "Projects" },
  { href: "/about", label: "About" },
] as const;

export const sections: Section[] = [
  {
    id: "games",
    index: "01",
    title: "Interactive",
    titleLine2: "Worlds",
    intro:
      "Two games in development, built in Visual Novel Maker and RPG Maker. Each one a short, self-contained experience built around consequence.",
  },
  {
    id: "poetry",
    index: "02",
    title: "A Collection of",
    titleLine2: "Poems",
    intro:
      "Short poems at the intersection of the natural world and the human one. Seasons change. Emotions shift like weather.",
  },
  {
    id: "fiction",
    index: "03",
    title: "Long-Form",
    titleLine2: "Fiction",
    intro:
      "An ongoing fantasy novel series and a mystery novella. Both available to read in full.",
  },
  {
    id: "scripts",
    index: "04",
    title: "Stage &",
    titleLine2: "Screen",
    intro:
      "A stage adaptation of a classic Japanese folktale, and an original short film about a retired detective who finds the case he never solved.",
  },
  {
    id: "projects",
    index: "05",
    title: "Technical",
    titleLine2: "Projects",
    intro:
      "Three projects built from scratch — a self-hosted smart home system, a digital party game, and a board game companion app.",
  },
];

/**
 * TODO: Mansion of Fate and Choices are still works in progress — neither has a
 * published itch.io page yet, so their links point at the itch.io profile root
 * and are labelled as in-progress rather than as a playable demo. When either
 * game ships, swap in its real page URL and restore the "Play …" label.
 */
export const works: Work[] = [
  {
    slug: "mansion-of-fate",
    title: "Mansion of Fate",
    category: "games",
    kind: "Visual Novel",
    blurb:
      "A group of friends follow the reckless Erica into an abandoned mansion that appeared overnight. Trapped in a shifting labyrinth, separated, and forced to survive lethal puzzles — every choice shapes who makes it out. Multiple endings, a hidden true ending, and a story that remembers what you did last time.",
    tags: ["Visual Novel Maker", "Ren'Py", "Branching Narrative"],
    status: "In progress",
    links: [{ label: "Follow on itch.io", href: profile.links.itch }],
    readable: true,
  },
  {
    slug: "choices",
    title: "Choices",
    category: "games",
    kind: "RPG",
    blurb:
      "A short RPG built on a single principle — every choice is final. Enemies can be fought or reasoned with, alliances can be forged or burned, but nothing can be undone. A compact, replayable experience that puts consequence at the centre of every decision.",
    tags: ["RPG Maker", "Short Form"],
    status: "In progress",
    links: [{ label: "Follow on itch.io", href: profile.links.itch }],
    readable: true,
  },
  {
    slug: "seasons-of-everything",
    title: "Seasons of Everything",
    category: "poetry",
    kind: "Poetry Collection",
    blurb:
      "A collection of short poems that move between the natural world and the human one — using forests, seasons, moonlight, and stone to speak about society, memory, emotion, and growth. Quiet in its observations and deliberate in its turns.",
    quote: {
      text: "The caged canary sleeps under cold bars.\nOutside the security of the cell lies adventure\nand the door was open.\nThis canary will not be content in a cage.",
      attribution: '"Bravery", from Seasons of Everything',
    },
    readable: true,
  },
  {
    slug: "the-infinite-cycle",
    title: "The Infinite Cycle",
    category: "fiction",
    kind: "Novel Series — Prologue & Chapters 1–2",
    blurb:
      "What happens after the end of an epic? Another story begins. A warrior reborn into an unfamiliar world with all his memories intact — navigating childhood, secrets, and the slow reconstruction of a life he never asked for.",
    quote: {
      text: "“A demon's face! What the hell? I need to move! I need to escape!” — he tried to run. He had no strength. He tried to speak. All he heard was one wild wail.",
      attribution: "The Infinite Cycle",
    },
    readable: true,
  },
  {
    slug: "veritas-case-files",
    title: "Veritas Case Files: Forest of the Dead",
    category: "fiction",
    kind: "Mystery Novella — Chapter 7 of 12",
    blurb:
      "Ghosts are terrorizing the residents of a countryside mansion. The client is frightened. The detective is reckless — and one of the apparitions seems to know it. A traditional mystery told through the eyes of Toni, Veritas' assistant, revealing its detective slowly, one unguarded moment at a time.",
    quote: {
      text: '"You." Toni pointed at Veritas. "Threw." He mimed an overhand throw. "Pebbles." He pinched his fingers. "At my face."',
      attribution: "Veritas Case Files: Forest of the Dead",
    },
    readable: true,
  },
  {
    slug: "the-tongue-cut-sparrow",
    title: "The Tongue-Cut Sparrow",
    category: "scripts",
    kind: "Stage Play — Adaptation",
    blurb:
      "A stage adaptation of the classic Japanese folktale. Two sisters, a sparrow, and a lesson about kindness, greed, and consequence — reimagined for the contemporary stage.",
    links: [{ label: "Download script (PDF)", href: "/downloads/the-tongue-cut-sparrow.pdf" }],
    readable: true,
  },
  {
    slug: "overlooked",
    title: "Overlooked",
    category: "scripts",
    kind: "Short Film Script — Original",
    blurb:
      "A retired detective stumbles on a breakthrough in a cold case he never solved. A 7-minute short film about obsession, absence, and the moment a man realizes the case that defined him may have cost him everything that mattered more.",
    links: [{ label: "Download script (PDF)", href: "/downloads/overlooked.pdf" }],
    readable: true,
  },
];

export const projects: Project[] = [
  {
    slug: "kitchen-hub",
    title: "Kitchen Hub",
    category: "projects",
    kind: "Self-hosted · Raspberry Pi 5",
    blurb:
      "A fully self-hosted smart kitchen management system built on a Raspberry Pi 5 — no subscriptions, no cloud dependency. Custom touchscreen dashboard, on-device voice control, live grocery deal matching, and smart home automation. Fridge-mounted, running entirely on a private home network.",
    stack: "Docker · Flask · Grocy · Mealie · faster-whisper · Home Assistant · Tailscale",
    tags: ["Docker", "Flask", "Home Assistant", "Raspberry Pi"],
    // Runs on a private home network, so the source is the only thing to link to.
    links: [{ label: "View source on GitHub", href: "https://github.com/Calsolum/kitchen-hub" }],
    readable: true,
  },
  {
    slug: "drunkquest",
    title: "DrunkQuest",
    category: "projects",
    kind: "Browser App · Party Game",
    blurb:
      "A fully playable browser adaptation of the DrunkQuest fantasy drinking card game. 8 hero classes, 8 realm cards, 22 treasure cards, 18 monsters and bosses, with complete turn management, hero abilities, and monster combat faithful to the original physical game.",
    stack: "Vanilla HTML · CSS · JavaScript · No dependencies",
    tags: ["JavaScript", "Single File", "Game"],
    app: "/apps/drunkquest.html",
    readable: true,
  },
  {
    slug: "tragedy-looper",
    title: "Tragedy Looper Player Aid",
    category: "projects",
    kind: "Board Game Companion · Browser Tool",
    blurb:
      "A digital companion for Tragedy Looper that replaces the physical board, tokens, cards, and rulebook during play. 13 official scripts preloaded, drag-and-drop character movement, a real-time win-condition engine, and all 28 characters' Goodwill abilities coded. Runs offline.",
    stack: "Vanilla HTML · CSS · JavaScript · No dependencies · 270KB",
    tags: ["JavaScript", "Single File", "Deduction"],
    app: "/apps/tragedy-looper.html",
    readable: true,
  },
];

export const stats = [
  { value: "2", label: "Games" },
  { value: "1", label: "Poetry Collection" },
  { value: "2", label: "Novel Chapters" },
  { value: "1", label: "Novella" },
  { value: "1", label: "Stage Adaptation" },
  { value: "1", label: "Film Script" },
  { value: "3", label: "Projects" },
];

export interface ExperienceEntry {
  role: string;
  org: string;
  period: string;
  bullets: string[];
}

export const experience: ExperienceEntry[] = [
  {
    role: "Editor",
    org: "Mobile Gaming News Network",
    period: "Jul 2019 – Aug 2020",
    bullets: [
      "Proofread, edited and suggested changes to articles before final publication.",
      "Scheduled and published approved web articles.",
      "Coordinated with other writers and editors to maintain a constant publishing schedule and a consistent voice across contributors.",
    ],
  },
  {
    role: "Editor",
    org: "Savant-Garde",
    period: "Oct 2018 – Oct 2019",
    bullets: [
      "Proofread and edited book reviews for tone and clarity before final publication.",
    ],
  },
  {
    role: "Editorial Project Lead",
    org: "Sheridan College Graduate Anthology",
    period: "6-month project",
    bullets: [
      "Led a 30-member team through publication of a graduate anthology spanning multiple genres.",
      "Held the project to its timelines and quality standards from submission through print.",
    ],
  },
  {
    role: "Document Control Administration",
    org: "Anti-Corrosion Technical Services",
    period: "Nov – Dec 2013",
    bullets: [
      "Created, modified and released controlled documents and certificates.",
      "Scanned and organised document archives.",
      "Provided IT support for missing, corrupted and deleted files, and implemented security measures preventing unauthorised modification of documents.",
    ],
  },
];

export interface EducationEntry {
  credential: string;
  field: string;
  institution: string;
  year: string;
}

export const education: EducationEntry[] = [
  {
    credential: "Honours Bachelor",
    field: "Creative Writing and Publishing",
    institution: "Sheridan Institute of Technology and Advanced Learning",
    year: "2023",
  },
  {
    credential: "Graduate Certificate",
    field: "Creative Writing",
    institution: "Humber College",
    year: "2018",
  },
  {
    credential: "Diploma",
    field: "Computer Programming",
    institution: "Sheridan Institute of Technology and Advanced Learning",
    year: "2017",
  },
  {
    credential: "Certificate",
    field: "Project Management",
    institution: "Sheridan Institute of Technology and Advanced Learning",
    year: "2017",
  },
];

export const skillGroups = [
  {
    label: "Narrative",
    items: [
      "Interactive Fiction",
      "Branching Narrative",
      "Dialogue & Event Scripting",
      "Non-Linear Storytelling",
      "Playtesting & Iteration",
    ],
  },
  {
    label: "Editorial",
    items: [
      "Editorial Management",
      "Copy & Line Editing",
      "Editorial Consistency",
      "Publication Scheduling",
      "Cross-Team Collaboration",
    ],
  },
  {
    label: "Technical",
    items: [
      "Unreal Engine (self-taught)",
      "Ren'Py",
      "HTML / CSS / JavaScript",
      "Python",
      "Java",
      "C#",
      "SQL",
      "Docker",
      "Networking",
    ],
  },
];
