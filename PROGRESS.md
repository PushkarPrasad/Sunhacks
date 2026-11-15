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
- [x] P1-3 Rocker-bogie rover (2020 extrusion with T-slots, 6 spoked wheels with grousers, gear motors, bay + lid shell, stereo mast, harness) and six-axis arm (servos with horns, printed links with layer-line normal map, gripper, PCA9685 board, leads); both explode along their assembly axes
- [x] P1-4 Phone (frame band with antenna breaks, buttons, ports, transmissive cover glass over an emissive home screen, glass back with camera plateau and three lens stacks, mid-frame, L-shaped logic board with RF shields, flex cables, pouch cell, speaker, haptics, camera modules) and laptop (unibody top case with instanced keycaps by width, glass trackpad, grilles, wall ring with ports, bottom cover with feet and screws, logic board, two blower fans, copper heat pipes, three cells, speakers, lid with hinge and emissive desktop). Phone/Laptop toggle on the model view
- [x] P2 Remaining models, all scored 4+: motion glove (Wearables), CanSat (Space & CanSats), weather station (Smart Home & IoT), RC buggy (RC Vehicles), FDM 3D printer (3D Printers & CNC), desktop synth (Audio & Synths). Every visible category now opens a hyper-real model; no category had to be hidden for quality

### Realism scores (1-5: silhouette / proportions / materials / detail / lighting)
| Model | Sil | Prop | Mat | Detail | Light | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Drone (approved reference) | 4 | 4 | 4 | 5 | 4 | Studio HDRI only |
| Balancing cube | 4 | 4 | 4 | 4 | 4 | Compared with photos of reaction-wheel cubes: plates, brass-weighted wheels and corner blocks match; aluminium roughness fixed after pass 1 (was mirror-like) |
| Rocker-bogie rover | 4 | 4 | 4 | 4 | 4 | Compared with hobby rocker-bogie builds: 2020 extrusion frame and arms with T-slots, 120 mm wheels with curved spokes and grousers, stereo mast; differential bar toned down after pass 1 |
| Six-axis arm | 4 | 4 | 4 | 4 | 4 | Compared with printed desktop arms on standard servos: servo housings with ears, labels, brass splines and aluminium horns; twin printed side plates with layer lines and spacers; parallel gripper with pads. Base/turntable switched from printed to moulded plastic after pass 1 (lathe UVs made the layer lines moiré) |
| Phone | 4 | 4 | 4 | 4 | 4 | 147 x 71.5 x 7.8 mm, 10.5 mm corners; compared with current flat-sided phones: frame band with antenna breaks and buttons, emissive home screen behind transmissive cover glass, camera plateau with ringed lens stacks; lens orientation fixed after pass 1 |
| Laptop | 4 | 4 | 4 | 4 | 4 | 304 x 212 x 15.5 mm; compared with 13-inch aluminium laptops: keyboard 12 mm from the hinge with an 11 mm gap to a 122 x 70 mm glass trackpad, speaker grilles, hinge barrel, desktop UI; pass 1 had the keyboard and trackpad cut-outs overlapping and the model turned side-on |
| Motion glove (P2) | 4 | 4 | 4 | 4 | 4 | Knit glove on the MIT hand mesh, Arduino 101 (68.6 x 53.3 mm) on a printed carrier with brass standoffs, LiPo + charger on the wrist, grab switch on the index finger, stitched leads; pass 1 cuff was a solid disc, fixed |
| CanSat (P2) | 4 | 4 | 4 | 4 | 4 | 66 x 115 mm; compared with competition CanSats: round boards on four M3 rods with nuts, ESP32 module, BME280 + IMU breakouts, shielded LoRa with SMA whip, ceramic GPS patch, packed parachute, eye bolt; caps switched to moulded plastic (lathe moiré) |
| Weather station (P2) | 4 | 4 | 4 | 4 | 4 | Compared with DIY solar weather stations: louvered radiation shield, 3-cup anemometer + vane on a crossbar, funnel rain gauge, framed 24-cell panel, IP65 box with glands, U-bolt arms, cable ties; solar cell texture moved to its own plane after pass 1 |
| RC buggy (P2) | 4 | 4 | 4 | 4 | 4 | 1/10 scale; compared with electric buggies: painted cab-forward shell with inside-painted windows and stripe, wing on struts, pin-spike tyres on six-spoke rims, coil-overs with helix springs, 64 T spur, fan-cooled ESC, hard-case 2S; pass 1 shell was a faceted bubble, rebuilt |
| 3D printer (P2) | 4 | 4 | 4 | 4 | 4 | Compared with i3-style bed-slingers: 2020/2040 frame with T-slots, labelled NEMA 17s, T8 lead screws, direct-drive hot end with heatsink fins, heater block and brass nozzle, PEI bed on springs and knobs, LCD + knob, PSU, 1 kg spool and PTFE tube, a print in progress |
| Synthesizer (P2) | 4 | 4 | 4 | 4 | 4 | Compared with compact desktop synths: walnut cheeks, anodized panel with legends, 12 knobs with pointer lines, encoder, OLED, faders, jacks, 25 mini keys; pass 1 had the panel cut-out at the back and the PCB above the keys |
- [x] Verification (05:55): lint clean, typecheck clean, 87 unit tests, production build, 67 Playwright tests (every page at 1440x900 and 1280x800 incl. every model category and Calibrate, glove/camera bench, hoop throw, calibration wizard). Fixed on the way: arrow keys could skip the Home slides (input-bus priority), e2e specs updated for V3 names, starter-build budgets
