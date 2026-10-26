# Forty Grams (example project)

A matcha cafe and tea shop on Calder Lane, Leith, built around a granite stone mill that grinds forty
grams of matcha an hour. A sample client, made to show the pipeline end to end.

- **Direction:** Taste skill, "The name as a monument" (seed 1834591317). The dealt navy-and-pink
  palette was swapped for the tea's own colours, keeping its proportions.
- **Idea:** the mill's hourly output becomes the monument name; the O of FORTY is a bowl of usucha
  seen from above.
- **Live thing:** the hero's corner counts how much the mill has ground today, in Edinburgh time
  (and says when it is resting).
- **Signature move:** the name sinks 6% as the first screen leaves; the footer wordmark grows into place.

## Replace before a real launch

- Sample facts: address (18 Calder Lane, EH6 6QR), phone (0131 496 0140 is an Ofcom drama number),
  email (`hello@fortygrams.example`), hours, menu items and prices, tin prices, delivery terms.
- Tin orders open a pre-filled email; wire a real shop.
- Imagery is drawn in code (`art/*.svg`): the bowl, the stone mill, four tins and the social card.
  The open picture archives were unreachable from the build machine, so there is no photography or
  footage yet. Slots are 1:1 (bowl), 4:5 (mill) and 9:14 (tins).

## Fonts

Unbounded and Onest, both SIL Open Font License 1.1, self-hosted from `src/fonts/`. See
[fonts-OFL.txt](fonts-OFL.txt).
