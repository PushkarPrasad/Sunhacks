# Magic Smoke: Project Rundown

Written from the team's seed (`RUNDOWN_seed.md`) and checked against the code on 2026-11-15. Where the seed
described something that is planned but not built yet, this version says so.

## The problem

Every hardware project starts with the same questions: which parts do I need, how do they connect, will it actually
work, and how do I turn a breadboard into a real PCB? The answers are scattered across datasheets, forum threads and
the heads of senior teammates. Meanwhile, the devices we use every day are sealed boxes, so students never get to see
how real products are put together.

Our team ran into this on every project we built, from a NASA student project to our own electronics builds: no clear
way to design the PCB, and no easy way to see what was wired where, and why.

## What we built

Magic Smoke lets you open up a 3D model of an everyday device, see the parts inside it, and start your own build from
it, or from a blank canvas. The drone is a detailed, realistic procedural model you can explode, x-ray and inspect part
by part; the other devices currently use simpler procedural exploded views. As you place parts and wire them, the site
checks power, voltages, pins, bus addresses, cost and board fit in real time, and leaves suggestions as sticky notes
with one-click fixes. One click turns the build into a schematic and a routed carrier PCB, with Gerber, BOM, KiCad and
Circuit JSON exports and a cost estimate. You can drive it with your hands through webcam hand tracking, and the site
can connect to the team's motion glove over Bluetooth or USB.

Who it's for: student engineering teams, makers, educators, and anyone curious about what's inside their devices.

## How the hand control works

- Webcam: Google's MediaPipe Hand Landmarker (`@mediapipe/tasks-vision`, Apache 2.0) runs in the browser and finds 21
  points on each hand on every video frame. The camera feed never leaves the computer. The WebAssembly runtime and
  model file are downloaded from jsDelivr and Google Storage when hand tracking is turned on.
- Our gesture layer (`lib/input/gestures.ts`) turns those points into actions with rule-based pose classification
  (pinch, open palm, spread, fist), exponential smoothing with a dead zone, hold times and cooldowns: pinch selects,
  an open-palm swipe changes page, holding a spread hand explodes a model, a fist collapses it, and a two-hand pinch
  zooms and rotates. **A trained gesture classifier is planned but not built yet** (see Machine learning).
- The glove: an Arduino 101 (Intel Curie: accelerometer, gyroscope and Bluetooth) with a micro switch on the index
  finger. The glove firmware is not part of this repository. The website side (`lib/input/glove.ts`, the Glove page)
  connects over Web Bluetooth or, as a fallback, USB (Web Serial), shows the live state, sensor and last gesture, and
  maps "hold the switch and turn your wrist" to rotating the 3D model like a globe.
- Combining them: the webcam handles pointing and hand poses, the glove handles grabbing and rotating, page flicks and
  confirming. If both report the same action within 300 ms it fires once. The keyboard always works.
- No app or driver to install: Web Bluetooth, Web Serial and the webcam all work in Chrome.

## Open source we built on

See the full dependency table at the end. The main pieces:
- MediaPipe Tasks Vision (Google): hand landmark detection.
- tscircuit (`@tscircuit/core`, `circuit-to-svg`, `circuit-json-to-gerber`, `circuit-json-to-bom-csv`,
  `circuit-json-to-kicad`, all MIT): schematics, PCB placement and autorouting, Gerber, BOM and KiCad exports.
- three.js, react-three-fiber and drei: real-time 3D.
- Next.js, React, TypeScript, Tailwind CSS, Zustand and Motion: the web app.
- Hoop Upload uses its own small 2D physics loop; matter-js is not used.
- Not in this repository: the glove firmware and its libraries (the seed lists Madgwick AHRS, ArduinoBLE and
  CurieBLE).
- Design guidance during development: the Taste Skill rules (Leonxlnx/taste-skill) were read and applied in V2, with
  one deliberate exception (violet stays, per the owner's palette). Image-to-Code, Web Design Guidelines,
  awesome-design-md and the Anatomy skill were not used in this pass. Browser testing uses `@playwright/test`.

Inspiration: open-source "Jarvis-style" hand-control demos that move a cursor with MediaPipe. We didn't use their code.

## What's ours

- The gesture layer: turning hand landmarks into reliable app actions (`lib/input/gestures.ts`, unit-tested).
- The webcam and glove fusion: the globe-grab rotation and the 300 ms de-duplication (`lib/input/glove.ts`).
- The checks engine (`lib/checks`), the sticky-note rules and one-click fixes (`lib/build/ops.ts`), the device
  templates (`data/`), and the procedural 3D models (`components/device3d`).
- Planned, not built yet: the calibration wizard and the personal gesture classifier.

We haven't contributed changes upstream to any of these projects. We plan to publish our gesture layer and glove
firmware as open source under the MIT license.

## Machine learning

Planned: a small gesture classifier trained on MediaPipe's hand landmarks (MediaPipe stays frozen as the feature
extractor; a lightweight classifier is trained on top and personalized during calibration). **Status: not built in
this version.** There is no dataset or accuracy figure yet; gestures currently come from the rule-based layer above.

## Why we chose what we chose

- Web app instead of a desktop app: nothing to install, and Web Bluetooth, Web Serial and webcam access all work in Chrome.
- Next.js and TypeScript: fast to build with, typed to catch mistakes, easy to deploy.
- MediaPipe: fast, accurate, free, and runs locally, which keeps camera data private.
- tscircuit: the only open-source tool we found that does schematic, PCB layout, autorouting and factory exports in JavaScript.
- Procedural 3D models instead of downloaded ones: full control over every part, no licensing or trademark problems, and every part can be labelled and exploded.
- Arduino 101: we had one, and it has the motion sensors and Bluetooth built in, which cut wiring to a single switch.
- Gemini, TinyFish and MongoDB: part-suggestion ranking and note wording, live part prices and quotes, and saved builds. All three run on local mocks until API keys are added.
- Development: built with AI coding assistants (Claude Code), with the team directing the design, hardware and decisions.

## How we got here

We started by rejecting ideas that already exist many times over: screen-time and doomscrolling blockers, a hobby
finder, a chore reward bot, a safety keychain and a group trip planner. We moved to a "swap a part and see what
changes" simulator, narrowed it to a repair-and-upgrade explorer for real devices, and then turned it into a full
project builder ending in a real PCB, because that's the problem our own teams kept hitting. Hand control came last,
to make exploring and building feel physical.

## The round "N" badge

The small round "N" in the corner was the Next.js developer tools indicator. It only appears in development mode
(`npm run dev`), never in the production build. V2 hides it with `devIndicators: false` in `next.config.ts`.

## Prize tracks (as of this version)

Covered with working code:
- Best Overall, Future of Work (Time and Cost Saved panel on Summary), Audience Vote (share link and QR code),
  Most Impractical (Hoop Upload basketball gag), Best Hardware (web side of the glove; firmware is outside this repo).

Built, but running on mock data until API keys are added:
- Gemini, TinyFish, MongoDB Atlas.

Partial:
- Best Gaming (Snake on the handheld-console template), Diversity and Equality (keyboard-only use, high contrast,
  reduced motion; English, Spanish and Hindi note text exists but is not polished), Solana (devnet code exists,
  button removed from the V2 Board page), Best Mascot (placeholder slot until the drawing is in).
- AWS (S3 upload adapter exists, mock until configured), Tiger Data (price-history adapter exists; the UI shows
  labelled sample data), MATLAB (the battery check reads MATLAB discharge tables if present; the scripts are not
  written yet), Maritime (the app can call a notes service by URL; the service itself is not built).

Not covered yet:
- Vultr (deploy) and GoDaddy (domain).

Not possible for this team:
- SpaceXSI (requires Cursor and Grok), Rookie (requires a first-time hacker on the team).

## Dependencies

Generated from `package.json`; versions and licenses read from `node_modules/<package>/package.json` (or the
package's LICENSE file where the field is missing).

| Package | Version | License | Kind | Used for |
| --- | --- | --- | --- | --- |
| `@aws-sdk/client-s3` | 3.1169.0 | Apache-2.0 | runtime | S3 upload of exported Gerbers (mock until configured) |
| `@mediapipe/tasks-vision` | 1.2.3 | Apache-2.0 | runtime | Webcam hand landmarks (21 points per hand) |
| `@react-three/drei` | 10.7.9 | MIT | runtime | 3D helpers: environment lighting, controls, rounded boxes, shadows |
| `@react-three/fiber` | 9.8.2 | MIT | runtime | React renderer for three.js |
| `@tscircuit/core` | 0.0.2378 | MIT (LICENSE file) | runtime | Build to Circuit JSON, placement and autorouting |
| `circuit-json-to-bom-csv` | 0.0.28 | MIT (LICENSE file) | runtime | BOM rows |
| `circuit-json-to-gerber` | 0.0.123 | MIT | runtime | Gerber and Excellon drill files |
| `circuit-json-to-kicad` | 0.0.275 | MIT (LICENSE file) | runtime | KiCad PCB and schematic files |
| `circuit-to-svg` | 0.0.460 | ISC | runtime | Schematic and PCB drawings |
| `jszip` | 3.10.2 | (MIT OR GPL-3.0-or-later) | runtime | Zip files for exports |
| `lucide-react` | 1.73.0 | ISC | runtime | Line icons |
| `mongodb` | 7.9.0 | Apache-2.0 | runtime | Saved builds and share links (mock until configured) |
| `motion` | 14.14.0 | MIT | runtime | Page, slide and card motion |
| `next` | 16.4.6 | MIT | runtime | Web framework |
| `pg` | 8.23.1 | MIT | runtime | Tiger Data price history (mock until configured) |
| `qrcode` | 1.5.4 | MIT | runtime | Share-link QR codes |
| `react` | 19.3.0 | MIT | runtime | UI |
| `react-dom` | 19.3.0 | MIT | runtime | UI |
| `server-only` | 0.0.1 | MIT | runtime | Keeps server code out of the browser bundle |
| `three` | 0.179.1 | MIT | runtime | 3D engine |
| `zustand` | 5.1.0 | MIT | runtime | App state |
| `@playwright/test` | 1.65.1 | Apache-2.0 | dev | Browser tests and screenshots |
| `@tailwindcss/turbopack` | 4.3.3 | MIT | dev | Tailwind build |
| `@types/node` | 20.19.43 | MIT | dev | Types |
| `@types/pg` | 8.23.1 | MIT | dev | Types |
| `@types/qrcode` | 1.5.6 | MIT | dev | Types |
| `@types/react` | 19.3.0 | MIT | dev | Types |
| `@types/react-dom` | 19.3.0 | MIT | dev | Types |
| `@types/three` | 0.187.0 | MIT | dev | Types |
| `eslint` | 9.39.5 | MIT | dev | Linting |
| `eslint-config-next` | 16.4.6 | MIT | dev | Lint rules |
| `tailwindcss` | 4.3.3 | MIT | dev | Styling |
| `typescript` | 5.9.3 | Apache-2.0 | dev | Type checking |
| `vitest` | 3.2.7 | MIT | dev | Unit tests |

Device models, textures and illustrations are procedural or drawn in code; no third-party models, textures or logos are used.
