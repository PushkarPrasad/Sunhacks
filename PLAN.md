# Copperline — build plan

Copperline is a hardware project builder. Start from a device category or from scratch, place real maker
modules, wire them pin to pin, get instant checks with sticky-note advice, then turn the build into a
schematic, a routed carrier PCB, a 3D board, exports and a quote.

## Architecture

```
app/                      Next.js App Router pages (each one exactly one screen)
  page.tsx                Home
  devices/                Devices grid, devices/[id] category (generateStaticParams), devices/more notice
  templates/              Paginated template browser
  builder/                Builder: Build / Schematic / PCB / 3D tabs
  checks/ board/ summary/ share/
  api/                    circuit (tscircuit), export, quote, prices, builds, notes, scan, matlab, s3
components/
  shell/                  AppShell, TopBar, PageNav (arrows + dots), SettingsPopover, PageTransition
  builder/                Palette, Canvas, ModuleCard, Wires, Inspector, NotesLayer, ChecksStrip
  device3d/               ExplodedDevice (react-three-fiber + drei, procedural geometry)
  board/                  CircuitSvgView, Board3D (R3F from Circuit JSON), ExportPanel, QuotePanel
  notes/                  StickyNote, NotesBoard
  input/                  HandCursor, GestureController, VoiceController, KeyboardMap
  game/                   SnakeScreen
lib/
  types.ts                Part, Pin, Build, Template, Category, Finding, Fix...
  build/                  nets (union-find), layout helpers, template -> build, fixes
  checks/                 power, voltage, pins, addresses, cost, boardFit (pure, Vitest-covered)
  notes/                  finding -> note text (templated, i18n), shared with services/notes-service
  i18n/                   en / es / hi dictionaries
  circuit/                build -> tscircuit Circuit JSON (server), placement packer, exports
  integrations/           gemini, tinyfish, mongo, tigerdata, aws, notes-service, solana (each with mock)
  input/                  keymap bus, hand tracking (MediaPipe, lazy), voice (Web Speech), Web Serial
stores/                   zustand: build (persisted autosave), ui (settings)
data/                     parts, categories (+architecture blocks), templates, compat map, matlab/*.json
services/                 notes-service (Maritime), aws-checks (Lambda)
firmware/                 gesture-ring (XIAO ESP32-S3, BLE keyboard) + pro-micro variant
matlab/                   battery discharge + MPU6050 low-pass scripts -> data/matlab/*.json
```

Data flow: `Build` (instances + wires) in a persisted zustand store -> `computeNets` -> `runChecks` (pure) ->
findings -> sticky notes (templated text, optionally Gemini-polished) -> Apply dispatches a machine-readable
`Fix` back into the store. Schematic/PCB/3D: POST build to `/api/circuit`, which uses `@tscircuit/core`
(chips with header footprints, packed placement, autorouter) and `circuit-to-svg`; exports use
`circuit-json-to-gerber`, `circuit-json-to-bom-csv`, `circuit-json-to-kicad`.

Page flow (arrows / dots / swipes): Home -> Devices -> Builder -> Checks -> Board -> Summary.

## Checklist

### 1. Product
- [ ] Two equal starting paths (device / scratch) working end to end
- [ ] No chat UI or AI wording anywhere

### 2. Tech stack
- [ ] Next 16 App Router, TS strict, Tailwind 4, Zustand
- [ ] tscircuit core + circuit-to-svg + exporters (APIs verified in node_modules)
- [ ] react-three-fiber + drei exploded views
- [ ] MediaPipe hand landmarker, lazy-loaded
- [ ] Vitest + Playwright
- [ ] Adapters with mock fallback; runs with zero keys

### 3. Design system
- [ ] 100vh, overflow hidden, no scrollbars; tabs/pagination for lists
- [ ] Arrow keys, on-screen arrows, page dots, swipes; subtle page transitions
- [ ] Palette, fonts (Instrument Serif / Inter / JetBrains Mono), 8px grid, hairlines, 12px radius
- [ ] lucide icons 1.5 stroke; copper ring hand cursor
- [ ] Focus rings, reduced motion, high-contrast toggle

### 4. Pages
- [ ] Home  - [ ] Devices  - [ ] Category  - [ ] Builder  - [ ] Checks  - [ ] Board  - [ ] Summary
- [ ] Templates browser, More (Coming Soon) notice, share route

### 5. Data
- [ ] ~60 parts with datasheet values, verified flags, sources
- [ ] 12 categories in exact order, architecture blocks for 2-11
- [ ] 2+ templates per category, Gesture Ring featured, Soda Can easter egg

### 6. Checks engine
- [ ] Power (rails, limits, battery life, MATLAB curves if present)
- [ ] Voltage  - [ ] Pins  - [ ] Addresses  - [ ] Cost  - [ ] Board Fit
- [ ] Full Vitest coverage

### 7. Sticky notes
- [ ] Paper notes next to parts, Apply / Dismiss, neutral wording
- [ ] Pairs well with (rule map; Gemini ranks when keyed)
- [ ] English / Spanish / Hindi

### 8. Input and gestures
- [ ] Keyboard map  - [ ] Hand tracking  - [ ] Voice (Space)  - [ ] Web Serial haptics

### 9. Integrations
- [ ] Gemini  - [ ] TinyFish  - [ ] MongoDB  - [ ] Tiger Data  - [ ] AWS S3 + Lambda
- [ ] Maritime notes-service  - [ ] Vultr Docker + DEPLOY.md  - [ ] GoDaddy DNS section
- [ ] MATLAB scripts  - [ ] Solana Pay devnet flag  - [ ] Snake  - [ ] Accessibility
- [ ] Time and Cost Saved  - [ ] Share + QR  - [ ] Mascot slot

### 10. Firmware
- [ ] XIAO ESP32-S3 BLE ring sketch + README  - [ ] Pro Micro HID variant

### 11. Phases
- [ ] Phase 1 core  - [ ] Phase 2 board  - [ ] Phase 3 input  - [ ] Phase 4 integrations
- [ ] lint, typecheck, vitest, build, screenshots at 1440x900 after each phase; commit

### 12. Docs
- [ ] README (Mermaid)  - [ ] DEVPOST.md  - [ ] DECISIONS.md  - [ ] .env.example

### 13. Rules
- [ ] No secrets, no brand assets, credits/licenses, no AI wording, STATUS.md
