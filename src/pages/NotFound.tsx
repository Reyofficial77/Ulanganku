import { Brand } from "../components/Icon";
import { useTitle } from "../lib/hooks";
import { Link } from "../lib/router";

export default function NotFound({ title = "Halaman tidak ditemukan", text = "Alamat yang kamu buka tidak tersedia atau sudah dipindahkan." }: { title?: string; text?: string }) {
  useTitle(`${title} - Ulanganku`, true);
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" aria-label="Kembali ke beranda">
          <Brand />
        </Link>
        <h1>{title}</h1>
        <p>{text}</p>
        <Link to="/" className="btn btn-primary btn-lg btn-block">
          Ke beranda
        </Link>
      </div>
    </div>
  );
}
