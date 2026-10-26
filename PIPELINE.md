# The pipeline

How a site moves from first call to launch. Seven stages, each with an owner, a deliverable, a gate
the machine checks and a sign-off a person gives. A stage is done when its gate passes **and** its
sign-off is recorded in `approvals.yaml`. Nothing skips a stage; a waiver is written down with its
reason and printed in the review report.

| Stage | Owner | Deliverable | Machine gate | Human sign-off |
| --- | --- | --- | --- | --- |
| 1. Brief and discovery | Strategist | `brief.yaml` | `brief` | Client: brief |
| 2. Content | Copywriter | Copy in `src/`, confirmed facts | `content` | Client: content |
| 3. Design system | Designer | `DESIGN.md`, tokens in `styles.css`, `art/` | `design` | Studio: design direction |
| 4. Build | Developer | `src/` → `dist/` | `lint`, build succeeds | — |
| 5. QA | QA lead | `reports/<slug>/results.json` | `a11y`, `responsive`, `browsers`, `seo`, `perf`, `taste` | — |
| 6. Review | Studio lead + client | `reports/<slug>/report.html` | QA ran on the current build | Studio: QA review |
| 7. Deploy | Developer | `public/<slug>/` | QA passed on this exact build | Client: launch (production only) |

## 1. Brief and discovery

The brief is facts, not adjectives. It names the one action the site exists for, what a visitor must
know within five seconds, who they are, and the **inventory**: eight to twelve things that belong to
this client and no competitor (its name and what it means, its street, its numbers, the constraint it
lives with, its materials and rituals). The idea for the design comes from this list, never from the
category. The brief also picks the surface's **mode** (Impeccable): persuade, operate, read or
experience, because that decides how much the design is allowed to perform.

Gate `brief`: every required field filled, no TODO, an absolute site URL, a valid mode, an inventory
of at least five items.

## 2. Content

Write the whole page as copy before markup. Every section opens with a heading that names it; every
headline fits on two lines at every width (about 32 characters is safe); every section the visitor
came for carries its full content (the whole menu with prices, every room, every speaker). Proof is
never invented: no quotes, reviews, logos or numbers that the client did not supply.

Gate `content` (runs on the built pages): no placeholder text, no stock phrases ("elevate",
"seamless", "curated", "journey"…), no social proof on sample projects, no vague link text, headlines
short enough to set large, enough words that sections are not thin.

## 3. Design system

1. **Draw a direction, don't default to one.** With the Taste skill installed, deal three directions
   (`draw.mjs --options 3`), choose the one that can carry an item from the inventory, then deal its
   full sheet. Record the seed. Taking the dealt direction is the point: the familiar layout is the
   one this step exists to prevent.
2. **Write the idea sentence**: "On this page, *something only this client has* becomes *the device
   the direction calls for*." Put the nearest competitor in it; if it still works, start again.
3. **Commit tokens**: colour roles with every text/ground pair listed in `pipeline.yaml` under
   `design.pairs`, two typefaces at most, five type steps, one radius, one button shape.
4. **Motion rules** (Emil Kowalski): strong ease-out curves, nothing over 300ms for UI, press feedback
   on every control, nothing scales from 0, one signature move, a reduced-motion fallback for all of it.
5. **Imagery**: the client's own, then generated, then real pictures of the client's world from open
   collections (credited), then drawn in code from the subject. Never stock that pretends to be the
   client. Sources for drawn work live in `art/*.svg` and are rendered by the art stage.

Gate `design`: every declared contrast pair meets its minimum; at most two families; and the craft
floor and anti-template rules: themed selection, focus and scrollbars; no CSS gradients, glass, hard
offset shadows, monospace costume, tracked tiny caps, eyebrow labels or index numbers; no
`transition: all`, no ease-in, nothing scaling from 0, reduced motion handled.

## 4. Build

Static HTML, CSS and a little progressive JavaScript: the page reads completely with scripts off.
`npm run art` renders artwork masters; `npm run build` makes responsive WebP sets, minifies CSS with
Lightning CSS (adding the prefixes our browser targets need), inlines it, and writes `robots.txt` and
`sitemap.xml` from the brief.

Gate `lint`: html-validate (recommended rules), stylelint (standard config), JavaScript syntax.

## 5. QA

All gates run on `dist/`, served over HTTP the way visitors get it.

- `a11y`: axe-core, WCAG 2.2 AA plus best practices, at 390, 768 and 1440px, with and without reduced
  motion; then a keyboard walk that checks every stop is reachable, visibly focused and on screen.
- `responsive`: nine widths from 320 to 1920. No sideways scroll, no text under 13px, no target under
  24px (WCAG 2.2) and a warning under 44px on phones, headings within two lines, nothing left
  invisible by an entrance that never fired. Screenshots for review.
- `browsers`: Chromium, Firefox and WebKit at phone and desktop. No script or console errors, no
  failed requests, fonts and images loaded, no sideways scroll, landmarks within 5% across engines.
  Engines missing locally are reported; CI always runs all three.
- `seo`: title and description lengths, canonical, `lang`, one h1 and an unbroken outline, Open Graph
  and Twitter cards, JSON-LD that parses, favicon, alt text, robots and sitemap, and every internal
  link, anchor and asset resolving.
- `taste` (optional): the Taste skill's own lint and real-browser inspector. Set `TASTE_SKILL_DIR`.
- `perf`: Lighthouse mobile and desktop. Mobile: performance ≥ 90; desktop ≥ 95; accessibility 100;
  best practices and SEO ≥ 95. LCP ≤ 2.5s, CLS ≤ 0.1, TBT ≤ 200ms, first load ≤ 1000 KB.

Thresholds live in `pipeline.config.mjs`. A project may tighten them in its `pipeline.yaml`; it may
only loosen one through a `waivers:` entry with a reason.

## 6. Review

`npm run review` writes one page: the verdict, every gate and its findings, Lighthouse scores, the
tokens and their contrast, the page at phone, tablet and desktop, each engine's render, and the
sign-off table. If the build changed after QA ran, the report says so and the verdict fails.

Look before you sign. Passing the gates means nothing banned was measured; it does not mean the page
is good. Critique the screenshots (Impeccable `critique`, Taste `references/critique.md`), fix the top
three problems, run again.

## 7. Deploy

`npm run deploy -- <slug>` refuses unless the last full QA run passed on this exact build (a hash of
every file in `dist/`). A preview copies the site and its review report to `public/<slug>/`.
`--production` also requires every sign-off in `approvals.yaml` and a project that is not a sample.
CI publishes `public/` to GitHub Pages from `main` only when every project is green.

## Starting a project

```bash
npm run new -- <slug> "<Client name>"   # copies templates/project
# fill in projects/<slug>/brief.yaml, then iterate:
npm run pipeline -- <slug>             # art → build → check → review
npm run deploy -- <slug>               # preview
```
