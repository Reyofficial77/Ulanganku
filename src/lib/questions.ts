import { api, type Format, type Kind, type Question } from "./api";
import { uid } from "./hooks";

export const KIND_META: { kind: Kind; label: string; desc: string; icon: "list" | "check" | "edit" | "file" | "book" | "image" }[] = [
  { kind: "multiple_choice", label: "Pilihan ganda", desc: "Murid memilih satu jawaban dari beberapa pilihan.", icon: "list" },
  { kind: "true_false", label: "Benar / Salah", desc: "Pernyataan yang dijawab benar atau salah.", icon: "check" },
  { kind: "short_answer", label: "Jawaban singkat", desc: "Murid mengetik jawaban singkat. Dinilai otomatis.", icon: "edit" },
  { kind: "essay", label: "Uraian", desc: "Murid menulis jawaban panjang. Dinilai manual oleh guru.", icon: "file" },
  { kind: "story", label: "Soal cerita", desc: "Bacaan atau cerita panjang diikuti pertanyaan.", icon: "book" },
  { kind: "story_image", label: "Soal cerita + gambar", desc: "Soal cerita yang dilengkapi gambar.", icon: "image" },
  { kind: "image", label: "Soal bergambar", desc: "Pertanyaan dengan gambar, tabel, atau diagram.", icon: "image" },
];

export const FORMAT_LABEL: Record<Format, string> = {
  multiple_choice: "Pilihan ganda",
  true_false: "Benar / Salah",
  short_answer: "Jawaban singkat",
  essay: "Uraian",
};

export const kindLabel = (kind: Kind) => KIND_META.find((item) => item.kind === kind)?.label ?? kind;
export const isBasicKind = (kind: Kind) => kind === "multiple_choice" || kind === "true_false" || kind === "short_answer" || kind === "essay";
export const hasStory = (kind: Kind) => kind === "story" || kind === "story_image";
export const hasImage = (kind: Kind) => kind === "story_image" || kind === "image";

export const TF_OPTIONS = ["Benar", "Salah"];

/** Lengkapi field sesuai bentuk jawaban supaya editor selalu punya data yang dibutuhkan. */
export function withFormatDefaults(question: Question): Question {
  const next = { ...question };
  if (next.format === "multiple_choice") {
    if (next.options.length < 2 || next.options.join("") === TF_OPTIONS.join("")) next.options = ["", "", "", ""];
    if (next.correctIndex >= next.options.length) next.correctIndex = 0;
  } else if (next.format === "true_false") {
    next.options = [...TF_OPTIONS];
    if (next.correctIndex > 1) next.correctIndex = 0;
  } else if (next.format === "short_answer") {
    if (next.acceptedAnswers.length === 0) next.acceptedAnswers = [""];
  }
  return next;
}

export function blankQuestion(kind: Kind = "multiple_choice"): Question {
  const format: Format = isBasicKind(kind) ? (kind as Format) : kind === "image" ? "multiple_choice" : "short_answer";
  return withFormatDefaults({
    id: uid(),
    kind,
    format,
    text: "",
    story: "",
    image: null,
    options: [],
    correctIndex: 0,
    acceptedAnswers: [],
    rubric: "",
    points: 1,
  });
}

export function changeKind(question: Question, kind: Kind): Question {
  let format = question.format;
  if (isBasicKind(kind)) format = kind as Format;
  else if (isBasicKind(question.kind)) format = kind === "image" ? "multiple_choice" : "short_answer";
  return withFormatDefaults({ ...question, kind, format });
}

export const changeFormat = (question: Question, format: Format): Question => withFormatDefaults({ ...question, format });

export function isComplete(question: Question) {
  if (!question.text.trim()) return false;
  if (hasStory(question.kind) && !question.story.trim()) return false;
  if (hasImage(question.kind) && !question.image) return false;
  if (question.format === "multiple_choice" || question.format === "true_false") return question.options.every((o) => o.trim());
  if (question.format === "short_answer") return question.acceptedAnswers.some((a) => a.trim());
  return true;
}

const MAX_BYTES = 1_200_000;

/** Perkecil gambar di browser (maks 1280px) dan ubah ke JPEG agar ringan. */
export async function compressImage(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error("Format gambar harus JPG, PNG, WebP, atau GIF.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Ukuran file terlalu besar (maksimal 15 MB).");

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Gambar tidak bisa dibaca."));
      el.src = url;
    });
    let scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Browser tidak mendukung pemrosesan gambar.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", attempt < 2 ? 0.82 : 0.65);
      if ((dataUrl.length * 3) / 4 <= MAX_BYTES) return dataUrl;
      scale *= 0.75;
    }
    throw new Error("Gambar terlalu besar. Gunakan gambar yang lebih kecil.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadImage(file: File): Promise<string> {
  const dataUrl = await compressImage(file);
  const { url } = await api<{ url: string }>("/images", { body: { dataUrl } });
  return url;
}
