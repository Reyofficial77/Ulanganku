import { AuthProvider } from "./lib/auth";
import { useLocation } from "./lib/router";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import DashboardApp from "./pages/dashboard/DashboardApp";
import PublicExam from "./pages/PublicExam";
import ProCheckout from "./pages/ProCheckout";

// Harus sinkron dengan RESERVED_SLUGS di api/_lib/exams.ts
const RESERVED = new Set([
  "api", "login", "logout", "auth", "dashboard", "admin", "app", "assets", "static", "public",
  "register", "signup", "signin", "about", "help", "bantuan", "harga", "fitur", "privacy", "terms",
  "robots.txt", "sitemap.xml", "favicon.ico", "index", "ulanganku", "ulangan", "hasil", "settings",
  "pengaturan", "unlockpro", "404", "undefined", "null",
]);

function Routes() {
  const { pathname } = useLocation();
  const segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const [first] = segments;

  if (segments.length === 0) return <Landing />;
  if (first === "login" && segments.length === 1) return <Login />;
  if (first === "dashboard") return <DashboardApp segments={segments.slice(1)} />;
  if (first === "unlockpro" && segments.length === 1) return <ProCheckout />;
  if (segments.length === 1 && !RESERVED.has(first.toLowerCase())) return <PublicExam slug={first.toLowerCase()} />;
  return <NotFound />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  );
}
