import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Brand, Icon } from "../../components/Icon";
import { ErrorState, Spinner } from "../../components/ui";
import { api, type ProBranding } from "../../lib/api";
import { useApi, useTitle } from "../../lib/hooks";
import { navigate } from "../../lib/router";
import { uploadImage } from "../../lib/questions";
import { Topbar, useShell } from "./shell";

type Data = { active: boolean; branding: ProBranding };

const PRESETS = ["#1b78c8", "#0f766e", "#15803d", "#b45309", "#be123c", "#6d28d9", "#334155"];
const HEX = /^#[0-9a-f]{6}$/i;
const DEFAULT_ACCENT = "#1b78c8";

export default function ProSettings() {
  useTitle("Fitur PRO - Ulanganku", true);
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
    if (!HEX.test(accent)) return notify("Kode warna harus berformat #RRGGBB.");
    setSaving(true);
    try {
      await api("/pro/branding", { method: "PUT", body: { accent, schoolName, logoUrl } });
      notify("Tampilan PRO disimpan.");
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
      <Topbar title="Fitur PRO" />
      <div className="page-content">
        <section className="welcome-row">
          <div>
            <span className="eyebrow">PRO</span>
            <h1>Tampilan ulangan</h1>
            <p>Sesuaikan halaman ulangan murid dengan identitas sekolahmu.</p>
          </div>
        </section>

        {loading && !data && <Spinner />}
        {error && !data && <ErrorState message={error.message} onRetry={reload} />}

        {data && !active && (
          <div className="notice notice-warn" role="status">
            <Icon name="lock" size={16} />
            <span>
              Pengaturan ini khusus pengguna PRO. Kamu masih bisa melihat pratinjaunya.{" "}
              <button type="button" className="text-button pro-inline" onClick={upgrade}>Upgrade ke PRO</button>
            </span>
          </div>
        )}

        {data && (
          <div className="pro-layout">
            <section className="panel">
              <div className="panel-heading"><div><h2>Identitas sekolah</h2><p>Berlaku di halaman ulangan murid (ulanganku.vercel.app/nama-ulangan).</p></div></div>

              <label className="field">
                <span>Nama sekolah</span>
                <input className="plain-input" maxLength={60} placeholder="Contoh: SMPN 1 Contoh" value={schoolName} disabled={!active} onChange={(e) => setSchoolName(e.target.value)} />
                <small>Menggantikan nama "Ulanganku" di bagian atas halaman ulangan. Kosongkan untuk memakai nama bawaan.</small>
              </label>

              <div className="field">
                <span>Logo sekolah</span>
                <div className="logo-row">
                  {logoUrl ? <img className="logo-preview" src={logoUrl} alt="Logo sekolah" /> : <div className="logo-preview logo-empty"><Icon name="image" size={20} /></div>}
                  <div className="image-actions">
                    <button type="button" className="btn btn-outline btn-sm" disabled={!active || uploading} onClick={() => fileRef.current?.click()}>
                      <Icon name="upload" size={15} /> {uploading ? "Mengunggah..." : logoUrl ? "Ganti logo" : "Unggah logo"}
                    </button>
                    {logoUrl && <button type="button" className="btn btn-outline btn-sm" disabled={!active} onClick={() => setLogoUrl(null)}>Hapus</button>}
                  </div>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pickLogo(e.target.files?.[0])} />
                </div>
                <small>Dipakai juga sebagai ikon tab browser. Gunakan gambar persegi agar rapi.</small>
              </div>

              <div className="field">
                <span>Warna aksen</span>
                <div className="color-row">
                  <input type="color" aria-label="Pilih warna" className="color-input" value={safeAccent} disabled={!active} onChange={(e) => setAccent(e.target.value)} />
                  <input className="plain-input color-hex" maxLength={7} value={accent} disabled={!active} onChange={(e) => setAccent(e.target.value.trim())} aria-label="Kode warna hex" />
                </div>
                <div className="swatches">
                  {PRESETS.map((color) => (
                    <button key={color} type="button" className={`swatch${safeAccent.toLowerCase() === color ? " swatch-on" : ""}`} style={{ background: color }} aria-label={`Warna ${color}`} disabled={!active} onClick={() => setAccent(color)} />
                  ))}
                </div>
                <small>Warna yang terlalu terang akan ditolak agar teks tombol tetap terbaca.</small>
              </div>

              <button className="btn btn-primary" onClick={save} disabled={!active || saving}>
                {saving ? "Menyimpan..." : "Simpan perubahan"}
              </button>
            </section>

            <section className="panel">
              <div className="panel-heading"><div><h2>Pratinjau</h2><p>Seperti inilah tampilan halaman ulangan murid.</p></div></div>
              <div className="pro-preview" style={previewStyle}>
                <div className="pro-preview-header"><Brand size={24} name={schoolName.trim() || "Ulanganku"} logo={logoUrl} /></div>
                <div className="pro-preview-body">
                  <span className="eyebrow">ULANGAN</span>
                  <strong>Contoh Ulangan Harian</strong>
                  <div className="l-mock-option l-mock-option-on"><i /> Pilihan yang dipilih</div>
                  <div className="l-mock-option">Pilihan lainnya</div>
                  <span className="btn btn-primary btn-block">Mulai mengerjakan</span>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
