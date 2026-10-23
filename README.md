# Tariq Singh — Portfolio

Personal portfolio site for Tariq Singh: interactive fiction, novels, poetry, stage and
screen scripts, and self-built technical projects. Most works are readable in full on the
site, two of the projects are playable in the browser, the FGO Team Builder runs at `/fgo`, the Daily
Deals finder runs at `/deals`, and the Smash Up Base Tracker runs at `/smash-up`.

Built with Next.js (App Router), TypeScript and Tailwind CSS v4. Every page is statically
prerendered; the only server code is the web-search API route behind `/deals` and the shared-game
API behind `/smash-up`.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

```bash
npm run build    # production build (also type-checks)
npm run start    # serve the production build
npm run lint     # eslint
npm test         # vitest (FGO Team Builder engine, Daily Deals, Smash Up Base Tracker)
```

## Editing the site

**Copy, metadata and links — `src/data/site.ts`.** One file holds the profile, nav, section
headings, work blurbs, pull quotes, tags, project stacks, the experience timeline, education
and skills. Most edits start and end here.

**Long-form writing — `src/content/*.html`.** Each work's full text lives in its own HTML
fragment, named after the work's `slug` in `site.ts`. The fragments use a small tag set
(`p`, `em`, `strong`, `h2`, `hr`, `ul`/`li`, `a`) and are styled by `.prose-reading` in
`src/app/globals.css`. Everything before the first `<hr />` is treated as the standfirst.

These were imported once from a WordPress export by
`scripts/extract-wordpress-content.py` and have been hand-edited since — re-running that
script overwrites them.

**Adding a work.** Add an entry to `works` (or `projects`) in `src/data/site.ts`, then drop
a matching `src/content/<slug>.html`. The category index and reading page pick it up
automatically via `generateStaticParams`.

## Updating the resume

The resume at `public/downloads/tariq-singh-resume.pdf` (linked from `/about`) is a static
file. It is **not** generated from `src/data/site.ts`, and the published copy has been edited
after export to remove private contact details. A fresh export needs those edits reapplied
every time:

1. **Export a fresh PDF** from the resume source and keep it **outside this folder**. The
   repo is public on GitHub, so the unredacted export must never be committed.
2. **Install the one dependency** (first time on a machine): `pip install pikepdf`.
3. **Strip the phone number, postal code and PDF metadata.** Pass the phone number exactly
   as it appears on the resume (digit groups separated by dashes). It's given at run time so
   the number is never written into this public repo:

   ```bash
   python scripts/redact-resume.py <fresh-export.pdf> redacted.pdf <phone-number>
   ```

4. **Swap the email to the site's address** (`tariq@live.ca` → `tariq@tariqsingh.ca`, to
   match `profile.email` in `site.ts`):

   ```bash
   python scripts/update-resume-email.py redacted.pdf public/downloads/tariq-singh-resume.pdf
   ```

   Skip this step if the export already shows `tariq@tariqsingh.ca`. The script stops with
   "could not find 'live'" when there's nothing to swap; in that case copy `redacted.pdf` to
   `public/downloads/tariq-singh-resume.pdf` instead.
5. **Check the result before committing.** Open the PDF and search it (Ctrl+F) for the phone
   number and postal code; neither should be found. The header should read
   `tariq@tariqsingh.ca | Brampton, Canada`. Then delete `redacted.pdf`.
6. **Ship it** through a PR like any other change, and open
   <https://tariqsingh.ca/downloads/tariq-singh-resume.pdf> once it has deployed.

**If a script fails**, the resume's header layout has probably changed. Both scripts match
exact text runs in the PDF's header line: `redact-resume.py` looks for the first and last
digit groups of the phone number you pass in, plus `POSTAL_PREFIX`, and
`update-resume-email.py` looks for `OLD_LOCAL`.
Update those to match the new export, then rerun from step 3. On macOS or Linux, use
`python3` in place of `python`.

## Structure

```
src/app/            routes — home, /about, and a category + [slug] pair per section
src/components/     layout (Nav, Footer), home (Hero, Stats), works, ui
src/content/        full text of each work, as HTML fragments
src/data/site.ts    all copy, metadata and links
src/fgo/            FGO Team Builder: atlas/ (API client + cache), engine/ (battle sim + search), state/, ui/
src/deals/          Daily Deals: lib/ (geo, OpenStreetMap, matching, validation), data/ (checked deals),
                    server/ (web search, cache, limits), ui/
src/smashup/        Smash Up Base Tracker: data/ (sets, bases, factions), lib/ (scoring, game replay,
                    checks), state/, sync/ (shared games), server/ (rooms API), ui/
src/app/api/        API routes: deals/web (the web search behind /deals) and smash-up/rooms (shared games)
src/lib/            content loaders, and the rate limiter both API routes use
public/apps/        self-contained playable builds (DrunkQuest, Tragedy Looper)
public/downloads/   script PDFs and the resume
```

## Deploy

Hosted on Vercel, which detects Next.js and needs no build configuration. Two things are optional
and switched on by environment variables: `ANTHROPIC_API_KEY` for web search on `/deals`, and an
Upstash Redis database for shared games on `/smash-up` (both below). Without them `next build` is
the whole story. Pushes to the production branch
(`portfolio`, also the repo default) deploy automatically; other branches get preview
deployments.

Live at [tariqsingh.ca](https://tariqsingh.ca). The apex is the canonical domain and
`www.tariqsingh.ca` 308-redirects to it, so `VERCEL_PROJECT_PRODUCTION_URL` — and therefore
every Open Graph and canonical URL — resolves to the bare domain.

`metadataBase` in `src/app/layout.tsx` reads Vercel's injected `VERCEL_PROJECT_PRODUCTION_URL`
/ `VERCEL_URL`, so Open Graph and canonical URLs stay absolute and correct on production,
previews, and the custom domain — no code change needed when the domain changed. Locally it
falls back to `http://localhost:3000`.

## Daily Deals (`/deals`)

Weekday food specials near a place, from two sources: a checked list in `src/deals/data/curated.ts`
and a web search by Claude. Nearby places come from OpenStreetMap (Overpass: four public servers,
with a slow one joined by the next rather than waited for) and locations from Nominatim, both called
from the visitor's browser.

**Switching on web search.** Without a key everything works except web search. On load the page asks
`/api/deals/web?status=1` whether a key is set and, if not, leaves the web search panel out, so
visitors never meet a button that does not work. Environment variables only reach a new deployment,
so redeploy after adding the key (the answer is cached for about a minute).

1. In the Claude Console, create a workspace just for this site and set a **monthly spend limit**
   on it. That limit is the real ceiling on cost; the in-app limits below are only brakes.
2. Create an API key in that workspace and add it to the Vercel project as `ANTHROPIC_API_KEY`
   (Production, and Preview if you want to try it on previews).
3. To try it locally, put the same line in `.env.local`, which git ignores.

**What a search costs.** A search by Claude, with up to six web searches ($10 per 1,000) and three
page fetches, is roughly 25 cents to a dollar. Every search logs one `[deals-web]` line in the
Vercel logs with token counts, search count and an estimate in dollars, so the real figure is
visible. A result is cached for a week per 5 km grid square and shared by every visitor, and an
empty result is cached too. On top of that each visitor may start 5 new searches per 10 minutes and
the site 20 per hour (per server instance). The model is the `MODEL` constant in
`src/deals/server/webSearch.ts`; keep the `PRICE` constants beside it in step when it changes, and
bump `PROMPT_VERSION` to throw away every cached search after editing the prompt.

**Function time limit.** A new search can run for a couple of minutes, so the route sets
`maxDuration = 300`. That needs Vercel's Fluid compute, which is on by default for new projects; on
a project without it the Hobby plan caps functions at 60 s and the deploy will say so.

**Trusting the results.** The server keeps a web deal only if its source link is a page the search
or fetch tools actually returned in that same response, and re-checks days, text lengths and links.
The browser checks the result again before showing it, because it also reads results back from
`localStorage`.

**Updating the checked list.** The rules are at the top of the data file: the source page itself
must state the weekday, food deals only, no every-day happy hours or limited-time promotions.
For a chain, add its Wikidata ID (open any branch on openstreetmap.org and read `brand:wikidata`)
and its names. For a single venue, add its OpenStreetMap ID and coordinates. Cards older than 90
days are marked as possibly out of date, so re-read the source and bump `verified` now and then.
When a source gives an end date, set `until` (YYYY-MM-DD) and the deal hides itself the day after;
the three Swiss Chalet entries use it, because that chain says its daily deals end on 2026-10-31,
so check its specials page then.
`npm test` checks the file (unique IDs, valid weekdays, https sources, well-formed Wikidata and
OpenStreetMap IDs) and checks the pinned venues against a real OpenStreetMap response.

**Who sees what.** Overpass receives a position rounded to about 100 m and Nominatim receives
either the typed place or that rounded position. This site's server sees only a 5 km grid-square ID,
and only when someone presses the web search button. The visitor's exact position stays in the
browser.

## Smash Up Base Tracker (`/smash-up`)

A table-side tracker for Smash Up: power, power until the end of the turn and minions on every base
(a minion and its power can be entered in one tap from a power pad), scoring by the rulebook (ties,
who is eligible, and seven bases whose extra VP it can work out), VP to the target, the turn handed
to any player for extra turns, Madness with its end-of-game VP cost, factions per player, a history
of finished games with stats and rematches. A game is stored as a list of actions and the board is
replayed from it, which is what makes undo exact and sharing safe. The logic is in
`src/smashup/lib/` and is covered by `npm test`.

**Opening with no signal.** `public/smash-up-sw.js` is a service worker scoped to `/smash-up`,
registered only in production builds. It fetches the page from the network first and falls back to
its stored copy, with the build files that copy needs, so the page opens offline once it has been
opened online; sharing still needs a connection. To retire it, replace the file with one that calls
`self.registration.unregister()` and deletes its caches, since a deleted file leaves installed
copies running.

**Switching on shared games.** One phone works with nothing set up. To let every phone at the table
join a game by code or QR, the site needs a small Redis database:

1. In the Vercel dashboard, open the project's **Storage** tab, create an **Upstash for Redis**
   database on the free plan and connect it to this project (Production, and Preview if wanted).
   It adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`; the code also accepts Upstash's own names,
   `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
2. Redeploy, since environment variables only reach new deployments.

Until then the page asks `/api/smash-up/rooms?status=1`, gets `{"sync":false}` and leaves the Share
and Join controls out. The answer is cached for about a minute.

**What sharing uses.** Phones poll every 1.5 s just after a change and every 4 s when the table is
quiet, and not at all while hidden; each poll and each tap is one Redis command. A four-player
evening is roughly 8,000 to 15,000 commands, well inside the free tier's monthly allowance. If the
allowance runs out, sharing stops until it resets and single-phone games carry on. A room is
deleted 48 hours after its last change and holds at most 5,000 changes, and the API limits how fast
one address can create rooms and send changes (per server instance).

**Trying sharing locally.** `npm run dev` keeps rooms in memory, so two tabs can share a game
without a database. For `npm run start`, put `SMASHUP_ROOMS=memory` in `.env.local`. Rooms in memory
vanish when the server restarts.

**Updating the base list.** `src/smashup/data/` holds every set, base and faction, read from the
Smash Up Wiki's [Bases](https://smashup.fandom.com/wiki/Bases) and
[Factions](https://smashup.fandom.com/wiki/Category:Factions) pages (names and numbers only; card
text is AEG's). The page source is easiest to read through the wiki's API,
`https://smashup.fandom.com/api.php?action=parse&page=Bases&prop=wikitext&format=json`, where
struck-through lines are old wordings. For a new set, add it to `sets.ts`, its bases and factions to
`bases.ts` and `factions.ts`, and its counts to the table in `src/smashup/__tests__/data.test.ts`;
`npm test` then checks ids, sets, numbers and counts.

**Who sees what.** Games, settings and history stay in the browser's local storage. A shared game
is stored on the server under its code until it expires, and holds only what the players typed
(names, factions, bases and taps).

## Notes

- The design is dark-only by intent; tokens live at the top of `src/app/globals.css`.
- Scroll reveals are progressive enhancement — a `<noscript>` rule keeps content visible
  without JavaScript.
- Contact is a `mailto:` link; there is no form backend.
- Traffic is measured with Vercel Web Analytics (`<Analytics />` in `src/app/layout.tsx`).
  It is cookie-free and only reports from Vercel deployments — nothing is sent in local
  dev. Data appears under the project's **Analytics** tab in the Vercel dashboard once Web
  Analytics is enabled there.
