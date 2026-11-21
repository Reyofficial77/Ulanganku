import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type Language = "id" | "en";

export type UserPreferences = {
  theme: ThemeMode;
  accent: string;
  language: Language;
};

const STORAGE_KEY = "ulanganku_preferences";
export const DEFAULT_ACCENT = "#1b78c8";
const HEX_RE = /^#[0-9a-f]{6}$/i;

const DEFAULT_PREFS: UserPreferences = {
  theme: "light",
  accent: DEFAULT_ACCENT,
  language: "id",
};

const listeners = new Set<(prefs: UserPreferences) => void>();

function readStored(): UserPreferences {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!raw || typeof raw !== "object") return DEFAULT_PREFS;
    const theme: ThemeMode = raw.theme === "dark" || raw.theme === "system" ? raw.theme : "light";
    const accent = typeof raw.accent === "string" && HEX_RE.test(raw.accent) ? raw.accent.toLowerCase() : DEFAULT_ACCENT;
    const language: Language = raw.language === "en" ? "en" : "id";
    return { theme, accent, language };
  } catch {
    return DEFAULT_PREFS;
  }
}

let currentPrefs: UserPreferences = typeof window !== "undefined" ? readStored() : DEFAULT_PREFS;

export function resolveTheme(theme: ThemeMode): "light" | "dark" {
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

export function applyPreferences(prefs: UserPreferences) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const resolved = resolveTheme(prefs.theme);
  root.dataset.theme = resolved;
  root.lang = prefs.language;

  if (prefs.accent.toLowerCase() !== DEFAULT_ACCENT && HEX_RE.test(prefs.accent)) {
    const surface = resolved === "dark" ? "#131c2b" : "#ffffff";
    root.style.setProperty("--brand", prefs.accent);
    root.style.setProperty("--brand-hover", `color-mix(in srgb, ${prefs.accent} 85%, black)`);
    root.style.setProperty("--brand-soft", `color-mix(in srgb, ${prefs.accent} ${resolved === "dark" ? "18%" : "13%"}, ${surface})`);
    root.style.setProperty("--brand-fill", prefs.accent);
  } else {
    root.style.removeProperty("--brand");
    root.style.removeProperty("--brand-hover");
    root.style.removeProperty("--brand-soft");
    root.style.removeProperty("--brand-fill");
  }
}

let initialized = false;

export function initPreferences() {
  if (typeof window === "undefined") return;
  currentPrefs = readStored();
  applyPreferences(currentPrefs);
  if (initialized) return;
  initialized = true;
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  media?.addEventListener?.("change", () => {
    if (currentPrefs.theme === "system") applyPreferences(currentPrefs);
  });
}

export function updatePreferences(patch: Partial<UserPreferences>) {
  currentPrefs = {
    theme: patch.theme ?? currentPrefs.theme,
    accent: patch.accent && HEX_RE.test(patch.accent) ? patch.accent.toLowerCase() : currentPrefs.accent,
    language: patch.language ?? currentPrefs.language,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentPrefs));
  } catch { /* storage may be disabled */ }
  applyPreferences(currentPrefs);
  for (const listener of listeners) listener(currentPrefs);
}

export function getLanguage(): Language {
  return currentPrefs.language;
}

export function tr(idText: string, enText: string): string {
  return currentPrefs.language === "en" ? enText : idText;
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<UserPreferences>(currentPrefs);

  useEffect(() => {
    listeners.add(setPrefs);
    return () => {
      listeners.delete(setPrefs);
    };
  }, []);

  const t = (idText: string, enText: string) => (prefs.language === "en" ? enText : idText);

  return {
    prefs,
    t,
    setTheme: (theme: ThemeMode) => updatePreferences({ theme }),
    setAccent: (accent: string) => updatePreferences({ accent }),
    setLanguage: (language: Language) => updatePreferences({ language }),
    resetAppearance: () => updatePreferences({ theme: "light", accent: DEFAULT_ACCENT }),
  };
}
