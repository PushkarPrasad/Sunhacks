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
- [x] P1-1 Global realism pass: `components/three/Studio.tsx` (local CC0 studio HDRI, soft key light + shadows, rim light, contact shadows, N8AO + bloom on emissives only + SMAA, ACES) on every 3D view; shared `lib/three/materials.ts` (carbon weave normal map + clearcoat, anodized aluminium, steel, brass, FR4 PCB with mask/pads/silkscreen, matte/gloss/printed plastics with layer lines, rubber, silicone, glass, cover glass, pouch foil, LEDs, screens)
- [x] P1-2 Reaction-wheel cube (procedural; `public/models/cubli/` was empty): 150 mm frame of 6 bevelled plates, 12 rails, rounded corners, 24 instanced M3 screws; three spoked wheels with 12 brass weights each; gimbal BLDCs; controller PCB on brass standoffs; IMU board; 3S LiPo with balance lead + JST-XH; three-phase harness with zip ties. Plates explode along their normals. Shared framework: `components/device3d/product/` (ProductModel, ProductViewer, `<Part>`, `<Ex>`), `lib/three/geo.tsx`.

### Realism scores (1-5: silhouette / proportions / materials / detail / lighting)
| Model | Sil | Prop | Mat | Detail | Light | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Drone (approved reference) | 4 | 4 | 4 | 5 | 4 | Studio HDRI only |
| Balancing cube | 4 | 4 | 4 | 4 | 4 | Compared with photos of reaction-wheel cubes: plates, brass-weighted wheels and corner blocks match; aluminium roughness fixed after pass 1 (was mirror-like) |
| Rocker-bogie rover | 4 | 4 | 4 | 4 | 4 | Compared with hobby rocker-bogie builds: 2020 extrusion frame and arms with T-slots, 120 mm wheels with curved spokes and grousers, stereo mast; differential bar toned down after pass 1 |
