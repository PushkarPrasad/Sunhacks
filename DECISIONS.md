# Decisions

Judgment calls made while building, newest last.

1. **Product name: Copperline.** The brief has no name; copper is the accent colour and the PCB trace motif.
2. **Next.js 16.4 with Cache Components on** (the create-next-app default). Category routes use
   `generateStaticParams`; everything that reads the persisted build (localStorage) is a client component.
3. **Circuit generation runs on the server** (`/api/circuit`, Node runtime) with `@tscircuit/core` marked as a
   server external package. It pulls in WASM and solver packages that are heavy to ship to the browser; the
   same code is reused by exports and Vitest.
4. **Non-React tscircuit API.** Each placed module becomes a `Chip` whose footprint is a header pattern that
   matches the module (e.g. `dip38_w25.4mm` for an ESP32 DevKitC, `pinrow4` for a 4-pin breakout,
   `pinrow40_rows2` for a Pi header). Traces reference pins by number (`.U1 > .pin21`) so duplicate labels
   such as several GND pins are safe.
5. **Own placement packer.** tscircuit skips autorouting when footprints overlap, so modules are shelf-packed
   by their physical outline (larger of datasheet dimensions and footprint bounds) plus a 3 mm gap; the board
   is sized to the packed area plus margins and four M3 mounting holes.
6. **3D board view is our own react-three-fiber scene built from Circuit JSON** (board outline, plated holes,
   traces, header bodies, module outlines) instead of `@tscircuit/3d-viewer`, which pins its own
   three/fiber versions that conflict with React 19 + fiber 9. Same data, consistent styling.
7. **Arrow keys:** move between items in the focused group (grids, palette, blocks). When nothing inside the
   page has focus, Left/Right change page. Shift+Left/Right always change page. In the builder canvas,
   arrows nudge the selected module.
8. **Parts seed is TypeScript (`data/parts.ts`)** with small helpers for pin lists, so 38-pin controllers stay
   readable. The app reads the seed directly; MongoDB stores saved builds (a catalogue seed script is still to do).
9. **MATLAB curves are not faked.** `data/matlab/` ships empty apart from a README; the checks engine uses the
   MATLAB tables when the scripts have been run, otherwise the documented simple formula, and the UI says
   which model was used.
10. **Hoop Upload endpoint is configurable.** Hoop's API was not available during the build, so `/api/hoop`
    packages Gerbers + BOM + Circuit JSON + build JSON and POSTs multipart to `HOOP_UPLOAD_URL` with
    `Authorization: Bearer HOOP_API_KEY`. Without it, it is a labelled mock that downloads the package.
11. **Board page is a quad view** (Schematic, PCB, 3D, Parts) sharing one selection. Selection maps designators to
    the `data-pcb-component-id` / `data-schematic-component-id` attributes circuit-to-svg emits.
12. **Anatomy figures** (numbered callouts with leader lines) for Phones, Laptops and Projectors only, per the
    draft scope; other categories use the plain exploded view.
13. **Draft scope** set by the owner: firmware, MATLAB, Solana, Tiger Data, multilingual notes, Snake, Maritime,
    Lambda, Docker, voice and haptics are deferred. Code that already existed for some of these stays in place.
14. **Violet stays despite the Taste Skill.** Taste's "Never" list bans violet in a page's own design; the owner's V2
    spec explicitly sets violet #7C5CFF as the primary accent, so the owner's spec wins. The rest of Taste's rules
    (hero alone on its screen, one section per screen, hover answers, no captions, verb+object buttons) apply.
15. **V1 token names kept** (`paper`, `ink`, `copper`) with V2 values, so the palette swap touched one file.
16. **Webcam preview removed**; hand tracking still turns on from Settings and shows only the ring cursor
    (the Calibration wizard, where the preview belongs, is deferred).
