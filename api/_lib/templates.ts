import { randomBytes } from "node:crypto";
import { q } from "./db.js";
import { HttpError } from "./http.js";
import { sanitizeQuestions, type Format, type Question } from "./exams.js";
import { getBuiltinTemplateQuestions } from "./template-question-seeds.js";

const TEMPLATE_FORMATS = new Set<Format>([
  "multiple_choice", "multiple_select", "true_false", "short_answer", "fill_blank", "essay", "matching", "ordering", "numeric",
]);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const cleanText = (value: unknown, max: number) => typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
const slugify = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);

function validateSlug(raw: unknown, fallbackName: string) {
  const slug = typeof raw === "string" && raw.trim() ? slugify(raw) : slugify(fallbackName);
  if (slug.length < 3 || slug.length > 64 || !SLUG_PATTERN.test(slug)) throw new HttpError(400, "Slug minimal 3 karakter; gunakan huruf kecil, angka, dan tanda hubung.");
  return slug;
}

function toTemplate(row: Record<string, any>, includeReusableQuestions = false) {
  return {
    id: String(row.id),
    ownerId: row.owner_id ? String(row.owner_id) : null,
    name: String(row.name),
    slug: String(row.slug),
    description: String(row.description ?? ""),
    subject: String(row.subject),
    gradeLevel: String(row.grade_level ?? ""),
    category: String(row.category ?? "ulangan"),
    questionConfig: row.question_config && typeof row.question_config === "object" ? row.question_config : {},
    questionCount: Number(row.question_count ?? 10),
    durationMin: Number(row.duration_min ?? 45),
    difficulty: String(row.difficulty ?? "Menengah"),
    instructions: String(row.instructions ?? ""),
    reusableQuestions: includeReusableQuestions && Array.isArray(row.reusable_questions) ? row.reusable_questions : [],
    visibility: String(row.visibility ?? "private") as "public" | "private",
    status: String(row.status ?? "draft") as "draft" | "published",
    isBuiltin: Boolean(row.is_builtin),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listTemplates(searchParams: URLSearchParams, userId: string | null) {
  const search = cleanText(searchParams.get("q"), 100);
  const subject = cleanText(searchParams.get("subject"), 60);
  const grade = cleanText(searchParams.get("grade"), 80);
  const rows = await q(
    `SELECT * FROM templates
      WHERE ((visibility = 'public' AND status = 'published') OR ($1::text IS NOT NULL AND owner_id = $1))
        AND ($2 = '' OR name ILIKE '%' || $2 || '%' OR description ILIKE '%' || $2 || '%' OR subject ILIKE '%' || $2 || '%')
        AND ($3 = '' OR subject = $3)
        AND ($4 = '' OR grade_level = $4)
      ORDER BY is_builtin DESC, updated_at DESC, name ASC
      LIMIT 250`,
    [userId, search, subject, grade],
  );
  return { templates: rows.map((row: Record<string, any>) => toTemplate(row, Boolean(userId && row.owner_id && String(row.owner_id) === userId))) };
}

export async function getTemplateBySlug(slug: string, userId: string | null) {
  const [row] = await q(
    `SELECT * FROM templates
      WHERE slug = $1 AND ((visibility = 'public' AND status = 'published') OR ($2::text IS NOT NULL AND owner_id = $2))
      LIMIT 1`,
    [slug, userId],
  );
  if (!row) throw new HttpError(404, "Template tidak ditemukan atau tidak bisa diakses.");
  return { template: toTemplate(row, Boolean(userId && row.owner_id && String(row.owner_id) === userId)) };
}

function questionConfig(value: unknown) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
  const source = raw.distribution && typeof raw.distribution === "object" && !Array.isArray(raw.distribution) ? raw.distribution as Record<string, unknown> : {};
  const distribution: Record<string, number> = {};
  for (const [key, amount] of Object.entries(source)) {
    if (!TEMPLATE_FORMATS.has(key as Format)) continue;
    const number = Number(amount);
    if (Number.isInteger(number) && number >= 0 && number <= 200) distribution[key] = number;
  }
  return { distribution, questionTypes: Object.keys(distribution).filter((key) => distribution[key] > 0) };
}

function validateData(body: Record<string, any>, current?: ReturnType<typeof toTemplate>) {
  const name = cleanText(body.name ?? current?.name, 100);
  if (name.length < 3) throw new HttpError(400, "Nama template minimal 3 karakter.");
  const subject = cleanText(body.subject ?? current?.subject, 60);
  if (!subject) throw new HttpError(400, "Mata pelajaran wajib diisi.");
  const slug = validateSlug(body.slug ?? current?.slug, name);
  const questionCount = Number(body.questionCount ?? current?.questionCount ?? 10);
  const durationMin = Number(body.durationMin ?? current?.durationMin ?? 45);
  if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 200) throw new HttpError(400, "Jumlah soal template harus antara 1 dan 200.");
  if (!Number.isInteger(durationMin) || durationMin < 1 || durationMin > 600) throw new HttpError(400, "Durasi template harus antara 1 dan 600 menit.");
  const visibility = body.visibility === undefined ? current?.visibility ?? "private" : body.visibility;
  if (visibility !== "public" && visibility !== "private") throw new HttpError(400, "Visibilitas template tidak valid.");
  const status = body.status === undefined ? current?.status ?? "draft" : body.status;
  if (status !== "published" && status !== "draft") throw new HttpError(400, "Status publikasi template tidak valid.");
  const reusableRaw = body.reusableQuestions ?? current?.reusableQuestions ?? [];
  if (!Array.isArray(reusableRaw) || reusableRaw.length > 200) throw new HttpError(400, "Pertanyaan template tidak valid.");
  const reusableQuestions = reusableRaw.length ? sanitizeQuestions(reusableRaw) : [];
  return {
    name, slug,
    description: cleanText(body.description ?? current?.description, 1200),
    subject,
    gradeLevel: cleanText(body.gradeLevel ?? current?.gradeLevel, 80),
    category: cleanText(body.category ?? current?.category, 60) || "ulangan",
    questionConfig: questionConfig(body.questionConfig ?? current?.questionConfig),
    questionCount, durationMin,
    difficulty: cleanText(body.difficulty ?? current?.difficulty, 40) || "Menengah",
    instructions: typeof (body.instructions ?? current?.instructions) === "string" ? String(body.instructions ?? current?.instructions).trim().slice(0, 2000) : "",
    reusableQuestions, visibility, status,
  };
}

async function assertOwnQuestionImages(questions: Question[], userId: string) {
  const ids = [...new Set(questions.map((question) => question.image?.replace("/api/img/", "").toLowerCase()).filter((id): id is string => Boolean(id)))];
  if (!ids.length) return;
  const slots = ids.map((_, index) => `$${index + 2}`).join(", ");
  const rows = await q(`SELECT id FROM images WHERE owner_id = $1 AND id::text IN (${slots})`, [userId, ...ids]);
  if (rows.length !== ids.length) throw new HttpError(400, "Template berisi gambar yang tidak kamu miliki. Unggah ulang gambar tersebut.");
}

export async function createTemplate(userId: string, body: Record<string, any>) {
  const data = validateData(body);
  await assertOwnQuestionImages(data.reusableQuestions, userId);
  try {
    const [row] = await q(
      `INSERT INTO templates (owner_id, name, slug, description, subject, grade_level, category, question_config, question_count, duration_min, difficulty, instructions, reusable_questions, visibility, status, is_builtin)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13::jsonb,$14,$15,false) RETURNING *`,
      [userId, data.name, data.slug, data.description, data.subject, data.gradeLevel, data.category, JSON.stringify(data.questionConfig), data.questionCount, data.durationMin, data.difficulty, data.instructions, JSON.stringify(data.reusableQuestions), data.visibility, data.status],
    );
    return { template: toTemplate(row, true) };
  } catch (error) {
    if (/unique|duplicate/i.test(error instanceof Error ? error.message : String(error))) throw new HttpError(409, "Slug template sudah digunakan. Pilih slug lain.");
    throw error;
  }
}

async function ownTemplate(userId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "Template tidak ditemukan.");
  const [row] = await q("SELECT * FROM templates WHERE id = $1 AND owner_id = $2 AND is_builtin = false", [id, userId]);
  if (!row) throw new HttpError(404, "Template tidak ditemukan atau bukan milikmu.");
  return toTemplate(row, true);
}

export async function updateTemplate(userId: string, id: string, body: Record<string, any>) {
  const current = await ownTemplate(userId, id);
  const data = validateData(body, current);
  await assertOwnQuestionImages(data.reusableQuestions, userId);
  try {
    const [row] = await q(
      `UPDATE templates SET name=$1, slug=$2, description=$3, subject=$4, grade_level=$5, category=$6, question_config=$7::jsonb,
        question_count=$8, duration_min=$9, difficulty=$10, instructions=$11, reusable_questions=$12::jsonb, visibility=$13, status=$14, updated_at=now()
       WHERE id=$15 AND owner_id=$16 AND is_builtin=false RETURNING *`,
      [data.name, data.slug, data.description, data.subject, data.gradeLevel, data.category, JSON.stringify(data.questionConfig), data.questionCount, data.durationMin, data.difficulty, data.instructions, JSON.stringify(data.reusableQuestions), data.visibility, data.status, id, userId],
    );
    if (!row) throw new HttpError(404, "Template tidak ditemukan.");
    return { template: toTemplate(row, true) };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (/unique|duplicate/i.test(error instanceof Error ? error.message : String(error))) throw new HttpError(409, "Slug template sudah digunakan. Pilih slug lain.");
    throw error;
  }
}

export async function deleteTemplate(userId: string, id: string) {
  await ownTemplate(userId, id);
  await q("DELETE FROM templates WHERE id = $1 AND owner_id = $2 AND is_builtin = false", [id, userId]);
  return { ok: true };
}

async function cloneQuestionImages(questions: Question[], userId: string): Promise<Question[]> {
  const imageIds = [...new Set(questions.map((question) => question.image?.replace("/api/img/", "")).filter((value): value is string => Boolean(value)))];
  if (!imageIds.length) return questions;
  const placeholders = imageIds.map((_, index) => `$${index + 1}`).join(", ");
  const rows = await q(`SELECT id, mime, data, size FROM images WHERE id::text IN (${placeholders})`, imageIds);
  const byId = new Map(rows.map((row: any) => [String(row.id), row]));
  const replacements = new Map<string, string>();
  for (const imageId of imageIds) {
    const image = byId.get(imageId);
    if (!image) throw new HttpError(409, "Gambar pada template sudah tidak tersedia. Edit template dan unggah ulang gambar tersebut.");
    const [created] = await q(
      "INSERT INTO images (owner_id, mime, data, size) VALUES ($1,$2,$3,$4) RETURNING id",
      [userId, image.mime, image.data, image.size],
    );
    replacements.set(imageId, String(created.id));
  }
  return questions.map((question) => {
    if (!question.image) return question;
    const originalId = question.image.replace("/api/img/", "");
    const clonedId = replacements.get(originalId);
    return { ...question, image: clonedId ? `/api/img/${clonedId}` : null };
  });
}

export async function duplicateTemplate(userId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "Template tidak ditemukan.");
  const [source] = await q(
    `SELECT * FROM templates WHERE id = $1 AND ((visibility = 'public' AND status = 'published') OR owner_id = $2) LIMIT 1`,
    [id, userId],
  );
  if (!source) throw new HttpError(404, "Template tidak ditemukan atau tidak bisa diakses.");
  const sourceTemplate = toTemplate(source, true);
  const name = `${sourceTemplate.name.slice(0, 88)} (Salinan)`;
  const slug = `${slugify(name).slice(0, 52)}-${randomBytes(3).toString("hex")}`;
  const copiedQuestions = sourceTemplate.reusableQuestions.map((question: any) => ({ ...question, id: randomBytes(6).toString("hex") }));
  const questions = await cloneQuestionImages(copiedQuestions, userId);
  const [row] = await q(
    `INSERT INTO templates (owner_id, name, slug, description, subject, grade_level, category, question_config, question_count, duration_min, difficulty, instructions, reusable_questions, visibility, status, is_builtin)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13::jsonb,'private','draft',false) RETURNING *`,
    [userId, name, slug, sourceTemplate.description, sourceTemplate.subject, sourceTemplate.gradeLevel, sourceTemplate.category, JSON.stringify(sourceTemplate.questionConfig), sourceTemplate.questionCount, sourceTemplate.durationMin, sourceTemplate.difficulty, sourceTemplate.instructions, JSON.stringify(questions)],
  );
  return { template: toTemplate(row, true) };
}

function blankQuestion(format: string): Question {
  const id = randomBytes(6).toString("hex");
  const base: Question = { id, kind: format as any, format: format as any, text: "", story: "", image: null, options: [], correctIndex: 0, correctIndices: [], acceptedAnswers: [], rubric: "", explanation: "", points: 1, matchPairs: [], orderItems: [], correctOrder: [] } as Question;
  if (format === "multiple_choice" || format === "multiple_select") base.options = ["", "", "", ""];
  if (format === "true_false") { base.options = ["Benar", "Salah"]; base.correctIndex = 0; }
  if (["short_answer", "fill_blank", "numeric"].includes(format)) base.acceptedAnswers = [""];
  if (format === "matching") base.matchPairs = [{ left: "Pasangan 1", right: "Jawaban 1" }, { left: "Pasangan 2", right: "Jawaban 2" }];
  if (format === "ordering") { base.orderItems = ["Item 1", "Item 2", "Item 3"]; base.correctOrder = [0, 1, 2]; }
  return base;
}

export async function useTemplate(userId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "Template tidak ditemukan.");
  const [row] = await q(
    `SELECT * FROM templates WHERE id = $1 AND ((visibility = 'public' AND status = 'published') OR owner_id = $2) LIMIT 1`,
    [id, userId],
  );
  if (!row) throw new HttpError(404, "Template tidak ditemukan atau tidak bisa diakses.");
  const template = toTemplate(row, true);
  const reusableQuestions = template.reusableQuestions.length
    ? template.reusableQuestions
    : template.isBuiltin
      ? getBuiltinTemplateQuestions(template.slug)
      : [];
  let questions: Question[] = await cloneQuestionImages(reusableQuestions.map((question: any) => ({ ...question, id: randomBytes(6).toString("hex") })), userId);
  if (!questions.length && template.isBuiltin) {
    throw new HttpError(409, "Soal contoh template bawaan belum tersedia. Muat ulang halaman setelah deployment terbaru.");
  }
  if (!questions.length) {
    const distribution = template.questionConfig?.distribution && typeof template.questionConfig.distribution === "object" ? template.questionConfig.distribution as Record<string, unknown> : {};
    const formats = Object.entries(distribution).filter(([key, value]) => TEMPLATE_FORMATS.has(key as Format) && Number.isInteger(Number(value)) && Number(value) > 0);
    const formatsList = formats.flatMap(([format, count]) => Array.from({ length: Math.min(200, Number(count)) }, () => format));
    while (formatsList.length < template.questionCount && formatsList.length < 200) formatsList.push("multiple_choice");
    questions = formatsList.slice(0, template.questionCount).map((format) => blankQuestion(format));
  }
  if (!questions.length) questions = [blankQuestion("multiple_choice")];
  const [exam] = await q(
    `INSERT INTO exams (owner_id, title, class_name, duration_min, questions, instructions) VALUES ($1,$2,$3,$4,$5::jsonb,$6) RETURNING *`,
    [userId, template.name, template.gradeLevel, template.durationMin, JSON.stringify(questions), template.instructions],
  );
  return { exam: { id: exam.id as string, title: exam.title as string, questionCount: questions.length } };
}
