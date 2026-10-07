# Tariq Singh — Portfolio

Personal portfolio site for Tariq Singh: interactive fiction, novels, poetry, stage and
screen scripts, and self-built technical projects. Most works are readable in full on the
site, two of the projects are playable in the browser, and the FGO Team Builder runs at `/fgo`.

Built with Next.js (App Router), TypeScript and Tailwind CSS v4. Every route is statically
prerendered.

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
npm test         # vitest (FGO Team Builder engine)
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
src/lib/content.ts  content loaders
public/apps/        self-contained playable builds (DrunkQuest, Tragedy Looper)
public/downloads/   script PDFs and the resume
```

## Deploy

Hosted on Vercel, which detects Next.js and needs no build configuration or environment
variables — `next build` is the whole story. Pushes to the production branch
(`portfolio`, also the repo default) deploy automatically; other branches get preview
deployments.

Live at [tariqsingh.ca](https://tariqsingh.ca). The apex is the canonical domain and
`www.tariqsingh.ca` 308-redirects to it, so `VERCEL_PROJECT_PRODUCTION_URL` — and therefore
every Open Graph and canonical URL — resolves to the bare domain.

`metadataBase` in `src/app/layout.tsx` reads Vercel's injected `VERCEL_PROJECT_PRODUCTION_URL`
/ `VERCEL_URL`, so Open Graph and canonical URLs stay absolute and correct on production,
previews, and the custom domain — no code change needed when the domain changed. Locally it
falls back to `http://localhost:3000`.

## Notes

- The design is dark-only by intent; tokens live at the top of `src/app/globals.css`.
- Scroll reveals are progressive enhancement — a `<noscript>` rule keeps content visible
  without JavaScript.
- Contact is a `mailto:` link; there is no form backend.
- Traffic is measured with Vercel Web Analytics (`<Analytics />` in `src/app/layout.tsx`).
  It is cookie-free and only reports from Vercel deployments — nothing is sent in local
  dev. Data appears under the project's **Analytics** tab in the Vercel dashboard once Web
  Analytics is enabled there.
