# Status: V2 (owner's reduced list) done

Run: `npm install && npm run build && npm start`, then http://localhost:3000. No keys needed.
Verified: lint and typecheck clean, 81 unit tests, production build, 42 Playwright tests (every page at
1440×900 and 1280×800, no overflow, no console errors). Screenshots are in `/screenshots`.

## Done
1. **Magic Smoke** rename (`lib/brand.ts`), dark violet/blue design system (`DESIGN.md`), Geist type, glows and grain.
   Home is five story slides, pages decluttered, webcam preview and corner gesture toggle removed, Next.js "N" hidden.
2. **Realistic procedural drone** as the Home hero and the new Drones category, with Solid/Transparent/X-ray
   shell modes, spring explode (slider, wheel, E, spread/fist), hover labels and a part inspector. Two drone
   templates and four new parts. Other categories keep their earlier models.
3. **Hoop Upload** gag in the Builder (Import build): throw a file-ball through the hoop with the mouse to import a
   saved build; "Just upload it" skips the game. Old upload service removed; "Save build file" added.
4. **About page** and **docs/RUNDOWN.md**, checked against the code with a generated dependency/licence table.
5. **Glove tab**: Bluetooth (by service UUID) with USB fallback, live status, sensor, switch state, last gesture,
   orientation dial, globe-grab rotation of the 3D model, 300 ms webcam/glove de-duplication, LED blink when a
   check turns red. Tested with simulated protocol lines; not yet tested against the physical glove.

## Not done (skipped as asked)
Calibration wizard, ML gesture classifier, realistic phone/laptop and other models (sections 3.1-3.3 beyond the
drone), Start From Scratch and sticky-note V2 (sections 4-5), Web Design Guidelines audit, DEVPOST.md, README.

## Notes
- Taste Skill: SKILL.md was read as text (not installed); its rules were applied except the "no violet" rule.
- `docs/references/hoop.png` and `scan-viewer.png` were not in the repo; the Hoop card follows the written spec.
