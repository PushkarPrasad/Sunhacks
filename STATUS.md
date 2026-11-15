# Status (paused mid-build: usage limit reached)

## Done and verified
- **Data**: 69 parts with datasheet values and per-field `unverified` tags (`data/parts.ts`), 12 categories in the exact order with 3D architecture blocks (`data/categories.ts`), 22 templates including Gesture Ring and the hidden Soda Can (`data/templates.ts`), and the compat map.
- **Checks engine** (`lib/checks`, pure): power (rail limits, converter efficiency, battery life with optional MATLAB curves), voltage, pins, addresses, cost, and board fit. Each finding carries a machine-readable fix, applied by `lib/build/ops.ts`, which can also insert a level shifter or transistor driver automatically.
- **Sticky-note text** in EN, ES and HI (`lib/i18n/notes.ts`).
- **Tests**: 66 Vitest tests, all passing (`npm test`). Typecheck was clean at the time of the commit.
- **tscircuit pipeline** (`lib/circuit/*`, `app/api/circuit`, `app/api/export`): Gesture Ring routes 17/17 traces in about 0.5 s and Robot Car 23/23. Gerber+drill zip, BOM CSV, KiCad zip and Circuit JSON exports are written; the converters were tested in Node, but not yet through the app.

## Written but not yet built or screenshotted
- Shell (top bar, settings, page dots and arrows, transitions, keyboard map), Home, Devices, Category (R3F exploded view), and Builder (canvas, wiring, notes, palette, inspector, checks strip), plus CircuitView and Board3D.

## Known errors to fix first
1. `components/game/SnakeGame.tsx` does not exist yet. BuilderPage imports it, so add it or remove the import.
2. R3F JSX typing errors: `<group ref>` and `position` get typed as non-three elements in `ExplodedDevice.tsx:57,121` and `Board3D.tsx:151`. Check the React 19 / @react-three/fiber 9 JSX augmentation.
3. `npm run build` has not been run yet, and no screenshots exist yet.

## Not started
- Pages: Checks, Board, Summary, Templates, and Share.
- Real gesture and voice input (the files are stubs).
- Phase 4: integration adapters and the API routes the inspector calls (`/api/prices`, `/api/prices/history`, `/api/suggest`, `/api/scan`, `/api/matlab`).
- Firmware, the MATLAB and services folders, Docker, DEPLOY.md, README, DEVPOST.md, and `.env.example`.
- The worktree guard was disabled for this folder in `.claude/settings.json` so the build could live here.
