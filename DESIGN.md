# Magic Smoke design system (V4, emerald)

Classy, formal and modern: a private bank or a high-end instrument maker, not a gaming site. Calm,
confident, plenty of space. Every value below lives as a CSS variable in `app/globals.css`;
components use the Tailwind tokens, never raw hex.

## Colour
| Token | Value | Use |
| --- | --- | --- |
| `paper` | #06100C | Page ground (deep green-black) |
| `card` | #0B1914 | Surfaces: cards, panels, sticky notes |
| `raised` | #11231C | Hover fills, popovers, inputs, chips |
| `line` | #1F3A2F | Hairlines |
| `line-strong` | #2C5243 | Active and hovered borders |
| `ink` | #EEF4F0 | Primary text |
| `muted` | #9BB3A7 | Secondary text |
| `faint` | #6B8579 | Labels, table heads, secondary eyebrows |
| `copper` | #0F9D6B | Primary accent: emerald. Primary actions, focus (hover `copper-hover` #14B47C) |
| `emerald-deep` | #0A6B49 | Pressed states, fills, anodized parts in 3D |
| `copper-soft` | rgb(15 157 107 / 0.14) | Selection, soft fills |
| `mint` | #5EE2A8 | Live states only, sparingly (also `ok`) |
| `champagne` | #C8A96A | Fine details only: thin rules, the page eyebrow, numerals. One accent per screen |
| `warn` | #E8B04B | Warnings |
| `bad` | #F0706A | Errors |

Token names `paper`, `ink` and `copper` are kept from V1 so markup did not churn; their values are V4.
`blue` and `peri` are retired: they map to `emerald-deep` and `champagne` so stray markup stays on
palette. Do not use them in new code.

Life: one soft radial emerald glow (top right) on the body and a 2.5% film-grain overlay. `.glass`
is a 72% surface with a 14px blur for overlays. Gradients stay behind content, never become the content.

## Type
- Display: Instrument Serif 400, italic for the accent word. 104 / 72 / 64 / 48 / 40 px, leading 0.9-1.0, tracking -0.02em.
- UI: Geist. 22 / 18 / 16 / 15 / 14 / 13 / 12 px.
- Numbers, specs and eyebrows: Geist Mono. The page eyebrow is `.eyebrow`: 11 px, uppercase, 0.22em
  tracking, `champagne`. Secondary labels use the same mono style in `faint`.

## Components
- Buttons: radius 10 px. Primary is an emerald fill with an inner highlight (`--shadow-btn`, inset
  0 1px 0 white/12%). Secondary is a hairline ghost (`border-line`, brightens to `line-strong`).
  The one main call to action per screen may use `--shadow-glow`: the inner highlight plus a soft
  emerald drop shadow. No glow rings, no neon.
- Segmented controls: 12 px track, 9 px segments. Filter chips 10 px. Status dots and page dots stay round.
- Sticky notes: a `card` surface with ink text and a 2 px left rule: emerald for notes, amber for
  warnings, `bad` for failures. A mono severity label sits above the title. No paper, no tilt, no mascot.
- Cards: 12-20 px radius, `line` hairline, `card` fill.

## 3D
- Keep the HDRI studio. The contact shadow has a very slight green tint; the rim light is a faint green-white.
- Hover and selection emissive is emerald #0F9D6B; x-ray highlight is mint. Outlines and explode
  guides are emerald.
- Materials stay physically plausible: anodized parts are deep emerald or graphite, PCBs are green
  solder mask with copper traces.

## Space, radius, elevation
- 8 px grid. Page gutters 48 px, card padding 20-32 px.
- Elevation: `--shadow-float` for floating panels, `--shadow-note` for notes, `--shadow-glow` for the one primary action.

## Motion
- Library: `motion` (Framer Motion) for entrances; CSS for page transitions and hover.
- Page transitions (`app/template.tsx`): fade plus an 8 px rise, 240 ms, ease-out.
- Hover (`.lift`): cards and ghost buttons rise 2 px and their hairline brightens to `line-strong`.
- Stats count up (`components/ui/CountUp.tsx`, 700 ms ease-out) on the Summary page.
- Nothing animates per frame on top of the 3D views beyond what the scenes already do.
- Everything rests under `prefers-reduced-motion` or the Reduce motion setting.

## Layout rules
- One screen per page, no page scroll. One primary action per screen; details go in drawers, popovers and the inspector.
- Short lines over paragraphs. No captions under visuals.
- Equal left and right content edges (`max-w-[1240px] px-12` on story pages).
