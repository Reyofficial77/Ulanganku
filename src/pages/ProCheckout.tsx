import { useEffect, useState } from "react";
import { Brand, Icon } from "../components/Icon";
import { Spinner } from "../components/ui";
import { useAuth } from "../lib/auth";
import { api, type ProOrder } from "../lib/api";
import { formatNumber } from "../lib/format";
import { useApi, useTitle } from "../lib/hooks";
import { usePreferences } from "../lib/preferences";
import { Link, navigate, useLocation } from "../lib/router";

type Method = "dana" | "gopay";

const METHOD_LABEL: Record<Method, string> = { dana: "DANA", gopay: "GoPay" };

export default function ProCheckout() {
  const { t } = usePreferences();
  useTitle(`${t("Upgrade PRO", "Upgrade to PRO")} - Ulanganku`, true);
  const { user, loading } = useAuth();
  const { pathname, search, params } = useLocation();
  // Format tautan: /unlockpro?=<checkoutSession>
  const orderId = (params.get("") || params.get("checkout") || "").trim();
  const [choosing, setChoosing] = useState<Method | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate(`/login?next=${encodeURIComponent(pathname + search)}`, { replace: true });
  }, [loading, user, pathname, search]);

  const { data, error, loading: orderLoading } = useApi<{ order: ProOrder }>(
    user && orderId ? `/pro/orders/${encodeURIComponent(orderId)}` : null,
  );

  async function choose(method: Method) {
    setChoosing(method);
    setNotice(null);
    try {
      const { waUrl } = await api<{ waUrl: string }>(`/pro/orders/${encodeURIComponent(orderId)}/method`, {
        method: "POST",
        body: { method },
      });
      window.location.assign(waUrl);
    } catch (err) {
      setNotice((err as Error).message);
      setChoosing(null);
    }
  }

  if (loading || !user) {
    return (
      <div className="splash" role="status">
        <span className="spinner" aria-hidden="true" /> {t("Memuat...", "Loading...")}
      </div>
    );
  }

  const order = data?.order;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" aria-label={t("Kembali ke beranda", "Back to home")}>
          <Brand />
        </Link>
        <h1>{t("Upgrade ke PRO", "Upgrade to PRO")}</h1>

        {!orderId && (
          <>
            <div className="notice notice-danger" role="alert">
              <Icon name="alert" size={16} />
              <span>{t("Pesanan tidak ditemukan. Buat pesanan dari dashboard.", "Order not found. Create an order from the dashboard.")}</span>
            </div>
            <Link to="/dashboard" className="auth-back"><Icon name="arrow" size={14} /> {t("Kembali ke dashboard", "Back to dashboard")}</Link>
          </>
        )}

        {orderId && orderLoading && !order && <Spinner label={t("Memuat pesanan...", "Loading order...")} />}

        {orderId && error && !order && (
          <div className="notice notice-danger" role="alert">
            <Icon name="alert" size={16} />
            <span>{error.message}</span>
          </div>
        )}

        {order && order.status === "done" && (
          <>
            <div className="notice">
              <Icon name="check" size={16} />
              <span>{t(`Pembayaran sudah dikonfirmasi. Fitur PRO aktif untuk akun ${user.email}.`, `Payment confirmed. PRO features are active for ${user.email}.`)}</span>
            </div>
            <Link to="/dashboard" className="btn btn-primary btn-block">{t("Buka dashboard", "Open dashboard")}</Link>
          </>
        )}

        {order && order.status === "cancelled" && (
          <>
            <div className="notice notice-danger" role="alert">
              <Icon name="alert" size={16} />
              <span>{t("Pesanan ini dibatalkan. Buat pesanan baru dari dashboard.", "This order was cancelled. Create a new order from the dashboard.")}</span>
            </div>
            <Link to="/dashboard" className="auth-back"><Icon name="arrow" size={14} /> {t("Kembali ke dashboard", "Back to dashboard")}</Link>
          </>
        )}

        {order && (order.status === "pending" || order.status === "waiting_payment") && (
          <>
            <p>
              {order.status === "pending"
                ? t("Pilih metode pembayaran. Kamu akan diarahkan ke WhatsApp admin dengan pesan pesanan yang sudah terisi.", "Select a payment method. You will be redirected to admin WhatsApp with a pre-filled order message.")
                : t("Pesananmu menunggu pembayaran. Kirim pembayaran ke admin, lalu tunggu konfirmasi.", "Your order is awaiting payment. Send payment to the admin, then wait for confirmation.")}
            </p>

            <dl className="pro-summary">
              <div><dt>{t("Kode pesanan", "Order code")}</dt><dd>{order.id.slice(0, 8).toUpperCase()}</dd></div>
              <div><dt>Email</dt><dd className="truncate">{user.email}</dd></div>
              <div><dt>{t("Metode", "Method")}</dt><dd>{order.paymentMethod ?? t("Belum dipilih", "Not selected")}</dd></div>
              {order.priceIdr !== null && (
                <div><dt>Total</dt><dd>Rp {formatNumber(order.priceIdr)}</dd></div>
              )}
            </dl>

            <p className="pro-note">{t("Pembayaran hanya tersedia lewat DANA atau GoPay.", "Payment is only available via DANA or GoPay.")}</p>

            <div className="pro-methods">
              {(["dana", "gopay"] as Method[]).map((method) => (
                <button
                  key={method}
                  type="button"
                  className={`pro-method${order.paymentMethod === METHOD_LABEL[method] ? " pro-method-on" : ""}`}
                  onClick={() => choose(method)}
                  disabled={choosing !== null || !order.adminWhatsappReady}
                >
                  {choosing === method ? t("Membuka WhatsApp...", "Opening WhatsApp...") : METHOD_LABEL[method]}
                </button>
              ))}
            </div>

            {!order.adminWhatsappReady && (
              <div className="notice notice-warn" role="status">
                <Icon name="alert" size={16} />
                <span>{t("Nomor WhatsApp admin belum diatur. Hubungi pengelola Ulanganku.", "Admin WhatsApp number is not configured. Contact the Ulanganku administrator.")}</span>
              </div>
            )}
            {notice && (
              <div className="notice notice-danger" role="alert">
                <Icon name="alert" size={16} />
                <span>{notice}</span>
              </div>
            )}
          </>
        )}

        <Link to="/dashboard" className="auth-back"><Icon name="arrow" size={14} /> {t("Kembali ke dashboard", "Back to dashboard")}</Link>
      </div>
    </div>
  );
}
