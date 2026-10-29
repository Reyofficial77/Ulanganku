import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "./Icon";
import { api, type ProStatus } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useApi } from "../lib/hooks";
import { Link } from "../lib/router";

type ChatMessage = { role: "user" | "assistant"; content: string; link?: { to: string; label: string } };
type ModelCatalog = { models: string[]; defaultModel: string; source?: "api" | "environment" };
type GenerationBatch = { jobId: string; examId: string | null; title: string; requestedCount: number; generatedCount: number; done: boolean; model: string };

// Perintah membuat ulangan, misalnya "buatkan ulangan IPA kelas 8 tentang tekanan".
const CREATE_EXAM = /\b(buat(?:kan|in)?|bikin(?:kan|in)?|generate|susun(?:kan)?|create|make|build|write|prepare)\b[^.\n]{0,60}\b(ulangan|ujian|kuis|quiz|soal|exam|test|assessment|questions?)\b/i;

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();
  const { data: pro } = useApi<ProStatus>(user && open ? "/pro/status" : null);
  const isPro = Boolean(pro?.active);
  const [selectedModel, setSelectedModel] = useState(() => {
    try { return localStorage.getItem("ulanganku_chat_model") ?? ""; } catch { return ""; }
  });
  const { data: availableModels, error: modelError, loading: modelsLoading, reload: reloadModels } = useApi<ModelCatalog>(isPro && open ? "/pro/models" : null);
  const activeJobRef = useRef<string | null>(null);
  const generationMessagesRef = useRef<ChatMessage[]>([]);
  const [generationProgress, setGenerationProgress] = useState<{ generated: number; requested: number } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      inputRef.current?.focus();
    }
  }, [open, messages, pending, error, generationProgress]);

  useEffect(() => {
    if (!availableModels) return;
    setSelectedModel((current) => {
      const next = current && availableModels.models.includes(current)
        ? current
        : availableModels.models.includes(availableModels.defaultModel)
          ? availableModels.defaultModel
          : availableModels.models[0] ?? "";
      try { if (next) localStorage.setItem("ulanganku_chat_model", next); } catch { /* storage may be disabled */ }
      return next;
    });
  }, [availableModels]);

  async function drainGeneration(jobId: string, baseMessages: ChatMessage[]) {
    let result: GenerationBatch | null = null;
    for (let step = 0; step < 22; step += 1) {
      result = await api<GenerationBatch>("/pro/ai/exam/batch", { method: "POST", body: { jobId } });
      setGenerationProgress({ generated: result.generatedCount, requested: result.requestedCount });
      if (result.done) break;
    }
    if (!result?.done || !result.examId) {
      throw new Error("Pembuatan belum selesai dalam satu sesi. Tekan Lanjutkan untuk melanjutkan batch berikutnya.");
    }
    activeJobRef.current = null;
    setGenerationProgress(null);
    setMessages([...baseMessages, {
      role: "assistant",
      content: `Draf ulangan "${result.title}" selesai dibuat dengan ${result.generatedCount} soal. Periksa pertanyaan, jawaban, dan durasinya sebelum dipublikasikan. Model: ${result.model}.`,
      link: { to: `/dashboard/ulangan/${result.examId}`, label: "Buka draf ulangan" },
    }]);
  }

  async function resumeGeneration() {
    const jobId = activeJobRef.current;
    if (!jobId || pending) return;
    setPending(true);
    setError("");
    try {
      await drainGeneration(jobId, generationMessagesRef.current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Batch gagal. Coba lanjutkan lagi.");
    } finally {
      setPending(false);
    }
  }

  async function sendMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const content = input.trim();
    if (!content || pending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "40px";
    setPending(true);
    setError("");

    try {
      // Fitur PRO: chatbot langsung membuat draf ulangan dari perintah guru.
      if (user && CREATE_EXAM.test(content)) {
        if (!isPro) {
          setMessages([...nextMessages, { role: "assistant", content: "Membuat ulangan otomatis adalah fitur PRO. Upgrade lewat tombol Upgrade ke PRO di sidebar dashboard, lalu coba lagi." }]);
          return;
        }
        const started = await api<{ jobId: string; requestedCount: number; generatedCount: number }>("/pro/ai/exam", {
          method: "POST", body: { prompt: content, ...(selectedModel ? { model: selectedModel } : {}) },
        });
        activeJobRef.current = started.jobId;
        generationMessagesRef.current = nextMessages;
        setGenerationProgress({ generated: 0, requested: started.requestedCount });
        await drainGeneration(started.jobId, nextMessages);
        return;
      }
      const result = await api<{ reply: string }>("/chat", {
        method: "POST",
        body: { messages: nextMessages.slice(-10), ...(isPro && selectedModel ? { model: selectedModel } : {}) },
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
                {generationProgress ? `Membuat soal: ${generationProgress.generated} dari ${generationProgress.requested}…` : "Sedang menyiapkan jawaban…"}
                {generationProgress && <div className="chatbot-generation-track"><span style={{ width: `${Math.min(100, generationProgress.generated / Math.max(1, generationProgress.requested) * 100)}%` }} /></div>}
              </div>
            )}
            {error && <div className="chatbot-error" role="alert">{error}{activeJobRef.current && <button type="button" className="chatbot-retry" onClick={() => void resumeGeneration()} disabled={pending}>Lanjutkan pembuatan{generationProgress ? ` (${generationProgress.generated}/${generationProgress.requested})` : ""}</button>}</div>}
            <div ref={endRef} />
          </div>

          <form className="chatbot-form" onSubmit={(event) => void sendMessage(event)}>
            <div className="chatbot-composer-field">
              {isPro && (
                <div className="chatbot-model-row">
                  <label className="chatbot-model-picker" htmlFor="chatbot-model" title="Pilih model AI">
                    <Icon name="sparkle" size={14} />
                    <select id="chatbot-model" value={selectedModel} onChange={(event) => {
                      setSelectedModel(event.target.value);
                      try { localStorage.setItem("ulanganku_chat_model", event.target.value); } catch { /* storage may be disabled */ }
                    }} aria-label="Model AI" disabled={modelsLoading || !(availableModels?.models.length)}>
                      {modelsLoading && <option value="">Memuat model…</option>}
                      {(availableModels?.models ?? []).map((model) => <option key={model} value={model}>{model}</option>)}
                    </select>
                    <Icon name="chevron" size={13} />
                  </label>
                  {modelError && <button type="button" className="chatbot-model-refresh" onClick={() => void reloadModels()} title="Muat ulang model">Coba lagi</button>}
                  {availableModels?.source === "environment" && <span className="chatbot-model-note" title="Daftar model memakai konfigurasi OLLAMA_MODELS">Daftar konfigurasi</span>}
                </div>
              )}
            <textarea
              ref={inputRef}
              aria-label="Pesan untuk asisten"
              value={input}
              onChange={(event) => {
                const target = event.currentTarget;
                setInput(target.value.slice(0, 1800));
                target.style.height = "40px";
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder="Tanyakan sesuatu…"
              rows={1}
              disabled={pending}
              maxLength={1800}
            />
            </div>
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
