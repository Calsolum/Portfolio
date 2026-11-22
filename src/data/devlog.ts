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
];
