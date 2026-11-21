import { Brand } from "../components/Icon";
import { useTitle } from "../lib/hooks";
import { usePreferences } from "../lib/preferences";
import { Link } from "../lib/router";

export default function NotFound({ title, text }: { title?: string; text?: string }) {
  const { t } = usePreferences();
  const resolvedTitle = title ?? t("Halaman tidak ditemukan", "Page not found");
  const resolvedText = text ?? t("Alamat yang kamu buka tidak tersedia atau sudah dipindahkan.", "The address you opened is unavailable or has been moved.");
  useTitle(`${resolvedTitle} - Ulanganku`, true);
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" aria-label={t("Kembali ke beranda", "Back to home")}>
          <Brand />
        </Link>
        <h1>{resolvedTitle}</h1>
        <p>{resolvedText}</p>
        <Link to="/" className="btn btn-primary btn-lg btn-block">
          {t("Ke beranda", "Go home")}
        </Link>
      </div>
    </div>
  );
}
