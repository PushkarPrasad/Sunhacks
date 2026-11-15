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
10. **Hoop Upload is a basketball gag in the Builder (V2).** The V1 upload service was removed. Importing a build
    means throwing a file-ball through a hoop (mouse/trackpad only, own 2D physics loop instead of matter-js to avoid
    a dependency); "Just upload it" skips the game. KiCad files are accepted but not converted yet.
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
17. **V3: Calibration tab added at the owner's request** (`/calibrate`): a 3-step wizard (keep still 2 s within 3°,
    tilt roll ±30° and pitch ±25° from that zero, grab + twist > 45°) on the shared glove/input store. Its logic is pure
    (`lib/input/calibration.ts`) and unit-tested. The board still calibrates its gyro at power-on.
18. **V3: fist held 450 ms = grab, shorter fist tap = collapse.** Both rules from the fusion table need the fist; the hold
    time separates them. A 150 ms gap is tolerated so a held fist does not drop mid-twist.
19. **V3: the duplicate filter now ignores the source.** The spec says a second event of the same type from either
    source within 300 ms is dropped, so a repeated glove flick inside 300 ms is dropped too.
20. **V3: the camera engine moved out of React** (`lib/input/camera.ts`) so the glove click handler can call
    getUserMedia before any await. The Settings toggle and the glove share it.
21. **V3 categories.** The twelve-tile order from the spec. New categories got real starter builds (two each) so
    every tile opens something that passes the checks engine. Tablets, Projectors, Game Consoles and Cameras are not
    in the new list; they stay routable (kind "hidden") and are named on the More tile. Phones and Laptops merged into
    one tile with a Phone/Laptop toggle.
