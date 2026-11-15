# Magic Smoke design system (V2)

Dark, precise and calm, with violet and blue light. Every value below lives as a CSS variable in
`app/globals.css`; components use the Tailwind tokens, never raw hex.

## Colour
| Token | Value | Use |
| --- | --- | --- |
| `paper` | #0A0A10 | Page ground |
| `card` | #12121C | Raised surface |
| `raised` | #1A1A2A | Second level, inputs, chips |
| `line` | #2A2A3D | Hairlines |
| `line-strong` | #3B3B55 | Stronger borders, inactive dots |
| `ink` | #ECEAF5 | Primary text |
| `muted` | #A3A1B8 | Secondary text |
| `copper` | #7C5CFF | Primary accent: violet (hover `copper-hover` #9479FF) |
| `blue` | #3D7BFF | Secondary accent |
| `peri` | #A5B4FC | Soft fills, eyebrow labels |
| `ok` | #3DDC97 | Success only: passing checks, "Glove connected", live dots. Never a large fill |
| `warn` | #F5B14C | Warnings |
| `bad` | #FF6B6B | Errors |
| `note` / `note-ink` | #F4E3A1 / #1B1A26 | Sticky-note paper and its text |

The token names `paper`, `ink` and `copper` are kept from V1 so markup did not churn; their values are V2.

Life: two soft radial glows (violet top right, blue bottom left) on the body, a 5% grain overlay, and
`.glass` (66% surface, 14px blur) for overlays. Gradients stay behind content, never become the content.

## Type
- Display: Instrument Serif 400, italic for the accent word. 104 / 72 / 64 / 48 / 40 px, leading 0.9-1.0, tracking -0.02em.
- UI: Geist. 22 / 18 / 16 / 15 / 14 / 13 / 12 px.
- Numbers and specs: Geist Mono. Eyebrows are 11 px mono, uppercase, 0.2em tracking, `peri`.

## Space, radius, elevation
- 8 px grid. Page gutters 48 px, card padding 20-32 px.
- Radius: 10 (rows, small cards), 14-16 (cards), 20 (feature panels), full (buttons, pills).
- Elevation: `--shadow-float` for floating panels, `--shadow-glow` (violet ring + bloom) for the one primary action.

## Motion
- Library: `motion` (Framer Motion). Springs: stiffness 200-220, damping 26-30.
- Page and slide changes slide 60 px with a fade; entrances stagger 80 ms.
- Hover: cards lift 2-4 px, buttons lift 2 px and settle on press, arrows nudge 4 px.
- Loops (diagram cards) cycle in 2.5-4 s. Everything rests under `prefers-reduced-motion` or the Reduce motion setting.

## Layout rules
- One screen per page, no page scroll. One primary action per screen; details go in drawers, popovers and the inspector.
- Short lines over paragraphs. No captions under visuals.
- Equal left and right content edges (`max-w-[1240px] px-12` on story pages).
