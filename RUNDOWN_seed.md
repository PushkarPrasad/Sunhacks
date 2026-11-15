# Magic Smoke: Project Rundown

## The problem

Every hardware project starts with the same questions: which parts do I need, how do they connect, will it actually work, and how do I turn a breadboard into a real PCB? The answers are scattered across datasheets, forum threads and the heads of senior teammates. Meanwhile, the devices we use every day are sealed boxes, so students never get to see how real products are put together.

Our team ran into this on every project we built, from a NASA student project to our own electronics builds: no clear way to design the PCB, and no easy way to see what was wired where, and why.

## What we built

Magic Smoke lets you open up a realistic 3D model of an everyday device (a phone, a laptop and more), see every part inside it, and start your own build from it, or from a blank canvas. As you place parts and wire them, the site checks power, voltages, pins, bus addresses, cost and board fit in real time, and leaves suggestions as margin notes. One click turns the build into a schematic and a manufacturable PCB, with factory files and a parts list. You can drive the whole thing with your hands, through webcam hand tracking and a glove we built.

Who it's for: student engineering teams, makers, educators, and anyone curious about what's inside their devices.

## How the hand control works

- Webcam: Google's MediaPipe Hand Landmarker (open source, Apache 2.0) runs entirely in the browser and finds 21 3D points on each hand, about 30 times a second. Nothing leaves the user's computer.
- Our gesture layer sits on top: it turns those points into actions (pinch to select, spread fingers to explode a model, fist to collapse, two-hand zoom and rotate) using a small classifier we trained (see below), with smoothing and hold-time filtering so it doesn't flicker.
- The glove: an Arduino 101, whose Intel Curie chip has a built-in accelerometer, gyroscope and Bluetooth, plus a micro switch on the index finger. The open-source Madgwick filter fuses the motion sensors into a 3D orientation. Our firmware detects taps, holds, wrist flicks and shakes, and streams orientation while you grab.
- Combining them: the webcam handles pointing and hand poses, the glove handles grabbing, rotating (like turning a globe), page flicks and confirming. If both report the same action at once, it fires once. The keyboard always works as a fallback.
- Connection: the website talks to the glove directly over Web Bluetooth or USB (Web Serial), so there's no app or driver to install.

## Open source we built on

(Verified against package.json in the dependency table below.)
- MediaPipe Tasks Vision (Google): hand landmark detection.
- TensorFlow.js: training and running our gesture classifier in the browser.
- tscircuit: turning builds into schematics, PCB layouts, 3D boards and Gerber, BOM and KiCad exports.
- three.js, react-three-fiber and drei: real-time 3D device models.
- Next.js, React, TypeScript, Tailwind CSS, Zustand and Motion: the web app.
- Madgwick AHRS (Arduino library): glove orientation.
- ArduinoBLE and CurieBLE: Bluetooth on the glove.
- matter-js (if used): physics for the Hoop Upload gag.
- Design skills used during development: Taste Skill and Image-to-Code (Leonxlnx/taste-skill), Web Design Guidelines (Vercel), awesome-design-md (VoltAgent), Playwright CLI (Microsoft).
- Anatomy (MIT-licensed Claude Code skill): isometric device illustrations in V1.

Inspiration: open-source "Jarvis-style" hand-control demos that move a cursor with MediaPipe. We didn't use their code.

## What's ours

- The gesture layer: turning hand landmarks into reliable app actions.
- The webcam and glove fusion, including the globe-grab rotation and the 300 ms de-duplication.
- The glove firmware: gesture detection, orientation streaming, and USB plus Bluetooth output with one shared message format.
- The calibration wizard and the personal gesture classifier.
- The checks engine, the sticky-note suggestion rules, the device-base templates and the realistic procedural 3D device models.

We haven't contributed changes upstream to any of these projects. We plan to publish our gesture layer and glove firmware as open source under the MIT license.

## Machine learning

We trained a small gesture classifier on top of MediaPipe's pretrained hand model. MediaPipe stays frozen and acts as the feature extractor; we train only a lightweight classifier on the hand landmarks (transfer learning). It's trained on a baseline dataset our team recorded, then personalized during each user's calibration. Real dataset size and measured accuracy: [filled in from the actual results after training].

## Why we chose what we chose

- Web app instead of a desktop app: nothing to install, and Web Bluetooth, Web Serial and webcam access all work in Chrome.
- Next.js and TypeScript: fast to build with, typed to catch mistakes, easy to deploy.
- MediaPipe: fast, accurate, free, and runs locally, which keeps camera data private.
- tscircuit: the only open-source tool we found that does schematic, PCB layout, autorouting and factory exports in the browser.
- Procedural 3D models instead of downloaded ones: full control over every part, no licensing or trademark problems, and every part can be labeled and exploded.
- Arduino 101: we had one, and it has the motion sensors and Bluetooth built in, which cut wiring to a single switch.
- Gemini, TinyFish and MongoDB: part suggestions, live part prices, and a flexible catalog where every part type has different fields.
- Development: built with AI coding assistants (Claude Code), with the team directing the design, hardware and decisions.

## How we got here

We started by rejecting ideas that already exist many times over: screen-time and doomscrolling blockers, a hobby finder, a chore reward bot, a safety keychain and a group trip planner. We moved to a "swap a part and see what changes" simulator, narrowed it to a repair-and-upgrade explorer for real devices, and then turned it into a full project builder ending in a real PCB, because that's the problem our own teams kept hitting. Hand control came last, to make exploring and building feel physical.

## The round "N" badge

The small round "N" in the bottom-left corner was the Next.js developer tools indicator. It only appears while the site runs in development mode (`npm run dev`), never in the real build. V2 hides it.

## Prize tracks

Covered with working code:
- Best Overall, Best Hardware (the glove), Future of Work (Time and Cost Saved panel), Audience Vote (share link and QR code), Most Impractical (Hoop Upload), Best Mascot (once the drawing is in).

Built, but running on mock data until API keys are added:
- Gemini, TinyFish, MongoDB Atlas.

Partial:
- Best Gaming (Snake on the console template), Diversity and Equality (keyboard-only use, multilingual notes in progress, one-handed glove control), Solana (button exists, switched off).

Not yet covered, still possible:
- Vultr (deploy) and GoDaddy (domain), AWS (S3 for exported files), MATLAB (battery and filter scripts), Maritime (host the suggestion service), Tiger Data (part price history).

Not possible for this team:
- SpaceXSI (requires Cursor and Grok), Rookie (requires a first-time hacker on the team).
