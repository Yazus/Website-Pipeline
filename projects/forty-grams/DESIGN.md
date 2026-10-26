# Forty Grams · Design system

Stage 3 of the pipeline. Durable visual decisions for every Forty Grams surface. Tokens live in
`src/styles.css` under `:root`; the design gate (`stages/design.mjs`) reads them from there and checks
every text pair against WCAG.

## Direction

Dealt by the Taste skill (`draw.mjs`, seed 1834591317): **the name as a monument**. The name is the
headline and it is set as architecture, two stacked lines that run margin to margin. After the hero
the page is small and calm so the contrast holds. The name returns in the footer in inverse colours,
so the page closes like a bracket.

> On this page, **the mill's hourly output** becomes **the monument name**, and the O of FORTY is a
> bowl of usucha seen from above.

The live thing: the hero's corner counts how much the mill has ground today, in Edinburgh time.

## Colour · drenched

The dealt palette was navy and pink. The subject has an unmistakable colour of its own, so we kept the
dealt proportions (one field the whole way down, one ink doing everything) and took the colours from the
tea itself. Recorded as a palette substitution, not a redraw.

| Token | Value | Job |
| --- | --- | --- |
| `--bg` | `#a4bd4c` | Matcha powder. The field for the whole page |
| `--surface` | `#97b142` | One tone step down: menu bars, alternating contact rows |
| `--ink` | `#15220e` | Every word, the one button, the footer field |
| `--ink-soft` | `#2c4118` | Secondary notes only, never running text |
| `--foam` | `#dfe8a6` | Whisked foam. Artwork grounds and the footer's soft ink |

Contrast: ink on bg 7.9:1, ink on surface 6.8:1, soft ink on bg 5.0:1, bg on ink 7.9:1.

## Type

| Role | Face | Setting |
| --- | --- | --- |
| Monument | Unbounded 800, uppercase | Tracking -0.04em, leading 0.82, sized to the width |
| Headings | Unbounded 800, uppercase | 28–44px, deliberately modest |
| Statements, stairs, contact rows | Onest 500 | Display sizes, tracking -0.03em |
| Body | Onest 400 | 17–19px, leading 1.5, measure under 70ch |

Five size steps: small, body, lead, head, display, plus the monument.

## Shape, depth and motion

- Square corners everywhere except the round arrow button. No shadows at rest, no rules, no gradients in CSS.
- Easing from Emil Kowalski's design-engineering rules: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` for
  entrances and feedback, `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)` for things moving on screen.
- Signature move: the monument scales down by 6% as the hero leaves; the footer wordmark grows into place.
- Every control presses to `scale(0.97)` in 140ms. Section parts enter staggered 70ms, rising 20px.
- `prefers-reduced-motion` keeps every element and drops the travel.

## Imagery

No photography exists yet, and the open collections could not be reached from the build machine, so the
cafe's own objects are drawn: the bowl, the stone mill and the four tins, in one screen-print language
(flat inks from the palette plus grain). Sources are in `art/*.svg`, rendered by the art stage. Replace
with photography after the shoot; the slots are 1:1, 4:5 and 9:14.
