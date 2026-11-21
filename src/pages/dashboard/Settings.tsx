import { useEffect, useState } from "react";
import { Icon } from "../../components/Icon";
import { ErrorState, Spinner } from "../../components/ui";
import { api, type ProAiConfig } from "../../lib/api";
import { useApi, useTitle } from "../../lib/hooks";
import { DEFAULT_ACCENT, usePreferences, type ThemeMode } from "../../lib/preferences";
import { navigate } from "../../lib/router";
import { Topbar, useShell } from "./shell";

const PRESETS = ["#1b78c8", "#0f766e", "#15803d", "#b45309", "#be123c", "#6d28d9", "#334155"];
const HEX_RE = /^#[0-9a-f]{6}$/i;

const README_PLACEHOLDER = `# Topik Percakapan
- Bantu saya berdiskusi tentang materi pelajaran, penyusunan RPP, serta pembahasan soal.
- Jawab juga pertanyaan umum di luar platform Ulanganku jika diperlukan.

## Gaya & Aturan Jawaban
- Gunakan bahasa Indonesia yang jelas, ringkas, dan terstruktur.
- Sertakan contoh konkret bila menjelaskan konsep baru.`;

export default function Settings() {
  const { prefs, setTheme, setAccent, resetAppearance, t } = usePreferences();
  useTitle(`${t("Pengaturan", "Settings")} - Ulanganku`, true);
  const { notify } = useShell();

  const [hexInput, setHexInput] = useState(prefs.accent);
  useEffect(() => setHexInput(prefs.accent), [prefs.accent]);

  const { data: aiData, setData: setAiData, error: aiError, loading: aiLoading, reload: reloadAi } = useApi<ProAiConfig>("/pro/ai-config");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [savingAi, setSavingAi] = useState(false);

  useEffect(() => {
    if (!aiData) return;
    setAiEnabled(aiData.config.enabled);
    setCustomPrompt(aiData.config.customPrompt);
  }, [aiData]);

  const proActive = Boolean(aiData?.active);

  function applyHex(value: string) {
    setHexInput(value);
    if (HEX_RE.test(value)) setAccent(value);
  }

  async function saveAiConfig() {
    setSavingAi(true);
    try {
      const updated = await api<ProAiConfig>("/pro/ai-config", {
        method: "PUT",
        body: { enabled: aiEnabled, customPrompt },
      });
      setAiData(updated);
      notify(t("Konfigurasi AI disimpan.", "AI configuration saved."));
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setSavingAi(false);
    }
  }

  async function upgrade() {
    try {
      const { id } = await api<{ id: string }>("/pro/orders", { method: "POST", body: {} });
      navigate(`/unlockpro?=${id}`);
    } catch (err) {
      notify((err as Error).message);
    }
  }

  const themes: { id: ThemeMode; label: string; icon: "sun" | "moon" | "monitor" }[] = [
    { id: "light", label: t("Terang", "Light"), icon: "sun" },
    { id: "dark", label: t("Gelap", "Dark"), icon: "moon" },
    { id: "system", label: t("Ikuti sistem", "System"), icon: "monitor" },
  ];

  return (
    <>
      <Topbar title={t("Pengaturan", "Settings")} />
      <div className="page-content">
        <section className="welcome-row">
          <div>
            <span className="eyebrow">{t("PREFERENSI", "PREFERENCES")}</span>
            <h1>{t("Pengaturan", "Settings")}</h1>
            <p>{t("Atur tampilan dashboard, warna aksen, dan konfigurasi AI.", "Customize dashboard appearance, accent color, and AI settings.")}</p>
          </div>
        </section>

        <div className="settings-stack">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>{t("Tema & warna aksen", "Theme & accent color")}</h2>
                <p>{t("Perubahan diterapkan langsung dan tersimpan di browser.", "Changes apply immediately and are saved in your browser.")}</p>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  resetAppearance();
                  notify(t("Tampilan dikembalikan ke default.", "Appearance reset to default."));
                }}
              >
                <Icon name="rotate-ccw" size={14} /> {t("Reset", "Reset")}
              </button>
            </div>

            <div className="field">
              <span>{t("Tema tampilan", "Theme")}</span>
              <div className="theme-options" role="radiogroup" aria-label={t("Tema tampilan", "Theme")}>
                {themes.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={prefs.theme === item.id}
                    className={`theme-option ${prefs.theme === item.id ? "theme-option-on" : ""}`}
                    onClick={() => setTheme(item.id)}
                  >
                    <Icon name={item.icon} size={16} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <span>{t("Warna aksen", "Accent color")}</span>
              <div className="color-row">
                <input
                  type="color"
                  aria-label={t("Pilih warna aksen", "Pick accent color")}
                  className="color-input"
                  value={HEX_RE.test(hexInput) ? hexInput : DEFAULT_ACCENT}
                  onChange={(e) => applyHex(e.target.value)}
                />
                <input
                  className="plain-input color-hex"
                  maxLength={7}
                  value={hexInput}
                  onChange={(e) => applyHex(e.target.value.trim())}
                  aria-label={t("Kode warna hex", "Hex color code")}
                />
              </div>
              <div className="swatches" style={{ marginTop: 4 }}>
                {PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`swatch${prefs.accent.toLowerCase() === color ? " swatch-on" : ""}`}
                    style={{ background: color }}
                    aria-label={`${t("Warna", "Color")} ${color}`}
                    onClick={() => applyHex(color)}
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>{t("Konfigurasi AI (Khusus PRO)", "AI Configuration (PRO Only)")}</h2>
                <p>
                  {t(
                    "Atur topik percakapan dan instruksi chatbot secara bebas menggunakan format teks seperti README.md.",
                    "Configure chatbot conversation topics and instructions freely using README.md-style text.",
                  )}
                </p>
              </div>
            </div>

            {aiLoading && !aiData && <Spinner />}
            {aiError && !aiData && <ErrorState message={aiError.message} onRetry={reloadAi} />}

            {aiData && !proActive && (
              <div className="notice notice-warn" role="status">
                <Icon name="lock" size={16} />
                <span>
                  {t("Konfigurasi topik AI khusus pengguna PRO. Pengguna biasa dibatasi hanya pada topik platform Ulanganku.", "Custom AI topic configuration is exclusive to PRO users. Regular users are restricted to Ulanganku platform topics.")}{" "}
                  <button type="button" className="text-button pro-inline" onClick={() => void upgrade()}>
                    {t("Upgrade ke PRO", "Upgrade to PRO")}
                  </button>
                </span>
              </div>
            )}

            {aiData && (
              <>
                <div className="toggle-row" style={{ borderTop: 0, paddingTop: 0 }}>
                  <div>
                    <strong>{t("Aktifkan topik percakapan kustom", "Enable custom conversation topic")}</strong>
                    <span>
                      {t(
                        "Bebaskan chatbot dari batas topik Ulanganku dan ikuti teks panduan di bawah ini.",
                        "Unlock the chatbot from Ulanganku-only topic limits and follow the guide text below.",
                      )}
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={aiEnabled}
                    className={`toggle ${aiEnabled ? "toggle-on" : ""}`}
                    disabled={!proActive || savingAi}
                    onClick={() => setAiEnabled((value) => !value)}
                  >
                    <span />
                  </button>
                </div>

                <label className="field" style={{ marginTop: 14 }}>
                  <span>
                    {t("Panduan & topik percakapan AI (Markdown / README.md)", "AI topic & instructions (Markdown / README.md)")}
                  </span>
                  <textarea
                    className="settings-ai-textarea"
                    rows={11}
                    maxLength={6000}
                    disabled={!proActive || savingAi}
                    placeholder={README_PLACEHOLDER}
                    value={customPrompt}
                    onChange={(e) => {
                      const next = e.target.value;
                      setCustomPrompt(next);
                      if (!aiEnabled && next.trim().length > 0 && customPrompt.trim().length === 0) {
                        setAiEnabled(true);
                      }
                    }}
                  />
                  <small>
                    {t(
                      `Mendukung format Markdown seperti README.md (${customPrompt.length}/6000 karakter). Penilaian jawaban uraian murid tetap menggunakan model gemma4:31b-it.`,
                      `Supports README.md-style Markdown (${customPrompt.length}/6000 characters). Student essay grading continues to use gemma4:31b-it.`,
                    )}
                  </small>
                </label>

                <button type="button" className="btn btn-primary" onClick={() => void saveAiConfig()} disabled={!proActive || savingAi}>
                  {savingAi ? t("Menyimpan...", "Saving...") : t("Simpan konfigurasi AI", "Save AI configuration")}
                </button>
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
