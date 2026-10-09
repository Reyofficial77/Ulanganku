import { HttpError } from "./http.js";

export type QuestionType = "multiple_choice" | "short_answer" | "essay" | "true_false" | "story" | "story_image" | "image";

export type Question = {
  id: string;
  type: QuestionType;
  text: string;
  options: string[];
  correctIndex: number | null;
  correctAnswer: string | null;
  imageUrl: string | null;
  required: boolean;
};

export const RESERVED_SLUGS = new Set([
  "api", "login", "logout", "auth", "dashboard", "admin", "app", "assets", "static",
  "public", "register", "signup", "signin", "about", "help", "bantuan", "harga",
  "fitur", "privacy", "terms", "robots.txt", "sitemap.xml", "favicon.ico", "index",
  "ulanganku", "ulangan", "hasil", "settings", "pengaturan", "404", "undefined", "null",
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

export function sanitizeQuestions(input: unknown): Question[] {
  if (!Array.isArray(input)) throw new HttpError(400, "Format soal tidak valid.");
  if (input.length > 200) throw new HttpError(400, "Maksimal 200 soal per ulangan.");
  const seen = new Set<string>();
  const types = new Set<QuestionType>(["multiple_choice", "short_answer", "essay", "true_false", "story", "story_image", "image"]);
  return input.map((raw, index) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    const id = typeof item.id === "string" && item.id.length > 0 && item.id.length <= 40 ? item.id : "";
    if (!id || seen.has(id)) throw new HttpError(400, `ID soal ${index + 1} tidak valid.`);
    seen.add(id);
    const type = types.has(item.type as QuestionType) ? (item.type as QuestionType) : "multiple_choice";
    const text = typeof item.text === "string" ? item.text.slice(0, 5000) : "";
    const options = Array.isArray(item.options) ? item.options : [];
    const cleanOptions = options.map((option) => (typeof option === "string" ? option.slice(0, 500) : ""));
    const needsOptions = type === "multiple_choice" || type === "story" || type === "story_image" || type === "image";
    if (needsOptions && (cleanOptions.length < 2 || cleanOptions.length > 8)) {
      throw new HttpError(400, `Soal ${index + 1} harus memiliki 2–8 pilihan.`);
    }
    const correctRaw = item.correctIndex;
    const correctIndex = correctRaw === null || correctRaw === undefined || correctRaw === "" ? null : Number(correctRaw);
    if (needsOptions && (!Number.isInteger(correctIndex) || (correctIndex as number) < 0 || (correctIndex as number) >= cleanOptions.length)) {
      throw new HttpError(400, `Kunci jawaban soal ${index + 1} tidak valid.`);
    }
    const correctAnswer = typeof item.correctAnswer === "string" ? item.correctAnswer.slice(0, 1000) : null;
    const imageUrl = typeof item.imageUrl === "string" ? item.imageUrl.trim().slice(0, 2000) : null;
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) throw new HttpError(400, `URL gambar soal ${index + 1} tidak valid.`);
    return {
      id, type, text, options: needsOptions ? cleanOptions : [],
      correctIndex: needsOptions ? correctIndex : null,
      correctAnswer: type === "short_answer" || type === "true_false" ? correctAnswer : null,
      imageUrl: imageUrl || null,
      required: item.required !== false,
    };
  });
}

/** Pesan error pertama jika ulangan belum layak dipublish; null jika layak. */
export function publishProblem(questions: Question[]): string | null {
  if (questions.length === 0) return "Tambahkan minimal 1 soal sebelum publish.";
  for (let i = 0; i < questions.length; i += 1) {
    const question = questions[i];
    if (!question.text.trim()) return `Pertanyaan soal ${i + 1} masih kosong.`;
    if (question.type === "multiple_choice" || question.type === "story" || question.type === "story_image" || question.type === "image") {
      if (question.options.length < 2 || question.options.some((option) => !option.trim()) || question.correctIndex === null) {
        return `Pilihan atau kunci jawaban soal ${i + 1} belum lengkap.`;
      }
    }
    if ((question.type === "short_answer" || question.type === "true_false") && !question.correctAnswer?.trim()) {
      return `Kunci jawaban soal ${i + 1} masih kosong.`;
    }
    if ((question.type === "image" || question.type === "story_image") && !question.imageUrl?.trim()) {
      return `Gambar soal ${i + 1} belum diisi.`;
    }
  }
  return null;
}

export type AnswerValue = string | number | boolean;

export function sanitizeAnswers(input: unknown, questions: Question[]): Record<string, AnswerValue> {
  const out: Record<string, AnswerValue> = {};
  if (!input || typeof input !== "object") return out;
  const source = input as Record<string, unknown>;
  for (const question of questions) {
    const value = source[question.id];
    if (value === undefined || value === null) continue;
    if (question.type === "multiple_choice" || question.type === "story" || question.type === "story_image" || question.type === "image") {
      const index = typeof value === "number" ? value : Number(value);
      if (Number.isInteger(index) && index >= 0 && index < question.options.length) out[question.id] = index;
    } else if (typeof value === "string" && value.length <= 5000) {
      out[question.id] = value.slice(0, 5000);
    }
  }
  return out;
}

const OPTION_TYPES = new Set<QuestionType>(["multiple_choice", "story", "story_image", "image"]);

/** Soal yang dinilai lewat pilihan (indeks opsi). */
export const hasOptions = (type: QuestionType) => OPTION_TYPES.has(type);

/** Apakah jawaban murid benar untuk soal ini? Esai tidak pernah dinilai otomatis. */
export function isCorrect(question: Question, answer: AnswerValue | undefined): boolean {
  if (question.type === "essay") return false;
  if (answer === undefined || answer === null || answer === "") return false;
  if (hasOptions(question.type)) {
    return question.correctIndex !== null && Number(answer) === question.correctIndex;
  }
  const expected = (question.correctAnswer ?? "").trim().toLocaleLowerCase();
  return expected !== "" && String(answer).trim().toLocaleLowerCase() === expected;
}

export function grade(questions: Question[], answers: Record<string, AnswerValue>) {
  let gradable = 0;
  let correct = 0;
  for (const question of questions) {
    if (question.type === "essay") continue;
    gradable += 1;
    if (isCorrect(question, answers[question.id])) correct += 1;
  }
  const score = gradable === 0 ? null : Math.round((correct / gradable) * 1000) / 10;
  return { total: questions.length, gradable, correct, score };
}

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
    allowRetakes: Boolean(row.allow_retakes),
    status: row.status as "draft" | "published" | "closed",
    slug: (row.slug as string | null) ?? null,
    questions: ((row.questions ?? []) as any[]).map((question) => ({
      id: String(question.id),
      type: question.type ?? "multiple_choice",
      text: typeof question.text === "string" ? question.text : "",
      options: Array.isArray(question.options) ? question.options : [],
      correctIndex: question.correctIndex === null || question.correctIndex === undefined ? null : Number(question.correctIndex),
      correctAnswer: typeof question.correctAnswer === "string" ? question.correctAnswer : null,
      imageUrl: typeof question.imageUrl === "string" ? question.imageUrl : null,
      required: question.required !== false,
    })) as Question[],
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
    avgScore: num(row.avg_score),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at ?? null,
  };
}

export const SUMMARY_SQL = `
  SELECT e.id, e.title, e.class_name, e.duration_min, e.status, e.slug,
         e.created_at, e.updated_at, e.published_at,
         jsonb_array_length(e.questions)::int AS question_count,
         count(s.id)::int AS participants,
         (count(s.id) FILTER (WHERE s.status = 'done'))::int AS submitted,
         round(avg(s.score) FILTER (WHERE s.status = 'done')::numeric, 1) AS avg_score
  FROM exams e
  LEFT JOIN submissions s ON s.exam_id = e.id
`;
