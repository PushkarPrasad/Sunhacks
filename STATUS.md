# Status: draft complete

Run it: `npm install && npm run build && npm start`, then open http://localhost:3000. No keys are needed.
Screenshots of every page at 1440×900 and 1280×800 are in `/screenshots`.

## Verified
- Lint and typecheck are clean. 75 Vitest tests pass (checks engine, fixes, data integrity, notes, gestures, share links).
- The production build passes.
- 34 Playwright tests pass. They screenshot every page at both sizes, assert no page overflow and no console errors,
  and cover these flows: start from scratch and wire pins; start from a device through to a starter build; Apply a
  sticky note, then undo; Gerber and BOM download for the Gesture Ring; arrow keys and E; share link round trip.

## What works
- **Home, Devices, Templates, Category:** all 12 categories in order. Phones, Laptops and Projectors have anatomy
  figures with numbered callouts; the other categories use a simple exploded view.
- **Builder:** palette of 69 parts (tabs, search, pages), drag and drop, pin-to-pin wiring, move, rotate, delete,
  undo/redo, autosave, inspector (specs with "unverified" tags, pins, Pairs well with) and a live checks strip.
- **Checks:** six checks (power, voltage, pins, addresses, cost, board fit). Sticky notes with working Apply buttons,
  e.g. automatic level-shifter or transistor-driver insertion, or regulator swaps.
- **Board:** quad view (Schematic, PCB, 3D, Parts) sharing one selection, plus a routed carrier PCB from tscircuit.
  Exports: Gerber zip, BOM CSV, KiCad, Circuit JSON. Manufacturing quote, Hoop Upload.
- **Summary:** totals, battery life, Time and Cost Saved with its assumptions shown, share link with QR code, and a
  hidden Soda Can link (the ∴ glyph).
- **Input:** keyboard map and webcam hand tracking with a copper ring cursor. Pinch selects, open-palm swipe changes
  page, spread explodes, fist collapses, two-hand pinch zooms and rotates.

## Mocked until a key is added (see `.env.example`)
- **Gemini:** ranks the rule-based suggestions, tightens note text, and powers Scan a Device. Without a key, scanning
  says it needs one.
- **TinyFish:** live part prices and the fab quote. Without a key, the app uses catalogue prices and an estimate
  formula.
- **MongoDB:** saved builds and share links. Without it, builds are stored in server memory and the browser keeps
  its own copy.
- **Hoop Upload:** Hoop's API was not available, so the endpoint is configurable. Without it, the project package
  downloads instead.

## Known issues
- Schematic layout comes from tscircuit's auto placement and gets dense on big builds; pan and zoom help.
- Hand tracking needs a webcam plus network access to jsDelivr and Google Storage for the model.
- Prices are typical retail estimates until TinyFish is configured.

## Deferred (owner's skip list)
Firmware, MATLAB scripts, Solana (the button is present but off), Tiger Data (the price trend shows labelled sample
data), multilingual notes (EN/ES/HI text exists), Snake (works on the console template), Maritime notes service,
AWS Lambda, Docker/DEPLOY.md, voice commands and Web Serial haptics. Voice and haptics code exists but was not
polished. README and DEVPOST.md have not been written yet.
