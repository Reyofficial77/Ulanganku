import { HttpError } from "./http.js";

export type Format = "multiple_choice" | "true_false" | "short_answer" | "essay";
export type Kind = Format | "story" | "story_image" | "image";

export type Question = {
  id: string;
  kind: Kind;
  format: Format;
  text: string;
  story: string;
  image: string | null;
  options: string[];
  correctIndex: number;
  acceptedAnswers: string[];
  rubric: string;
  points: number;
};

export type AnswerValue = number | string;
export type Answers = Record<string, AnswerValue>;

export const FORMATS: Format[] = ["multiple_choice", "true_false", "short_answer", "essay"];
export const KINDS: Kind[] = [...FORMATS, "story", "story_image", "image"];
export const TF_OPTIONS = ["Benar", "Salah"];
const IMAGE_URL_RE = /^\/api\/img\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const RESERVED_SLUGS = new Set([
  "api", "login", "logout", "auth", "dashboard", "admin", "app", "assets", "static",
  "public", "register", "signup", "signin", "about", "help", "bantuan", "harga",
  "fitur", "privacy", "terms", "robots.txt", "sitemap.xml", "favicon.ico", "index",
  "ulanganku", "ulangan", "hasil", "settings", "pengaturan", "unlockpro", "404", "undefined", "null",
]);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateSlug(slug: unknown): string {
  if (typeof slug !== "string") throw new HttpError(400, "URL ulangan wajib diisi.");
  const value = slug.trim().toLowerCase();
  if (value.length < 3) throw new HttpError(400, "URL ulangan minimal 3 karakter.");
  if (value.length > 60) throw new HttpError(400, "URL ulangan maksimal 60 karakter.");
  if (!SLUG_RE.test(value)) {
    throw new HttpError(400, "Gunakan huruf kecil, angka, dan tanda hubung (tanpa spasi di awal/akhir).");
  }
  if (RESERVED_SLUGS.has(value)) throw new HttpError(400, "URL ini dicadangkan oleh sistem.");
  return value;
}

/* ------------------------------ Soal ------------------------------ */

const str = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");

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
  return {
    id: String(raw?.id ?? ""),
    kind,
    format,
    text: str(raw?.text, 3000),
    story: str(raw?.story, 6000),
    image: typeof raw?.image === "string" ? raw.image : null,
    options: Array.isArray(raw?.options) ? raw.options.map((o: unknown) => str(o, 500)) : [],
    correctIndex: Number.isInteger(raw?.correctIndex) ? raw.correctIndex : 0,
    acceptedAnswers: Array.isArray(raw?.acceptedAnswers) ? raw.acceptedAnswers.map((a: unknown) => str(a, 200)) : [],
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
    const item = (raw ?? {}) as Record<string, unknown>;
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
      if (typeof item.image !== "string" || !IMAGE_URL_RE.test(item.image)) {
        throw new HttpError(400, `Gambar soal ${n} tidak valid.`);
      }
      image = item.image;
    }

    const points = Number(item.points ?? 1);
    if (!Number.isInteger(points) || points < 1 || points > 100) {
      throw new HttpError(400, `Bobot soal ${n} harus antara 1 dan 100.`);
    }

    let options: string[] = [];
    let correctIndex = 0;
    let acceptedAnswers: string[] = [];

    if (format === "multiple_choice") {
      const list = Array.isArray(item.options) ? item.options : [];
      if (list.length < 2 || list.length > 6) throw new HttpError(400, `Soal ${n} harus memiliki 2–6 pilihan.`);
      options = list.map((o) => str(o, 500));
      correctIndex = Number(item.correctIndex);
      if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
        throw new HttpError(400, `Kunci jawaban soal ${n} tidak valid.`);
      }
    } else if (format === "true_false") {
      options = [...TF_OPTIONS];
      correctIndex = Number(item.correctIndex);
      if (correctIndex !== 0 && correctIndex !== 1) throw new HttpError(400, `Kunci jawaban soal ${n} tidak valid.`);
    } else if (format === "short_answer") {
      const list = Array.isArray(item.acceptedAnswers) ? item.acceptedAnswers : [];
      if (list.length < 1 || list.length > 10) throw new HttpError(400, `Soal ${n} harus memiliki 1–10 jawaban benar.`);
      acceptedAnswers = list.map((a) => str(a, 200));
    }

    return {
      id,
      kind,
      format,
      text: str(item.text, 3000),
      story: hasStory ? str(item.story, 6000) : "",
      image,
      options,
      correctIndex,
      acceptedAnswers,
      rubric: format === "essay" ? str(item.rubric, 2000) : "",
      points,
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
    if ((q.format === "multiple_choice" || q.format === "true_false") && q.options.some((o) => !o.trim())) {
      return `Ada pilihan jawaban kosong pada soal ${n}.`;
    }
    if (q.format === "short_answer" && !q.acceptedAnswers.some((a) => a.trim())) {
      return `Soal ${n} belum memiliki jawaban benar.`;
    }
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
    } else if (typeof value === "string") {
      const text = value.slice(0, q.format === "essay" ? 5000 : 300).trim();
      if (text) out[q.id] = text;
    }
  }
  return out;
}

export function normalizeText(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s.,;:!?"'`()]+|[\s.,;:!?"'`()]+$/g, "");
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

export type QuestionResult = {
  earned: number;
  max: number;
  status: "correct" | "partial" | "wrong" | "blank" | "pending";
};

export function gradeSubmission(questions: Question[], answers: Answers, grades: Record<string, number> = {}) {
  let earned = 0;
  let max = 0;
  let correct = 0;
  let pending = 0;
  const detail: Record<string, QuestionResult> = {};

  for (const q of questions) {
    max += q.points;
    const answer = answers[q.id];
    let e = 0;
    let status: QuestionResult["status"] = "wrong";

    if (answer === undefined) {
      status = "blank";
    } else if (q.format === "multiple_choice" || q.format === "true_false") {
      e = answer === q.correctIndex ? q.points : 0;
    } else if (q.format === "short_answer") {
      e = typeof answer === "string" && shortMatches(answer, q.acceptedAnswers) ? q.points : 0;
    } else {
      const manual = grades[q.id];
      if (manual === undefined) {
        status = "pending";
        pending += 1;
      } else {
        e = Math.min(q.points, Math.max(0, manual));
      }
    }

    if (status !== "blank" && status !== "pending") {
      status = e === q.points ? "correct" : e > 0 ? "partial" : "wrong";
    }
    if (e === q.points) correct += 1;
    earned += e;
    detail[q.id] = { earned: e, max: q.points, status };
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
