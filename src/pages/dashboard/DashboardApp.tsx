import { useEffect } from "react";
import { useAuth } from "../../lib/auth";
import { useTitle } from "../../lib/hooks";
import { navigate, useLocation } from "../../lib/router";
import NotFound from "../NotFound";
import Editor from "./Editor";
import ExamList from "./ExamList";
import Home from "./Home";
import ProSettings from "./ProSettings";
import Results from "./Results";
import { Shell } from "./shell";

export default function DashboardApp({ segments }: { segments: string[] }) {
  useTitle("Dashboard - Ulanganku", true);
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
  else return <NotFound />;

  return (
    <Shell user={user} onLogout={logout}>
      {page}
    </Shell>
  );
}
