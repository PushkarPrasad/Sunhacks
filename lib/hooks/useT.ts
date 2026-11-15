"use client";

import { useUi } from "@/stores/ui";
import { uiText, type UiKey } from "@/lib/i18n/ui";

export function useT() {
  const lang = useUi((s) => s.lang);
  return (key: UiKey) => uiText(key, lang);
}
