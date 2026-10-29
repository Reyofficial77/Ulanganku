import { HttpError } from "./http.js";

export type Format = "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "fill_blank" | "essay" | "matching" | "ordering" | "numeric";
export type Kind = Format | "story" | "story_image" | "image";
export type MatchPair = { left: string; right: string };

export type Question = {
  id: string;
  kind: Kind;
  format: Format;
  text: string;
  story: string;
  image: string | null;
  options: string[];
  correctIndex: number;
  correctIndices?: number[];
  acceptedAnswers: string[];
  explanation: string;
  matchPairs?: MatchPair[];
  orderItems?: string[];
  /** List of indexes in the intended correct order. */
  correctOrder?: number[];
  rubric: string;
  points: number;
};

export type AnswerValue = number | string | number[];
export type Answers = Record<string, AnswerValue>;

export const FORMATS: Format[] = ["multiple_choice", "multiple_select", "true_false", "short_answer", "fill_blank", "essay", "matching", "ordering", "numeric"];
export const KINDS: Kind[] = [...FORMATS, "story", "story_image", "image"];
export const TF_OPTIONS = ["Benar", "Salah"];
const IMAGE_URL_RE = /^\/api\/img\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const RESERVED_SLUGS = new Set([
  "api", "login", "logout", "auth", "dashboard", "admin", "app", "assets", "static",
  "public", "register", "signup", "signin", "about", "help", "bantuan", "harga",
  "fitur", "privacy", "terms", "robots.txt", "sitemap.xml", "favicon.ico", "index",
  "ulanganku", "ulangan", "hasil", "settings", "pengaturan", "unlockpro", "template", "404", "undefined", "null",
]);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateSlug(slug: unknown): string {
  if (typeof slug !== "string") throw new HttpError(400, "URL ulangan wajib diisi.");
  const value = slug.trim().toLowerCase();
  if (value.length < 3) throw new HttpError(400, "URL ulangan minimal 3 karakter.");
  if (value.length > 60) throw new HttpError(400, "URL ulangan maksimal 60 karakter.");
  if (!SLUG_RE.test(value)) throw new HttpError(400, "Gunakan huruf kecil, angka, dan tanda hubung (tanpa spasi di awal/akhir).");
  if (RESERVED_SLUGS.has(value)) throw new HttpError(400, "URL ini dicadangkan oleh sistem.");
  return value;
}

/* ------------------------------ Soal ------------------------------ */

const str = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");
const ints = (value: unknown, max: number) => Array.isArray(value) ? value.map(Number).filter((n) => Number.isInteger(n)).slice(0, max) : [];

/** Lengkapi field soal (mendukung data lama yang belum punya field baru). */
export function hydrateQuestion(raw: any): Question {
  const kind: Kind = KINDS.includes(raw?.kind) ? raw.kind : "multiple_choice";
  const format: Format = FORMATS.includes(kind as Format)
    ? (kind as Format)
    : FORMATS.includes(raw?.format)
      ? raw.format
      : kind === "image"
        ? "multiple_choice"
        : "short_answer";
  const matchPairs = Array.isArray(raw?.matchPairs)
    ? raw.matchPairs.slice(0, 10).map((pair: any) => ({ left: str(pair?.left, 300), right: str(pair?.right, 300) }))
    : [];
  return {
    id: String(raw?.id ?? ""), kind, format,
    text: str(raw?.text, 3000), story: str(raw?.story, 6000),
    image: typeof raw?.image === "string" ? raw.image : null,
    options: Array.isArray(raw?.options) ? raw.options.map((o: unknown) => str(o, 500)) : [],
    correctIndex: Number.isInteger(raw?.correctIndex) ? raw.correctIndex : 0,
    correctIndices: ints(raw?.correctIndices, 10),
    acceptedAnswers: Array.isArray(raw?.acceptedAnswers) ? raw.acceptedAnswers.map((a: unknown) => str(a, 200)) : [],
    explanation: str(raw?.explanation, 2000),
    matchPairs,
    orderItems: Array.isArray(raw?.orderItems) ? raw.orderItems.slice(0, 10).map((item: unknown) => str(item, 300)) : [],
    correctOrder: ints(raw?.correctOrder, 10),
    rubric: str(raw?.rubric, 2000),
    points: Number.isInteger(raw?.points) && raw.points >= 1 ? raw.points : 1,
  };
}

export const hydrateQuestions = (input: unknown): Question[] => (Array.isArray(input) ? input.map(hydrateQuestion) : []);

export function sanitizeQuestions(input: unknown): Question[] {
  if (!Array.isArray(input)) throw new HttpError(400, "Format soal tidak valid.");
  if (input.length > 200) throw new HttpError(400, "Maksimal 200 soal per ulangan.");
  const seen = new Set<string>();
  return input.map((raw, index) => {
    const n = index + 1;
    const item = (raw ?? {}) as Record<string, any>;
    const id = typeof item.id === "string" && item.id.length > 0 && item.id.length <= 40 ? item.id : "";
    if (!id || seen.has(id)) throw new HttpError(400, `ID soal ${n} tidak valid.`);
    seen.add(id);
    if (!KINDS.includes(item.kind as Kind)) throw new HttpError(400, `Tipe soal ${n} tidak valid.`);
    const kind = item.kind as Kind;
    let format: Format;
    if (FORMATS.includes(kind as Format)) format = kind as Format;
    else if (FORMATS.includes(item.format as Format)) format = item.format as Format;
    else throw new HttpError(400, `Bentuk jawaban soal ${n} tidak valid.`);

    const hasStory = kind === "story" || kind === "story_image";
    const hasImage = kind === "story_image" || kind === "image";
    let image: string | null = null;
    if (hasImage && item.image) {
      if (typeof item.image !== "string" || !IMAGE_URL_RE.test(item.image)) throw new HttpError(400, `Gambar soal ${n} tidak valid.`);
      image = item.image;
    }
    const points = Number(item.points ?? 1);
    if (!Number.isInteger(points) || points < 1 || points > 100) throw new HttpError(400, `Bobot soal ${n} harus antara 1 dan 100.`);

    let options: string[] = [];
    let correctIndex = 0;
    let correctIndices: number[] = [];
    let acceptedAnswers: string[] = [];
    let matchPairs: MatchPair[] = [];
    let orderItems: string[] = [];
    let correctOrder: number[] = [];

    if (format === "multiple_choice" || format === "multiple_select") {
      const list = Array.isArray(item.options) ? item.options : [];
      if (list.length < 2 || list.length > 8) throw new HttpError(400, `Soal ${n} harus memiliki 2–8 pilihan.`);
      options = list.map((o: unknown) => str(o, 500));
      if (format === "multiple_choice") {
        correctIndex = Number(item.correctIndex);
        if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) throw new HttpError(400, `Kunci jawaban soal ${n} tidak valid.`);
      } else {
        correctIndices = [...new Set(ints(item.correctIndices, 8))].filter((value) => value >= 0 && value < options.length);
        if (!correctIndices.length) throw new HttpError(400, `Soal ${n} harus memiliki setidaknya satu pilihan benar.`);
      }
    } else if (format === "true_false") {
      options = [...TF_OPTIONS];
      correctIndex = Number(item.correctIndex);
      if (correctIndex !== 0 && correctIndex !== 1) throw new HttpError(400, `Kunci jawaban soal ${n} tidak valid.`);
    } else if (["short_answer", "fill_blank", "numeric"].includes(format)) {
      const list = Array.isArray(item.acceptedAnswers) ? item.acceptedAnswers : [];
      if (list.length < 1 || list.length > 10) throw new HttpError(400, `Soal ${n} harus memiliki 1–10 jawaban benar.`);
      acceptedAnswers = list.map((a: unknown) => str(a, 200)).filter(Boolean);
      if (!acceptedAnswers.length) acceptedAnswers = [""];
    } else if (format === "matching") {
      if (!Array.isArray(item.matchPairs) || item.matchPairs.length < 2 || item.matchPairs.length > 10) throw new HttpError(400, `Soal ${n} harus memiliki 2–10 pasangan.`);
      matchPairs = item.matchPairs.map((pair: any) => ({ left: str(pair?.left, 300), right: str(pair?.right, 300) }));
      if (matchPairs.some((pair) => !pair.left.trim() || !pair.right.trim())) throw new HttpError(400, `Pasangan soal ${n} tidak boleh kosong.`);
    } else if (format === "ordering") {
      if (!Array.isArray(item.orderItems) || item.orderItems.length < 2 || item.orderItems.length > 10) throw new HttpError(400, `Soal ${n} harus memiliki 2–10 item urutan.`);
      orderItems = item.orderItems.map((value: unknown) => str(value, 300));
      if (orderItems.some((value) => !value.trim())) throw new HttpError(400, `Item urutan soal ${n} tidak boleh kosong.`);
      correctOrder = ints(item.correctOrder, 10);
      if (correctOrder.length !== orderItems.length || new Set(correctOrder).size !== orderItems.length || correctOrder.some((value) => value < 0 || value >= orderItems.length)) {
        throw new HttpError(400, `Kunci urutan soal ${n} tidak valid.`);
      }
    }

    return {
      id, kind, format, text: str(item.text, 3000), story: hasStory ? str(item.story, 6000) : "", image,
      options, correctIndex, correctIndices, acceptedAnswers, explanation: str(item.explanation, 2000), matchPairs, orderItems, correctOrder,
      rubric: format === "essay" ? str(item.rubric, 2000) : "", points,
    };
  });
}

/** Pesan error pertama jika ulangan belum layak dipublish; null jika layak. */
export function publishProblem(questions: Question[]): string | null {
  if (questions.length === 0) return "Tambahkan minimal 1 soal sebelum publish.";
  for (let i = 0; i < questions.length; i += 1) {
    const q = questions[i];
    const n = i + 1;
    if (!q.text.trim()) return `Pertanyaan soal ${n} masih kosong.`;
    if ((q.kind === "story" || q.kind === "story_image") && !q.story.trim()) return `Teks cerita soal ${n} masih kosong.`;
    if ((q.kind === "story_image" || q.kind === "image") && !q.image) return `Soal ${n} belum memiliki gambar.`;
    if (["multiple_choice", "multiple_select", "true_false"].includes(q.format) && q.options.some((o) => !o.trim())) return `Ada pilihan jawaban kosong pada soal ${n}.`;
    if (["short_answer", "fill_blank", "numeric"].includes(q.format) && !q.acceptedAnswers.some((a) => a.trim())) return `Soal ${n} belum memiliki jawaban benar.`;
    if (q.format === "matching" && (q.matchPairs ?? []).some((pair) => !pair.left.trim() || !pair.right.trim())) return `Pasangan soal ${n} belum lengkap.`;
    if (q.format === "ordering" && (q.orderItems ?? []).some((item) => !item.trim())) return `Item urutan soal ${n} belum lengkap.`;
  }
  return null;
}

/* ----------------------------- Jawaban ---------------------------- */

export function sanitizeAnswers(input: unknown, questions: Question[]): Answers {
  const out: Answers = {};
  if (!input || typeof input !== "object") return out;
  const source = input as Record<string, unknown>;
  for (const q of questions) {
    const value = source[q.id];
    if (q.format === "multiple_choice" || q.format === "true_false") {
      if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value < q.options.length) out[q.id] = value;
    } else if (q.format === "multiple_select") {
      if (Array.isArray(value)) {
        const selected = [...new Set(value.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < q.options.length))];
        if (selected.length) out[q.id] = selected;
      }
    } else if (q.format === "ordering") {
      const size = q.orderItems?.length ?? 0;
      if (Array.isArray(value) && value.length === size) {
        const ranks = value.map(Number);
        if (ranks.every((n) => Number.isInteger(n) && n >= -1 && n < size) && ranks.some((n) => n >= 0)) out[q.id] = ranks;
      }
    } else if (typeof value === "string") {
      const maxLength = q.format === "essay" ? 5000 : q.format === "matching" || q.format === "ordering" ? 3000 : 300;
      const text = value.slice(0, maxLength).trim();
      if (text) out[q.id] = text;
    }
  }
  return out;
}

export function normalizeText(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim().replace(/^[\s.,;:!?"'`()]+|[\s.,;:!?"'`()]+$/g, "");
}

const asNumber = (value: string) => {
  const s = value.replace(/\s/g, "").replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
};

export function shortMatches(answer: string, accepted: string[]) {
  const a = normalizeText(answer);
  if (!a) return false;
  const an = asNumber(a);
  return accepted.some((item) => {
    const n = normalizeText(item);
    if (!n) return false;
    if (n === a) return true;
    const xn = asNumber(n);
    return an !== null && xn !== null && Math.abs(an - xn) < 1e-9;
  });
}

export type QuestionResult = { earned: number; max: number; status: "correct" | "partial" | "wrong" | "blank" | "pending" };

function compareArrays(a: number[], b: number[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function correctObjectiveAnswer(question: Question, answer: AnswerValue): boolean {
  if (question.format === "multiple_choice" || question.format === "true_false") return answer === question.correctIndex;
  if (question.format === "multiple_select") {
    if (!Array.isArray(answer)) return false;
    return compareArrays([...answer].sort((a, b) => a - b), [...(question.correctIndices ?? [])].sort((a, b) => a - b));
  }
  if (["short_answer", "fill_blank", "numeric"].includes(question.format)) return typeof answer === "string" && shortMatches(answer, question.acceptedAnswers);
  if (question.format === "matching") {
    if (typeof answer !== "string") return false;
    try {
      const selected = JSON.parse(answer) as Record<string, string>;
      return (question.matchPairs ?? []).every((pair) => normalizeText(selected[pair.left] ?? "") === normalizeText(pair.right));
    } catch { return false; }
  }
  if (question.format === "ordering") {
    if (!Array.isArray(answer)) return false;
    const items = question.orderItems ?? [];
    const expectedRanks = new Array(items.length).fill(-1);
    (question.correctOrder ?? []).forEach((itemIndex, rank) => { expectedRanks[itemIndex] = rank; });
    return answer.length === expectedRanks.length && answer.every((rank, index) => rank === expectedRanks[index]) && answer.every((rank) => rank >= 0);
  }
  return false;
}

export function gradeSubmission(questions: Question[], answers: Answers, grades: Record<string, number> = {}) {
  let earned = 0;
  let max = 0;
  let correct = 0;
  let pending = 0;
  const detail: Record<string, QuestionResult> = {};
  const objectiveFormats = new Set<Format>(["multiple_choice", "multiple_select", "true_false", "short_answer", "fill_blank", "numeric", "matching", "ordering"]);
  for (const question of questions) {
    max += question.points;
    const answer = answers[question.id];
    let e = 0;
    let status: QuestionResult["status"] = "wrong";
    if (answer === undefined) status = "blank";
    else if (objectiveFormats.has(question.format)) e = correctObjectiveAnswer(question, answer) ? question.points : 0;
    else {
      const manual = grades[question.id];
      if (manual === undefined) { status = "pending"; pending += 1; }
      else e = Math.min(question.points, Math.max(0, manual));
    }
    if (status !== "blank" && status !== "pending") status = e === question.points ? "correct" : e > 0 ? "partial" : "wrong";
    if (e === question.points) correct += 1;
    earned += e;
    detail[question.id] = { earned: e, max: question.points, status };
  }
  const score = max === 0 ? 0 : Math.round((earned / max) * 1000) / 10;
  return { earned, max, score, correct, total: questions.length, pending, detail };
}

/* ------------------------------ Mapper ----------------------------- */

export const num = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

export function toExam(row: Record<string, any>) {
  return {
    id: row.id as string,
    title: row.title as string,
    className: row.class_name as string,
    durationMin: Number(row.duration_min),
    instructions: String(row.instructions ?? ""),
    shuffle: Boolean(row.shuffle),
    showScore: Boolean(row.show_score),
    allowRetake: Boolean(row.allow_retake),
    maxAttempts: Number(row.max_attempts ?? 0),
    status: row.status as "draft" | "published" | "closed",
    slug: (row.slug as string | null) ?? null,
    bannerUrl: (row.banner_url as string | null) ?? null,
    questions: hydrateQuestions(row.questions),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at ?? null,
  };
}

export function toSummary(row: Record<string, any>) {
  return {
    id: row.id as string,
    title: row.title as string,
    className: row.class_name as string,
    durationMin: Number(row.duration_min),
    status: row.status as "draft" | "published" | "closed",
    slug: (row.slug as string | null) ?? null,
    questionCount: Number(row.question_count ?? 0),
    participants: Number(row.participants ?? 0),
    submitted: Number(row.submitted ?? 0),
    pendingReview: Number(row.pending_review ?? 0),
    avgScore: num(row.avg_score),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at ?? null,
  };
}

/** Peserta dihitung per perangkat; nilai rata-rata memakai nilai tertinggi tiap perangkat. */
export const SUMMARY_SQL = `
  SELECT e.id, e.title, e.class_name, e.duration_min, e.status, e.slug,
         e.created_at, e.updated_at, e.published_at,
         jsonb_array_length(e.questions)::int AS question_count,
         (SELECT count(DISTINCT s.device_id) FROM submissions s WHERE s.exam_id = e.id)::int AS participants,
         (SELECT count(DISTINCT s.device_id) FROM submissions s WHERE s.exam_id = e.id AND s.status = 'done')::int AS submitted,
         (SELECT count(*) FROM submissions s WHERE s.exam_id = e.id AND s.status = 'done' AND s.pending > 0)::int AS pending_review,
         (SELECT round(avg(b.best)::numeric, 1) FROM (
            SELECT max(s.score) AS best FROM submissions s
            WHERE s.exam_id = e.id AND s.status = 'done' GROUP BY s.device_id
         ) b) AS avg_score
  FROM exams e
`;
