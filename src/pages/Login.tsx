import { useEffect } from "react";
import { Brand, GoogleMark, Icon } from "../components/Icon";
import { useAuth } from "../lib/auth";
import { useTitle } from "../lib/hooks";
import { Link, navigate, useLocation } from "../lib/router";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/dashboard";
  return value;
}

export default function Login() {
  useTitle("Masuk - Ulanganku", true);
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
        <Link to="/" aria-label="Kembali ke beranda">
          <Brand />
        </Link>
        <h1>Masuk ke Ulanganku</h1>
        <p>Gunakan akun Google untuk membuat dan mengelola ulangan.</p>

        {failed && (
          <div className="notice notice-danger" role="alert">
            <Icon name="alert" size={16} />
            <span>Login dengan Google gagal. Silakan coba lagi.</span>
          </div>
        )}

        <a className="btn btn-outline btn-lg btn-block google-button" href={`/api/auth/google?next=${encodeURIComponent(next)}`}>
          <GoogleMark size={20} />
          Lanjutkan dengan Google
        </a>

        <div className="auth-note">
          <Icon name="shield" size={16} />
          <span>Kami hanya membaca nama, email, dan foto profil Google. Murid tidak perlu login.</span>
        </div>

        <Link to="/" className="auth-back">
          <Icon name="arrow" size={14} /> Kembali ke beranda
        </Link>
      </div>
    </div>
  );
}
