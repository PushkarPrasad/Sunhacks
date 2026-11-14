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
   readable; `npm run seed:export` writes JSON for MongoDB.
9. **MATLAB curves are not faked.** `data/matlab/` ships empty apart from a README; the checks engine uses the
   MATLAB tables when the scripts have been run, otherwise the documented simple formula, and the UI says
   which model was used.
