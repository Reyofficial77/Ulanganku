import { api, type Format, type Kind, type Question } from "./api";
import { uid } from "./hooks";
import { tr } from "./preferences";
import { uploadName } from "./upload";

export function getKindMeta(): { kind: Kind; label: string; desc: string; icon: "list" | "check" | "edit" | "file" | "book" | "image" }[] {
  return [
    { kind: "multiple_choice", label: tr("Pilihan ganda", "Multiple choice"), desc: tr("Murid memilih satu jawaban dari beberapa pilihan.", "Students choose one answer from several options."), icon: "list" },
    { kind: "multiple_select", label: tr("Pilihan ganda kompleks", "Multiple select"), desc: tr("Murid dapat memilih lebih dari satu jawaban benar.", "Students can select more than one correct answer."), icon: "check" },
    { kind: "true_false", label: tr("Benar / Salah", "True / False"), desc: tr("Pernyataan yang dijawab benar atau salah.", "A statement answered as true or false."), icon: "check" },
    { kind: "short_answer", label: tr("Jawaban singkat", "Short answer"), desc: tr("Murid mengetik jawaban singkat. Dinilai otomatis.", "Students type a short answer. Auto-graded."), icon: "edit" },
    { kind: "fill_blank", label: tr("Isian rumpang", "Fill in the blank"), desc: tr("Murid melengkapi bagian kalimat yang kosong.", "Students complete the blank part of a sentence."), icon: "edit" },
    { kind: "numeric", label: tr("Jawaban numerik", "Numeric"), desc: tr("Jawaban berupa angka, dinilai otomatis.", "Numeric answer, auto-graded."), icon: "edit" },
    { kind: "matching", label: tr("Menjodohkan", "Matching"), desc: tr("Murid memasangkan pernyataan dengan jawaban.", "Students match prompts with answers."), icon: "list" },
    { kind: "ordering", label: tr("Mengurutkan", "Ordering"), desc: tr("Murid menyusun langkah atau item dalam urutan benar.", "Students arrange steps or items in the right order."), icon: "list" },
    { kind: "essay", label: tr("Uraian", "Essay"), desc: tr("Murid menulis jawaban panjang. Dinilai AI atau guru.", "Students write a long answer. Graded by AI or teacher."), icon: "file" },
    { kind: "story", label: tr("Soal cerita", "Passage"), desc: tr("Bacaan diikuti pertanyaan; pilihan ganda menjadi bentuk jawaban bawaan.", "Reading passage followed by a question; defaults to multiple choice."), icon: "book" },
    { kind: "story_image", label: tr("Soal cerita + gambar", "Passage + image"), desc: tr("Soal cerita yang dilengkapi gambar.", "Passage question accompanied by an image."), icon: "image" },
    { kind: "image", label: tr("Soal bergambar", "Image question"), desc: tr("Pertanyaan dengan gambar, tabel, atau diagram.", "Question with an image, table, or diagram."), icon: "image" },
  ];
}

export const KIND_META = getKindMeta();

export function getFormatLabel(format: Format): string {
  const labels: Record<Format, [string, string]> = {
    multiple_choice: ["Pilihan ganda", "Multiple choice"],
    multiple_select: ["Pilihan ganda kompleks", "Multiple select"],
    true_false: ["Benar / Salah", "True / False"],
    short_answer: ["Jawaban singkat", "Short answer"],
    fill_blank: ["Isian rumpang", "Fill in the blank"],
    numeric: ["Jawaban numerik", "Numeric"],
    matching: ["Menjodohkan", "Matching"],
    ordering: ["Mengurutkan", "Ordering"],
    essay: ["Uraian", "Essay"],
  };
  return tr(labels[format][0], labels[format][1]);
}

export const FORMAT_LABEL: Record<Format, string> = {
  multiple_choice: "Pilihan ganda",
  multiple_select: "Pilihan ganda kompleks",
  true_false: "Benar / Salah",
  short_answer: "Jawaban singkat",
  fill_blank: "Isian rumpang",
  numeric: "Jawaban numerik",
  matching: "Menjodohkan",
  ordering: "Mengurutkan",
  essay: "Uraian",
};

export const kindLabel = (kind: Kind) => getKindMeta().find((item) => item.kind === kind)?.label ?? kind;
export const isBasicKind = (kind: Kind) => ["multiple_choice", "multiple_select", "true_false", "short_answer", "fill_blank", "numeric", "matching", "ordering", "essay"].includes(kind);
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
  } else if (["short_answer", "fill_blank", "numeric"].includes(next.format)) {
    if (next.acceptedAnswers.length === 0) next.acceptedAnswers = [""];
  } else if (next.format === "multiple_select") {
    if (next.options.length < 2) next.options = ["", "", "", ""];
    if (!next.correctIndices?.length) next.correctIndices = [0];
  } else if (next.format === "matching") {
    if (!next.matchPairs?.length) next.matchPairs = [{ left: "", right: "" }, { left: "", right: "" }];
  } else if (next.format === "ordering") {
    if (!next.orderItems?.length) { next.orderItems = ["", "", ""]; next.correctOrder = [0, 1, 2]; }
  }
  return next;
}

export function blankQuestion(kind: Kind = "multiple_choice"): Question {
  const format: Format = isBasicKind(kind) ? (kind as Format) : ["story", "story_image", "image"].includes(kind) ? "multiple_choice" : "short_answer";
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
    explanation: "",
    rubric: "",
    points: 1,
  });
}

export function changeKind(question: Question, kind: Kind): Question {
  let format = question.format;
  if (isBasicKind(kind)) format = kind as Format;
  else if (isBasicKind(question.kind)) format = ["story", "story_image", "image"].includes(kind) ? "multiple_choice" : "short_answer";
  return withFormatDefaults({ ...question, kind, format });
}

export const changeFormat = (question: Question, format: Format): Question => withFormatDefaults({ ...question, format });

export function isComplete(question: Question) {
  if (!question.text.trim()) return false;
  if (hasStory(question.kind) && !question.story.trim()) return false;
  if (hasImage(question.kind) && !question.image) return false;
  if (["multiple_choice", "multiple_select", "true_false"].includes(question.format)) return question.options.every((o) => o.trim());
  if (["short_answer", "fill_blank", "numeric"].includes(question.format)) return question.acceptedAnswers.some((a) => a.trim());
  if (question.format === "matching") return (question.matchPairs ?? []).length >= 2 && (question.matchPairs ?? []).every((pair) => pair.left.trim() && pair.right.trim());
  if (question.format === "ordering") return (question.orderItems ?? []).length >= 2 && (question.orderItems ?? []).every((item) => item.trim());
  return true;
}

const MAX_BYTES = 1_200_000;

/** Perkecil gambar di browser (maks 1280px) dan ubah ke JPEG agar ringan. */
export async function compressImage(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error(tr("Format gambar harus JPG, PNG, WebP, atau GIF.", "Image format must be JPG, PNG, WebP, or GIF."));
  if (file.size > 15 * 1024 * 1024) throw new Error(tr("Ukuran file terlalu besar (maksimal 15 MB).", "File size is too large (maximum 15 MB)."));

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(tr("Gambar tidak bisa dibaca.", "Image could not be read.")));
      el.src = url;
    });
    let scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error(tr("Browser tidak mendukung pemrosesan gambar.", "Browser does not support image processing."));
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", attempt < 2 ? 0.82 : 0.65);
      if ((dataUrl.length * 3) / 4 <= MAX_BYTES) return dataUrl;
      scale *= 0.75;
    }
    throw new Error(tr("Gambar terlalu besar. Gunakan gambar yang lebih kecil.", "Image is too large. Use a smaller image."));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadImage(file: File): Promise<string> {
  const dataUrl = await compressImage(file);
  // Gambar selalu dikonversi ke JPEG; nama asli dari perangkat tidak dikirim ke server.
  const filename = uploadName("image/jpeg", file.name);
  const { url } = await api<{ url: string }>("/images", { body: { dataUrl, filename } });
  return url;
}
