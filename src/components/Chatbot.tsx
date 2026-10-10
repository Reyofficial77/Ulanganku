import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "./Icon";
import { api, type ProStatus } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useApi } from "../lib/hooks";
import { Link } from "../lib/router";

type ChatMessage = { role: "user" | "assistant"; content: string; link?: { to: string; label: string } };

// Perintah membuat ulangan, misalnya "buatkan ulangan IPA kelas 8 tentang tekanan".
const CREATE_EXAM = /\b(buat(?:kan|in)?|bikin(?:kan|in)?|generate|susun(?:kan)?)\b[^.\n]{0,40}\b(ulangan|ujian|kuis|quiz|soal)\b/i;

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();
  const { data: pro } = useApi<ProStatus>(user && open ? "/pro/status" : null);
  const isPro = Boolean(pro?.active);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      inputRef.current?.focus();
    }
  }, [open, messages, pending, error]);

  async function sendMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const content = input.trim();
    if (!content || pending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "48px";
    setPending(true);
    setError("");

    try {
      // Fitur PRO: chatbot langsung membuat draf ulangan dari perintah guru.
      if (user && CREATE_EXAM.test(content)) {
        if (!isPro) {
          setMessages([...nextMessages, { role: "assistant", content: "Membuat ulangan otomatis adalah fitur PRO. Upgrade lewat tombol Upgrade ke PRO di sidebar dashboard, lalu coba lagi." }]);
          return;
        }
        const made = await api<{ examId: string; title: string; questionCount: number }>("/pro/ai/exam", { method: "POST", body: { prompt: content } });
        setMessages([...nextMessages, {
          role: "assistant",
          content: `Draf ulangan "${made.title}" dengan ${made.questionCount} soal sudah dibuat. Periksa soal dan kunci jawabannya sebelum dipublish.`,
          link: { to: `/dashboard/ulangan/${made.examId}`, label: "Buka draf ulangan" },
        }]);
        return;
      }
      const result = await api<{ reply: string }>("/chat", {
        method: "POST",
        body: { messages: nextMessages.slice(-10) },
      });
      setMessages([...nextMessages, { role: "assistant", content: result.reply }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pesan gagal dikirim. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="chatbot-root">
      {open && (
        <section className="chatbot-panel" aria-label="Chatbot Ulanganku" aria-live="polite">
          <header className="chatbot-header">
            <div className="chatbot-avatar"><Icon name="sparkle" size={19} /></div>
            <div className="chatbot-heading">
              <strong>Asisten Ulanganku</strong>
              <span>Didukung Google Gemini 3.8 Flash</span>
            </div>
            <button className="icon-button chatbot-close" aria-label="Tutup chatbot" onClick={() => setOpen(false)}>
              <Icon name="close" size={18} />
            </button>
          </header>

          <div className="chatbot-messages" role="log" aria-label="Percakapan">
            <div className="chatbot-note">AI dapat membuat kesalahan. Jangan kirim kata sandi atau API key.</div>
            {messages.length === 0 && (
              <div className="chatbot-message chatbot-assistant">
                Halo! Saya asisten Ulanganku. Tanyakan cara membuat ulangan, mengatur percobaan, atau mengelola hasil ujian.{isPro ? " Sebagai pengguna PRO, kamu juga bisa menyuruh saya membuat ulangan, misalnya: \"Buatkan ulangan IPA kelas 8 tentang tekanan, 10 soal\"." : ""}
              </div>
            )}
            {messages.map((message, index) => (
              <div key={`${index}-${message.role}`} className={`chatbot-message chatbot-${message.role}`}>
                {message.content}
                {message.link && (
                  <Link to={message.link.to} className="chatbot-link">{message.link.label} <Icon name="arrow" size={13} /></Link>
                )}
              </div>
            ))}
            {pending && (
              <div className="chatbot-message chatbot-assistant chatbot-typing" role="status">
                Sedang menyiapkan jawaban…
              </div>
            )}
            {error && <div className="chatbot-error" role="alert">{error}</div>}
            <div ref={endRef} />
          </div>

          <form className="chatbot-form" onSubmit={(event) => void sendMessage(event)}>
            <textarea
              ref={inputRef}
              aria-label="Pesan untuk asisten"
              value={input}
              onChange={(event) => {
                const target = event.currentTarget;
                setInput(target.value.slice(0, 1800));
                target.style.height = "48px";
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder="Tanyakan sesuatu…"
              rows={2}
              disabled={pending}
              maxLength={1800}
            />
            <button className="btn btn-primary chatbot-send" type="submit" disabled={pending || !input.trim()}>
              {pending ? <span className="spinner" aria-hidden="true" /> : <Icon name="arrow" size={16} />}
              Kirim
            </button>
          </form>
        </section>
      )}

      <button
        className={`chatbot-toggle ${open ? "chatbot-toggle-open" : ""}`}
        aria-label={open ? "Tutup chatbot" : "Buka chatbot Ulanganku"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <Icon name="close" size={22} /> : <><Icon name="sparkle" size={20} /><span>Bantuan AI</span></>}
      </button>
    </div>
  );
}
