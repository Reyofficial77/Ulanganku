import { Brand, GoogleMark, Icon } from "../components/Icon";
import { useAuth } from "../lib/auth";
import { useTitle } from "../lib/hooks";
import { Link } from "../lib/router";

const features = [
  { icon: "edit", title: "Editor soal pilihan ganda", text: "Tulis pertanyaan, atur kunci jawaban, dan biarkan perubahan tersimpan otomatis." },
  { icon: "link", title: "Satu tautan per ulangan", text: "Setiap ulangan punya URL sendiri yang mudah dibagikan lewat grup kelas." },
  { icon: "users", title: "Murid tanpa akun", text: "Murid cukup membuka tautan, mengisi nama, lalu langsung mengerjakan." },
  { icon: "check", title: "Penilaian otomatis", text: "Nilai dihitung saat jawaban dikumpulkan. Tidak perlu mengoreksi satu per satu." },
  { icon: "bolt", title: "Pantau realtime", text: "Lihat siapa yang sedang mengerjakan, siapa yang sudah selesai, dan nilai sementara." },
  { icon: "chart", title: "Hasil dan ekspor", text: "Distribusi nilai, soal tersulit, dan ekspor nilai ke file CSV untuk rekap." },
] as const;

const steps = [
  { title: "Masuk dengan Google", text: "Tanpa formulir pendaftaran panjang. Cukup satu akun Google." },
  { title: "Susun soal", text: "Buat soal di editor, atur durasi dan kelas, lalu pilih URL ulangan." },
  { title: "Bagikan dan pantau", text: "Kirim tautan ke murid dan pantau pengerjaan dari dashboard." },
];

const faqs = [
  { q: "Apakah murid perlu membuat akun?", a: "Tidak. Murid hanya membuka tautan ulangan dan mengisi nama. Hanya guru yang masuk dengan akun Google." },
  { q: "Bagaimana jika koneksi murid terputus?", a: "Jawaban tersimpan otomatis selama mengerjakan. Murid dapat membuka tautan yang sama dari perangkat yang sama dan melanjutkan, selama waktu pengerjaan belum habis." },
  { q: "Apakah satu murid bisa mengerjakan dua kali?", a: "Satu perangkat mendapat satu kesempatan per ulangan. Setelah dikumpulkan, jawaban tidak bisa diubah." },
  { q: "Bisakah URL ulangan diganti setelah dipublish?", a: "URL dikunci setelah pertama kali dipublish agar tautan yang sudah dibagikan tetap berlaku. Pilih nama yang jelas sebelum publish." },
  { q: "Siapa yang bisa melihat hasil ulangan?", a: "Hanya akun yang membuat ulangan. Murid melihat nilainya sendiri jika opsi tampilkan nilai diaktifkan." },
];

export default function Landing() {
  useTitle("Ulanganku - Ulangan online untuk sekolah");
  const { user } = useAuth();
  const host = window.location.host;

  return (
    <div className="landing">
      <header className="l-nav">
        <div className="l-container l-nav-inner">
          <Link to="/" aria-label="Ulanganku beranda">
            <Brand />
          </Link>
          <nav className="l-nav-links" aria-label="Navigasi utama">
            <a href="#fitur">Fitur</a>
            <a href="#cara-kerja">Cara kerja</a>
            <a href="#faq">FAQ</a>
          </nav>
          {user ? (
            <Link to="/dashboard" className="btn btn-primary">
              Buka dashboard
            </Link>
          ) : (
            <Link to="/login" className="btn btn-outline">
              Masuk
            </Link>
          )}
        </div>
      </header>

      <main>
        <section className="l-hero l-container">
          <div className="l-hero-copy">
            <span className="l-eyebrow">UNTUK GURU DAN SEKOLAH</span>
            <h1>Buat ulangan online, bagikan lewat satu tautan.</h1>
            <p>
              Susun soal, publish, dan pantau hasilnya secara realtime. Murid tidak perlu membuat akun, cukup buka
              tautan dan mulai mengerjakan.
            </p>
            <div className="l-hero-actions">
              {user ? (
                <Link to="/dashboard" className="btn btn-primary btn-lg">
                  Buka dashboard <Icon name="arrow" size={17} />
                </Link>
              ) : (
                <a href="/api/auth/google?next=%2Fdashboard" className="btn btn-primary btn-lg">
                  <span className="google-chip">
                    <GoogleMark size={16} />
                  </span>
                  Mulai dengan Google
                </a>
              )}
              <a href="#cara-kerja" className="btn btn-outline btn-lg">
                Lihat cara kerja
              </a>
            </div>
            <ul className="l-hero-points">
              <li><Icon name="check" size={15} /> Tanpa akun untuk murid</li>
              <li><Icon name="check" size={15} /> Nilai otomatis</li>
              <li><Icon name="check" size={15} /> Ekspor ke CSV</li>
            </ul>
          </div>

          <div className="l-mock" aria-hidden="true">
            <div className="l-mock-bar">
              <i /><i /><i />
              <div className="l-mock-url">
                <Icon name="lock" size={12} />
                {host}/ulangan-ipa-9b
              </div>
            </div>
            <div className="l-mock-body">
              <div className="l-mock-top">
                <strong>Penilaian Harian IPA</strong>
                <span className="l-mock-timer"><Icon name="clock" size={13} /> 24:18</span>
              </div>
              <div className="l-mock-progress"><span /></div>
              <div className="l-mock-question">
                <small>Soal 7 dari 20</small>
                <p>Bagian tumbuhan yang berfungsi menyerap air dari dalam tanah adalah...</p>
                <div className="l-mock-option">Batang</div>
                <div className="l-mock-option l-mock-option-on"><i /> Akar</div>
                <div className="l-mock-option">Daun</div>
                <div className="l-mock-option">Bunga</div>
              </div>
            </div>
          </div>
        </section>

        <section id="fitur" className="l-section l-container">
          <div className="l-section-head">
            <span className="l-eyebrow">FITUR</span>
            <h2>Semua yang dibutuhkan untuk ulangan harian</h2>
            <p>Sederhana untuk dipakai guru, ringan dibuka murid dari ponsel.</p>
          </div>
          <div className="l-feature-grid">
            {features.map((feature) => (
              <article key={feature.title} className="l-feature">
                <div className="l-feature-icon"><Icon name={feature.icon} size={20} /></div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="cara-kerja" className="l-section l-section-alt">
          <div className="l-container">
            <div className="l-section-head">
              <span className="l-eyebrow">CARA KERJA</span>
              <h2>Tiga langkah sampai murid mulai mengerjakan</h2>
            </div>
            <ol className="l-steps">
              {steps.map((step, index) => (
                <li key={step.title}>
                  <span className="l-step-number">{index + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
            <div className="l-url-demo">
              <span>Tautan ulangan mengikuti alamat situs ini:</span>
              <code>{host}/<b>nama-ulangan</b></code>
            </div>
          </div>
        </section>

        <section id="faq" className="l-section l-container l-faq-wrap">
          <div className="l-section-head">
            <span className="l-eyebrow">FAQ</span>
            <h2>Pertanyaan yang sering muncul</h2>
          </div>
          <div className="l-faq">
            {faqs.map((item) => (
              <details key={item.q}>
                <summary>{item.q}<Icon name="chevron" size={16} /></summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="l-container">
          <div className="l-cta">
            <div>
              <h2>Siap membuat ulangan pertama?</h2>
              <p>Masuk dengan Google dan susun soal dalam beberapa menit.</p>
            </div>
            {user ? (
              <Link to="/dashboard" className="btn btn-light btn-lg">Buka dashboard</Link>
            ) : (
              <a href="/api/auth/google?next=%2Fdashboard" className="btn btn-light btn-lg">
                <span className="google-chip"><GoogleMark size={16} /></span>
                Mulai dengan Google
              </a>
            )}
          </div>
        </section>
      </main>

      <footer className="l-footer">
        <div className="l-container l-footer-inner">
          <Brand size={24} />
          <span>© {new Date().getFullYear()} Ulanganku. Platform ulangan digital untuk sekolah.</span>
        </div>
      </footer>
    </div>
  );
}
