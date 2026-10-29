import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "./Icon";
import { api, type ProStatus } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useApi } from "../lib/hooks";
import { Link } from "../lib/router";

type ChatMessage = { role: "user" | "assistant"; content: string; link?: { to: string; label: string } };
type ModelCatalog = { models: string[]; defaultModel: string; source?: "api" | "environment" };
type GenerationBatch = { jobId: string; examId: string | null; title: string; requestedCount: number; generatedCount: number; done: boolean; model: string };
type ChatbotProps = { context?: "landing" | "dashboard" };

const FALLBACK_PRO_MODELS = [
  "beam:cloud",
  "kimi-k2.6:cloud",
  "minimax-m2.7:cloud",
  "glm-5.1:cloud",
  "nemotron-3-super:cloud",
  "gemma4:31b",
];
const MODEL_LABELS: Record<string, string> = {
  "beam:cloud": "Beam · Gratis · 1M context",
  "kimi-k2.6:cloud": "Kimi K2.6 · Gratis",
  "minimax-m2.7:cloud": "MiniMax M2.7 · Gratis",
  "glm-5.1:cloud": "GLM 5.1 · Gratis",
  "nemotron-3-super:cloud": "Nemotron 3 Super · Gratis",
  "gemma4:31b": "Gemma 4 31B",
};

// Perintah membuat ulangan, misalnya "buatkan ulangan IPA kelas 8 tentang tekanan".
const CREATE_EXAM = /\b(?:buat(?:kan|in)?|membuat(?:kan)?|bikin(?:kan|in)?|generate|susun(?:kan)?|menyusun|create|make|build|write|prepare)\b[^.\n]{0,60}\b(ulangan|ujian|kuis|quiz|soal|exam|test|assessment|questions?)\b/i;
const EXAM_HOW_TO = /^\s*(?:(?:tolong|mohon|bisa(?:\s+bantu)?)\s+)?(?:(?:jelaskan|terangkan)\s+)?(?:bagaimana|gimana|cara|langkah|panduan|tutorial|apa\s+cara|apa\s+langkah)\b/i;

function renderInlineMarkdown(text: string): ReactNode[] {
  const tokenPattern = /(\*\*[^*\n]+?\*\*|__[^_\n]+?__|~~[^~\n]+?~~|(?<!\*)\*[^*\n]+?\*(?!\*)|(?<!_)_[^_\n]+?_(?!_)|`[^`\n]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
  const output: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of text.matchAll(tokenPattern)) {
    const token = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) output.push(text.slice(lastIndex, index));
    if (token.startsWith("**") && token.endsWith("**")) {
      output.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("__") && token.endsWith("__")) {
      output.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("~~") && token.endsWith("~~")) {
      output.push(<s key={key++}>{token.slice(2, -2)}</s>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      output.push(<em key={key++}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("_") && token.endsWith("_")) {
      output.push(<em key={key++}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`")) {
      output.push(<code key={key++}>{token.slice(1, -1)}</code>);
    } else {
      const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if (link) output.push(<a key={key++} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>);
      else output.push(token);
    }
    lastIndex = index + token.length;
  }
  if (lastIndex < text.length) output.push(text.slice(lastIndex));
  return output;
}

function FormattedChatMessage({ content }: { content: string }) {
  const normalized = content.replace(/\r\n?/g, "\n");
  const chunks = normalized.split(/(```[\s\S]*?```)/g);
  let key = 0;
  return (
    <div className="chatbot-rich-content">
      {chunks.map((chunk) => {
        if (!chunk.trim()) return null;
        if (chunk.startsWith("```")) {
          const code = chunk.match(/^```([^\n`]*)\n([\s\S]*?)\n?```$/);
          const language = code?.[1]?.trim() ?? "";
          const source = code?.[2] ?? chunk.replace(/^```/, "").replace(/```$/, "");
          return <pre className="chatbot-code-block" key={key++}>{language && <span className="chatbot-code-language">{language}</span>}<code>{source}</code></pre>;
        }
        return chunk.split(/\n\s*\n/).map((block) => {
          const lines = block.trim().split("\n");
          if (!block.trim()) return null;
          if (lines.length === 1 && /^\s*(?:-{3,}|_{3,}|\*{3,})\s*$/.test(lines[0])) return <hr key={key++} />;
          if (lines.length >= 2 && lines[0].includes("|") && /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[1])) {
            const cells = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));
            const headers = cells(lines[0]);
            return <div className="chatbot-table-wrap" key={key++}><table><thead><tr>{headers.map((cell, index) => <th key={index}>{renderInlineMarkdown(cell)}</th>)}</tr></thead><tbody>{lines.slice(2).filter((line) => line.includes("|")).map((line, rowIndex) => <tr key={rowIndex}>{cells(line).map((cell, cellIndex) => <td key={cellIndex}>{renderInlineMarkdown(cell)}</td>)}</tr>)}</tbody></table></div>;
          }
          if (lines.every((line) => /^\s*>\s?/.test(line))) {
            return <blockquote key={key++}>{lines.map((line, index) => <Fragment key={index}>{index > 0 && <br />}{renderInlineMarkdown(line.replace(/^\s*>\s?/, ""))}</Fragment>)}</blockquote>;
          }
          if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line))) {
            return <ol key={key++}>{lines.map((line) => <li key={key++}>{renderInlineMarkdown(line.replace(/^\s*\d+[.)]\s+/, ""))}</li>)}</ol>;
          }
          if (lines.every((line) => /^\s*[-*•]\s+/.test(line))) {
            return <ul key={key++}>{lines.map((line) => <li key={key++}>{renderInlineMarkdown(line.replace(/^\s*[-*•]\s+/, ""))}</li>)}</ul>;
          }
          const heading = lines[0].match(/^\s{0,3}(#{1,3})\s+(.+)$/);
          if (heading) {
            const headingContent = renderInlineMarkdown(heading[2]);
            const remaining = lines.slice(1);
            return <div className="chatbot-markdown-section" key={key++}>{heading[1].length === 1 ? <h3>{headingContent}</h3> : heading[1].length === 2 ? <h4>{headingContent}</h4> : <h5>{headingContent}</h5>}{remaining.length > 0 && <p>{remaining.map((line, index) => <Fragment key={index}>{index > 0 && <br />}{renderInlineMarkdown(line)}</Fragment>)}</p>}</div>;
          }
          return <p key={key++}>{lines.map((line, index) => <Fragment key={index}>{index > 0 && <br />}{renderInlineMarkdown(line)}</Fragment>)}</p>;
        });
      })}
    </div>
  );
}

export default function Chatbot({ context = "dashboard" }: ChatbotProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();
  const { data: pro } = useApi<ProStatus>(context === "dashboard" && user && open ? "/pro/status" : null);
  const isPro = context === "dashboard" && Boolean(pro?.active);
  const canChooseModel = context === "dashboard" && isPro;
  const [selectedModel, setSelectedModel] = useState(() => {
    try { return localStorage.getItem("ulanganku_chat_model") ?? ""; } catch { return ""; }
  });
  const { data: availableModels, error: modelError, loading: modelsLoading, reload: reloadModels } = useApi<ModelCatalog>(canChooseModel && open ? "/pro/models" : null);
  const modelOptions = availableModels?.models?.length ? availableModels.models : FALLBACK_PRO_MODELS;
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
    if (!canChooseModel) return;
    setSelectedModel((current) => {
      const next = current && modelOptions.includes(current)
        ? current
        : modelOptions.includes("beam:cloud")
          ? "beam:cloud"
          : availableModels?.models.includes(availableModels.defaultModel)
            ? availableModels.defaultModel
            : modelOptions[0] ?? "";
      try { if (next) localStorage.setItem("ulanganku_chat_model", next); } catch { /* storage may be disabled */ }
      return next;
    });
  }, [availableModels, canChooseModel, modelOptions]);

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
    if (inputRef.current) inputRef.current.style.height = "30px";
    setPending(true);
    setError("");

    try {
      // Fitur PRO: chatbot langsung membuat draf ulangan dari perintah guru.
      if (user && CREATE_EXAM.test(content) && !EXAM_HOW_TO.test(content)) {
        if (!isPro) {
          setMessages([...nextMessages, { role: "assistant", content: "Membuat ulangan otomatis adalah fitur PRO. Upgrade lewat tombol Upgrade ke PRO di sidebar dashboard, lalu coba lagi." }]);
          return;
        }
        const started = await api<{ jobId: string; requestedCount: number; generatedCount: number }>("/pro/ai/exam", {
          method: "POST", body: { prompt: content, ...(canChooseModel && selectedModel ? { model: selectedModel } : {}) },
        });
        activeJobRef.current = started.jobId;
        generationMessagesRef.current = nextMessages;
        setGenerationProgress({ generated: 0, requested: started.requestedCount });
        await drainGeneration(started.jobId, nextMessages);
        return;
      }
      const result = await api<{ reply: string }>("/chat", {
        method: "POST",
        body: { messages: nextMessages.slice(-10), ...(canChooseModel && selectedModel ? { model: selectedModel } : {}) },
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
              <div className="chatbot-message chatbot-assistant chatbot-welcome">
                {context === "landing"
                  ? "Halo! Saya Asisten Ulanganku. Saya bisa membantu menjelaskan fitur Ulanganku dan cara memulai membuat ulangan online."
                  : <>Halo! Saya Asisten Ulanganku. Saya bisa membantu mengatur percobaan, mengelola hasil, dan menggunakan fitur dashboard.{isPro ? " Sebagai pengguna PRO, pilih model AI di bawah lalu minta saya membuat draf ulangan." : " Pembuatan draf ulangan otomatis dengan AI tersedia untuk pengguna PRO."}</>}
              </div>
            )}
            {messages.map((message, index) => (
              <div key={`${index}-${message.role}`} className={`chatbot-message chatbot-${message.role}`}>
                {message.role === "assistant" ? <FormattedChatMessage content={message.content} /> : message.content}
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
              {canChooseModel && (
                <div className="chatbot-model-row">
                  <label className="chatbot-model-picker" htmlFor="chatbot-model" title="Pilih model AI">
                    <Icon name="sparkle" size={14} />
                    <select id="chatbot-model" value={selectedModel} onChange={(event) => {
                      setSelectedModel(event.target.value);
                      try { localStorage.setItem("ulanganku_chat_model", event.target.value); } catch { /* storage may be disabled */ }
                    }} aria-label="Model AI" aria-busy={modelsLoading}>
                      {modelOptions.map((model) => <option key={model} value={model}>{MODEL_LABELS[model] ?? model}</option>)}
                    </select>
                    <Icon name="chevron" size={13} />
                  </label>
                  {modelError && <button type="button" className="chatbot-model-refresh" onClick={() => void reloadModels()} aria-label="Muat ulang daftar model" title="Muat ulang daftar model"><Icon name="refresh" size={13} /></button>}
                </div>
              )}
            <textarea
              ref={inputRef}
              aria-label="Pesan untuk asisten"
              value={input}
              onChange={(event) => {
                const target = event.currentTarget;
                setInput(target.value.slice(0, 1800));
                target.style.height = "30px";
                target.style.height = `${Math.min(target.scrollHeight, 88)}px`;
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
            <button className="btn btn-primary chatbot-send" type="submit" aria-label="Kirim pesan" title="Kirim pesan" disabled={pending || !input.trim()}>
              {pending ? <span className="spinner" aria-hidden="true" /> : <Icon name="arrow" size={16} />}
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
