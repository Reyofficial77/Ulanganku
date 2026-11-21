import { useState } from "react";
import { Icon } from "../../components/Icon";
import { api, type ProStatus } from "../../lib/api";
import { formatDateShort } from "../../lib/format";
import { useApi } from "../../lib/hooks";
import { usePreferences } from "../../lib/preferences";
import { navigate } from "../../lib/router";

export default function ProCard({ notify }: { notify: (message: string) => void }) {
  const { t } = usePreferences();
  const { data, error, reload } = useApi<ProStatus>("/pro/status");
  const [busy, setBusy] = useState(false);

  async function startUpgrade() {
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>("/pro/orders", { method: "POST", body: {} });
      navigate(`/unlockpro?=${id}`);
    } catch (error) {
      notify((error as Error).message);
      setBusy(false);
    }
  }

  async function claimTrial() {
    setBusy(true);
    try {
      await api<ProStatus>("/pro/trial", { method: "POST", body: {} });
      notify(t("Promo PRO aktif. Nikmati fitur PRO.", "PRO promo active. Enjoy PRO features."));
      reload();
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!data && !error) return null;

  if (data?.active && data.expiresOn) {
    return (
      <div className="pro-card pro-card-active">
        <strong><Icon name="shield" size={15} /> {t("PRO aktif", "PRO active")}</strong>
        <p>{t("Berlaku sampai", "Valid until")} {formatDateShort(data.expiresOn)}</p>
      </div>
    );
  }

  return (
    <div className="pro-card">
      {data?.trialAvailable && (
        <>
          <strong>{t(`Coba PRO gratis ${data.trialDays} hari`, `Try PRO free for ${data.trialDays} days`)}</strong>
          <p>{t("Promo untuk akun terdaftar. Hanya berlaku satu kali per perangkat.", "Promo for registered accounts. Valid once per device.")}</p>
          <button className="btn btn-outline btn-block pro-button" onClick={claimTrial} disabled={busy}>
            {t("Aktifkan promo", "Activate promo")}
          </button>
        </>
      )}
      <strong>{t("Upgrade ke PRO", "Upgrade to PRO")}</strong>
      <p>{t("Buka fitur tambahan untuk ulangan sekolahmu.", "Unlock extra features for your school exams.")}</p>
      <button className="btn btn-primary btn-block pro-button" onClick={startUpgrade} disabled={busy}>
        {busy ? t("Memproses...", "Processing...") : t("Upgrade ke PRO", "Upgrade to PRO")}
      </button>
    </div>
  );
}
