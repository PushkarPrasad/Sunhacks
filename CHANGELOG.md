# Changelog

## V3
- Glove protocol matches `hardware/glove/glove.ino` (READY heartbeat, O:roll,pitch,yaw, SWIPE/SELECT/SHAKE, optional BTN); old formats ignored; writes queued with writeValueWithoutResponse.
- Shared input store (`stores/input.ts`): camera fist or glove switch = grab; smoothed globe rotation from the grab-start baseline; shake recenters; any duplicate action within 300 ms dropped.
- Connecting the glove starts the webcam tracker in the same click; picture-in-picture preview with landmarks; camera denial keeps the glove working with a one-line notice.
- Standalone test bench at `/test/glove-camera.html`: glove, camera and fusion checklist with score, live landmarks, cube driven by fist + twist, error log (incl. the Serial Monitor hint).
- Home "Drive it with your hands": the box-and-ovals drawing is replaced by a realistic 3D hand (WebXR generic hand, MIT) posed per gesture, with a mini drone for grab + twist and live-landmark mirroring.
- Devices: new category order with Drones first, Start blank button, Phone/Laptop toggle, nine new starter builds, 12 V adapter part; tablets, projectors, consoles and cameras moved behind More (Coming Soon).
- Hoop Upload is findable: "Upload" button with a basketball icon in the Builder toolbar and `/builder?hoop=1`; Playwright covers the throw.
- Calibration tab: three-step wizard (keep still, tilt to each side, grab and twist) with a green check per step.
- Realism pass on every 3D view: local studio HDRI, soft shadows, contact shadows, ambient occlusion, bloom only on LEDs and screens, SMAA; shared procedural materials library.
- Balancing Robots: hyper-real reaction-wheel cube standing on an edge, with shell modes and exploded plates.
- Rovers and Robot Arms: hyper-real rocker-bogie rover and six-axis servo arm.
- Phones & Laptops: rebuilt hyper-real phone and laptop with exploded internals.
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
