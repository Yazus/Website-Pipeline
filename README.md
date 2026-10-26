# Website Pipeline

A studio pipeline for building websites the way a good agency does: a brief with real facts, copy
before markup, a design system with measured contrast, a static build, ten automated QA gates, a
review page people sign, and a deploy that refuses anything QA didn't pass.

**Example:** [Forty Grams](projects/forty-grams/), a matcha cafe and tea shop whose granite mill
grinds forty grams an hour. Preview: https://yazus.github.io/website-pipeline/forty-grams/ (once
GitHub Pages is on; see below).

| | |
| --- | --- |
| Lighthouse, mobile | 99 performance · 100 accessibility · 100 best practices · 100 SEO |
| Lighthouse, desktop | 100 · 100 · 100 · 100 |
| First load | 164 KB, LCP 1.8s, CLS 0 |
| axe (WCAG 2.2 AA) | 0 violations at 390, 768, 1440px, with and without reduced motion |
| Responsive | 9 widths, 320–1920px, no failures |

## Quick start

```bash
npm ci
npx playwright install --with-deps chromium firefox webkit
npm run pipeline -- forty-grams   # art → build → check → review
open reports/forty-grams/report.html
npm run deploy -- forty-grams     # preview into public/forty-grams/
```

Start your own: `npm run new -- <slug> "<Client name>"`, then fill in `projects/<slug>/brief.yaml`.
The brief gate blocks everything else until it's complete.

## The stages

1. **Brief and discovery** (`brief.yaml`): goal, audience, mode, and an inventory of what belongs to
   this client and no one else.
2. **Content**: the whole page as copy, full menus and prices, no invented proof.
3. **Design system** (`DESIGN.md`, tokens): a dealt direction, an idea sentence, tokens with contrast.
4. **Build** (`src/` → `dist/`): responsive images, minified and inlined CSS, sitemap and robots.
5. **QA**: brief · content · design · lint · a11y · responsive · browsers · seo · taste · perf.
6. **Review** (`reports/<slug>/report.html`): every finding, every width, every engine, every sign-off.
7. **Deploy** (`public/<slug>/`): preview on QA pass; production only with every sign-off.

[PIPELINE.md](PIPELINE.md) has each stage's owner, rules and definition of done.

## Design skills

The UI work follows three Claude skills. Install them in Claude to use them when building a project:

- **Taste** ([Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill)): deals art directions
  from a library of studied gallery sites, enforces house rules against the generated-page look, and
  inspects the rendered page. Set `TASTE_SKILL_DIR` to run its inspector as the `taste` gate.
- **Impeccable** ([pbakaus/impeccable](https://github.com/pbakaus/impeccable)): surface modes, the
  craft floor (themed browser surfaces, states, contrast), critique and polish passes.
- **Emil Kowalski's design engineering** ([emilkowalski/skill](https://github.com/emilkowalski/skill)):
  easing, timing, press feedback, interruptible motion.

The `design` gate encodes the parts of all three that a machine can check.

## CI and previews

`.github/workflows/pipeline.yml` runs every project through the pipeline on pull requests and on
`main`, in Chromium, Firefox and WebKit, and keeps the review reports as an artifact. On `main`, when
every project is green, it publishes `public/` to GitHub Pages. Turn Pages on once under
**Settings → Pages → Source: GitHub Actions**. To add the Taste inspector in CI, set the repository
variable `TASTE_SKILL` to `true`.

## Layout

```
bin/site.mjs              the CLI (npm run site -- help)
pipeline.config.mjs       studio thresholds: widths, a11y tags, Lighthouse budgets
stages/                   one module per stage; stages/qa/ holds the gates
templates/project/        what `npm run new` copies
projects/<slug>/          brief.yaml · DESIGN.md · approvals.yaml · pipeline.yaml · art/ · src/
reports/<slug>/           results.json · report.html · screenshots · Lighthouse (generated)
dist/, public/            build output and deployable previews (generated)
```
