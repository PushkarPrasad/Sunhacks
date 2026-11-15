import type { Lang } from "./notes";

const en = {
  "nav.Home": "Home",
  "nav.Devices": "Devices",
  "nav.Builder": "Builder",
  "nav.Checks": "Checks",
  "nav.Board": "Board",
  "nav.Summary": "Summary",
  "check.power": "Power",
  "check.voltage": "Voltage",
  "check.pins": "Pins",
  "check.addresses": "Addresses",
  "check.cost": "Cost",
  "check.boardFit": "Board Fit",
  "note.apply": "Apply",
  "note.dismiss": "Dismiss",
  "note.applied": "Applied",
  "settings.title": "Settings",
  "settings.language": "Note language",
  "settings.contrast": "High contrast",
  "settings.motion": "Reduce motion",
  "settings.gestures": "Hand gestures (webcam)",
  "settings.ring": "Gesture ring haptics (USB)",
  "settings.voice": "Hold Space to speak a command",
  "notes.none": "No notes. Every check passed.",
  "notes.title": "Notes",
} as const;

type Key = keyof typeof en;

const es: Record<Key, string> = {
  "nav.Home": "Inicio",
  "nav.Devices": "Dispositivos",
  "nav.Builder": "Editor",
  "nav.Checks": "Comprobaciones",
  "nav.Board": "Placa",
  "nav.Summary": "Resumen",
  "check.power": "Energía",
  "check.voltage": "Voltaje",
  "check.pins": "Pines",
  "check.addresses": "Direcciones",
  "check.cost": "Coste",
  "check.boardFit": "Ajuste de placa",
  "note.apply": "Aplicar",
  "note.dismiss": "Descartar",
  "note.applied": "Aplicado",
  "settings.title": "Ajustes",
  "settings.language": "Idioma de las notas",
  "settings.contrast": "Alto contraste",
  "settings.motion": "Reducir movimiento",
  "settings.gestures": "Gestos con la mano (cámara)",
  "settings.ring": "Vibración del anillo (USB)",
  "settings.voice": "Mantén Espacio para dar una orden",
  "notes.none": "Sin notas. Todas las comprobaciones pasaron.",
  "notes.title": "Notas",
};

const hi: Record<Key, string> = {
  "nav.Home": "होम",
  "nav.Devices": "डिवाइस",
  "nav.Builder": "बिल्डर",
  "nav.Checks": "जाँच",
  "nav.Board": "बोर्ड",
  "nav.Summary": "सारांश",
  "check.power": "पावर",
  "check.voltage": "वोल्टेज",
  "check.pins": "पिन",
  "check.addresses": "एड्रेस",
  "check.cost": "लागत",
  "check.boardFit": "बोर्ड फ़िट",
  "note.apply": "लागू करें",
  "note.dismiss": "हटाएँ",
  "note.applied": "लागू हुआ",
  "settings.title": "सेटिंग्स",
  "settings.language": "नोट्स की भाषा",
  "settings.contrast": "हाई कॉन्ट्रास्ट",
  "settings.motion": "कम एनिमेशन",
  "settings.gestures": "हाथ के इशारे (वेबकैम)",
  "settings.ring": "रिंग वाइब्रेशन (USB)",
  "settings.voice": "कमांड बोलने के लिए Space दबाए रखें",
  "notes.none": "कोई नोट नहीं। सभी जाँच पास हुईं।",
  "notes.title": "नोट्स",
};

const dicts: Record<Lang, Record<Key, string>> = { en, es, hi };

export type UiKey = Key;
export function uiText(key: Key, lang: Lang): string {
  return dicts[lang]?.[key] ?? en[key];
}
