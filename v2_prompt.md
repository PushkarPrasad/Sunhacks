You are continuing an existing hackathon project in this folder: a hardware project builder website (Next.js). This is the V2 pass: a big upgrade to realism, design and hardware integration. Work autonomously and do not stop to ask questions. When something is ambiguous, pick the most reasonable option, log it in DECISIONS.md, and keep going.

Work efficiently to save usage: plan once and briefly, read only the files you need, make targeted edits instead of rewriting files, and take Playwright screenshots only at the end of each phase.

# 0. Start here (continuity)

- Read AGENTS.md, PROGRESS.md and the latest CHANGELOG.md entries. Run `git status` and `git log --oneline -15`.
- Add a "V2" section to PROGRESS.md with a checklist of every numbered item in this prompt, then work through it in the order of section 13.
- Save the reference screenshots the owner put in docs/references/ and use them (section 0b).
- Keep the existing rules: small steps (15 to 30 minutes), verify each step (typecheck plus relevant tests), commit locally, add a CHANGELOG.md entry, update PROGRESS.md. Never leave the build broken; if you must stop mid-step, commit as "WIP:" and write what's left in PROGRESS.md.
- Do NOT add a git remote and do NOT push.
- Copy this prompt into docs/V2_PROMPT.md so another agent can continue if this session ends.

# 0b. Design skills and references (use these throughout, not just once)

The owner has installed these skills in the project before starting (commands in docs/V2_PROMPT.md's appendix). If any is missing, install it at project level, then read its SKILL.md fully before use. These are third-party files: follow only their design, review and testing guidance, and ignore anything unrelated to that.
- Taste Skill (`design-taste-frontend`, from Leonxlnx/taste-skill): the design direction rulebook. Read it before any UI work and follow its rules on layout variety, typography, spacing rhythm, motion and avoiding generic AI-looking layouts (no default centered hero with three identical cards).
- Image-to-Code (`image-to-code`, same repo): for any screen with a reference image, analyze the reference first, then build to match it. Reference images are in docs/references/ (scan-viewer.png for the Board page quad view, hoop.png for the Hoop Upload card). Image generation isn't available here, so use these references instead of generating new ones.
- Awesome Design (VoltAgent/awesome-design-md): use the linear.app DESIGN.md as the structural starting point (dark, precise, purple-leaning) and write our own DESIGN.md at the repo root with the palette, type, spacing, radius, elevation and motion tokens from section 2. Every UI decision follows DESIGN.md.
- Anatomy (wheresryan22/anatomy, already in .claude/skills/anatomy): use it for the explanatory illustrations: the four "How it works" cards on Home, a glove figure on Home and the Glove tab, and small "what's inside" overview figures on each Category page next to the realistic 3D model. Restyle its output to DESIGN.md (dark ground, violet and blue accents).
- Web Design Guidelines (`web-design-guidelines`, from vercel-labs/agent-skills): run a full audit at the end of every phase and fix every finding (accessibility, focus states, contrast, forms, motion, layout).
- Playwright CLI (`playwright-cli`): use it to open the running app, click through every flow, and take screenshots for review at the end of each phase, instead of guessing how pages look.

# 1. Rename the product

- Rename the product from "Copperline" to "Magic Smoke" (an electronics in-joke: every chip runs on magic smoke, and once you let it out, it stops working). The owner may change the name later, so put the name, tagline and short description in one config file (lib/brand.ts) and use it everywhere: page titles, metadata, wordmark, footer, README, DEVPOST.md, firmware Bluetooth name strings in the docs.
- Tagline: "Open anything. Build everything." Keep the humor low-key; the rest of the product stays clean and professional.
- Make a simple wordmark (type-based, no clip art).

# 2. Design direction V2: cleaner, calmer, more alive

The current UI shows too much at once. V2 should feel like a polished pitch deck: clean, formal and presentable, but with color, motion and life.

- Progressive disclosure: every screen has one clear primary action. Secondary details live in drawers, popovers or a collapsible inspector. Cut visible text by at least half; short punchy lines over paragraphs.
- Keep the one-screen-per-page rule with no page scrolling. Use generous white space.
- Typography: refined, realistic type. Use "Instrument Serif" for large display lines and "Geist" (or "Inter Tight") for UI, with "Geist Mono" for numbers and specs. Set proper tracking, line heights and a clear type scale.
- Color: a dark theme in purple, black and blue, with green only as a small highlight.
  - Base: near-black #0A0A10, raised surfaces #12121C and #1A1A2A, hairlines #2A2A3D.
  - Text: #ECEAF5 primary, #A3A1B8 secondary.
  - Primary accent violet #7C5CFF (hover #9479FF); secondary accent electric blue #3D7BFF; soft periwinkle #A5B4FC for subtle fills.
  - Green highlight #3DDC97 used sparingly and only where it means something: success states, "Glove connected", passing checks, the live indicator. Never as a large fill.
  - Warnings amber #F5B14C, errors coral #FF6B6B.
  - Life: soft blurred violet-to-blue glows and gentle gradient meshes behind hero content and key panels, fine grain texture, glassy panels (backdrop blur) for overlays. Keep it tasteful; don't let gradients become the whole design.
  - Put all of this in DESIGN.md and CSS variables; no hard-coded colors in components.
- Motion: use the `motion` (Framer Motion) library. Springy but calm page transitions, staggered entrances, hover lift on cards, smooth 3D camera moves. Respect prefers-reduced-motion.
- Home becomes a short story you swipe through (arrows, page dots, keyboard, hand swipe), 5 full-screen slides:
  1. Hero: the wordmark, the tagline, and a live 3D phone that slowly explodes and reassembles.
  2. The problem, in one or two lines (see docs/RUNDOWN.md).
  3. How it works: Explore → Build → Check → Board, as four illustrated cards.
  4. Hands-on: the glove and gestures, with a short looping visual.
  5. Two big buttons: "Start From a Device" and "Start From Scratch".
- Remove the floating webcam preview and any gesture on/off controls from page corners. The camera preview may appear only inside the Calibration wizard.
- Hide the Next.js dev indicator (the round "N" badge in the corner during `npm run dev`) by setting `devIndicators: false` in next.config.ts.
- Navigation: a slim top bar with Home, Devices, Builder, Board, Glove, Calibration, About. Keep it minimal.

# 3. Realistic 3D device models (the wow factor; highest priority)

The current device figures look fake. Replace them with realistic, detailed, real-time 3D models in react-three-fiber + drei that you can rotate, zoom into and explode.

Look and rendering:
- Physically based materials (MeshStandardMaterial and MeshPhysicalMaterial): brushed and anodized aluminium, glass, ceramic, copper, gold contacts, green and black PCB solder mask, matte plastics, rubber.
- Studio lighting with an HDRI environment (drei `Environment`, studio preset or a bundled HDR), ACES tone mapping, soft contact shadows, very subtle bloom on the screen, antialiasing.
- A "Shell" control with three modes: Solid, Transparent (like transparent earbuds or teardown phone skins: frosted, clear housing with the real internals visible, using MeshPhysicalMaterial transmission, thickness, IOR and slight roughness) and X-ray (internals highlighted, shell as faint outline).
- Exploding: parts separate along sensible axes with spring easing, in layers. The explode amount is continuous: driven by a slider, the scroll wheel, the E key, and by the user spreading their fingers (open palm fully spread = fully exploded, closed hand = assembled).
- Hover a part: soft highlight and a clean label with a leader line. Click: the inspector shows the part's name, function and key specs.
- Generic designs only: no brand names, logos or trademarked product shapes. Call them "Android-style flagship phone", "Thin-and-light laptop" and so on.

How to build them:
- Build parts procedurally with real detail: bevelled and rounded geometry (RoundedBoxGeometry, ExtrudeGeometry with bevels, LatheGeometry for lenses), canvas-generated textures for PCB traces, labels, grilles and copper coils (with matching normal maps), InstancedMesh for small surface-mount components and keycaps, tube geometry for flex cables.
- You may use CC0 or CC-BY models and textures (for example from Poly Pizza, ambientCG or Poly Haven) only if you verify the license, contain no brand logos, and credit them in README and docs/RUNDOWN.md. Prefer procedural.
- Performance: lazy-load each device, keep each under roughly 300k triangles, share materials, target 60 fps on a MacBook, and fall back to a lighter version if frame rate drops.

Devices and parts, in priority order (do 1 and 2 at the highest fidelity first, commit each separately):
1. Android-style flagship phone: aluminium mid-frame with antenna bands, glass back, triple camera bump (each module with lens stack, sensor, stabilization housing, sapphire cover), flash, OLED display stack (cover glass, panel, flex cable), stacked logic board (system-on-chip and RAM under shield cans, power management chip, modem, many small components, gold test pads, board-to-board connectors), pouch battery with a realistic printed generic label (for example "Li-ion Polymer 4500 mAh 3.87 V"), USB-C port on its flex, loudspeaker with grille mesh, earpiece, linear haptic motor, wireless charging coil, NFC coil, SIM tray, microphones, graphite thermal sheet or vapor chamber, screws.
2. Thin-and-light laptop: aluminium lid and base (base supports the Transparent mode), display panel with bezel and camera, keyboard deck with instanced keycaps, trackpad, logic board with processor and memory chips, M.2 SSD, battery made of labeled pouch cells, two fans with curved blades, copper heat pipes, speakers, hinge, ports.
3. Then, at good (not maximum) fidelity: tablet, smartwatch, wireless earbuds with case, handheld game console, projector, camera, smart speaker, small robot.

These models are used on the Category pages, the Home hero and anywhere a device is shown. Retire the old isometric device figures there (leave the files if other code still uses them).

# 4. Start From Scratch upgrades

- Start From Scratch offers two choices: "Blank canvas" (current behavior) and "Start from a device base".
- Device bases: Phone, Laptop, Smartwatch, Earbuds case, Handheld console. Choosing one gives a board outline shaped like that device, with labeled zones (battery bay, display connector, camera, charging port) and suggested parts for each zone, which the user can accept, swap or delete.
- Expand the parts catalog with more complex parts, each with specs, an `estimated: true` flag where values are typical rather than from a datasheet, and a simple 3D look for the board view:
  - Device-grade parts: phone system-on-chip module, power management chip, OLED panel with flex cable, camera modules (OV2640, OV5640, a generic 12 MP module), Li-ion pouch cells in several capacities, USB-C port, USB-C PD trigger, battery management chip, linear haptic motor and DRV2605L driver, wireless charging receiver, NFC (PN532), MEMS microphones, small speakers, GPS (NEO-6M), M.2 SSD, SO-DIMM memory, laptop fan.
  - More maker modules: Raspberry Pi CM4, ESP32-S3 module, BMI270 IMU, round TFT, e-paper display.
- The checks engine keeps working with the new parts; where values are estimated, the check result says so.

# 5. Sticky notes V2: calm, readable, like a mentor's margin comments

- Notes live in a comment rail on the right side of the canvas or schematic, like comments in a word processor, each connected to its part by a thin curved line. They never overlap: use a stacking layout with a minimum gap.
- They enter calmly: fade and slide in over about 350 ms with a soft spring, staggered by 80 ms. No bouncing, shaking or popping.
- At most three notes are expanded at once; the rest collapse into a "2 more notes" row. While the user is drawing a wire, notes dim and wait.
- Readable: 14 to 15 px text, comfortable line height, strong contrast, a subtle paper tint, the mascot as a tiny avatar.
- Each note has a short title, one or two plain sentences, and Apply, Later and Dismiss.
- Wording stays grounded: "Based on the checks we ran, we suggest…". No "AI", "assistant" or chat wording, and no claim that a human expert reviewed the build.

# 6. Glove tab and Calibration tab

Gestures have no on/off button in the UI. The glove's physical power switch is the on/off. Glove gestures turn on automatically once the glove is connected and calibrated, and turn off when it disconnects.

Glove tab:
- "Find glove": tries Bluetooth first (Web Bluetooth), then offers USB (Web Serial) as a fallback. Bluetooth details: device name "Copperline Glove" (firmware may later be renamed "Magic Smoke Glove", so filter by service UUID, not name); service 19b10000-e8f2-537e-4f6c-d104768a1214; event characteristic 19b10001-… (notify, text messages); command characteristic 19b10002-… (write one byte). USB: 115200 baud, newline-separated text.
- Shows a clear connection state ("Searching", "Glove connected", "Disconnected"), the sensor name from the READY message, a live orientation dial, and the last gesture.
- Handles disconnects gracefully and reconnects with one click.

Message protocol (from the glove firmware, already written):
- READY:<sensor> on startup (CURIE, ADXL345, LIS3DH or MMA7660); BLE:ON or BLE:OFF.
- BTN:DOWN and BTN:UP: switch pressed and released (grab and release).
- G:SELECT: short tap. G:SWIPE_L and G:SWIPE_R: wrist flick. G:SHAKE: back. G:ZOOM_IN and G:ZOOM_OUT: hold and tilt, repeats.
- G:THROW:<x>,<y>: release during a flick, in hundredths of g.
- O:<roll>,<pitch>[,<yaw>]: orientation in degrees at 50 Hz while the switch is held. Yaw is present on the Arduino 101 version and wraps 0 to 360, so compute deltas with wrap-around.
- Commands to the glove: 'B' blinks the glove LED (send it when a check turns red), 'S' toggles raw streaming.

Calibration tab (a step-by-step wizard, one step per screen):
1. Find the glove (same as the Glove tab).
2. Hold still for 3 seconds: capture the neutral orientation.
3. Twist right, then left: detect the twist direction and set the invert flags automatically.
4. Tilt up, then down: same for tilt.
5. Flick left and right three times each: confirm swipe directions and set the swap flag if reversed.
6. Tap, then hold the switch: confirm select and grab.
7. Webcam: ask for camera permission and show the preview (the only place it appears). Ask the user to show each hand pose for about 2 seconds: open palm, fingers spread wide, pinch, fist, pointing, and relaxed (none). Collect landmark samples and train the personal gesture classifier (section 7). Show its measured accuracy.
8. Done: "Gestures on". Save the calibration in localStorage, with a "Recalibrate" button.

How inputs combine:
- Webcam: moves the cursor; spreading the fingers explodes models (continuous); a fist collapses; a pinch selects; two-hand pinch zooms and rotates.
- Glove: hold the switch to grab the model and rotate it like holding a globe. Map yaw, pitch and roll changes since the grab started to the model's rotation, smoothed. Releasing keeps the new orientation, and grabbing again continues from there. Wrist flicks change pages, shake goes back, and a tap is a backup select. Ignore G:THROW messages (Hoop Upload is mouse and trackpad only).
- If the webcam and the glove report the same action within 300 ms, fire it once.
- Keyboard fallback stays for everything.

# 7. Personal gesture classifier (real machine learning)

Replace the hard-coded webcam gesture thresholds with a small trained classifier, so the project genuinely uses trained ML.
- Input: the 21 MediaPipe hand landmarks, normalized (wrist at the origin, scaled by palm size, rotation-normalized), turned into a feature vector (normalized coordinates plus fingertip distances and finger curl angles).
- Classes: open palm, spread, pinch, fist, point, none.
- Model: a small neural network (two dense layers) trained in the browser with TensorFlow.js, plus a k-nearest-neighbors fallback when there are few samples. MediaPipe's pretrained hand model stays frozen and acts as the feature extractor; we train only the small classifier on top (transfer learning).
- Data: a baseline dataset the team records with a hidden recorder page (/calibration?record=1) that exports JSON to data/gesture-baseline.json, plus each user's calibration samples, which personalize the model.
- Evaluation: hold out 20% of samples and show accuracy and a small confusion matrix in the Calibration wizard. Write the real numbers into docs/RUNDOWN.md. Never invent or inflate results.
- At runtime: use the classifier's prediction with a confidence threshold and hysteresis (a pose must hold for about 150 ms), and fall back to the old rules if no model is trained yet.

# 8. Hoop Upload (Most Impractical): a gag inside the Builder

The current "Hoop Upload" is wrong. Replace it with a basketball-hoop file drop that lives only in the Builder, as a playful gag:
- In the Builder, the "Import build" action opens a clean card styled like docs/references/hoop.png: title "Upload files", subtitle "Drag and drop, or take the shot", an "Uploaded N" counter pill, a dashed drop zone, and a basketball hoop with a backboard and net under it.
- Dropping a file (a saved build JSON or a KiCad file) turns it into a small file-icon ball resting at the bottom of the card. The user throws it with the mouse or trackpad only: press on the ball, drag, release; the release velocity sets the throw. No gestures, no glove.
- Use matter-js or a small 2D physics loop: gravity, backboard and rim bounces, a swish through an animated net. A made basket imports the file and increments the counter, with a small celebratory animation; a miss bounces back for another try.
- A plain "Just upload it" link under the hoop skips the game (accessibility). Other imports elsewhere in the app use a normal file picker.
- Remove the HOOP_UPLOAD_URL service code. Credit the design inspiration (a Figma Community concept) in DEVPOST.md.

# 9. About page

A calm, one-screen About page in the new style, with:
- The backstory: we're a team of engineering students. One of us leads a student team on a NASA project, and the others are friends studying electrical engineering. Across all our projects, the same problem kept coming up: no good way to design the PCB, and it was hard to see what we were wiring, how, and why. We grew up loving the fluid, futuristic interfaces in the movies we watched as kids, so we built the tool we always wanted. (Do not name any film, character or franchise.)
- Team cards with placeholder photos (initials in a colored circle, easy to swap for real photos in /public/team/): Aayoush Iyer, Meghana Yerragovula, Nicole Galvan Ayon, Pushkar Prasad. Each card has a role line set to "Role coming soon" so the owner can fill it in.

# 10. docs/RUNDOWN.md (project transparency)

- The owner has placed RUNDOWN_seed.md in the repo root. Copy it to docs/RUNDOWN.md, then verify every technical claim against the actual code and package.json and correct anything that's wrong.
- Add a dependency table generated from package.json with each library's version and license (read from node_modules/<pkg>/package.json), and note what each one is used for.
- After section 7 is done, add the classifier's real dataset size and measured accuracy.
- Keep it accurate. Never claim an integration or result that isn't real in the code.

# 11. Tracks

- Don't add new infrastructure integrations in this pass. Keep the existing adapters (Gemini, TinyFish, MongoDB) with their mocks.
- Update the track section of DEVPOST.md to match reality: which tracks the project genuinely covers now, which are partial, and which are not covered.

# 12. Rules

- No brand names, logos or trademarked product designs for devices. Generic names only.
- No chat UI and no AI wording in the interface.
- Credit all open-source code, models, textures and data in README and docs/RUNDOWN.md.
- Never commit secrets. No git remote, no push.
- All pages fit one screen at 1440×900 and 1280×800 with no scrollbars or overflow.

# 13. Order of work and acceptance

Phase A (foundation): sections 0b, 1 and 2, including DESIGN.md (rename, design system, Home story slides, navigation, decluttering, dev indicator off). Acceptance: every page is calmer, uses the new palette and type, and Home's 5 slides swipe smoothly.
Phase B (realism): section 3, phone first, then laptop, then the rest. Acceptance: phone and laptop look realistic up close in all three shell modes, explode smoothly, and run at about 60 fps.
Phase C (building): sections 4 and 5. Acceptance: device bases work in Start From Scratch, the new parts work with checks, and sticky notes never overlap and enter calmly.
Phase D (hands): sections 6, 7 and 8. Acceptance: with no glove connected, everything still works by mouse and keyboard; with the glove, calibration completes and globe-grab rotation feels natural; the classifier trains and reports accuracy; Hoop Upload works in the Builder with mouse and trackpad.
Phase E (story): sections 9, 10 and 11. Acceptance: About page done; docs/RUNDOWN.md verified against the code; DEVPOST.md tracks accurate.

At the end of each phase: run lint, typecheck, unit tests and the production build; click through every flow with Playwright CLI and screenshot every page at 1440×900 into /screenshots; run the Web Design Guidelines audit and a Taste Skill review of the screenshots; fix everything they find; commit. When all phases are done, update STATUS.md and mark "V2 COMPLETE" at the top of PROGRESS.md.


# Appendix: skill install commands (the owner runs these in the project folder before starting)

```
npx skills add https://github.com/Leonxlnx/taste-skill --skill design-taste-frontend
npx skills add https://github.com/Leonxlnx/taste-skill --skill image-to-code
npx skills add https://github.com/vercel-labs/agent-skills --skill web-design-guidelines
npm install -g @playwright/cli@latest && playwright-cli install --skills
git clone https://github.com/VoltAgent/awesome-design-md.git docs/awesome-design-md
git clone https://github.com/wheresryan22/anatomy.git .claude/skills/anatomy   # skip if it already exists
```
