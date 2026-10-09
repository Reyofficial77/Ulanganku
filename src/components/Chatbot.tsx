import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "./Icon";
import { api } from "../lib/api";

type ChatMessage = { role: "user" | "assistant"; content: string };

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
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
              <span>Didukung Meta Llama 3.1</span>
            </div>
            <button className="icon-button chatbot-close" aria-label="Tutup chatbot" onClick={() => setOpen(false)}>
              <Icon name="close" size={18} />
            </button>
          </header>

          <div className="chatbot-messages" role="log" aria-label="Percakapan">
            <div className="chatbot-note">AI dapat membuat kesalahan. Jangan kirim kata sandi atau API key.</div>
            {messages.length === 0 && (
              <div className="chatbot-message chatbot-assistant">
                Halo! Saya asisten Ulanganku. Tanyakan cara membuat ulangan, mengatur percobaan, atau mengelola hasil ujian.
              </div>
            )}
            {messages.map((message, index) => (
              <div key={`${index}-${message.role}`} className={`chatbot-message chatbot-${message.role}`}>
                {message.content}
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
