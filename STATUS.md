# Status: V4 (Reliability, Precision, Emerald)

Run: `npm install && npm run build && npm start`, then http://localhost:3000 (Chrome, for Web Bluetooth). No keys needed.
**Restart any `next start` already running** so it serves this build.

## Done
| # | Task | How it was verified |
|---|------|---------------------|
| P0-1 | Glove reliability: firmware v4 (Appendix A, verbatim, in `hardware/glove/glove.ino`); one Bluetooth link for the whole site (survives page changes); auto-reconnect to the same device (0.5/1/2/4 s, then 5 s for 2 min) with re-subscribe; 4 s stall watchdog (ignores the page being busy); queued writes; nav pill (Connected / Reconnecting… / Stalled / Off → Glove tab); link log on the Glove tab | `e2e/glove-link.spec.ts` with a fake Web Bluetooth device: navigation keeps 1 connection and 1 subscription; a drop reconnects with exactly one listener; 4 s silence → stall → reconnect; the log shows all three |
| P0-2 | Grab and rotate: glove-only clutch (hold the switch; with no switch, a knock toggles grab on 3D views); quaternion delta math with a 2° dead zone; 0.25 slerp; axis map + per-axis flips; release keeps the pose; shake resets; "Grabbed" chip + emerald ring | `tests/grab.test.ts` (12) and `e2e/glove-link.spec.ts`: grab, 90° on yaw / pitch / roll, release → model within 5° in the real Drones view |
| P0-3 | Continuous palm openness: fist 0, half-open ½, open 1; world-landmark joint angles, per-user range, One Euro, end snaps with hysteresis, confidence/palm gates, 300 ms still to engage, holds on loss; meter next to the slider | `tests/openness.test.ts` (10, synthetic hands with noise: ±0.1, no flicker); `e2e/hand.spec.ts`: slider at 0 / 50 / 100 ±10 |
| P0-4 | Snap-to-target pointer: knuckle (not fingertip), reach box, One Euro, 48 px magnet / 72 px hysteresis, ring morphs around the target, click goes to the target locked 150 ms before the pinch | `tests/snap.test.ts`: ≥ 95% required on 44×28 px buttons with ±30 px noise (100% on the seeded run); `e2e/hand.spec.ts`: 5/5 Calibrate targets |
| P0-5 | Camera only from Calibration: one entry point, no Settings toggle, no camera on glove connect, no video pop-up anywhere; "Hand control on" pill with Off | `tests/camera-guard.test.ts` greps `getUserMedia` (only `lib/input/camera.ts` and the test page) |
| P0-6 | Calibration wizard (glove still / tilt / twist with live axes and flips, grab cube, Start hand control, openness range, reach corners, click test with hit rate, Reset); test page updated (openness meter, snap grid with hit rate, grab/switch state, heartbeat/stall, reconnect log) | `e2e/calibrate.spec.ts`, `e2e/hand.spec.ts`, `e2e/glove-camera.spec.ts` (openness 1.000 / 0.502 / 0.000; 40/40 grid clicks; grab 90.0°; stall shown at 4.3 s) |
| P1-1 | Emerald redesign: all palette tokens, 10 px buttons, champagne eyebrows, sticky notes as cards with a coloured rule, emerald 3D highlights; every old violet/blue hex removed from app code | Grep of the old hex list finds nothing in app/, components/, lib/, stores/; screenshots of every page in `docs/screens/v4/` |
| P1-2 | Motion: 240 ms fade + 8 px rise between pages, 2 px hover lift with brightening hairline, count-up stats, springy pointer ring; all off under reduced motion | Visual review of the screenshots |

## Partly done / not done
- **Not tested on the real glove or a real webcam.** Everything was tested with simulated Bluetooth and synthetic landmarks.
- **Axis signs** in `AXIS_MAP` are a best guess for the glove on the back of the hand. If a direction is wrong, use the flip toggles on Calibrate step 1.
- Shared layout animation from a project card into its model view: not done.
- No 50 fps measurement on an M-series Mac (tests ran in headless Chrome).
- The Taste / web-design-guidelines / image-to-code / anatomy skills are not installed in this project; see the audit note under Final checks.

## Hardware test checklist (please run on the demo laptop, in Chrome)
1. **Heartbeat LED.** Flash `hardware/glove/glove.ino` (Arduino 101) and keep the glove still ~2 s after power-on. The LED should flash briefly once a second. *If it stops flashing, the board hung. If it keeps flashing but the site stops updating, the link is at fault.*
2. **Connect.** Glove tab → Connect Bluetooth. The nav pill shows "Glove · Connected" and the link log shows "Connected".
3. **5-minute soak.** Stay connected for 5 minutes, moving between Home, Devices, Builder and Board with the nav (not the browser's reload). The pill should stay Connected; any drop should show "Reconnecting…" and recover on its own. Screenshot the link log afterwards.
4. **Grab and rotate, each axis.** Devices → Drones. Hold the switch (or knock once if there is no switch), then: twist like a doorknob (model spins in the screen plane), tilt your fingers down (model tips toward you), turn your hand left (model turns left). Release: it stays. Shake: it goes back. If an axis is reversed, flip it on Calibrate step 1.
5. **Openness, half-open.** Calibrate → Start hand control → Openness (fist, then open). Then on Drones, hold your hand still for a moment: a fist assembles the model, a half-open hand stops it about half exploded, an open hand explodes it fully, with no jitter.
6. **Click accuracy.** Calibrate → Reach (four corners) → Click test: pinch the five targets. Aiming slightly off a button should still hit it; note the hit rate shown.
7. **Camera never pops up.** Move around the site after step 5: no video preview appears, only the "Hand control on" pill. Reloading turns hand control off.

## Known bugs
- From V3: a faint dashed line can show along the laptop lid edge at some angles; the rover mast and RC buggy shock towers pass through their shells.
- In headless tests, clicking Connect within ~1 s of page load (before hydration) can be ignored; people are not affected.

## Final checks
(filled in at the end)
