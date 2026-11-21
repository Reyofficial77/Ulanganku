import { useEffect } from "react";
import { Brand, GoogleMark, Icon } from "../components/Icon";
import { useAuth } from "../lib/auth";
import { useTitle } from "../lib/hooks";
import { usePreferences } from "../lib/preferences";
import { Link, navigate, useLocation } from "../lib/router";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/dashboard";
  return value;
}

export default function Login() {
  const { t } = usePreferences();
  useTitle(`${t("Masuk", "Sign in")} - Ulanganku`, true);
  const { user, loading } = useAuth();
  const { params } = useLocation();
  const next = safeNext(params.get("next"));
  const failed = params.get("error") === "oauth";

  useEffect(() => {
    if (!loading && user) navigate(next, { replace: true });
  }, [loading, user, next]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" aria-label={t("Kembali ke beranda", "Back to home")}>
          <Brand />
        </Link>
        <h1>{t("Masuk ke Ulanganku", "Sign in to Ulanganku")}</h1>
        <p>{t("Gunakan akun Google untuk membuat dan mengelola ulangan.", "Use your Google account to create and manage exams.")}</p>

        {failed && (
          <div className="notice notice-danger" role="alert">
            <Icon name="alert" size={16} />
            <span>{t("Login dengan Google gagal. Silakan coba lagi.", "Google sign-in failed. Please try again.")}</span>
          </div>
        )}

        <a className="btn btn-outline btn-lg btn-block google-button" href={`/api/auth/google?next=${encodeURIComponent(next)}`}>
          <GoogleMark size={20} />
          {t("Lanjutkan dengan Google", "Continue with Google")}
        </a>

        <div className="auth-note">
          <Icon name="shield" size={16} />
          <span>{t("Kami hanya membaca nama, email, dan foto profil Google. Murid tidak perlu login.", "We only read your Google name, email, and profile picture. Students do not need to log in.")}</span>
        </div>

        <Link to="/" className="auth-back">
          <Icon name="arrow" size={14} /> {t("Kembali ke beranda", "Back to home")}
        </Link>
      </div>
    </div>
  );
}
