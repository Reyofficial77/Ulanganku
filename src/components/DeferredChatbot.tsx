import { lazy, Suspense, useState } from "react";
import { usePreferences } from "../lib/preferences";
import { Icon } from "./Icon";

const Chatbot = lazy(() => import("./Chatbot"));
const HIDDEN_KEY = "ulanganku_chatbot_hidden";

type Props = { context?: "landing" | "dashboard" };

function wasHidden() {
  try {
    return sessionStorage.getItem(HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

export default function DeferredChatbot({ context = "dashboard" }: Props) {
  const { t } = usePreferences();
  const [activated, setActivated] = useState(false);
  const [initialOpen, setInitialOpen] = useState(false);
  const [restoreHidden, setRestoreHidden] = useState(wasHidden);

  const activate = (open: boolean) => {
    if (restoreHidden) {
      try { sessionStorage.removeItem(HIDDEN_KEY); } catch { /* storage may be disabled */ }
      setRestoreHidden(false);
    }
    setInitialOpen(open);
    setActivated(true);
  };

  if (activated) {
    return (
      <Suspense
        fallback={
          <div className="chatbot-root">
            <button className="chatbot-toggle" type="button" disabled aria-label={t("Memuat bantuan AI", "Loading AI help")}>
              <span className="spinner" aria-hidden="true" /> {t("Memuat AI...", "Loading AI...")}
            </button>
          </div>
        }
      >
        <Chatbot context={context} initialOpen={initialOpen} />
      </Suspense>
    );
  }

  return (
    <div className="chatbot-root">
      <button
        className="chatbot-toggle chatbot-toggle-lazy"
        type="button"
        aria-label={restoreHidden ? t("Tampilkan bantuan AI", "Show AI help") : t("Buka chatbot Ulanganku", "Open Ulanganku chatbot")}
        aria-expanded="false"
        title={restoreHidden ? t("Tampilkan kembali bantuan AI", "Show AI help again") : t("Buka bantuan AI Ulanganku", "Open Ulanganku AI help")}
        onClick={() => activate(!restoreHidden)}
      >
        <Icon name="sparkle" size={20} />
        <span>{restoreHidden ? t("Tampilkan bantuan AI", "Show AI help") : t("Bantuan AI", "AI Help")}</span>
      </button>
    </div>
  );
}
