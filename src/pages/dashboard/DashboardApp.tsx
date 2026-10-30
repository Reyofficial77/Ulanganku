import { lazy, Suspense, useEffect } from "react";
import { useAuth } from "../../lib/auth";
import { useTitle } from "../../lib/hooks";
import { navigate, useLocation } from "../../lib/router";
import NotFound from "../NotFound";
import { Shell } from "./shell";

const Editor = lazy(() => import("./Editor"));
const ExamList = lazy(() => import("./ExamList"));
const Home = lazy(() => import("./Home"));
const ProSettings = lazy(() => import("./ProSettings"));
const Results = lazy(() => import("./Results"));

function DashboardPageFallback() {
  return (
    <div className="spinner-wrap" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" /> Memuat halaman...
    </div>
  );
}

export default function DashboardApp({ segments }: { segments: string[] }) {
  useTitle(
    "Dashboard - Ulanganku",
    true,
    "Dashboard guru Ulanganku untuk membuat ulangan online, mengelola soal, memantau pengerjaan, dan melihat hasil siswa.",
  );
  const { user, loading, logout } = useAuth();
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate(`/login?next=${encodeURIComponent(pathname + search)}`, { replace: true });
  }, [loading, user, pathname, search]);

  if (loading || !user) {
    return (
      <div className="splash" role="status">
        <span className="spinner" aria-hidden="true" /> Memuat dashboard...
      </div>
    );
  }

  const [section, id, extra] = segments;
  let page;
  if (!section) page = <Home name={user.name} />;
  else if (section === "ulangan" && !extra) page = id ? <Editor key={id} id={id} /> : <ExamList mode="exams" />;
  else if (section === "hasil" && !extra) page = id ? <Results key={id} id={id} /> : <ExamList mode="results" />;
  else if (section === "pro" && !id) page = <ProSettings />;
  else page = <NotFound />;

  return (
    <Shell user={user} onLogout={logout}>
      <Suspense fallback={<DashboardPageFallback />}>{page}</Suspense>
    </Shell>
  );
}
