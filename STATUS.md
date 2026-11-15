# Status: V3 final push complete (finished 06:00, well before the 10:00 hard stop)

Run: `npm install && npm run build && npm start`, then http://localhost:3000. No keys needed.
**If a `next start` is already running on port 3000, restart it**: `.next` was rebuilt for V3, and the old process
keeps serving the pre-V3 build until it restarts.

Verified on the final tree: lint clean, typecheck clean, 87 unit tests, `npm run build`, 67 Playwright tests (every
page at 1440x900 and 1280x800 including every model category and Calibrate, the glove + camera bench with simulated
input, the Hoop throw, the calibration wizard). Screenshots are in `/screenshots` (`v3-*` for the models).

## How to open things
- **Glove tab:** top nav **Glove** (`/glove`). Press **Connect Bluetooth** (or **USB**); the webcam starts in the same
  click and a small preview with landmarks appears bottom right (Hide / close). Live roll/pitch/yaw, a 3D board
  preview, the last eight events, **Blink LED**, **Recenter**, and one-click **Reconnect** if the glove drops out.
- **Calibration tab:** top nav **Calibrate** (`/calibrate`): keep still 2 s, tilt each side, grab and twist. Each step
  turns green.
- **Combined test page:** `http://localhost:3000/test/glove-camera.html` (also the **Test page** button on the Glove
  tab). Checklist on the left, camera top right, cube bottom right, score "X / N passed", error log.
- **Hoop Upload:** in the Builder toolbar (top right) press **Upload** (small basketball icon), or open
  `http://localhost:3000/builder?hoop=1` directly. Choose or drop a build `.json` (the download icon next to Upload
  saves one), press on the ball, drag and let go so it drops through the hoop. **Just upload it** skips the game.
- **Firmware:** `hardware/glove/glove.ino` (the Arduino 101 sketch from the prompt, unchanged).

## Finished
| # | Task | Notes |
| --- | --- | --- |
| P0-1 | Glove protocol + firmware | Parser matches the sketch (READY, O:r,p,y, SWIPE_L/R, SELECT, SHAKE, BTN); old formats ignored; BLE filtered by service UUID; writes queued with `writeValueWithoutResponse` |
| P0-2 | Glove + camera together | Camera starts in the glove's click handler; PiP 200 px with landmarks and close; camera denial keeps the glove working with a one-line notice; one shared input store (`stores/input.ts`) owns the fusion table and the 300 ms duplicate filter |
| P0-3 | Combined test page | Standalone HTML, MediaPipe from jsDelivr; headless test passes 17/17 with simulated lines and fake landmarks |
| P0-4 | Home hands illustration | WebXR generic hand (MIT) with a skin material, poses for pinch, spread, fist, animated swipe and grab + twist holding a mini drone; rows clickable, 3 s auto-cycle, 400 ms easing; live landmarks drive the rig when the camera is on; "an optional switch" |
| P0-5 | Category order | Drones first ... Phones & Laptops, More; **Start blank** is a button; nine new starter builds and a 12 V adapter part; Tablets, Projectors, Game Consoles and Cameras moved behind More |
| P0-6 | Hoop Upload | Toolbar button + `?hoop=1`; Playwright throws the ball through the hoop and checks the build lands |
| Add-on | Calibration tab | Asked for by the owner during the run |
| P1-1 | Global realism pass | Local CC0 studio HDRI, soft key light + shadows, contact shadows, N8AO, bloom on emissives only, SMAA, ACES, DPR ≤ 2, per-scene exposure; shared procedural materials library |
| P1-2 | Balancing cube | Procedural (no files in `public/models/cubli/`) |
| P1-3 | Rover, robot arm | |
| P1-4 | Phone, laptop | Rebuilt |
| P2 | Remaining models | Motion glove, CanSat, weather station, RC buggy, 3D printer, desktop synth |

Every visible category now opens a hyper-real model; all scored 4+ on every axis (table in PROGRESS.md), so nothing
had to be hidden for quality. The drone was left as approved apart from the shared studio lighting.

## Partly done / caveats (honest list)
- **Glove tested with simulated protocol lines only** in this run, not against the physical Arduino 101.
- **60 fps is not measured on an M-series Mac.** Testing ran in headless Chrome. Repeated parts are instanced and the
  post stack runs AO at half resolution, but please check frame rate on the demo laptop; if a view stutters, the
  cheapest fix is `effects={false}` on `<Studio>` for that view.
- **Realism scores are the agent's own judgement** from three-angle screenshots compared with what these products
  look like; no reference photos were downloaded and placed side by side.
- Live-landmark mirroring on the Home hand was tested with synthetic landmarks, not a real webcam.
- Category pages show the first two starter builds (one-screen rule); the rest are on Templates.
- The old category URLs (`/devices/phones`, `/robots`, `/smartwatches`) redirect to their V3 homes.

## Known bugs
- A faint dashed line can show along the laptop lid edge at some angles (shadow/bevel aliasing).
- The rover's mast and the RC buggy's shock towers pass through their shells (real RC bodies have holes there, but
  the holes are not modelled).
- `next build` for a separate verify folder (`NEXT_DIST_DIR=.next-verify`) rewrites `tsconfig.json` includes; revert
  it with `git checkout tsconfig.json` if that happens.

## Last commit
`cdeaddc` was the last code commit; this STATUS update is committed on top of it (see `git log -1`). Nothing was
pushed and no remote was added.
