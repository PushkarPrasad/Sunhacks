# DRAFT COMPLETE

Draft scope (owner request), all four steps done:

- [x] 1. All pages work end to end with mocks: Home, Devices, Category, Builder, Checks, Board, Summary, Templates, Share
- [x] 1. Anatomy figures (numbered callouts) for Phones, Laptops, Projectors; plain exploded view for the rest
- [x] 2. Board quad view (Schematic, PCB, 3D, Parts) with synced selection
- [x] 2. Gerber and BOM export (also KiCad and Circuit JSON), Summary page, Hoop Upload (mock until configured)
- [x] 3. Keyboard map and webcam hand tracking (MediaPipe, lazy-loaded)
- [x] 4. Gemini, TinyFish and MongoDB adapters with mocks

Stopped here as instructed. Deferred items are listed in STATUS.md.

## V2 (owner's reduced list)
- [x] 1. Rename to Magic Smoke (lib/brand.ts), dark violet/blue palette + DESIGN.md, Home as 5 story slides, decluttered pages, webcam popup removed, Next.js indicator hidden
- [x] 2. Realistic drone model (Home hero + Drones category)
- [x] 3. Hoop Upload gag in the Builder
- [x] 4. About page + docs/RUNDOWN.md
- [x] 5. Glove tab connection

## V3 (final push, v3_prompt.md; hard stop 10:00 AM)
- [x] P0-1 Glove protocol + `hardware/glove/glove.ino` (Arduino 101 sketch); Glove tab: state, live roll/pitch/yaw, 3D board preview, last 8 events, Blink LED, one-click reconnect
- [x] P0-2 Camera starts in the same click as the glove; PiP preview (bottom right, landmarks, hide/close); one shared input store (`stores/input.ts`) with the fusion rules
- [x] P0-3 `public/test/glove-camera.html` (checklist, camera + landmarks, CSS 3D cube, score, log); `e2e/glove-camera.spec.ts` passes 17/17 with simulated input
- [x] P0-4 Home hands slide: WebXR generic hand (MIT) with skin material, FK-posed pinch / spread / fist / animated swipe / grab + twist holding a mini drone; rows clickable, 3 s auto-cycle, 400 ms ease; live landmarks drive the rig when the camera is on; "an optional switch"
- [x] P0-5 Devices grid in the V3 order (Drones first ... Phones & Laptops, More); "Start blank" is a button, not a tile; 9 new starter builds (balancers, rover, servo arm, CanSat, altimeter, RC car + transmitter, pen plotter, mini CNC) and a 12 V adapter part; Tablets, Projectors, Game Consoles and Cameras hidden behind More
- [x] P0-6 Hoop Upload: toolbar "Upload" button with a basketball icon, `/builder?hoop=1`, pointer capture made safe; `e2e/hoop.spec.ts` (throw through the hoop imports the build, ?hoop=1 + Just upload it, real mouse drag) passes
- [x] Owner add-on: Calibration tab (`/calibrate`, nav "Calibrate"): keep still, tilt each side, grab and twist, green check per step; unit + e2e tests
