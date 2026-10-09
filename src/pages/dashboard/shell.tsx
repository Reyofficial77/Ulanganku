import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Avatar } from "../../components/ui";
import { Brand, Icon } from "../../components/Icon";
import { api, type Exam, type User } from "../../lib/api";
import { Link, navigate, useLocation } from "../../lib/router";

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

export function Shell({ user, onLogout, children }: { user: User; onLogout: () => void; children: ReactNode }) {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number>(0);

  useEffect(() => setMenuOpen(false), [pathname]);

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
    { to: "/dashboard", label: "Beranda", icon: "home", match: (p: string) => p === "/dashboard" || p === "/dashboard/" },
    { to: "/dashboard/ulangan", label: "Ulangan", icon: "file", match: (p: string) => p.startsWith("/dashboard/ulangan") },
    { to: "/dashboard/hasil", label: "Hasil & Analitik", icon: "chart", match: (p: string) => p.startsWith("/dashboard/hasil") },
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
            {creating ? "Membuat..." : "Buat ulangan"}
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

          <Link to="/" className="sidebar-link">
            <Icon name="external" size={17} /> Halaman utama
          </Link>

          <div className="account-card">
            <Avatar name={user.name} picture={user.picture} />
            <div className="account-text">
              <strong title={user.name}>{user.name}</strong>
              <span title={user.email}>{user.email}</span>
            </div>
            <button className="icon-button" aria-label="Keluar" title="Keluar" onClick={onLogout}>
              <Icon name="logout" size={17} />
            </button>
          </div>
        </aside>

        {menuOpen && <button className="sidebar-backdrop" aria-label="Tutup menu" onClick={() => setMenuOpen(false)} />}

        <main className="workspace">{children}</main>

        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
