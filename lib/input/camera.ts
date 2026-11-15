"use client";

// Webcam hand tracking engine (MediaPipe Hand Landmarker). One instance for the whole app. startCamera() calls
// getUserMedia synchronously so it can run inside the same click handler as the glove chooser. Gesture events
// go to the shared input store and to any subscriber (the ring cursor layer, the Home hand rig).

import { fireAction, setGrab, useInput } from "@/stores/input";
import { GestureRecognizer, type GestureEvent, type Hand, type Pt } from "./gestures";

const MP_VERSION = "1.2.3";
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

type Landmarker = { detectForVideo: (v: HTMLVideoElement, t: number) => { landmarks: Pt[][]; worldLandmarks?: Pt[][] }; close: () => void };
type Listener = (e: GestureEvent) => void;
type FrameListener = (hands: Pt[][], world: Pt[][]) => void;

let stream: MediaStream | null = null;
let video: HTMLVideoElement | null = null;
let landmarker: Landmarker | null = null;
let raf = 0;
let runId = 0;
let rec: GestureRecognizer | null = null;
const listeners = new Set<Listener>();
const frameListeners = new Set<FrameListener>();
let latest: { hands: Pt[][]; world: Pt[][] } = { hands: [], world: [] };

export const cameraVideo = () => video;
export const latestHands = () => latest;

export function onGesture(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function onHandFrame(l: FrameListener): () => void {
  frameListeners.add(l);
  return () => frameListeners.delete(l);
}

/** Shared fusion for camera gestures; DOM clicking and the ring cursor live in GestureLayer. */
function route(e: GestureEvent) {
  switch (e.type) {
    case "swipe":
      fireAction(e.dir === "right" ? "nextPage" : "prevPage", "camera", e.dir === "right" ? "Swipe right" : "Swipe left");
      break;
    case "explode":
      fireAction("explode", "camera", "Spread (explode)");
      break;
    case "collapse":
      fireAction("collapse", "camera", "Fist tap (collapse)");
      break;
    case "grabStart":
      setGrab("camera", true);
      break;
    case "grabEnd":
      setGrab("camera", false);
      break;
  }
  for (const l of listeners) l(e);
}

export function startCamera(): Promise<void> {
  const st = useInput.getState().camera;
  if (st === "starting" || st === "on") return Promise.resolve();
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    useInput.setState({ camera: "error", cameraNotice: "No camera on this device. The glove still works." });
    return Promise.resolve();
  }
  const id = ++runId;
  useInput.setState({ camera: "starting", cameraNotice: null, pipOpen: true });
  // Called before any await so the permission prompt belongs to the click that started it.
  const media = navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" } });
  return (async () => {
    try {
      stream = await media;
      if (id !== runId) return stopTracks();
      video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM);
      const lmk = (await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 2,
      })) as unknown as Landmarker;
      if (id !== runId) {
        lmk.close();
        return;
      }
      landmarker = lmk;
      rec = new GestureRecognizer({ width: window.innerWidth, height: window.innerHeight });
      useInput.setState({ camera: "on" });
      loop(id);
    } catch (e) {
      if (id !== runId) return;
      stopTracks();
      const denied = e instanceof Error && (e.name === "NotAllowedError" || e.name === "SecurityError");
      useInput.setState({
        camera: denied ? "denied" : "error",
        cameraNotice: denied ? "Camera blocked. The glove still works; allow the camera in the address bar to add hand tracking." : "Hand tracking could not start. The glove still works.",
      });
    }
  })();
}

function loop(id: number) {
  let lastT = -1;
  const tick = () => {
    if (id !== runId || !landmarker || !video || !rec) return;
    const now = performance.now();
    if (video.readyState >= 2 && video.currentTime !== lastT) {
      lastT = video.currentTime;
      const res = landmarker.detectForVideo(video, now);
      const hands: Hand[] = (res.landmarks ?? []).map((landmarks) => ({ landmarks }));
      feedHands(hands, res.worldLandmarks ?? [], now);
    }
    raf = requestAnimationFrame(tick);
  };
  tick();
}

/** Runs one frame of landmarks through the recogniser. Exported so tests can inject fake hands. */
export function feedHands(hands: Hand[], world: Pt[][] = [], now = performance.now()) {
  if (!rec) rec = new GestureRecognizer({ width: window.innerWidth, height: window.innerHeight });
  rec.resize(window.innerWidth, window.innerHeight);
  latest = { hands: hands.map((h) => h.landmarks), world };
  for (const e of rec.update(hands, now)) route(e);
  const s = useInput.getState();
  const seen = hands.length > 0;
  if (s.handSeen !== seen || s.cameraPose !== rec.pose) useInput.setState({ handSeen: seen, cameraPose: rec.pose });
  for (const l of frameListeners) l(latest.hands, latest.world);
}

function stopTracks() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
}

export function stopCamera() {
  runId++;
  cancelAnimationFrame(raf);
  landmarker?.close();
  landmarker = null;
  stopTracks();
  if (video) video.srcObject = null;
  video = null;
  rec = null;
  latest = { hands: [], world: [] };
  setGrab("camera", false);
  useInput.setState({ camera: "off", handSeen: false, cameraPose: "none" });
}

if (typeof window !== "undefined") {
  // Test hook: Playwright drives the fusion with fake landmarks (no camera in headless Chrome).
  (window as unknown as { __magicSmokeInput?: unknown }).__magicSmokeInput = { feedHands };
}
