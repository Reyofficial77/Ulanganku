import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Brand, Icon } from "../../components/Icon";
import { ErrorState, Spinner } from "../../components/ui";
import { api, type ProBranding } from "../../lib/api";
import { useApi, useTitle } from "../../lib/hooks";
import { usePreferences } from "../../lib/preferences";
import { navigate } from "../../lib/router";
import { uploadImage } from "../../lib/questions";
import { Topbar, useShell } from "./shell";

type Data = { active: boolean; branding: ProBranding };

const PRESETS = ["#1b78c8", "#0f766e", "#15803d", "#b45309", "#be123c", "#6d28d9", "#334155"];
const HEX = /^#[0-9a-f]{6}$/i;
const DEFAULT_ACCENT = "#1b78c8";

export default function ProSettings() {
  const { t } = usePreferences();
  useTitle(`${t("Fitur PRO", "PRO Features")} - Ulanganku`, true);
  const { notify } = useShell();
  const { data, error, loading, reload } = useApi<Data>("/pro/branding");
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [schoolName, setSchoolName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!data) return;
    setAccent(data.branding.accent ?? DEFAULT_ACCENT);
    setSchoolName(data.branding.schoolName);
    setLogoUrl(data.branding.logoUrl);
  }, [data]);

  const active = Boolean(data?.active);
  const safeAccent = HEX.test(accent) ? accent : DEFAULT_ACCENT;

  async function pickLogo(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      setLogoUrl(await uploadImage(file));
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    if (!HEX.test(accent)) return notify(t("Kode warna harus berformat #RRGGBB.", "Color code must use #RRGGBB format."));
    setSaving(true);
    try {
      await api("/pro/branding", { method: "PUT", body: { accent, schoolName, logoUrl } });
      notify(t("Tampilan PRO disimpan.", "PRO appearance saved."));
      reload();
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setSaving(false);
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

  const previewStyle = {
    "--brand": safeAccent,
    "--brand-fill": safeAccent,
    "--brand-hover": `color-mix(in srgb, ${safeAccent} 85%, black)`,
    "--brand-soft": `color-mix(in srgb, ${safeAccent} 12%, white)`,
  } as CSSProperties;

  return (
    <>
      <Topbar title={t("Fitur PRO", "PRO Features")} />
      <div className="page-content">
        <section className="welcome-row">
          <div>
            <span className="eyebrow">PRO</span>
            <h1>{t("Tampilan ulangan", "Exam branding")}</h1>
            <p>{t("Sesuaikan halaman ulangan murid dengan identitas sekolahmu.", "Customize the student exam page with your school identity.")}</p>
          </div>
        </section>

        {loading && !data && <Spinner />}
        {error && !data && <ErrorState message={error.message} onRetry={reload} />}

        {data && !active && (
          <div className="notice notice-warn" role="status">
            <Icon name="lock" size={16} />
            <span>
              {t("Pengaturan ini khusus pengguna PRO. Kamu masih bisa melihat pratinjaunya.", "This setting is exclusive to PRO users. You can still view the preview.")}{" "}
              <button type="button" className="text-button pro-inline" onClick={upgrade}>{t("Upgrade ke PRO", "Upgrade to PRO")}</button>
            </span>
          </div>
        )}

        {data && (
          <div className="pro-layout">
            <section className="panel">
              <div className="panel-heading"><div><h2>{t("Identitas sekolah", "School identity")}</h2><p>{t(`Berlaku di halaman ulangan murid (${window.location.host}/nama-ulangan).`, `Applies to student exam pages (${window.location.host}/exam-slug).`)}</p></div></div>

              <label className="field">
                <span>{t("Nama sekolah", "School name")}</span>
                <input className="plain-input" maxLength={60} placeholder={t("Contoh: SMPN 1 Contoh", "Example: Springfield High School")} value={schoolName} disabled={!active} onChange={(e) => setSchoolName(e.target.value)} />
                <small>{t("Menggantikan nama \"Ulanganku\" di bagian atas halaman ulangan. Kosongkan untuk memakai nama bawaan.", "Replaces \"Ulanganku\" at the top of the exam page. Leave blank to use default.")}</small>
              </label>

              <div className="field">
                <span>{t("Logo sekolah", "School logo")}</span>
                <div className="logo-row">
                  {logoUrl ? <img className="logo-preview" src={logoUrl} alt={t("Logo sekolah", "School logo")} /> : <div className="logo-preview logo-empty"><Icon name="image" size={20} /></div>}
                  <div className="image-actions">
                    <button type="button" className="btn btn-outline btn-sm" disabled={!active || uploading} onClick={() => fileRef.current?.click()}>
                      <Icon name="upload" size={15} /> {uploading ? t("Mengunggah...", "Uploading...") : logoUrl ? t("Ganti logo", "Change logo") : t("Unggah logo", "Upload logo")}
                    </button>
                    {logoUrl && <button type="button" className="btn btn-outline btn-sm" disabled={!active} onClick={() => setLogoUrl(null)}>{t("Hapus", "Remove")}</button>}
                  </div>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pickLogo(e.target.files?.[0])} />
                </div>
                <small>{t("Dipakai juga sebagai ikon tab browser. Gunakan gambar persegi agar rapi.", "Also used as the browser tab icon. Use a square image for best results.")}</small>
              </div>

              <div className="field">
                <span>{t("Warna aksen", "Accent color")}</span>
                <div className="color-row">
                  <input type="color" aria-label={t("Pilih warna", "Pick color")} className="color-input" value={safeAccent} disabled={!active} onChange={(e) => setAccent(e.target.value)} />
                  <input className="plain-input color-hex" maxLength={7} value={accent} disabled={!active} onChange={(e) => setAccent(e.target.value.trim())} aria-label={t("Kode warna hex", "Hex color code")} />
                </div>
                <div className="swatches">
                  {PRESETS.map((color) => (
                    <button key={color} type="button" className={`swatch${safeAccent.toLowerCase() === color ? " swatch-on" : ""}`} style={{ background: color }} aria-label={`${t("Warna", "Color")} ${color}`} disabled={!active} onClick={() => setAccent(color)} />
                  ))}
                </div>
                <small>{t("Warna yang terlalu terang akan ditolak agar teks tombol tetap terbaca.", "Overly bright colors will be rejected so button text stays readable.")}</small>
              </div>

              <button className="btn btn-primary" onClick={save} disabled={!active || saving}>
                {saving ? t("Menyimpan...", "Saving...") : t("Simpan perubahan", "Save changes")}
              </button>
            </section>

            <section className="panel">
              <div className="panel-heading"><div><h2>{t("Pratinjau", "Preview")}</h2><p>{t("Seperti inilah tampilan halaman ulangan murid.", "This is how the student exam page will look.")}</p></div></div>
              <div className="pro-preview" style={previewStyle}>
                <div className="pro-preview-header"><Brand size={24} name={schoolName.trim() || "Ulanganku"} logo={logoUrl} /></div>
                <div className="pro-preview-body">
                  <span className="eyebrow">{t("ULANGAN", "EXAM")}</span>
                  <strong>{t("Contoh Ulangan Harian", "Sample Daily Exam")}</strong>
                  <div className="l-mock-option l-mock-option-on"><i /> {t("Pilihan yang dipilih", "Selected option")}</div>
                  <div className="l-mock-option">{t("Pilihan lainnya", "Other option")}</div>
                  <span className="btn btn-primary btn-block">{t("Mulai mengerjakan", "Start exam")}</span>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
