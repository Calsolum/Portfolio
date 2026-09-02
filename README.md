# Tariq Singh — Portfolio

Personal portfolio site for Tariq Singh: interactive fiction, novels, poetry, stage and
screen scripts, and self-built technical projects. Most works are readable in full on the
site, and two of the projects are playable in the browser.

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

## Structure

```
src/app/            routes — home, /about, and a category + [slug] pair per section
src/components/     layout (Nav, Footer), home (Hero, Stats), works, ui
src/content/        full text of each work, as HTML fragments
src/data/site.ts    all copy, metadata and links
src/lib/content.ts  content loaders
public/apps/        self-contained playable builds (DrunkQuest, Tragedy Looper)
public/downloads/   script PDFs and the resume
```

## Deploy

Hosted on Vercel, which detects Next.js and needs no build configuration or environment
variables — `next build` is the whole story. Pushes to the production branch
(`portfolio`, also the repo default) deploy automatically; other branches get preview
deployments.

`metadataBase` in `src/app/layout.tsx` reads Vercel's injected `VERCEL_PROJECT_PRODUCTION_URL`
/ `VERCEL_URL`, so Open Graph and canonical URLs stay absolute and correct on production,
previews, and any custom domain added later. Locally it falls back to `http://localhost:3000`.

## Notes

- The design is dark-only by intent; tokens live at the top of `src/app/globals.css`.
- Scroll reveals are progressive enhancement — a `<noscript>` rule keeps content visible
  without JavaScript.
- Contact is a `mailto:` link; there is no form backend.
