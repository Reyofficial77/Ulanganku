import { lazy, Suspense, useState } from "react";
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
            <button className="chatbot-toggle" type="button" disabled aria-label="Memuat bantuan AI">
              <span className="spinner" aria-hidden="true" /> Memuat AI...
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
        aria-label={restoreHidden ? "Tampilkan bantuan AI" : "Buka chatbot Ulanganku"}
        aria-expanded="false"
        title={restoreHidden ? "Tampilkan kembali bantuan AI" : "Buka bantuan AI Ulanganku"}
        onClick={() => activate(!restoreHidden)}
      >
        <Icon name="sparkle" size={20} />
        <span>{restoreHidden ? "Tampilkan bantuan AI" : "Bantuan AI"}</span>
      </button>
    </div>
  );
}
