# Working in this repo

This is a website pipeline. Read PIPELINE.md before changing a project or a gate.

- New site: `npm run new -- <slug> "<Name>"`, then fill `brief.yaml` with facts and an inventory
  before any design. Use the Taste skill to deal a direction (`draw.mjs --options 3`), Impeccable for
  the craft floor and critique, and Emil Kowalski's skill for motion. Record the direction and seed in
  the project's DESIGN.md.
- Iterate with `npm run pipeline -- <slug>` and read every screenshot in `reports/<slug>/shots/`
  after the last change. Fix every failure; never loosen a threshold in `pipeline.config.mjs` to get
  green. A real exception goes in the project's `waivers:` with a reason.
- Never fill in someone else's sign-off in `approvals.yaml`. Never invent reviews, quotes, logos or
  business numbers. Sample content is listed in the brief and the report.
- Gates must stay deterministic and runnable offline except for the Lighthouse/axe tooling in
  node_modules. Firefox and WebKit may be missing locally; CI installs them.
