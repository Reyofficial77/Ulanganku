import { Fragment, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { Icon } from "./Icon";
import { ApiError, api, type ProStatus } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useApi } from "../lib/hooks";
import { Link } from "../lib/router";
import { extensionFor, fileToBase64, uploadName } from "../lib/upload";

type SentAttachment = { name: string; kind: "image" | "doc" };
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  link?: { to: string; label: string };
  /** Hanya untuk tampilan: nama (sudah diganti) lampiran yang dikirim bersama pesan ini. */
  attachments?: SentAttachment[];
  /** Teks dokumen hasil ekstraksi server, dikirim ulang sebagai teks agar pertanyaan lanjutan tetap nyambung. */
  docs?: { name: string; text: string }[];
};
type PendingAttachment = { id: string; file: File; kind: "image" | "doc"; previewUrl: string | null };
type Point = { x: number; y: number };

const POSITION_KEY = "ulanganku_chatbot_pos";
const HIDDEN_KEY = "ulanganku_chatbot_hidden";
const EDGE = 6;
const DRAG_THRESHOLD = 6;
const LONG_PRESS_MS = 2000;
const MAX_ATTACHMENTS = 3;
const MAX_DOC_BYTES = 2_000_000;
const MAX_TOTAL_BYTES = 3_000_000;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const DOC_EXTENSIONS = ["pdf", "docx", "txt", "md", "csv", "json"];
const DOC_MIME: Record<string, string> = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", txt: "text/plain", md: "text/markdown", csv: "text/csv", json: "application/json" };

function readStoredPosition(): Point | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(POSITION_KEY) ?? "null");
    if (parsed && Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) return { x: parsed.x, y: parsed.y };
  } catch { /* storage may be disabled */ }
  return null;
}

function readHidden(): boolean {
  try { return sessionStorage.getItem(HIDDEN_KEY) === "1"; } catch { return false; }
}
type ModelCatalog = { models: string[]; defaultModel: string; source?: "api" | "environment" };
type GenerationBatch = { jobId: string; examId: string | null; title: string; requestedCount: number; generatedCount: number; done: boolean; model: string };
type ChatbotProps = { context?: "landing" | "dashboard"; initialOpen?: boolean };

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
// Deteksi dibuat lebih toleran terhadap susunan kalimat Indonesia, jumlah soal di depan,
// dan permintaan berbasis lampiran. Pertanyaan tentang CARA/capability tidak memicu job.
const CREATE_EXAM = /(?:\b(?:buat(?:kan|in)?|membuat(?:kan)?|bikin(?:kan|in)?|generate|hasilkan|susun(?:kan)?|menyusun|siapkan|sediakan|create|make|build|write|prepare|butuh|perlu|ingin|mau|pengen|minta(?:kan)?|ubah|jadikan|konversi)\b[\s\S]{0,140}\b(?:ulangan|ujian|kuis|quiz|soal|pertanyaan|exam|test|assessment|questions?)\b|\b(?:\d{1,3}\s+)?(?:ulangan|ujian|kuis|quiz|soal|pertanyaan|exam|test|assessment|questions?)\b[\s\S]{0,100}\b(?:dari|berdasarkan|tentang|topik|materi)\b)/i;
const EXAM_HOW_TO = /(?:^\s*(?:(?:tolong|mohon)\s+)?(?:(?:jelaskan|terangkan)\s+)?(?:bagaimana|gimana|cara|langkah|panduan|tutorial|apa\s+cara|apa\s+langkah|apakah|bisakah|dapatkah)\b|\b(?:ingin|mau|pengen)\s+tahu\b)/i;

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

export default function Chatbot({ context = "dashboard", initialOpen = false }: ChatbotProps) {
  const [open, setOpen] = useState(initialOpen);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();
  // Status PRO perlu diketahui juga saat chatbot dibuka dari landing page.
  // Pembuatan soal tetap berjalan lewat endpoint PRO yang memvalidasi akses di server.
  const { data: pro, setData: setPro } = useApi<ProStatus>(user && open ? "/pro/status" : null);
  const isPro = Boolean(pro?.active);
  const canChooseModel = context === "dashboard" && isPro;
  const [selectedModel, setSelectedModel] = useState(() => {
    try { return localStorage.getItem("ulanganku_chat_model") ?? ""; } catch { return ""; }
  });
  const { data: availableModels, error: modelError, loading: modelsLoading, reload: reloadModels } = useApi<ModelCatalog>(canChooseModel && open ? "/pro/models" : null);
  const modelOptions = availableModels?.models?.length ? availableModels.models : FALLBACK_PRO_MODELS;
  const activeJobRef = useRef<string | null>(null);
  const generationBatchSizeRef = useRef(2);
  const generationMessagesRef = useRef<ChatMessage[]>([]);
  const [generationProgress, setGenerationProgress] = useState<{ generated: number; requested: number } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ---- Posisi overlay (bisa digeser) ----
  const [pos, setPos] = useState<Point | null>(() => readStoredPosition());
  const [panelPos, setPanelPos] = useState<(Point & { h: number | null }) | null>(null);
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const [hidden, setHidden] = useState(() => readHidden());
  const [menu, setMenu] = useState<Point | null>(null);
  const [toast, setToast] = useState(false);
  const [docking, setDocking] = useState(false);
  const dockingTimer = useRef<number | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: number; startX: number; startY: number; originX: number; originY: number; moved: boolean; touch: boolean; timer: number | null } | null>(null);
  const suppressClick = useRef(false);
  const menuOpenedAt = useRef(0);
  const lastPointerType = useRef<string>("mouse");

  // ---- Lampiran ----
  const [queued, setPendingFiles] = useState<PendingAttachment[]>([]);
  const [attachMenu, setAttachMenu] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const hasImageAttachment = queued.some((item) => item.kind === "image");

  function clampToViewport(point: Point): Point {
    const toggle = toggleRef.current;
    const width = toggle?.offsetWidth ?? 120;
    const height = toggle?.offsetHeight ?? 48;
    return {
      x: Math.min(Math.max(EDGE, point.x), Math.max(EDGE, window.innerWidth - width - EDGE)),
      y: Math.min(Math.max(EDGE, point.y), Math.max(EDGE, window.innerHeight - height - EDGE)),
    };
  }

  function dockToNearestSide(point: Point): Point {
    const toggleWidth = toggleRef.current?.offsetWidth ?? 124;
    const clamped = clampToViewport(point);
    const leftDistance = clamped.x;
    const rightDistance = window.innerWidth - (clamped.x + toggleWidth);
    const x = leftDistance <= rightDistance
      ? 14
      : Math.max(EDGE, window.innerWidth - toggleWidth - 14);
    return clampToViewport({ x, y: clamped.y });
  }

  function persistPosition(point: Point | null) {
    try {
      if (point) localStorage.setItem(POSITION_KEY, JSON.stringify(point));
      else localStorage.removeItem(POSITION_KEY);
    } catch { /* storage may be disabled */ }
  }

  // Jaga overlay tetap di dalam layar saat ukuran jendela berubah (rotasi, keyboard HP, resize).
  useEffect(() => {
    const onResize = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
      setPos((current) => (current ? dockToNearestSide(current) : current));
      setMenu(null);
    };
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, []);

  // Tombol bisa berubah lebar (pil "Bantuan AI" <-> lingkaran), jadi klem ulang saat status buka/tutup berubah.
  useLayoutEffect(() => {
    setPos((current) => {
      if (!current) return current;
      const next = dockToNearestSide(current);
      return next.x === current.x && next.y === current.y ? current : next;
    });
  }, [open, hidden]);

  // Jendela AI mengikuti letak overlay, selalu di dalam layar, dan tidak menutupi tombol overlay.
  useLayoutEffect(() => {
    if (!open || hidden) { setPanelPos(null); return; }
    if (viewport.w <= 560) {
      setPanelPos({ x: 8, y: 8, h: null });
      return;
    }
    const toggle = toggleRef.current;
    const panel = panelRef.current;
    if (!toggle || !panel) return;
    const t = toggle.getBoundingClientRect();
    const w = panel.offsetWidth;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;
    const gap = 10;
    const minHeight = 300;
    // Tinggi bawaan jendela (sama dengan aturan CSS .chatbot-panel).
    const compact = vw <= 560;
    const naturalHeight = Math.min(compact ? 590 : 620, vh - (compact ? 88 : 100));
    const clampX = (value: number) => Math.min(Math.max(margin, value), Math.max(margin, vw - margin - w));
    const alignedLeft = clampX(t.right - w < margin ? t.left : t.right - w);
    const roomAbove = t.top - gap - margin;
    const roomBelow = vh - t.bottom - gap - margin;
    let top: number;
    let left = alignedLeft;
    let height: number | null = null;
    if (roomAbove >= naturalHeight) {
      top = t.top - gap - naturalHeight;
    } else if (roomBelow >= naturalHeight) {
      top = t.bottom + gap;
    } else if (Math.max(roomAbove, roomBelow) >= minHeight) {
      // Ruang kurang: perkecil tinggi jendela ke sisi yang lebih lega.
      if (roomAbove >= roomBelow) { height = roomAbove; top = margin; }
      else { height = roomBelow; top = t.bottom + gap; }
    } else {
      // Layar pendek: taruh di samping tombol bila muat, jika tidak, tombol tetap berada di atas jendela.
      const roomLeft = t.left - gap - margin;
      const roomRight = vw - t.right - gap - margin;
      if (roomLeft >= w) left = t.left - gap - w;
      else if (roomRight >= w) left = t.right + gap;
      const panelHeight = Math.min(naturalHeight, vh - margin * 2);
      height = panelHeight < naturalHeight ? panelHeight : null;
      top = Math.min(Math.max(margin, t.top + t.height / 2 - panelHeight / 2), Math.max(margin, vh - margin - panelHeight));
    }
    setPanelPos((current) => (current && current.x === left && current.y === top && current.h === height ? current : { x: left, y: top, h: height }));
  }, [open, hidden, pos, viewport]);

  // Menu klik kanan: tutup saat klik di luar atau tekan Escape.
  useEffect(() => {
    if (!menu && !attachMenu) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.("[data-attach-menu]")) return;
      setMenu(null);
      setAttachMenu(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenu(null); setAttachMenu(false); } };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu, attachMenu]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(false), 7000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => () => {
    if (dockingTimer.current) window.clearTimeout(dockingTimer.current);
  }, []);

  function hideOverlay() {
    setMenu(null);
    setOpen(false);
    setHidden(true);
    setToast(true);
    try { sessionStorage.setItem(HIDDEN_KEY, "1"); } catch { /* storage may be disabled */ }
  }

  function showOverlay() {
    setHidden(false);
    setToast(false);
    try { sessionStorage.removeItem(HIDDEN_KEY); } catch { /* storage may be disabled */ }
  }

  const MENU_WIDTH = 190;
  const MENU_HEIGHT = 176;

  function openMenuAt(clientX: number, clientY: number) {
    const rect = toggleRef.current?.getBoundingClientRect();
    const fromKeyboard = clientX === 0 && clientY === 0 && rect;
    const x = fromKeyboard ? rect.left : clientX;
    const y = fromKeyboard ? rect.top - MENU_HEIGHT - 8 : clientY;
    menuOpenedAt.current = 0; // pengaman waktu hanya untuk menu hasil tahan lama di layar sentuh
    setMenu({
      x: Math.min(Math.max(EDGE, x), Math.max(EDGE, window.innerWidth - MENU_WIDTH - EDGE)),
      y: Math.min(Math.max(EDGE, y), Math.max(EDGE, window.innerHeight - MENU_HEIGHT - EDGE)),
    });
  }

  function placeOverlay(side: "left" | "right" | "reset") {
    setMenu(null);
    if (side === "reset") {
      setPos(null);
      persistPosition(null);
      return;
    }
    const toggleWidth = toggleRef.current?.offsetWidth ?? 124;
    const toggleHeight = toggleRef.current?.offsetHeight ?? 48;
    const y = pos?.y ?? Math.max(EDGE, window.innerHeight - toggleHeight - 24);
    const x = side === "left" ? 14 : Math.max(EDGE, window.innerWidth - toggleWidth - 14);
    const next = clampToViewport({ x, y });
    setPos(next);
    persistPosition(next);
  }

  // Layar sentuh: menu diletakkan di samping tombol, jauh dari jari, supaya tidak terpencet saat jari diangkat.
  function openMenuNearToggle() {
    const rect = toggleRef.current?.getBoundingClientRect();
    if (!rect) return;
    const above = rect.top - MENU_HEIGHT - 12;
    const y = above >= EDGE ? above : rect.bottom + 12;
    menuOpenedAt.current = Date.now();
    setMenu({
      x: Math.min(Math.max(EDGE, rect.right - MENU_WIDTH), Math.max(EDGE, window.innerWidth - MENU_WIDTH - EDGE)),
      y: Math.min(Math.max(EDGE, y), Math.max(EDGE, window.innerHeight - MENU_HEIGHT - EDGE)),
    });
  }

  function clearGestureTimer() {
    if (gesture.current?.timer) window.clearTimeout(gesture.current.timer);
    if (gesture.current) gesture.current.timer = null;
  }

  function onTogglePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (dockingTimer.current) window.clearTimeout(dockingTimer.current);
    dockingTimer.current = null;
    setDocking(false);
    lastPointerType.current = event.pointerType;
    if (event.pointerType === "mouse" && event.button !== 0) return; // klik kanan ditangani onContextMenu
    const rect = event.currentTarget.getBoundingClientRect();
    const touch = event.pointerType !== "mouse";
    gesture.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, originX: rect.left, originY: rect.top, moved: false, touch, timer: null };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* ignore */ }
    setMenu(null);
    if (touch) {
      // Tahan ±2 detik tanpa menggeser = tampilkan opsi Sembunyikan.
      gesture.current.timer = window.setTimeout(() => {
        if (!gesture.current || gesture.current.moved) return;
        suppressClick.current = true;
        if (navigator.vibrate) { try { navigator.vibrate(15); } catch { /* ignore */ } }
        openMenuNearToggle();
      }, LONG_PRESS_MS);
    }
  }

  function onTogglePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;
    if (!g.moved && Math.hypot(dx, dy) < (g.touch ? DRAG_THRESHOLD + 4 : DRAG_THRESHOLD)) return;
    if (!g.moved) { g.moved = true; clearGestureTimer(); setMenu(null); }
    setPos(clampToViewport({ x: g.originX + dx, y: g.originY + dy }));
  }

  function endGesture(event: ReactPointerEvent<HTMLButtonElement>) {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    clearGestureTimer();
    if (g.moved) {
      suppressClick.current = true; // jangan anggap sebagai klik buka/tutup
      const rect = event.currentTarget.getBoundingClientRect();
      const final = dockToNearestSide({ x: rect.left, y: rect.top });
      setDocking(true);
      setPos(final);
      persistPosition(final);
      if (dockingTimer.current) window.clearTimeout(dockingTimer.current);
      dockingTimer.current = window.setTimeout(() => {
        setDocking(false);
        dockingTimer.current = null;
      }, 220);
    }
    gesture.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
    // Bila browser tidak mengirim event click setelah geser/tahan, jangan biarkan klik berikutnya ikut tertelan.
    if (suppressClick.current) window.setTimeout(() => { suppressClick.current = false; }, 80);
  }

  function onToggleClick() {
    if (suppressClick.current) { suppressClick.current = false; return; }
    setOpen((value) => !value);
  }

  function onToggleContextMenu(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    // Di layar sentuh, menu muncul lewat tahan 2 detik, bukan lewat menu bawaan browser.
    if (lastPointerType.current === "touch" || lastPointerType.current === "pen") return;
    openMenuAt(event.clientX, event.clientY);
  }

  // ---- Lampiran: pilih, hapus, siapkan ----
  function addFiles(list: FileList | null, mode: "image" | "doc") {
    if (!list || list.length === 0) return;
    const accepted: PendingAttachment[] = [];
    let problem = "";
    for (const file of Array.from(list)) {
      if (queued.length + accepted.length >= MAX_ATTACHMENTS) { problem = `Maksimal ${MAX_ATTACHMENTS} lampiran per pesan.`; break; }
      const ext = /\.([a-z0-9]{1,5})$/i.exec(file.name)?.[1]?.toLowerCase() ?? "";
      if (mode === "image") {
        if (!IMAGE_TYPES.includes(file.type)) { problem = "Foto harus berformat JPG, PNG, WebP, atau GIF."; continue; }
        if (file.size > 15 * 1024 * 1024) { problem = "Ukuran foto terlalu besar (maksimal 15 MB)."; continue; }
        accepted.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file, kind: "image", previewUrl: URL.createObjectURL(file) });
      } else {
        if (!DOC_EXTENSIONS.includes(ext)) { problem = "Dokumen harus berformat PDF, DOCX, TXT, MD, CSV, atau JSON."; continue; }
        if (file.size > MAX_DOC_BYTES) { problem = "Ukuran dokumen maksimal 2 MB."; continue; }
        accepted.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file, kind: "doc", previewUrl: null });
      }
    }
    if (accepted.length) setPendingFiles((current) => [...current, ...accepted]);
    setError(problem);
    setAttachMenu(false);
  }

  function removePending(id: string) {
    setPendingFiles((current) => {
      const target = current.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }

  /** Ganti nama SEBELUM dikirim ke server (nama asli dari perangkat tidak ikut terkirim). */
  async function prepareUploads(items: PendingAttachment[]): Promise<{ files: { name: string; data: string }[]; sent: SentAttachment[] }> {
    const files: { name: string; data: string }[] = [];
    const sent: SentAttachment[] = [];
    let total = 0;
    for (const item of items) {
      if (item.kind === "image") {
        const { compressImage } = await import("../lib/questions");
        const dataUrl = await compressImage(item.file);
        const name = uploadName("image/jpeg", item.file.name);
        const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
        total += (base64.length * 3) / 4;
        files.push({ name, data: base64 });
        sent.push({ name, kind: "image" });
      } else {
        const ext = extensionFor(item.file.type, item.file.name);
        const name = uploadName(item.file.type || DOC_MIME[ext] || "", item.file.name);
        const base64 = await fileToBase64(item.file);
        total += item.file.size;
        files.push({ name, data: base64 });
        sent.push({ name, kind: "doc" });
      }
    }
    if (total > MAX_TOTAL_BYTES) throw new Error("Total ukuran lampiran maksimal 3 MB per pesan. Hapus satu lampiran atau pilih file yang lebih kecil.");
    return { files, sent };
  }

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
    for (let step = 0; step < 30; step += 1) {
      result = await api<GenerationBatch>("/pro/ai/exam/batch", { method: "POST", body: { jobId, batchSize: generationBatchSizeRef.current } });
      setGenerationProgress({ generated: result.generatedCount, requested: result.requestedCount });
      if (result.done) break;
    }
    if (!result?.done || !result.examId) {
      throw new Error("Pembuatan belum selesai dalam satu sesi. Tekan Lanjutkan untuk melanjutkan batch berikutnya.");
    }
    activeJobRef.current = null;
    generationBatchSizeRef.current = 2;
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
      if (cause instanceof ApiError && cause.status === 504) generationBatchSizeRef.current = 1;
      setError(cause instanceof Error ? cause.message : "Batch gagal. Coba lanjutkan lagi.");
    } finally {
      setPending(false);
    }
  }

  async function sendMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const typed = input.trim();
    const outgoing = queued;
    if ((!typed && outgoing.length === 0) || pending) return;
    const content = typed || "Tolong periksa lampiran ini.";

    setPending(true);
    setError("");
    let uploads: Awaited<ReturnType<typeof prepareUploads>> = { files: [], sent: [] };
    try {
      if (outgoing.length) uploads = await prepareUploads(outgoing);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Lampiran gagal disiapkan.");
      setPending(false);
      return;
    }

    const userMessage: ChatMessage = { role: "user", content, ...(uploads.sent.length ? { attachments: uploads.sent } : {}) };
    const nextMessages: ChatMessage[] = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "30px";

    try {
      // Permintaan membuat soal diproses langsung dari chat. Jangan lempar ke chatbot umum,
      // karena itu membuat model mengikuti instruksi lama yang melarang pembuatan soal.
      if (CREATE_EXAM.test(content) && !EXAM_HOW_TO.test(content)) {
        // Konfirmasi sesi sekali lagi agar login yang baru selesai di landing tidak salah
        // dianggap sebagai pengunjung, meskipun state AuthProvider belum selesai dimuat.
        const session = user ? true : Boolean((await api<{ user: unknown }>("/me")).user);
        if (!session) {
          setMessages([...nextMessages, {
            role: "assistant",
            content: "Untuk membuat draf soal langsung dari chat, masuk ke akun Ulanganku terlebih dahulu. Setelah login, buka Bantuan AI dan kirim ulang permintaan yang sama.",
            link: { to: "/login", label: "Masuk ke Ulanganku" },
          }]);
          return;
        }

        // Ambil status terkini sebelum memutuskan akses, termasuk untuk chatbot landing.
        const currentPro = await api<ProStatus>("/pro/status");
        setPro(currentPro);
        if (!currentPro.active) {
          setMessages([...nextMessages, {
            role: "assistant",
            content: "Pembuatan draf soal langsung dari chat tersedia untuk akun PRO. Setelah akses PRO aktif, kirim ulang perintah di sini. Kamu tidak perlu mencari menu khusus bernama ‘Buat Ulangan AI’."
          }]);
          return;
        }

        const started = await api<{ jobId: string; requestedCount: number; generatedCount: number }>("/pro/ai/exam", {
          method: "POST", body: {
            prompt: content,
            ...(canChooseModel && selectedModel ? { model: selectedModel } : {}),
            ...(uploads.files.length ? { files: uploads.files } : {}),
          },
        });
        activeJobRef.current = started.jobId;
        outgoing.forEach((item) => { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
        if (outgoing.length) setPendingFiles([]);
        generationBatchSizeRef.current = 2;
        generationMessagesRef.current = nextMessages;
        setGenerationProgress({ generated: 0, requested: started.requestedCount });
        await drainGeneration(started.jobId, nextMessages);
        return;
      }
      const history = nextMessages.slice(-10);
      const result = await api<{
        reply?: string;
        docs?: { name: string; text: string }[];
        generation?: { jobId: string; requestedCount: number; generatedCount: number; model: string };
      }>("/chat", {
        method: "POST",
        body: {
          messages: history.map((message, index) => ({
            role: message.role,
            content: message.content,
            ...(message.docs?.length ? { docs: message.docs } : {}),
            // Lampiran baru hanya menyertai pesan terakhir; nama file di sini sudah diganti.
            ...(index === history.length - 1 && uploads.files.length ? { files: uploads.files } : {}),
          })),
          ...(canChooseModel && selectedModel ? { model: selectedModel } : {}),
        },
      });
      if (result.generation?.jobId) {
        activeJobRef.current = result.generation.jobId;
        outgoing.forEach((item) => { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
        if (outgoing.length) setPendingFiles([]);
        generationBatchSizeRef.current = 2;
        generationMessagesRef.current = nextMessages;
        setGenerationProgress({ generated: result.generation.generatedCount ?? 0, requested: result.generation.requestedCount });
        await drainGeneration(result.generation.jobId, nextMessages);
        return;
      }
      const withDocs = result.docs?.length
        ? nextMessages.map((message, index) => (index === nextMessages.length - 1 ? { ...message, docs: result.docs } : message))
        : nextMessages;
      setMessages([...withDocs, { role: "assistant", content: result.reply ?? "AI tidak mengembalikan jawaban. Silakan coba lagi." }]);
      outgoing.forEach((item) => { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
      if (outgoing.length) setPendingFiles([]);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 504 && activeJobRef.current) generationBatchSizeRef.current = 1;
      if (outgoing.length && !activeJobRef.current) setInput(content);
      setError(cause instanceof Error ? cause.message : "Pesan gagal dikirim. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  if (hidden) {
    return toast ? (
      <div className="chatbot-toast" role="status">
        <span>Bantuan AI disembunyikan.</span>
        <button type="button" onClick={showOverlay}>Urungkan</button>
      </div>
    ) : null;
  }

  return (
    <div className={`chatbot-root ${docking ? "chatbot-root-docking" : ""}`} style={pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : undefined}>
      {open && (
        <section
          ref={panelRef}
          className={`chatbot-panel ${viewport.w <= 560 ? "chatbot-panel-mobile" : ""}`}
          style={panelPos ? { left: panelPos.x, top: panelPos.y, ...(panelPos.h ? { height: panelPos.h, minHeight: 0 } : {}) } : { visibility: "hidden" }}
          aria-label="Chatbot Ulanganku"
          aria-live="polite"
        >
          <header className="chatbot-header">
            <div className="chatbot-avatar"><Icon name="sparkle" size={19} /></div>
            <div className="chatbot-heading">
              <strong>Asisten Ulanganku</strong>
              <small>Bisa digeser dan ditempel di sisi layar</small>
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
                  ? <>Halo! Saya Asisten Ulanganku. Saya bisa membantu menjelaskan fitur Ulanganku dan cara membuat ulangan online.{isPro ? " Akun PRO kamu juga bisa meminta saya membuat draf ulangan langsung dari chat." : " Masuk dengan akun PRO untuk membuat draf ulangan langsung dari chat."}</>
                  : <>Halo! Saya Asisten Ulanganku. Saya bisa membantu mengatur percobaan, mengelola hasil, dan menggunakan fitur dashboard.{isPro ? " Sebagai pengguna PRO, pilih model AI lalu minta saya membuat draf ulangan. Kamu juga bisa mengunggah foto, PDF, atau DOCX dan menulis: ‘buatkan 10 soal dari materi ini’." : " Pembuatan draf ulangan otomatis dengan AI tersedia untuk pengguna PRO."}</>}
              </div>
            )}
            {messages.map((message, index) => (
              <div key={`${index}-${message.role}`} className={`chatbot-message chatbot-${message.role}`}>
                {message.role === "assistant" ? <FormattedChatMessage content={message.content} /> : message.content}
                {message.attachments?.length ? (
                  <div className="chatbot-sent-files">
                    {message.attachments.map((file) => (
                      <span key={file.name} className="chatbot-file-chip chatbot-file-chip-sent"><Icon name={file.kind === "image" ? "image" : "file"} size={12} /> {file.name}</span>
                    ))}
                  </div>
                ) : null}
                {message.link && (
                  <Link to={message.link.to} className="chatbot-link">{message.link.label} <Icon name="arrow" size={13} /></Link>
                )}
              </div>
            ))}
            {pending && (
              <div className="chatbot-message chatbot-assistant chatbot-typing" role="status">
                {generationProgress
                  ? `Membuat soal: ${generationProgress.generated} dari ${generationProgress.requested}…`
                  : queued.length
                    ? "Membaca lampiran dan menyiapkan jawaban…"
                    : "Sedang menyiapkan jawaban…"}
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
              {queued.length > 0 && (
                <div className="chatbot-queued">
                  {queued.map((item) => (
                    <span key={item.id} className="chatbot-file-chip">
                      {item.previewUrl ? <img src={item.previewUrl} alt="" /> : <Icon name="file" size={13} />}
                      <span className="chatbot-file-name">{item.file.name}</span>
                      <button type="button" aria-label={`Hapus lampiran ${item.file.name}`} onClick={() => removePending(item.id)} disabled={pending}><Icon name="close" size={11} /></button>
                    </span>
                  ))}
                </div>
              )}
              {hasImageAttachment && canChooseModel && selectedModel !== "gemma4:31b" && (
                <div className="chatbot-model-note">Foto akan dianalisis dengan Gemma 4 31B.</div>
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
              placeholder={queued.length ? "Contoh: buatkan 10 soal dari materi ini…" : "Tanyakan sesuatu…"}
              rows={1}
              disabled={pending}
              maxLength={1800}
            />
              <div className="chatbot-attach-row" data-attach-menu>
                <button
                  type="button"
                  className="chatbot-attach"
                  aria-label="Lampirkan file"
                  aria-haspopup="menu"
                  aria-expanded={attachMenu}
                  title={user ? "Lampirkan foto atau dokumen" : "Masuk ke akun untuk melampirkan file"}
                  disabled={pending || !user || queued.length >= MAX_ATTACHMENTS}
                  onClick={() => setAttachMenu((value) => !value)}
                >
                  <Icon name="paperclip" size={16} />
                </button>
                {attachMenu && (
                  <div className="chatbot-attach-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => imageInputRef.current?.click()}><Icon name="image" size={14} /> Foto / gambar</button>
                    <button type="button" role="menuitem" onClick={() => docInputRef.current?.click()}><Icon name="file" size={14} /> Dokumen</button>
                  </div>
                )}
                <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(event) => { addFiles(event.target.files, "image"); event.target.value = ""; }} />
                <input ref={docInputRef} type="file" accept=".pdf,.docx,.txt,.md,.csv,.json,application/pdf,text/plain" multiple hidden onChange={(event) => { addFiles(event.target.files, "doc"); event.target.value = ""; }} />
                <small>{user ? "JPG/PNG/WebP · PDF/DOCX/TXT/CSV/JSON · maks. 3 file" : "Masuk untuk melampirkan file"}</small>
              </div>
            </div>
            <button className="btn btn-primary chatbot-send" type="submit" aria-label="Kirim pesan" title="Kirim pesan" disabled={pending || (!input.trim() && queued.length === 0)}>
              {pending ? <span className="spinner" aria-hidden="true" /> : <Icon name="arrow" size={16} />}
            </button>
          </form>
        </section>
      )}

      {!(open && viewport.w <= 560) && <button
        ref={toggleRef}
        className={`chatbot-toggle ${open ? "chatbot-toggle-open" : ""}`}
        aria-label={open ? "Tutup chatbot" : "Buka chatbot Ulanganku"}
        aria-expanded={open}
        title="Klik untuk membuka. Geser untuk menempel di sisi layar. Klik kanan atau tahan untuk opsi posisi."
        onPointerDown={onTogglePointerDown}
        onPointerMove={onTogglePointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onContextMenu={onToggleContextMenu}
        onClick={onToggleClick}
      >
        {open ? <Icon name="close" size={22} /> : <><Icon name="sparkle" size={20} /><span>Bantuan AI</span></>}
      </button>}

      {menu && (
        <div ref={menuRef} className="chatbot-menu" role="menu" aria-label="Pengaturan posisi Bantuan AI" style={{ left: menu.x, top: menu.y }}>
          <button type="button" role="menuitem" onClick={() => placeOverlay("left")}><Icon name="align-left" size={14} /> Tempel di kiri</button>
          <button type="button" role="menuitem" onClick={() => placeOverlay("right")}><Icon name="align-right" size={14} /> Tempel di kanan</button>
          <button type="button" role="menuitem" onClick={() => placeOverlay("reset")}><Icon name="rotate-ccw" size={14} /> Reset posisi</button>
          <button type="button" role="menuitem" onClick={() => { if (Date.now() - menuOpenedAt.current < 400) return; hideOverlay(); }}><Icon name="eye-off" size={14} /> Sembunyikan bantuan AI</button>
        </div>
      )}
    </div>
  );
}
