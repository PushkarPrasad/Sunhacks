# Magic Smoke: V4 (Reliability, Precision, Emerald)

You are continuing the Magic Smoke Next.js project. Work autonomously and think hard. Do not ask questions; make the call and log it in DECISIONS.md. Use as much reasoning and iteration as the work needs. Quality matters more than speed, but respect the hard stop.

## 0. Before Anything

1. Read AGENTS.md, PROGRESS.md, CHANGELOG.md, DECISIONS.md, STATUS.md and v3_prompt.md. Run `git status`, `git log --oneline | head -20` and `date`.
2. Timing: Devpost closes at 11:00 AM America/Phoenix.
   - **Hard stop for new work: 10:00 AM.**
   - 10:00 to 10:20: bug fixes only, then `npm run build` must pass, then commit.
   - If something is half-done at 10:00, revert it.
3. Commit locally after every finished task. **Never push. Never add a remote.**
4. Update PROGRESS.md and CHANGELOG.md after every task.
5. Load and use every design and testing skill installed in this project:
   - design-taste-frontend
   - image-to-code
   - web-design-guidelines
   - Anatomy
   - Playwright CLI
   - docs/awesome-design-md
   - frontend-design, if it's present

   Use any MCP connectors that are configured and useful. List which ones you used in PROGRESS.md.

## 1. What the User Saw on Real Hardware

1. The Arduino connects and works, then **freezes after about 30 seconds** and must be reset and reconnected.
2. Bluetooth **disconnects often**.
3. **Grab and rotate doesn't work.** Nobody can make it work.
4. **Expand/collapse by webcam is a gamble.** The user wants it continuous: open palm = fully exploded, half-open = half exploded, fist = collapsed.
5. **The webcam pointer is inaccurate.** A slight miss next to a button should still hit the button.
6. **The webcam pops up while navigating.** It must only start from the Calibration tab.
7. The blue/purple/black look feels generic. **Switch to an emerald green identity** that is classy, formal and modern, with fluid motion.

## 2. Priority Order

| # | Task | Section |
|---|------|---------|
| P0-1 | Glove reliability (firmware v4 + browser connection layer) | 3 |
| P0-2 | Grab and rotate that actually works | 4 |
| P0-3 | Continuous palm-openness explode | 5 |
| P0-4 | Snap-to-target pointer (bounding-box magnetism) | 6 |
| P0-5 | Camera only from Calibration; no pop-ups elsewhere | 7 |
| P0-6 | Calibration wizard covering all of the above, plus test page update | 8 |
| P1-1 | Emerald redesign of the whole site | 9 |
| P1-2 | Motion and fluidity pass | 10 |
| P2 | Polish, guideline audit, STATUS.md | 11 |

You cannot touch the real glove or a real webcam. Test everything with simulated input (scripted glove messages, recorded or synthetic landmark streams) in Playwright. Write a hardware test checklist in STATUS.md for the user to run.

## 3. Glove Reliability (P0-1)

### 3.1 Firmware

Replace `hardware/glove/glove.ino` with Appendix A exactly. What it changes:
- It only notifies when a central is connected **and** subscribed. The old version wrote notifications nonstop, even with nothing connected, which is the top suspect for the 30-second freeze.
- USB serial printing is off by default (`DEBUG_SERIAL`). A full USB serial buffer can block the loop.
- Orientation is sent at about 15 Hz, and only when it changes (plus a keepalive). This cuts BLE traffic by about 3x.
- It re-advertises after a disconnect.
- **Heartbeat LED:** a short flash every second while the loop runs. If the LED stops, the board hung. If it keeps flashing but the site stops updating, the link is at fault. Put this in STATUS.md so the user can tell which.

### 3.2 Browser Connection Layer (One Module, Used Everywhere)

1. **Singleton:** Keep the BluetoothDevice, the characteristics and the listeners in a module-level singleton outside React, so page navigation never drops the link. Check that every internal link uses Next `<Link>` / router navigation. Any full page reload kills Web Bluetooth, and is a likely cause of the "constant disconnections".
2. **Auto-reconnect:** On `gattserverdisconnected`, call `device.gatt.connect()` on the same device. No chooser is needed. Back off at 0.5 s, 1 s, 2 s and 4 s, then keep retrying every 5 s for 2 minutes. Re-subscribe to notifications after every reconnect.
3. **Stall watchdog:** If no message arrives for 4 s (READY arrives every 3 s), treat the link as stalled. Disconnect and reconnect.
4. **Writes:** One promise-chain queue, using `writeValueWithoutResponse`.
5. **Status pill** in the nav: Connected / Reconnecting… / Stalled / Off. Clicking it opens the Glove tab.
6. Log every connect, disconnect, reconnect and stall with a timestamp to an in-memory ring buffer, shown on the Glove tab. The user can screenshot it.

## 4. Grab and Rotate (P0-2)

The glove alone owns grab. The camera no longer grabs; a fist is used for collapse.

1. **Clutch:**
   - With a switch wired (any `BTN:` event seen this session), hold `BTN:DOWN` to grab and release on `BTN:UP`.
   - Without a switch, a knock (`G:SELECT`) **toggles** grab on any 3D view. Elsewhere a knock is a click.
2. **Math:** Build quaternions from `O:roll,pitch,yaw` (degrees, XYZ order).
   - At grab start, store `qGlove0` and `qModel0`.
   - Each frame, compute `qDelta = qGlove * inverse(qGlove0)`.
   - Target: `qModel = qDelta * qModel0`.
   - Slerp the model toward the target at 0.25 per frame.
   - Apply a 2° dead zone on the delta.
   - Map the sensor axes to screen axes so twisting the wrist like a doorknob turns the model the same way. Write the axis map in one constants object, and add a "flip axis" toggle on the Calibration tab per axis.
3. Releasing keeps the model where it is. `G:SHAKE` animates the model back to its default view.
4. Visible state on every 3D view: a small "Grabbed" chip with an emerald ring around the model while grabbed.
5. Test it with a scripted glove stream (grab, rotate 90° on each axis, release) and assert the model's final rotation matches within 5°.

## 5. Continuous Palm-Openness Explode (P0-3)

Replace the discrete spread/fist explode and collapse events with one continuous value.

1. **Openness 0..1:** Use MediaPipe world landmarks, which don't change with distance from the camera. For each of the four fingers, compute curl from the joint angles at MCP, PIP and DIP (the angles between bone vectors). Openness = 1 − mean normalized curl. Ignore the thumb, or give it 0.5 weight.
2. **Per-user range:** The Calibration tab records the user's fist value and full-open value. Map linearly between them and clamp to 0..1. Use sensible defaults when uncalibrated.
3. **Filtering:** One Euro filter (min cutoff about 1.0, beta about 0.02). Snap to exactly 0 below 0.08 and exactly 1 above 0.92.
4. **Gating:** Only drive the explode when hand confidence is above 0.7 and the palm faces the camera (palm normal within about 50° of the camera axis). Otherwise hold the last value. If the hand leaves the frame, hold for 1 s, then ease nothing; keep the last value.
5. **Engage:** Hand control only drives the explode while the hand is held still in frame for 300 ms, so the model doesn't jump as your hand enters.
6. Drive the existing explode slider from this value. Show a thin openness meter next to the slider while the hand is driving it.
7. Test with synthetic landmark sequences for a fist, half-open and full-open hand, plus noise. Assert the explode within ±0.1 and no flicker.

## 6. Snap-to-Target Pointer (P0-4)

1. **Pointer source:** Use the index-finger MCP joint (base knuckle) or the palm centre, **not the fingertip**. The fingertip moves when you pinch, and that moves the pointer off the button. Filter with a One Euro filter.
2. **Reach mapping:** Calibration records the four corners the user can comfortably point at. Map that box to the full viewport, so small hand movements cover the screen.
3. **Targets:** Every interactive element (links, buttons, cards, tabs, slider thumbs) registers itself through a `useSnapTarget` hook or a global scan of `[data-snap]`, role=button, `a` and `button`. Rebuild the rects on route change, scroll and resize.
4. **Magnetism:**
   - If the raw pointer is within 48 px of a target's rect, the effective pointer locks to that target. If several are in range, pick the nearest by distance to the rect edge, with a bias toward the currently locked one.
   - **Hysteresis:** stay locked until the raw pointer leaves the rect expanded by 72 px.
   - Draw the cursor as an emerald ring that morphs to wrap the locked target's rect (Motion layout animation), the way the Apple TV / iPadOS pointer does.
5. **Click intent:** Pinch-to-click fires on the target that was locked **150 ms before** the pinch started, so the pinch motion itself can't drag the click off the target. Pinch needs the thumb-to-index distance under a threshold (normalized by palm size) for at least 2 frames. Release hysteresis prevents double clicks.
6. **Test:** Make a grid of small buttons and use a scripted pointer path with ±30 px of noise. Assert at least 95% of clicks land on the intended button.

## 7. Camera Only From Calibration (P0-5)

1. Remove every automatic camera start, including the start on glove connect from V3. No page except Calibration (and `/test/glove-camera.html`) may call `getUserMedia`.
2. The Calibration tab has a "Start hand control" button. It is the only place the camera permission prompt can appear.
3. After that, hand control keeps running across pages with **no video pop-up**, only a small "Hand control on" pill in the nav with an off switch. The tracker lives in the same kind of singleton as the glove, so client navigation doesn't restart it.
4. A full reload turns hand control off. It never restarts on its own.
5. Grep the codebase and assert that `getUserMedia` appears only in the camera singleton and the test page.

## 8. Calibration Wizard and Test Page (P0-6)

The Calibration tab gets a clean stepper with an emerald check per step:

1. **Glove:** connect, then keep still for 2 s (shows the heartbeat LED tip), then tilt left/right/up/down, then twist like a doorknob. Show live axes, with flip-axis toggles if a direction is wrong.
2. **Grab:** press the switch, or knock to toggle grab, and rotate the preview cube.
3. **Camera:** start hand control.
4. **Openness:** hold a fist for 1.5 s, then open fully for 1.5 s. Save the range and show a live openness bar.
5. **Reach:** point at the four corner dots, holding about 1 s each.
6. **Click test:** hit five targets by pinching, and show the hit rate.

Save everything in localStorage, wrapped in try/catch. Add a "Reset calibration" button.

Update `public/test/glove-camera.html` to match:
- An openness meter
- The snap-target grid with hit rate
- Grab toggle and switch states
- The heartbeat/stall indicator
- The reconnect log

## 9. Emerald Redesign (P1-1)

Goal: classy, formal and modern. Think a private bank or a high-end instrument maker, not a gaming site. Calm, confident, plenty of space.

Replace the palette everywhere through the existing theme tokens. Grep for every old hex value (#7C5CFF, #9479FF, #3D7BFF, #A5B4FC, #0A0A10, #12121C, #1A1A2A, #2A2A3D) and remove them all.

| Token | Value | Use |
|---|---|---|
| bg | #06100C | Page |
| surface | #0B1914 | Cards, panels |
| raised | #11231C | Hover, popovers |
| hairline | #1F3A2F | Borders |
| hairline-strong | #2C5243 | Active borders |
| text | #EEF4F0 | Primary text |
| text-muted | #9BB3A7 | Secondary |
| text-faint | #6B8579 | Labels |
| emerald | #0F9D6B | Primary actions, focus |
| emerald-hover | #14B47C | Hover |
| emerald-deep | #0A6B49 | Pressed, fills |
| mint | #5EE2A8 | Live states, sparingly |
| champagne | #C8A96A | Fine details only: thin rules, small-caps eyebrows, numerals, one accent per screen |
| warning | #E8B04B | |
| danger | #F0706A | |

Design rules:
- Keep Instrument Serif headlines and Geist body. Use Geist Mono in small caps with wide tracking for eyebrows and data.
- Buttons: emerald fill with a subtle inner highlight, or hairline ghost. Radius 10 px. No neon glows; at most a soft emerald shadow on the main call-to-action.
- Backgrounds: a deep green-black with one soft radial emerald glow per slide and very faint film grain (2–3% opacity).
- 3D scenes: keep the HDRI. Give the floor reflection a very slight green tint. Selection outlines and explode guides use emerald.
- Sticky notes: a surface card with a 2 px emerald left rule. Warnings use an amber rule.
- Keep one-screen pages and the pitch-deck feel.
- Run the Taste and web-design-guidelines checks after the change. Take Playwright screenshots of every page before and after, and keep the after shots in `docs/screens/v4/`.

## 10. Motion and Fluidity (P1-2)

- Page transitions: fade plus 8 px rise, 240 ms, ease-out. Shared layout animation from a project card into its model view.
- Hover: a 2 px lift and a hairline brightening. Magnetic buttons should match the hand-pointer magnetism.
- Number and stat changes count up. The explode slider and openness meter animate smoothly.
- Respect `prefers-reduced-motion`.
- No animation may drop the 3D view below 50 fps on an M-series Mac.

## 11. Polish and Report (P2)

1. Fix anything the guideline audit flags.
2. Update docs/RUNDOWN.md: the new input design (clutch grab, continuous openness, target magnetism), with honest notes on what was tested with simulation versus real hardware.
3. Write STATUS.md with:
   - Done / partly done / hidden
   - The hardware test checklist: heartbeat LED, a 5-minute connection soak, grab-rotate on each axis, openness half-open, click accuracy
   - Known bugs
   - The last commit hash

## 12. Rules That Still Apply

- No AI wording in the UI. Never claim human expert review.
- Never fabricate results. Report only real measured numbers.
- Every new third-party asset goes into the RUNDOWN credits table.
- No brand logos.
- Never push. Never add a remote.

## Appendix A: hardware/glove/glove.ino (v4)

```cpp
// Magic Smoke glove v4, Arduino 101. Motion + optional grab switch. No extra libraries.
#include <CurieIMU.h>
#include <CurieBLE.h>
#include <math.h>

const bool HAS_BUTTON = true;       // false if no switch is wired
const bool BTN_ACTIVE_HIGH = true;  // true = Grove button, false = bare switch to GND
const int BTN_PIN = 4;
const bool DEBUG_SERIAL = false;    // true only while the Serial Monitor is open
const float SWIPE_G = 0.8;          // lower = easier swipes
const float KNOCK_G = 1.2;          // lower = easier knocks
const unsigned long O_EVERY_MS = 66;  // ~15 Hz orientation
const int LED = 13;

BLEService svc("19B10000-E8F2-537E-4F6C-D104768A1214");
BLECharacteristic evt("19B10001-E8F2-537E-4F6C-D104768A1214", BLERead | BLENotify, 20);
BLEUnsignedCharCharacteristic cmd("19B10002-E8F2-537E-4F6C-D104768A1214", BLEWrite | BLEWriteWithoutResponse);

volatile bool linked = false, readvertise = false;
float roll = 0, pitch = 0, yaw = 0;
float grav[3] = {0, 0, 1}, lin[3] = {0, 0, 0};
unsigned long lastUs = 0, lastO = 0, lastOSent = 0, lastReady = 0, cooldown = 0, lastKnock = 0;
int lastR = 999, lastP = 999, lastY = 999;
int spikeSign = 0, pendingDir = 0, reversals = 0;
unsigned long firstSpike = 0, lastSpike = 0;
int blinks = 0;
unsigned long blinkAt = 0;
bool btnRaw = false, btnState = false;
unsigned long btnChangeAt = 0;

void onConnect(BLEDevice c) { linked = true; }
void onDisconnect(BLEDevice c) { linked = false; readvertise = true; }

void send(const char *m) {
  if (DEBUG_SERIAL) Serial.println(m);
  if (linked && evt.subscribed()) evt.writeValue((const unsigned char *)m, strlen(m));
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
  BLE.setEventHandler(BLEConnected, onConnect);
  BLE.setEventHandler(BLEDisconnected, onDisconnect);
  BLE.advertise();
  lastUs = micros();
  blink(3);
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
  if (readvertise) { readvertise = false; BLE.advertise(); }
  if (cmd.written() && cmd.value() == 'B') blink(3);
  while (Serial.available()) if (Serial.read() == 'B') blink(3);

  unsigned long now = millis();
  if (blinks > 0) {
    if (now - blinkAt > 80) { blinkAt = now; blinks--; digitalWrite(LED, blinks % 2); }
  } else {
    digitalWrite(LED, (now % 1000) < 60);   // heartbeat: loop is alive
  }
  checkButton(now);

  if (micros() - lastUs < 10000) return;   // 100 Hz sensor loop
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

  if (now - lastO >= O_EVERY_MS) {
    lastO = now;
    int r = (int)roll, p = (int)pitch, y = (int)yaw;
    if (r != lastR || p != lastP || y != lastY || now - lastOSent > 1000) {
      lastR = r; lastP = p; lastY = y; lastOSent = now;
      char b[21];
      snprintf(b, sizeof(b), "O:%d,%d,%d", r, p, y);
      send(b);
    }
  }
  if (now - lastReady >= 3000) { lastReady = now; send("READY:CURIE"); }
}
```
