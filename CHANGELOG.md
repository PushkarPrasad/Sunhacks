# Changelog

## V3
- Glove protocol matches `hardware/glove/glove.ino` (READY heartbeat, O:roll,pitch,yaw, SWIPE/SELECT/SHAKE, optional BTN); old formats ignored; writes queued with writeValueWithoutResponse.
- Shared input store (`stores/input.ts`): camera fist or glove switch = grab; smoothed globe rotation from the grab-start baseline; shake recenters; any duplicate action within 300 ms dropped.
- Connecting the glove starts the webcam tracker in the same click; picture-in-picture preview with landmarks; camera denial keeps the glove working with a one-line notice.
- Glove tab rebuilt: live roll/pitch/yaw bars, 3D board preview, last 8 events, Blink LED, Reconnect.

## V2
- Glove tab: Bluetooth/USB connection, live status and last gesture, orientation dial, globe-grab model rotation, webcam/glove de-dup, LED blink on red checks; Glove and About in the nav.
- About page (backstory, team cards with initials) and docs/RUNDOWN.md verified against the code with a generated dependency/licence table.
- Hoop Upload is now a basketball file drop in the Builder (Import build); Save build file added; old upload service removed.
- Procedural high-detail drone (carbon frame, brushless motors, props, ESC/FC stack, LiPo, camera, VTX, RX, GPS, canopy) with Solid/Transparent/X-ray shell, spring explode (slider, wheel, E, gestures), hover labels and part inspector; Home hero and new Drones category with two templates and four new parts.
- Renamed to Magic Smoke; dark violet/blue palette, Geist type, glows and grain; DESIGN.md.
- Home is five story slides (hero, problem, how it works, hands-on, start) with spring transitions.
- Removed the webcam preview and the corner gesture toggle; hid the Next.js dev indicator; slimmer nav.

## Unreleased
- Draft complete: anatomy figures (Phones, Laptops, Projectors) with screen-space callouts.
- Board quad view (Schematic, PCB, 3D, Parts) with synced selection; SVGs isolated in shadow roots.
- Hoop Upload (configurable endpoint, mock download fallback).
- New parts land in free canvas space; notes fade while wiring; Apply clicks no longer captured by the canvas.
- Hand-gesture recogniser (pure, tested) + MediaPipe webcam layer with copper ring cursor.
- Keyboard map and input bus shared by keyboard, gesture ring, gestures and voice.
- Checks, Board, Summary, Templates and Share pages; Gerber/BOM/KiCad/JSON export.
- Gemini, TinyFish, MongoDB adapters (plus Tiger Data, S3, notes) with local mocks.
- tscircuit schematic, routed carrier PCB and 3D board.
- Data model, 69 parts, 22 templates, six-check engine with Apply fixes.
