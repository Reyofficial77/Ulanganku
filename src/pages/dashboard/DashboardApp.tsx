import { lazy, Suspense, useEffect } from "react";
import { useAuth } from "../../lib/auth";
import { useTitle } from "../../lib/hooks";
import { usePreferences } from "../../lib/preferences";
import { navigate, useLocation } from "../../lib/router";
import NotFound from "../NotFound";
import { Shell } from "./shell";

const Editor = lazy(() => import("./Editor"));
const ExamList = lazy(() => import("./ExamList"));
const Home = lazy(() => import("./Home"));
const ProSettings = lazy(() => import("./ProSettings"));
const Results = lazy(() => import("./Results"));
const Settings = lazy(() => import("./Settings"));

function DashboardPageFallback() {
  const { t } = usePreferences();
  return (
    <div className="spinner-wrap" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" /> {t("Memuat halaman...", "Loading page...")}
    </div>
  );
}

export default function DashboardApp({ segments }: { segments: string[] }) {
  const { t } = usePreferences();
  useTitle(
    "Dashboard - Ulanganku",
    true,
    t(
      "Dashboard guru Ulanganku untuk membuat ulangan online, mengelola soal, memantau pengerjaan, dan melihat hasil siswa.",
      "Ulanganku teacher dashboard to create online exams, manage questions, monitor progress, and review student results.",
    ),
  );
  const { user, loading, logout } = useAuth();
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate(`/login?next=${encodeURIComponent(pathname + search)}`, { replace: true });
  }, [loading, user, pathname, search]);

  if (loading || !user) {
    return (
      <div className="splash" role="status">
        <span className="spinner" aria-hidden="true" /> {t("Memuat dashboard...", "Loading dashboard...")}
      </div>
    );
  }

  const [section, id, extra] = segments;
  let page;
  if (!section) page = <Home name={user.name} />;
  else if (section === "ulangan" && !extra) page = id ? <Editor key={id} id={id} /> : <ExamList mode="exams" />;
  else if (section === "hasil" && !extra) page = id ? <Results key={id} id={id} /> : <ExamList mode="results" />;
  else if (section === "pro" && !id) page = <ProSettings />;
  else if (section === "pengaturan" && !id) page = <Settings />;
  else page = <NotFound />;

  return (
    <Shell user={user} onLogout={logout}>
      <Suspense fallback={<DashboardPageFallback />}>{page}</Suspense>
    </Shell>
  );
}
