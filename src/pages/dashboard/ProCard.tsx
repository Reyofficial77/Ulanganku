import { useState } from "react";
import { Icon } from "../../components/Icon";
import { api, type ProStatus } from "../../lib/api";
import { formatDateShort } from "../../lib/format";
import { useApi } from "../../lib/hooks";
import { navigate } from "../../lib/router";

export default function ProCard({ notify }: { notify: (message: string) => void }) {
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
      notify("Promo PRO aktif. Nikmati fitur PRO.");
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
        <strong><Icon name="shield" size={15} /> PRO aktif</strong>
        <p>Berlaku sampai {formatDateShort(data.expiresOn)}</p>
      </div>
    );
  }

  return (
    <div className="pro-card">
      {data?.trialAvailable && (
        <>
          <strong>Coba PRO gratis {data.trialDays} hari</strong>
          <p>Promo untuk akun terdaftar. Hanya berlaku satu kali per perangkat.</p>
          <button className="btn btn-outline btn-block pro-button" onClick={claimTrial} disabled={busy}>
            Aktifkan promo
          </button>
        </>
      )}
      <strong>Upgrade ke PRO</strong>
      <p>Buka fitur tambahan untuk ulangan sekolahmu.</p>
      <button className="btn btn-primary btn-block pro-button" onClick={startUpgrade} disabled={busy}>
        {busy ? "Memproses..." : "Upgrade ke PRO"}
      </button>
    </div>
  );
}
