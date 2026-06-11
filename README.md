# pruthvishetty.com

Personal site of Pruthvi Shetty — hand-built with [Astro](https://astro.build),
typeset in Fraunces & Newsreader, and powered by an unreasonable amount of chai.

## Develop

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # production build → dist/
npm run preview    # serve the production build locally
```

## Publish

Push to `main` — GitHub Actions builds and deploys to GitHub Pages automatically
(`.github/workflows/deploy.yml`). One-time setup: repo **Settings → Pages →
Source: GitHub Actions**.

## Write a poem

Two ways:

1. **From anywhere:** visit `/write`, unlock with the password, write with live
   preview, hit *Publish* — it commits the markdown to `src/content/poems/` via
   the GitHub API and the site rebuilds in about a minute.
2. **From this repo:** drop a markdown file in `src/content/poems/` with
   `title`, `date`, and optional `theme` frontmatter.

To enable in-browser publishing, seal a token once:

```bash
npm run encrypt-token
```

Use a [fine-grained PAT](https://github.com/settings/personal-access-tokens)
scoped to **this repo only** with **Contents: Read and write**. The token is
encrypted with AES-256-GCM (key derived from your password via PBKDF2, 310k
iterations) into `public/write/token.enc.json`, which is safe to commit.
Without the password the blob is unreadable; until it exists, `/write` runs in
local-draft mode.

## Map

```
src/
  layouts/      BaseLayout (nav, footer, theme, SEO) · ToolLayout (tool chrome)
  components/   Nav, Footer
  content/      poems/*.md (content collection)
  pages/        index · writing · poems/[slug] · tools/* (11 tools) · write · 404
  scripts/      site.js — theme, reveals, clock, year progress, and the secrets
  styles/       global.css — the design system (paper, ink, chai)
public/
  assets/       images (the city postcards live here)
  family-tree/  password-gated family tree (static passthrough)
scripts/
  encrypt-token.mjs   seal the GitHub token for /write
```

The tools under `/tools` are 100% client-side — no data ever leaves the
browser. Keep it that way.

P.S. Try typing `chai` on any page. Or the Konami code.
