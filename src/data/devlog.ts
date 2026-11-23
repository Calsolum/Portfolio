/**
 * Dev Log: short, public progress notes across every project.
 *
 * House rules for entries (they're public):
 * - Keep them deliberately vague. Say what kind of work happened, not the
 *   details that matter: "Developed supporting characters", never the
 *   characters' names or plot points.
 * - No sensitive information: no addresses, IPs, hardware model numbers,
 *   account names, or anything from a private repo.
 * - Private projects can appear by name with a generic line, but never get
 *   a link (leave `href` off).
 * - Anything specific (a character, a feature name, a plot beat) is run
 *   past Tariq before it goes in. Claude drafts, Tariq edits and approves.
 *
 * Newest first. `more` links out to a longer write-up on the WordPress blog
 * when there is one.
 */

export type DevLogTag = "Writing" | "Design" | "Code" | "Hardware" | "Planning";

export interface DevLogEntry {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  project: string;
  /** Link to the project's page on this site. Leave off for private projects. */
  href?: string;
  tag: DevLogTag;
  /** One or two vague sentences. */
  summary: string;
  /** Optional longer write-up, usually a post on the WordPress blog. */
  more?: { label: string; href: string };
}

export const devlogIntro =
  "Running notes on what I'm working on across my games, writing and technical projects. Short and deliberately light on spoilers; the finished work speaks for itself.";

export const devlog: DevLogEntry[] = [
  {
    date: "2026-11-20",
    project: "Ethics Engine",
    tag: "Design",
    summary: "Started a second version of the prototype with a new upgrade system.",
    more: {
      label: "Read about version 2",
      href: "https://calsolum.wordpress.com/2026/11/23/ethics-engine-devlog-2-version-2-begins-chips-and-device-upgrades/",
    },
  },
  {
    date: "2026-11-15",
    project: "Ethics Engine",
    tag: "Code",
    summary: "Submitted the prototype to the Epic AI MegaJam, then kept polishing after the deadline.",
    more: {
      label: "Read the jam recap",
      href: "https://calsolum.wordpress.com/2026/11/23/ethics-engine-devlog-1-making-ethics-engine-in-four-days/",
    },
  },
  {
    date: "2026-11-14",
    project: "Ethics Engine",
    tag: "Design",
    summary: "Playtested, reworked the city layout and brought in character art and music.",
  },
  {
    date: "2026-11-12",
    project: "Ethics Engine",
    tag: "Code",
    summary: "Jam weekend: built a playable game prototype in Unreal Engine in four days, with Claude as the coding partner.",
  },
  {
    date: "2026-10-31",
    project: "Ethics Engine",
    tag: "Writing",
    summary: "Wrote the story, characters and world for a new game.",
  },
  {
    date: "2026-11-02",
    project: "Kitchen Hub",
    href: "/projects/kitchen-hub",
    tag: "Code",
    summary: "Added new drink-brewing controls and reusable presets for printed kitchen labels.",
  },
  {
    date: "2026-10-28",
    project: "Smash Up Base Tracker",
    href: "/projects/smash-up-tracker",
    tag: "Code",
    summary: "Built a game-night companion that keeps score at the table and shows the game on the TV.",
  },
  {
    date: "2026-10-28",
    project: "Tabletop label printer",
    tag: "Hardware",
    summary: "Side project: printing game tokens from a phone to a small label printer.",
  },
  {
    date: "2026-10-19",
    project: "Portfolio site",
    tag: "Writing",
    summary: "Reworked every project write-up to show how it was built as well as what it does.",
  },
  {
    date: "2026-10-16",
    project: "Daily Deals",
    href: "/projects/daily-deals",
    tag: "Code",
    summary: "Launched a finder for weekday food specials nearby.",
  },
  {
    date: "2026-10-29",
    project: "CaffeineTracker",
    tag: "Code",
    summary: "Side project: a phone and watch app for tracking caffeine.",
  },
  {
    date: "2026-10-16",
    project: "Orbit",
    tag: "Code",
    summary: "Side project: a custom launcher for an older smartwatch.",
  },
  {
    date: "2026-09-28",
    project: "Alice is Missing Table Assistant",
    href: "/projects/alice-is-missing",
    tag: "Code",
    summary: "Started a table assistant for a tabletop game.",
  },
  {
    date: "2026-09-23",
    project: "FGO Team Builder",
    href: "/projects/fgo-team-builder",
    tag: "Code",
    summary: "Built a team planner for a mobile game.",
  },
  {
    date: "2026-09-06",
    project: "Kitchen Hub",
    href: "/projects/kitchen-hub",
    tag: "Hardware",
    summary: "Started a self-hosted kitchen dashboard.",
  },
  {
    date: "2026-09-02",
    project: "Portfolio site",
    tag: "Code",
    summary: "Launched this site.",
  },
  {
    date: "2026-08-31",
    project: "TeslaUSB Dashcam Add-ons",
    href: "/projects/teslausb-dashcam",
    tag: "Code",
    summary: "Started add-ons for a car dashcam setup.",
  },
  {
    date: "2026-08-29",
    project: "Tragedy Looper Player Aid",
    href: "/projects/tragedy-looper",
    tag: "Code",
    summary: "Started a companion app for a board game.",
  },
  {
    date: "2026-08-28",
    project: "DrunkQuest",
    href: "/projects/drunkquest",
    tag: "Code",
    summary: "Started a digital party game.",
  },
  {
    date: "2026-05-03",
    project: "Mansion of Fate",
    href: "/games/mansion-of-fate",
    tag: "Code",
    summary: "Finished the first playable web build.",
  },
  {
    date: "2025-03-19",
    project: "Mansion of Fate",
    href: "/games/mansion-of-fate",
    tag: "Writing",
    summary: "Returned to the project and reworked the story data.",
  },
  {
    date: "2019-10-03",
    project: "Mansion of Fate",
    href: "/games/mansion-of-fate",
    tag: "Writing",
    summary: "Began work on a visual novel.",
  },
];
