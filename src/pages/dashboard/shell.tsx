import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Avatar, Modal } from "../../components/ui";
import { Brand, Icon } from "../../components/Icon";
import { api, type Exam, type User } from "../../lib/api";
import { usePreferences } from "../../lib/preferences";
import { Link, navigate, useLocation } from "../../lib/router";
import DeferredChatbot from "../../components/DeferredChatbot";
import ProCard from "./ProCard";

type ShellContext = {
  openMenu: () => void;
  createExam: () => Promise<void>;
  creating: boolean;
  notify: (message: string) => void;
};

const Ctx = createContext<ShellContext>({
  openMenu: () => {},
  createExam: async () => {},
  creating: false,
  notify: () => {},
});

export const useShell = () => useContext(Ctx);

export function Topbar({ title, children }: { title: ReactNode; children?: ReactNode }) {
  const { openMenu } = useShell();
  return (
    <header className="topbar">
      <button className="icon-button mobile-menu" aria-label="Buka menu" onClick={openMenu}>
        <Icon name="menu" />
      </button>
      <div className="topbar-title">{title}</div>
      <div className="topbar-actions">{children}</div>
    </header>
  );
}

export function Shell({ user, onLogout, children }: { user: User; onLogout: () => void | Promise<void>; children: ReactNode }) {
  const { pathname } = useLocation();
  const { prefs, setLanguage, t } = usePreferences();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number>(0);
  const accountWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
    setAccountMenuOpen(false);
    setLangMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (accountWrapRef.current?.contains(event.target as Node)) return;
      setAccountMenuOpen(false);
      setLangMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
        setLangMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountMenuOpen]);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  const createExam = useCallback(async () => {
    setCreating(true);
    try {
      const { exam } = await api<{ exam: Exam }>("/exams", { method: "POST", body: {} });
      navigate(`/dashboard/ulangan/${exam.id}`);
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setCreating(false);
    }
  }, [notify]);

  const value = useMemo(
    () => ({ openMenu: () => setMenuOpen((open) => !open), createExam, creating, notify }),
    [createExam, creating, notify],
  );

  const nav = [
    { to: "/dashboard", label: t("Beranda", "Home"), icon: "home", match: (p: string) => p === "/dashboard" || p === "/dashboard/" },
    { to: "/dashboard/ulangan", label: t("Ulangan", "Exams"), icon: "file", match: (p: string) => p.startsWith("/dashboard/ulangan") },
    { to: "/template", label: t("Template soal", "Templates"), icon: "file", match: (p: string) => p === "/template" || p.startsWith("/template/") },
    { to: "/dashboard/hasil", label: t("Hasil & Analitik", "Results & Analytics"), icon: "chart", match: (p: string) => p.startsWith("/dashboard/hasil") },
    { to: "/dashboard/pro", label: t("Fitur PRO", "PRO Features"), icon: "sparkle", match: (p: string) => p.startsWith("/dashboard/pro") },
  ] as const;

  return (
    <Ctx.Provider value={value}>
      <div className="app-shell">
        <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
          <Link to="/dashboard" className="sidebar-brand" aria-label="Beranda dashboard">
            <Brand />
          </Link>

          <button className="btn btn-primary btn-block create-button" onClick={createExam} disabled={creating}>
            <Icon name="plus" size={18} />
            {creating ? t("Membuat...", "Creating...") : t("Buat ulangan", "Create exam")}
          </button>

          <nav className="main-nav" aria-label="Navigasi utama">
            {nav.map((item) => (
              <Link key={item.to} to={item.to} className={item.match(pathname) ? "active" : ""} aria-current={item.match(pathname) ? "page" : undefined}>
                <Icon name={item.icon} />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="sidebar-spacer" />

          <ProCard notify={notify} />

          <Link to="/" className="sidebar-link">
            <Icon name="external" size={17} /> {t("Halaman utama", "Landing page")}
          </Link>

          <div className="account-menu-wrap" ref={accountWrapRef}>
            {accountMenuOpen && (
              <div className="account-dropdown" role="menu" aria-label={t("Menu akun", "Account menu")}>
                <button
                  type="button"
                  role="menuitem"
                  className="account-dropdown-item"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    setLangMenuOpen(false);
                    navigate("/dashboard/pengaturan");
                  }}
                >
                  <Icon name="settings" size={16} />
                  <span>{t("Pengaturan", "Settings")}</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  aria-expanded={langMenuOpen}
                  className="account-dropdown-item"
                  onClick={() => setLangMenuOpen((open) => !open)}
                >
                  <Icon name="globe" size={16} />
                  <span>{t("Bahasa", "Language")}</span>
                  <small className="account-lang-pill">{prefs.language === "id" ? "ID" : "EN"}</small>
                </button>

                {langMenuOpen && (
                  <div className="account-lang-list" role="group" aria-label={t("Pilih bahasa", "Choose language")}>
                    <button
                      type="button"
                      className={`account-lang-option ${prefs.language === "id" ? "account-lang-option-on" : ""}`}
                      onClick={() => {
                        setLanguage("id");
                        setAccountMenuOpen(false);
                        setLangMenuOpen(false);
                        notify("Bahasa diubah ke Indonesia.");
                      }}
                    >
                      <span>Bahasa Indonesia</span>
                      {prefs.language === "id" && <Icon name="check" size={14} />}
                    </button>
                    <button
                      type="button"
                      className={`account-lang-option ${prefs.language === "en" ? "account-lang-option-on" : ""}`}
                      onClick={() => {
                        setLanguage("en");
                        setAccountMenuOpen(false);
                        setLangMenuOpen(false);
                        notify("Language switched to English.");
                      }}
                    >
                      <span>English</span>
                      {prefs.language === "en" && <Icon name="check" size={14} />}
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  role="menuitem"
                  className="account-dropdown-item"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    setLangMenuOpen(false);
                    setHelpOpen(true);
                  }}
                >
                  <Icon name="help" size={16} />
                  <span>{t("Bantuan (Help)", "Help")}</span>
                </button>
              </div>
            )}

            <div
              className="account-card account-card-clickable"
              role="button"
              tabIndex={0}
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
              onClick={() => {
                setAccountMenuOpen((open) => {
                  const next = !open;
                  if (!next) setLangMenuOpen(false);
                  return next;
                });
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setAccountMenuOpen((open) => !open);
                }
              }}
            >
              <Avatar name={user.name} picture={user.picture} />
              <div className="account-text">
                <strong title={user.name}>{user.name}</strong>
                <span title={user.email}>{user.email}</span>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label={t("Keluar", "Log out")}
                title={t("Keluar", "Log out")}
                onClick={(event) => {
                  event.stopPropagation();
                  setAccountMenuOpen(false);
                  void Promise.resolve(onLogout()).catch((error) => notify((error as Error)?.message || "Gagal keluar. Coba lagi."));
                }}
              >
                <Icon name="logout" size={17} />
              </button>
            </div>
          </div>
        </aside>

        {menuOpen && <button className="sidebar-backdrop" aria-label="Tutup menu" onClick={() => setMenuOpen(false)} />}

        <main className="workspace">{children}</main>

        {helpOpen && (
          <Modal
            icon="help"
            title={t("Bantuan Ulanganku", "Ulanganku Help")}
            description={t("Panduan singkat penggunaan fitur dashboard dan penilaian AI.", "Quick guide to dashboard features and AI grading.")}
            onClose={() => setHelpOpen(false)}
            footer={
              <button type="button" className="btn btn-primary" onClick={() => setHelpOpen(false)}>
                {t("Tutup", "Close")}
              </button>
            }
          >
            <div className="help-list">
              <div>
                <strong>{t("1. Membuat & membagikan ulangan", "1. Create & share exams")}</strong>
                <p>{t("Klik Buat ulangan atau gunakan Template soal, lengkapi pertanyaan, lalu klik Publish untuk mendapatkan tautan yang dibagikan ke murid.", "Click Create exam or use Templates, add questions, then Publish to get a shareable student link.")}</p>
              </div>
              <div>
                <strong>{t("2. Penilaian jawaban uraian otomatis", "2. Automatic essay grading")}</strong>
                <p>{t("Soal objektif dinilai otomatis oleh sistem, sedangkan jawaban singkat, isian, dan uraian dinilai oleh model gemma4:31b-it untuk semua ulangan lama maupun baru.", "Objective questions are graded automatically, while short-answer, fill-in-the-blank, and essay responses are graded by gemma4:31b-it across both existing and new exams.")}</p>
              </div>
              <div>
                <strong>{t("3. Pengaturan & Konfigurasi AI (PRO)", "3. Settings & AI Configuration (PRO)")}</strong>
                <p>{t("Buka menu Pengaturan dari kartu akun untuk mengubah tema, warna aksen, serta mengatur topik percakapan AI secara bebas bagi pengguna PRO.", "Open Settings from the account card to change theme, accent color, and configure custom AI chat topics for PRO users.")}</p>
              </div>
            </div>
          </Modal>
        )}

        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
        <DeferredChatbot context="dashboard" />
      </div>
    </Ctx.Provider>
  );
}
