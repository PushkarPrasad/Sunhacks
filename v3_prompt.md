# Magic Smoke: V3 Final Push (SunHacks 9.0)

You are continuing an existing Next.js project called Magic Smoke. Work autonomously. Do not ask questions; make the sensible call and log it in DECISIONS.md.

## 0. Before Anything

1. Read AGENTS.md, PROGRESS.md, CHANGELOG.md, DECISIONS.md and STATUS.md. Run `git log --oneline | head -20` and `git status`.
2. Run `date`. Devpost closes at 11:00 AM local time (America/Phoenix). **Hard stop for new features: 10:00 AM.** From 10:00 to 10:20 you only fix bugs, run `npm run build`, and commit. If the build fails at 10:15, revert the last broken change instead of debugging it.
3. Commit after each finished task (`git commit`, local only). **Never push. Never add a git remote.**
4. Update PROGRESS.md and CHANGELOG.md after every task so another agent can pick up mid-stream.
5. Work strictly in the priority order below. Whatever is unfinished at the hard stop must not be visible in a broken state.

## 1. Priority Order

| # | Task | Section |
|---|------|---------|
| P0-1 | Glove protocol + firmware file matches the new sketch | 2 |
| P0-2 | Camera turns on automatically when the glove connects; both run together | 3 |
| P0-3 | Combined camera + glove test page | 4 |
| P0-4 | Replace the hands illustration on the Home "Drive it with your hands" slide | 5 |
| P0-5 | Projects/devices tab order: drones first | 6 |
| P0-6 | Hoop Upload gag: make it findable and verify it works | 7 |
| P1-1 | Global realism pass (lighting, renderer, materials) that lifts every model | 8.1 |
| P1-2 | Hyper-real balancing cube, using the user's SolidWorks export if present | 8.3 |
| P1-3 | Hyper-real rover, robot arm | 8.4 |
| P1-4 | Rebuild phone and laptop models hyper-real | 8.5 |
| P2 | Remaining models | 8.6 |

The drone model is approved by the user. Do not restyle it beyond the global realism pass. Use it as the quality bar for everything else.

## 2. Glove Protocol and Firmware (P0-1)

Save the sketch in Appendix A as `hardware/glove/glove.ino` (create the folder). This is the firmware running on the Arduino 101 right now.

Messages arrive one per line over Bluetooth notify (or USB serial at 115200):

| Message | Meaning |
|---|---|
| `READY:CURIE` | Sent at boot and every 3 s. Treat as heartbeat. |
| `O:roll,pitch,yaw` | Integer degrees at 25 Hz. Yaw drifts slowly; always use deltas from a baseline taken at grab start. |
| `G:SWIPE_L`, `G:SWIPE_R` | Flick gestures |
| `G:SELECT` | Knock gesture |
| `G:SHAKE` | Recenter |
| `BTN:DOWN`, `BTN:UP` | Grab switch (only if the switch is wired) |

The board accepts a one-byte write `B` on the command characteristic to blink its LED 3 times.

BLE: service `19B10000-E8F2-537E-4F6C-D104768A1214`, events `19B10001-…` (notify), command `19B10002-…` (write). Device name "Copperline Glove". Filter `requestDevice` by service, not by name, because macOS caches old names. Queue all writes through one promise chain; use `writeValueWithoutResponse`. Old message formats (`MODE:MOTION`, `A:`, `G:THROW`) can be ignored.

Update the Glove tab, the Calibration tab, and the shared glove store to this protocol. The Glove tab shows: connection state, live roll/pitch/yaw, a small 3D preview that follows the glove, the last 8 events, and a "Blink LED" button. Disconnects must show clearly and offer one-click reconnect.

## 3. Glove + Camera Together (P0-2)

When the glove connects, start the webcam hand tracker (MediaPipe Hand Landmarker) in the same click handler, so the permission prompt is tied to a user gesture. Show a small picture-in-picture camera preview (bottom right, 200 px wide, landmarks drawn, close button). If the camera is denied, keep the glove working and show a one-line notice.

Input fusion rules (one shared input store, no duplicated logic per page):

| Action | Camera | Glove |
|---|---|---|
| Grab | Fist held | `BTN:DOWN` held (if wired) |
| Rotate model like a globe | — | While grabbed, apply roll/pitch/yaw deltas from the grab-start baseline, smoothed |
| Select | Pinch | `G:SELECT` |
| Explode | Spread (open palm) | — |
| Collapse | Fist tap | — |
| Next / previous page | Swipe | `G:SWIPE_R` / `G:SWIPE_L` |
| Recenter | — | `G:SHAKE` |

A camera fist counts as a grab, so grab + twist works even with no switch wired. Drop a second event of the same type from either source within 300 ms, so one motion doesn't fire twice.

## 4. Combined Test Page (P0-3)

Create `public/test/glove-camera.html`. It is a standalone file (no build step) served at `http://localhost:3000/test/glove-camera.html`. Load MediaPipe tasks-vision from a CDN. Dark theme matching the site.

Layout: a checklist on the left, the camera with landmarks top right, and a 3D cube bottom right. The cube rotates from glove deltas while grabbed (camera fist or switch). Score reads "X / N passed". Buttons: Connect Bluetooth, Connect USB, Start Camera, Recenter, Blink LED, Reset.

Checklist (each ticks green once achieved):
- Glove: found, live data, roll ±30°, pitch ±25°, yaw ±30°, swipe left, swipe right, select (knock), shake, switch down and up (marked "optional" if never seen)
- Camera: hand detected, pinch, spread, fist, swipe left, swipe right
- Fusion: fist + twist rotates the cube more than 45°

Show errors in a visible log, including "close the Arduino Serial Monitor first" on a USB failure. Test it headless with simulated messages and fake landmark input before moving on.

## 5. Home Hands Illustration (P0-4)

The current hand drawing on the "Drive it with your hands" slide is a crude box with ovals, and the user hates it. Replace it with a realistic 3D hand:

- Use the WebXR generic hand model (`@webxr-input-profiles/assets`, `generic-hand/right.glb`, MIT license). Download it into `public/models/hand/`. Credit it in docs/RUNDOWN.md. If that fails, use another CC0 or MIT rigged hand, never a hand-drawn primitive.
- Skin material: MeshPhysicalMaterial with sheen and a subtle subsurface feel. Same studio lighting as the product models.
- Pose the joints for each gesture: pinch, spread, fist, swipe (animate a motion, not a static pose), and grab + twist (fist rotating a small model of the drone).
- Clicking a row on the left plays that gesture, and the rows auto-cycle every 3 s. Ease between poses over about 400 ms.
- If the webcam is already on, mirror the live landmarks onto the rig.
- The text "one switch" should become "an optional switch".

## 6. Projects Tab Order (P0-5)

New category order:

1. Drones
2. Balancing Robots
3. Rovers
4. Robot Arms
5. Wearables
6. Space & CanSats
7. RC Vehicles
8. Smart Home & IoT
9. 3D Printers & CNC
10. Audio & Synths
11. Phones & Laptops
12. More (Coming Soon)

"Start blank" (custom canvas) becomes a separate button at the top, not a category. Within each category, put the most realistic model first.

## 7. Hoop Upload Gag (P0-6)

1. Find the existing implementation (`grep -ril hoop app components lib`). Confirm it works with mouse and trackpad: drag to throw the file-ball, and it uploads when it goes through the hoop. A small "Just upload it" link always skips the game.
2. Make it findable: put an "Upload" button with a small basketball icon in the Builder toolbar, and have `/builder?hoop=1` open it directly.
3. Test it with Playwright (simulate drag and throw), and confirm a file actually lands in the Builder.
4. Write in STATUS.md exactly how to open it.

## 8. Hyper-Realism

The user's standard: it should look like a product render or photo, not a CAD sketch. The drone is the reference.

### 8.1 Global Pass (P1-1), Applies to Every 3D View

- Renderer: ACESFilmic tone mapping, sRGB output, exposure tuned per scene, antialiasing, devicePixelRatio capped at 2.
- Lighting: a local CC0 studio HDRI from Poly Haven (1k .hdr) saved into `public/hdri/` and loaded by drei `<Environment files>`. No runtime network calls. Add a key light with soft shadows.
- Grounding: drei ContactShadows or AccumulativeShadows under every model.
- Post-processing (@react-three/postprocessing): N8AO ambient occlusion, SMAA, and bloom only on emissive LEDs and screens. Keep it subtle.
- One shared materials file:
  - Carbon fiber with a procedural weave normal map and clearcoat
  - Anodized aluminum (metalness 1, roughness about 0.35, tinted)
  - Steel screws
  - FR4 PCB with black or green solder mask plus clearcoat, gold pads and copper traces
  - Matte and gloss plastics, rubber, silicone wire insulation
  - Glass with transmission
  - Lithium pouch foil
- Performance target: 60 fps on an M-series Mac. Instance repeated parts (screws, keys, cells). Dispose geometries on unmount.

### 8.2 Modelling Rules for Every Model

- Real dimensions in millimetres, taken from real-world reference parts. Research them.
- No raw boxes or cylinders on show. Everything gets bevels, fillets or chamfers (RoundedBox, ExtrudeGeometry with bevel, lathe profiles).
- Visible real detail: screws, connectors, solder joints, generic silkscreen text via CanvasTexture, cable harnesses as TubeGeometry along curves with natural sag, heat-shrink, zip ties.
- No brand logos or trademarks anywhere.
- Every model supports the existing Solid / Transparent / X-ray shell modes and the continuous explode slider. Exploded parts move along sensible assembly axes.

### 8.3 Balancing Cube (P1-2)

If `public/models/cubli/` contains STL, STEP-converted GLB or OBJ files (the user's SolidWorks export), use them:
- Load each part (STLs are in millimetres; scale 0.001 to metres).
- Centre the assembly.
- Assign materials by part name (frame aluminum, wheels steel or brass, PCB, motors, battery).
- Build the explode from each part's offset from the assembly centre.
- Credit it as the team's own CAD in RUNDOWN.md.

If the folder is empty, build it procedurally:
- 150 mm aluminum cube frame with chamfered edges.
- Three reaction wheels on three faces, each with spokes and brass rim weights.
- BLDC gimbal motors.
- An IMU board.
- A controller PCB.
- A LiPo pack with balance lead.
- Wiring harness.

### 8.4 Rover, Robot Arm (P1-3)

Rover:
- Six-wheel rocker-bogie with spoked wheels and grousers.
- Aluminum extrusion chassis.
- Electronics bay with lid in transparent mode.
- Mast camera.

Robot arm:
- Six-axis desktop arm with servo housings and horns.
- Printed links with a visible layer-line normal map.
- Gripper.

### 8.5 Phones & Laptops (P1-4)

The user says the current ones look bad. Rebuild them.

Phone:
- Correct corner radii.
- Glass front and back with transmission.
- Metal frame with antenna lines.
- Camera bump with real lens stack (glass, rings).
- Screen showing a plausible emissive UI texture.
- Exploded internals: display stack, mid-frame, logic board with RF shields, pouch battery, flex cables, speaker, haptic motor, cameras.

Laptop:
- Unibody aluminum.
- Hinge.
- Instanced keycaps.
- Glass trackpad.
- Exploded internals: logic board, fan(s), heat pipe, battery cells, speakers, display panel.

### 8.6 Remaining Models (P2)

Glove, CanSat, weather station and others, in that order, until the hard stop.

### 8.7 Realism Check Loop (for Every Model)

1. Take Playwright screenshots at three angles (front three-quarter, top, exploded) in Solid mode.
2. Find two or three real reference photos of that kind of object and compare.
3. Score 1–5 on silhouette, proportions, materials, detail and lighting. Write the scores in PROGRESS.md.
4. Fix the weakest area and repeat. Stop when every score is 4 or higher, or after 25 minutes on that model.
5. **If a model is still below 4 on any axis at the hard stop, hide it behind "More (Coming Soon)".** A missing model is better than an ugly one in the demo.

## 9. Rules That Still Apply

- No AI wording in the UI. Never claim human expert review. Sticky notes keep the "Based on the checks we ran, we suggest…" voice.
- Never fabricate ML results. Report only real accuracy numbers.
- Keep the purple/black/blue palette (green sparingly) and one-screen pages.
- Every new third-party asset (HDRI, hand model, any CC0 model) goes into the docs/RUNDOWN.md credits table with license and URL.
- Never push and never add a remote.

## 10. Final Report (at 10:20 AM or when done)

Write STATUS.md with:
- What was finished, partly done or hidden.
- How to open the Glove tab, the combined test page and the Hoop gag.
- Any known bugs.
- The last commit hash.

## Appendix A: hardware/glove/glove.ino

```cpp
// Magic Smoke glove, Arduino 101. Motion + optional grab switch. No extra libraries.
#include <CurieIMU.h>
#include <CurieBLE.h>
#include <math.h>

const float SWIPE_G = 0.8;          // lower = easier swipes
const float KNOCK_G = 1.2;          // lower = easier knocks
const bool HAS_BUTTON = true;       // false if no switch is wired
const bool BTN_ACTIVE_HIGH = true;  // true = Grove button, false = bare switch to GND
const int BTN_PIN = 4;
const int LED = 13;

BLEService svc("19B10000-E8F2-537E-4F6C-D104768A1214");
BLECharacteristic evt("19B10001-E8F2-537E-4F6C-D104768A1214", BLERead | BLENotify, 20);
BLEUnsignedCharCharacteristic cmd("19B10002-E8F2-537E-4F6C-D104768A1214", BLEWrite | BLEWriteWithoutResponse);

float roll = 0, pitch = 0, yaw = 0;
float grav[3] = {0, 0, 1}, lin[3] = {0, 0, 0};
unsigned long lastUs = 0, lastO = 0, lastReady = 0, cooldown = 0, lastKnock = 0;
int spikeSign = 0, pendingDir = 0, reversals = 0;
unsigned long firstSpike = 0, lastSpike = 0;
int blinks = 0;
unsigned long blinkAt = 0;
bool btnRaw = false, btnState = false;
unsigned long btnChangeAt = 0;

void send(const char *m) {
  Serial.println(m);
  evt.writeValue((const unsigned char *)m, strlen(m));
}

void blink(int n) { blinks = n * 2; blinkAt = millis(); }

void setup() {
  Serial.begin(115200);
  pinMode(LED, OUTPUT);
  if (HAS_BUTTON) pinMode(BTN_PIN, BTN_ACTIVE_HIGH ? INPUT : INPUT_PULLUP);
  CurieIMU.begin();
  CurieIMU.setAccelerometerRange(4);
  CurieIMU.setGyroRange(500);
  CurieIMU.autoCalibrateGyroOffset();   // keep still ~2 s after power-on
  BLE.begin();
  BLE.setLocalName("Copperline Glove");
  BLE.setAdvertisedService(svc);
  svc.addCharacteristic(evt);
  svc.addCharacteristic(cmd);
  BLE.addService(svc);
  BLE.advertise();
  lastUs = micros();
  blink(3);
  send("READY:CURIE");
}

void detectSwipes(unsigned long now) {
  if (now < cooldown) return;
  float s = lin[0];
  int sign = s > SWIPE_G ? 1 : (s < -SWIPE_G ? -1 : 0);
  if (sign != 0 && sign != spikeSign) {
    if (pendingDir == 0 || now - lastSpike > 220) { pendingDir = sign; reversals = 0; firstSpike = now; }
    else reversals++;
    spikeSign = sign;
    lastSpike = now;
  }
  if (pendingDir != 0 && reversals >= 3 && now - firstSpike < 700) {
    send("G:SHAKE"); blink(1);
    pendingDir = 0; spikeSign = 0; reversals = 0; cooldown = now + 800;
  } else if (pendingDir != 0 && now - lastSpike > 220) {
    if (reversals < 3) { send(pendingDir > 0 ? "G:SWIPE_R" : "G:SWIPE_L"); blink(1); }
    pendingDir = 0; spikeSign = 0; reversals = 0; cooldown = now + 450;
  }
}

void checkButton(unsigned long now) {
  if (!HAS_BUTTON) return;
  bool raw = digitalRead(BTN_PIN) == (BTN_ACTIVE_HIGH ? HIGH : LOW);
  if (raw != btnRaw) { btnRaw = raw; btnChangeAt = now; }
  if (now - btnChangeAt > 25 && btnRaw != btnState) {
    btnState = btnRaw;
    send(btnState ? "BTN:DOWN" : "BTN:UP");
  }
}

void loop() {
  BLE.poll();
  if (cmd.written() && cmd.value() == 'B') blink(3);
  while (Serial.available()) if (Serial.read() == 'B') blink(3);

  unsigned long now = millis();
  if (blinks > 0 && now - blinkAt > 80) { blinkAt = now; blinks--; digitalWrite(LED, blinks % 2); }
  checkButton(now);

  if (micros() - lastUs < 10000) return;   // 100 Hz
  float dt = (micros() - lastUs) / 1e6;
  lastUs = micros();

  float ax, ay, az, gx, gy, gz;
  CurieIMU.readAccelerometerScaled(ax, ay, az);
  CurieIMU.readGyroScaled(gx, gy, gz);

  float accRoll = atan2(ay, az) * 57.2958;
  float accPitch = atan2(-ax, sqrt(ay * ay + az * az)) * 57.2958;
  roll = 0.98 * (roll + gx * dt) + 0.02 * accRoll;
  pitch = 0.98 * (pitch + gy * dt) + 0.02 * accPitch;
  yaw += gz * dt;
  if (yaw > 180) yaw -= 360;
  if (yaw < -180) yaw += 360;

  float g[3] = {ax, ay, az};
  for (int i = 0; i < 3; i++) { grav[i] = 0.92 * grav[i] + 0.08 * g[i]; lin[i] = g[i] - grav[i]; }

  detectSwipes(now);
  if (fabs(lin[2]) > KNOCK_G && fabs(lin[2]) > fabs(lin[0]) * 1.5 && now - lastKnock > 400) {
    lastKnock = now; send("G:SELECT"); blink(1);
  }

  if (now - lastO >= 40) {   // 25 Hz orientation
    lastO = now;
    char b[21];
    snprintf(b, sizeof(b), "O:%d,%d,%d", (int)roll, (int)pitch, (int)yaw);
    send(b);
  }
  if (now - lastReady >= 3000) { lastReady = now; send("READY:CURIE"); }
}
```
