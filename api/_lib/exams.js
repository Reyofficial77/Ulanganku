import { HttpError } from "./http.js";
export const FORMATS = ["multiple_choice", "true_false", "short_answer", "essay"];
export const KINDS = [...FORMATS, "story", "story_image", "image"];
export const TF_OPTIONS = ["Benar", "Salah"];
const IMAGE_URL_RE = /^\/api\/img\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const RESERVED_SLUGS = new Set([
    "api", "login", "logout", "auth", "dashboard", "admin", "app", "assets", "static",
    "public", "register", "signup", "signin", "about", "help", "bantuan", "harga",
    "fitur", "privacy", "terms", "robots.txt", "sitemap.xml", "favicon.ico", "index",
    "ulanganku", "ulangan", "hasil", "settings", "pengaturan", "unlockpro", "404", "undefined", "null",
]);
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function validateSlug(slug) {
    if (typeof slug !== "string")
        throw new HttpError(400, "URL ulangan wajib diisi.");
    const value = slug.trim().toLowerCase();
    if (value.length < 3)
        throw new HttpError(400, "URL ulangan minimal 3 karakter.");
    if (value.length > 60)
        throw new HttpError(400, "URL ulangan maksimal 60 karakter.");
    if (!SLUG_RE.test(value)) {
        throw new HttpError(400, "Gunakan huruf kecil, angka, dan tanda hubung (tanpa spasi di awal/akhir).");
    }
    if (RESERVED_SLUGS.has(value))
        throw new HttpError(400, "URL ini dicadangkan oleh sistem.");
    return value;
}
/* ------------------------------ Soal ------------------------------ */
const str = (value, max) => (typeof value === "string" ? value.slice(0, max) : "");
/** Lengkapi field soal (mendukung data lama yang belum punya field baru). */
export function hydrateQuestion(raw) {
    const kind = KINDS.includes(raw?.kind) ? raw.kind : "multiple_choice";
    const format = FORMATS.includes(kind)
        ? kind
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
        options: Array.isArray(raw?.options) ? raw.options.map((o) => str(o, 500)) : [],
        correctIndex: Number.isInteger(raw?.correctIndex) ? raw.correctIndex : 0,
        acceptedAnswers: Array.isArray(raw?.acceptedAnswers) ? raw.acceptedAnswers.map((a) => str(a, 200)) : [],
        rubric: str(raw?.rubric, 2000),
        points: Number.isInteger(raw?.points) && raw.points >= 1 ? raw.points : 1,
    };
}
export const hydrateQuestions = (input) => (Array.isArray(input) ? input.map(hydrateQuestion) : []);
export function sanitizeQuestions(input) {
    if (!Array.isArray(input))
        throw new HttpError(400, "Format soal tidak valid.");
    if (input.length > 500)
        throw new HttpError(400, "Maksimal 500 soal per ulangan.");
    const seen = new Set();
    return input.map((raw, index) => {
        const n = index + 1;
        const item = (raw ?? {});
        const id = typeof item.id === "string" && item.id.length > 0 && item.id.length <= 40 ? item.id : "";
        if (!id || seen.has(id))
            throw new HttpError(400, `ID soal ${n} tidak valid.`);
        seen.add(id);
        if (!KINDS.includes(item.kind))
            throw new HttpError(400, `Tipe soal ${n} tidak valid.`);
        const kind = item.kind;
        let format;
        if (FORMATS.includes(kind))
            format = kind;
        else if (FORMATS.includes(item.format))
            format = item.format;
        else
            throw new HttpError(400, `Bentuk jawaban soal ${n} tidak valid.`);
        const hasStory = kind === "story" || kind === "story_image";
        const hasImage = kind === "story_image" || kind === "image";
        let image = null;
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
        let options = [];
        let correctIndex = 0;
        let acceptedAnswers = [];
        if (format === "multiple_choice") {
            const list = Array.isArray(item.options) ? item.options : [];
            if (list.length < 2 || list.length > 6)
                throw new HttpError(400, `Soal ${n} harus memiliki 2–6 pilihan.`);
            options = list.map((o) => str(o, 500));
            correctIndex = Number(item.correctIndex);
            if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
                throw new HttpError(400, `Kunci jawaban soal ${n} tidak valid.`);
            }
        }
        else if (format === "true_false") {
            options = [...TF_OPTIONS];
            correctIndex = Number(item.correctIndex);
            if (correctIndex !== 0 && correctIndex !== 1)
                throw new HttpError(400, `Kunci jawaban soal ${n} tidak valid.`);
        }
        else if (format === "short_answer") {
            const list = Array.isArray(item.acceptedAnswers) ? item.acceptedAnswers : [];
            if (list.length < 1 || list.length > 10)
                throw new HttpError(400, `Soal ${n} harus memiliki 1–10 jawaban benar.`);
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
export function publishProblem(questions) {
    if (questions.length === 0)
        return "Tambahkan minimal 1 soal sebelum publish.";
    for (let i = 0; i < questions.length; i += 1) {
        const q = questions[i];
        const n = i + 1;
        if (!q.text.trim())
            return `Pertanyaan soal ${n} masih kosong.`;
        if ((q.kind === "story" || q.kind === "story_image") && !q.story.trim())
            return `Teks cerita soal ${n} masih kosong.`;
        if ((q.kind === "story_image" || q.kind === "image") && !q.image)
            return `Soal ${n} belum memiliki gambar.`;
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
export function sanitizeAnswers(input, questions) {
    const out = {};
    if (!input || typeof input !== "object")
        return out;
    const source = input;
    for (const q of questions) {
        const value = source[q.id];
        if (q.format === "multiple_choice" || q.format === "true_false") {
            if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value < q.options.length)
                out[q.id] = value;
        }
        else if (typeof value === "string") {
            const text = value.slice(0, q.format === "essay" ? 5000 : 300).trim();
            if (text)
                out[q.id] = text;
        }
    }
    return out;
}
export function normalizeText(value) {
    return value
        .normalize("NFKC")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^[\s.,;:!?"'`()]+|[\s.,;:!?"'`()]+$/g, "");
}
const asNumber = (value) => {
    const s = value.replace(/\s/g, "").replace(",", ".");
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
};
export function shortMatches(answer, accepted) {
    const a = normalizeText(answer);
    if (!a)
        return false;
    const an = asNumber(a);
    return accepted.some((item) => {
        const n = normalizeText(item);
        if (!n)
            return false;
        if (n === a)
            return true;
        const xn = asNumber(n);
        return an !== null && xn !== null && Math.abs(an - xn) < 1e-9;
    });
}
export function gradeSubmission(questions, answers, grades = {}) {
    let earned = 0;
    let max = 0;
    let correct = 0;
    let pending = 0;
    const detail = {};
    for (const q of questions) {
        max += q.points;
        const answer = answers[q.id];
        let e = 0;
        let status = "wrong";
        if (answer === undefined) {
            status = "blank";
        }
        else if (q.format === "multiple_choice" || q.format === "true_false") {
            e = answer === q.correctIndex ? q.points : 0;
        }
        else if (q.format === "short_answer") {
            e = typeof answer === "string" && shortMatches(answer, q.acceptedAnswers) ? q.points : 0;
        }
        else {
            const manual = grades[q.id];
            if (manual === undefined) {
                status = "pending";
                pending += 1;
            }
            else {
                e = Math.min(q.points, Math.max(0, manual));
            }
        }
        if (status !== "blank" && status !== "pending") {
            status = e === q.points ? "correct" : e > 0 ? "partial" : "wrong";
        }
        if (e === q.points)
            correct += 1;
        earned += e;
        detail[q.id] = { earned: e, max: q.points, status };
    }
    const score = max === 0 ? 0 : Math.round((earned / max) * 1000) / 10;
    return { earned, max, score, correct, total: questions.length, pending, detail };
}
/* ------------------------------ Mapper ----------------------------- */
export const num = (value) => value === null || value === undefined ? null : Number(value);
export function toExam(row) {
    return {
        id: row.id,
        title: row.title,
        className: row.class_name,
        durationMin: Number(row.duration_min),
        shuffle: Boolean(row.shuffle),
        showScore: Boolean(row.show_score),
        allowRetake: Boolean(row.allow_retake),
        maxAttempts: Number(row.max_attempts ?? 0),
        status: row.status,
        slug: row.slug ?? null,
        bannerUrl: row.banner_url ?? null,
        questions: hydrateQuestions(row.questions),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        publishedAt: row.published_at ?? null,
    };
}
export function hydrateTemplate(raw) { const visibility = (raw.visibility === "public" || raw.visibility === "private") ? raw.visibility : "private"; const status = (raw.status === "draft" || raw.status === "published") ? raw.status : "draft"; return { id: String(raw?.id ?? ""), owner_id: String(raw?.owner_id ?? ""), title: String(raw?.title ?? "").trim(), slug: String(raw?.slug ?? "").trim(), description: typeof raw?.description === "string" ? raw.description : null, subject: typeof raw?.subject === "string" ? raw.subject : null, grade: typeof raw?.grade === "string" ? raw.grade : null, category: typeof raw?.category === "string" ? raw.category : null, default_question_types: Array.isArray(raw?.default_question_types) ? raw.default_question_types.map(String) : [], default_question_count: Number.isInteger(raw?.default_question_count) && raw.default_question_count > 0 ? raw.default_question_count : 10, default_duration: Number.isInteger(raw?.default_duration) && raw.default_duration > 0 ? raw.default_duration : 45, difficulty: typeof raw?.difficulty === "string" ? raw.difficulty : "sedang", visibility, status, created_at: raw?.created_at ? new Date(raw.created_at) : new Date(), updated_at: raw?.updated_at ? new Date(raw.updated_at) : new Date(), }; } /** Convert a Template row to a plain object for API responses. */
export function toTemplate(row) { return hydrateTemplate(row); }
export function toSummary(row) {
    return {
        id: row.id,
        title: row.title,
        className: row.class_name,
        durationMin: Number(row.duration_min),
        status: row.status,
        slug: row.slug ?? null,
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
