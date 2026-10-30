import { lazy, Suspense, type ReactNode } from "react";
import { AuthProvider } from "./lib/auth";
import { useLocation } from "./lib/router";

const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const NotFound = lazy(() => import("./pages/NotFound"));
const DashboardApp = lazy(() => import("./pages/dashboard/DashboardApp"));
const PublicExam = lazy(() => import("./pages/PublicExam"));
const ProCheckout = lazy(() => import("./pages/ProCheckout"));
const TemplateCatalog = lazy(() => import("./pages/TemplateCatalog"));

// Harus sinkron dengan RESERVED_SLUGS di api/_lib/exams.ts
const RESERVED = new Set([
  "api", "login", "logout", "auth", "dashboard", "admin", "app", "assets", "static", "public",
  "register", "signup", "signin", "about", "help", "bantuan", "harga", "fitur", "privacy", "terms",
  "robots.txt", "sitemap.xml", "favicon.ico", "index", "ulanganku", "ulangan", "hasil", "settings",
  "pengaturan", "unlockpro", "template", "404", "undefined", "null",
]);

function RouteFallback() {
  return (
    <main className="route-loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>Memuat halaman...</span>
    </main>
  );
}

function Routes() {
  const { pathname } = useLocation();
  const segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const [first] = segments;

  let page: ReactNode;
  if (segments.length === 0) page = <Landing />;
  else if (first === "login" && segments.length === 1) page = <Login />;
  else if (first === "dashboard") page = <DashboardApp segments={segments.slice(1)} />;
  else if (first === "unlockpro" && segments.length === 1) page = <ProCheckout />;
  else if (first === "template" && segments.length <= 2) page = <TemplateCatalog slug={segments[1]} />;
  else if (segments.length === 1 && !RESERVED.has(first.toLowerCase())) page = <PublicExam slug={first.toLowerCase()} />;
  else page = <NotFound />;

  return <Suspense fallback={<RouteFallback />}>{page}</Suspense>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  );
}
