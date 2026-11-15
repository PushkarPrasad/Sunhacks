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
