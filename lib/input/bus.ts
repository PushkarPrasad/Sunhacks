// One small event bus for every input method. Keyboard, the gesture ring (which types keys), webcam gestures
// and voice commands all emit the same actions; pages subscribe to the ones they care about.

export type InputAction =
  | "select"
  | "back"
  | "explode"
  | "collapse"
  | "toggleExplode"
  | "zoomIn"
  | "zoomOut"
  | "rotate"
  | "prevPage"
  | "nextPage"
  | "showChecks"
  | "exportBoard"
  | "startScratch";

export interface InputEvent {
  action: InputAction;
  /** Gesture payloads: zoom factor or rotation delta from two-hand pinch. */
  value?: number;
  source: "keyboard" | "gesture" | "voice" | "ui";
}

type Handler = (e: InputEvent) => boolean | void;
const handlers = new Map<InputAction, Handler[]>();

/** Subscribe; returns an unsubscribe function. Later subscribers run first and can return true to consume. */
export function onInput(action: InputAction, handler: Handler): () => void {
  const list = handlers.get(action) ?? [];
  handlers.set(action, [handler, ...list]);
  return () => handlers.set(action, (handlers.get(action) ?? []).filter((h) => h !== handler));
}

export function emitInput(action: InputAction, source: InputEvent["source"] = "ui", value?: number): boolean {
  for (const h of handlers.get(action) ?? []) {
    if (h({ action, source, value }) === true) return true;
  }
  return false;
}
