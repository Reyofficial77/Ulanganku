import { Brand, GoogleMark, Icon } from "../components/Icon";
import { useAuth } from "../lib/auth";
import { useTitle } from "../lib/hooks";
import { usePreferences } from "../lib/preferences";
import { Link } from "../lib/router";
import DeferredChatbot from "../components/DeferredChatbot";

export default function Landing() {
  const { t } = usePreferences();
  const features = [
    { icon: "edit", title: t("Beragam tipe soal", "Various question types"), text: t("Pilihan ganda, pilihan ganda kompleks, benar/salah, isian, menjodohkan, mengurutkan, numerik, uraian, dan soal cerita.", "Multiple choice, multiple select, true/false, fill-in-the-blank, matching, ordering, numeric, essay, and reading passages.") },
    { icon: "link", title: t("Satu tautan per ulangan", "One link per exam"), text: t("Setiap ulangan punya URL sendiri yang mudah dibagikan lewat grup kelas.", "Each exam gets its own URL that is easy to share with your class.") },
    { icon: "users", title: t("Murid tanpa akun", "No student accounts needed"), text: t("Murid cukup membuka tautan, mengisi nama, lalu langsung mengerjakan.", "Students just open the link, enter their name, and start right away.") },
    { icon: "check", title: t("Penilaian otomatis", "Automatic grading"), text: t("Tipe soal objektif dinilai otomatis. Soal isian dan uraian dinilai AI serta dapat dikoreksi guru.", "Objective questions are auto-graded. Short-answer and essay responses are graded by AI and reviewable by teachers.") },
    { icon: "bolt", title: t("Pantau realtime", "Real-time monitoring"), text: t("Lihat siapa yang sedang mengerjakan, siapa yang sudah selesai, dan nilai sementara.", "See who is working, who has finished, and live provisional scores.") },
    { icon: "chart", title: t("Hasil dan ekspor", "Results & export"), text: t("Distribusi nilai, soal tersulit, dan ekspor nilai ke file CSV untuk rekap.", "Score distribution, hardest question insights, and CSV export for reporting.") },
  ] as const;

  const steps = [
    { title: t("Masuk dengan Google", "Sign in with Google"), text: t("Tanpa formulir pendaftaran panjang. Cukup satu akun Google.", "No long registration forms. Just one Google account.") },
    { title: t("Susun soal", "Build your exam"), text: t("Buat soal di editor, atur durasi dan kelas, lalu pilih URL ulangan.", "Create questions in the editor, set duration and class, and choose the exam URL.") },
    { title: t("Bagikan dan pantau", "Share and monitor"), text: t("Kirim tautan ke murid dan pantau pengerjaan dari dashboard.", "Send the link to students and track progress from the dashboard.") },
  ];

  const faqs = [
    { q: t("Apakah murid perlu membuat akun?", "Do students need to create an account?"), a: t("Tidak. Murid hanya membuka tautan ulangan dan mengisi nama. Hanya guru yang masuk dengan akun Google.", "No. Students simply open the exam link and enter their name. Only teachers sign in with Google.") },
    { q: t("Bagaimana jika koneksi murid terputus?", "What if a student loses connection?"), a: t("Jawaban tersimpan otomatis selama mengerjakan. Murid dapat membuka tautan yang sama dari perangkat yang sama dan melanjutkan, selama waktu pengerjaan belum habis.", "Answers are auto-saved while working. Students can reopen the same link on the same device to resume as long as time hasn't expired.") },
    { q: t("Apakah satu murid bisa mengerjakan dua kali?", "Can a student take an exam twice?"), a: t("Secara bawaan satu perangkat mendapat satu kesempatan. Guru bisa mengaktifkan opsi mengerjakan berkali-kali, dengan batas percobaan jika diperlukan. Setiap percobaan dicatat terpisah.", "By default each device gets one attempt. Teachers can enable retakes with an optional attempt limit. Each attempt is recorded separately.") },
    { q: t("Bisakah URL ulangan diganti setelah dipublish?", "Can the exam URL be changed after publishing?"), a: t("URL dikunci setelah pertama kali dipublish agar tautan yang sudah dibagikan tetap berlaku. Pilih nama yang jelas sebelum publish.", "The URL is locked once published so shared links stay valid. Pick a clear slug before publishing.") },
    { q: t("Siapa yang bisa melihat hasil ulangan?", "Who can view exam results?"), a: t("Hanya akun yang membuat ulangan. Murid melihat nilainya sendiri jika opsi tampilkan nilai diaktifkan.", "Only the account that created the exam. Students see their own score if 'Show score' is enabled.") },
  ];

  useTitle(
    t("Ulanganku - Ulangan online untuk sekolah", "Ulanganku - Online exams for schools"),
    false,
    t("Buat ulangan digital, bagikan lewat satu tautan, dan pantau hasilnya secara realtime. Murid cukup membuka tautan tanpa membuat akun.", "Create digital exams, share via one link, and monitor results in real time. Students just open the link with no account required."),
  );
  const { user } = useAuth();
  const host = window.location.host;

  return (
    <div className="landing">
      <header className="l-nav">
        <div className="l-container l-nav-inner">
          <Link to="/" aria-label={t("Ulanganku beranda", "Ulanganku home")}>
            <Brand />
          </Link>
          <nav className="l-nav-links" aria-label={t("Navigasi utama", "Main navigation")}>
            <a href="#fitur">{t("Fitur", "Features")}</a>
            <a href="#cara-kerja">{t("Cara kerja", "How it works")}</a>
            <Link to="/template">{t("Template soal", "Templates")}</Link>
            <a href="#faq">FAQ</a>
          </nav>
          {user ? (
            <Link to="/dashboard" className="btn btn-primary">
              {t("Buka dashboard", "Open dashboard")}
            </Link>
          ) : (
            <Link to="/login" className="btn btn-outline">
              {t("Masuk", "Sign in")}
            </Link>
          )}
        </div>
      </header>

      <main>
        <section className="l-hero l-container">
          <div className="l-hero-copy">
            <span className="l-eyebrow">{t("UNTUK GURU DAN SEKOLAH", "FOR TEACHERS AND SCHOOLS")}</span>
            <h1>{t("Buat ulangan online, bagikan lewat satu tautan.", "Create online exams, share with a single link.")}</h1>
            <p>
              {t(
                "Susun soal, publish, dan pantau hasilnya secara realtime. Murid tidak perlu membuat akun, cukup buka tautan dan mulai mengerjakan.",
                "Build questions, publish, and monitor results in real time. Students don't need an account—just open the link and start.",
              )}
            </p>
            <div className="l-hero-actions">
              {user ? (
                <Link to="/dashboard" className="btn btn-primary btn-lg">
                  {t("Buka dashboard", "Open dashboard")} <Icon name="arrow" size={17} />
                </Link>
              ) : (
                <a href="/api/auth/google?next=%2Fdashboard" className="btn btn-primary btn-lg">
                  <span className="google-chip">
                    <GoogleMark size={16} />
                  </span>
                  {t("Mulai dengan Google", "Start with Google")}
                </a>
              )}
              <a href="#cara-kerja" className="btn btn-outline btn-lg">
                {t("Lihat cara kerja", "See how it works")}
              </a>
            </div>
            <ul className="l-hero-points">
              <li><Icon name="check" size={15} /> {t("Tanpa akun untuk murid", "No student accounts")}</li>
              <li><Icon name="check" size={15} /> {t("Nilai otomatis", "Auto-grading")}</li>
              <li><Icon name="check" size={15} /> {t("Ekspor ke CSV", "Export to CSV")}</li>
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
                <strong>{t("Penilaian Harian IPA", "Daily Science Quiz")}</strong>
                <span className="l-mock-timer"><Icon name="clock" size={13} /> 24:18</span>
              </div>
              <div className="l-mock-progress"><span /></div>
              <div className="l-mock-question">
                <small>{t("Soal 7 dari 20", "Question 7 of 20")}</small>
                <p>{t("Bagian tumbuhan yang berfungsi menyerap air dari dalam tanah adalah...", "Which part of a plant absorbs water from the soil?")}</p>
                <div className="l-mock-option">{t("Batang", "Stem")}</div>
                <div className="l-mock-option l-mock-option-on"><i /> {t("Akar", "Roots")}</div>
                <div className="l-mock-option">{t("Daun", "Leaves")}</div>
                <div className="l-mock-option">{t("Bunga", "Flower")}</div>
              </div>
            </div>
          </div>
        </section>

        <section id="fitur" className="l-section l-container">
          <div className="l-section-head">
            <span className="l-eyebrow">{t("FITUR", "FEATURES")}</span>
            <h2>{t("Semua yang dibutuhkan untuk ulangan harian", "Everything you need for daily assessments")}</h2>
            <p>{t("Sederhana untuk dipakai guru, ringan dibuka murid dari ponsel.", "Simple for teachers to use, lightweight for students on mobile.")}</p>
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
              <span className="l-eyebrow">{t("CARA KERJA", "HOW IT WORKS")}</span>
              <h2>{t("Tiga langkah sampai murid mulai mengerjakan", "Three steps until students start taking the exam")}</h2>
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
              <span>{t("Tautan ulangan mengikuti alamat situs ini:", "Exam links follow this site's address:")}</span>
              <code>{host}/<b>{t("nama-ulangan", "exam-slug")}</b></code>
            </div>
          </div>
        </section>

        <section id="faq" className="l-section l-container l-faq-wrap">
          <div className="l-section-head">
            <span className="l-eyebrow">FAQ</span>
            <h2>{t("Pertanyaan yang sering muncul", "Frequently asked questions")}</h2>
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
              <h2>{t("Siap membuat ulangan pertama?", "Ready to create your first exam?")}</h2>
              <p>{t("Masuk dengan Google dan susun soal dalam beberapa menit.", "Sign in with Google and build questions in minutes.")}</p>
            </div>
            {user ? (
              <Link to="/dashboard" className="btn btn-light btn-lg">{t("Buka dashboard", "Open dashboard")}</Link>
            ) : (
              <a href="/api/auth/google?next=%2Fdashboard" className="btn btn-light btn-lg">
                <span className="google-chip"><GoogleMark size={16} /></span>
                {t("Mulai dengan Google", "Start with Google")}
              </a>
            )}
          </div>
        </section>
      </main>

      <footer className="l-footer">
        <div className="l-container l-footer-inner">
          <Brand size={24} />
          <span>© {new Date().getFullYear()} Ulanganku. {t("Platform ulangan digital untuk sekolah.", "Digital exam platform for schools.")}</span>
        </div>
      </footer>
      <DeferredChatbot context="landing" />
    </div>
  );
}
