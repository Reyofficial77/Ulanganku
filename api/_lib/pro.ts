import { createHash, randomBytes } from "node:crypto";
import type { VercelRequest } from "@vercel/node";
import { q } from "./db.js";
import { OLLAMA_MODEL, extractJson, ollamaText, validateOllamaModel } from "./ollama.js";
import { sanitizeQuestions, type Question } from "./exams.js";
import { HttpError, getIp } from "./http.js";
import type { SessionUser } from "./session.js";

/** Promo uji coba (hari). Hanya untuk email yang sudah terdaftar di tabel pro_access. */
export const TRIAL_DAYS = 30;

// Tanggal hari ini di zona waktu Indonesia (WIB).
const TODAY = "(now() AT TIME ZONE 'Asia/Jakarta')::date";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const METHODS: Record<string, string> = { dana: "DANA", gopay: "GoPay" };

/** Sidik jari perangkat dari IP, disalt dengan SESSION_SECRET. IP mentah tidak disimpan. */
function deviceHash(req: VercelRequest): string {
  const ip = getIp(req) || "unknown";
  return createHash("sha256").update(`${process.env.SESSION_SECRET ?? ""}|device|${ip}`).digest("hex");
}

function readPrice(): number | null {
  const raw = process.env.PRO_PRICE_IDR?.trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

function adminNumber(): string {
  return (process.env.ADMIN_WHATSAPP ?? "").replace(/\D/g, "");
}

function assertOrderId(id: string) {
  if (!UUID_RE.test(id)) throw new HttpError(404, "Pesanan tidak ditemukan.");
}

export async function proStatus(user: SessionUser, req: VercelRequest) {
  const email = user.email.toLowerCase();
  const [access] = await q(
    `SELECT to_char(expires_on, 'YYYY-MM-DD') AS expires_on, (expires_on - ${TODAY})::int AS days_left
       FROM pro_access WHERE email = $1`,
    [email],
  );
  const active = Boolean(access) && Number(access.days_left) >= 0;

  // Promo hanya ditawarkan ke akun yang sedang login, dan hanya sekali per akun dan per perangkat.
  let trialAvailable = false;
  if (access && !active) {
    const [used] = await q(
      `SELECT EXISTS(SELECT 1 FROM pro_trials WHERE user_id = $1) AS mine,
              EXISTS(SELECT 1 FROM pro_trials WHERE device_hash = $2) AS device`,
      [user.id, deviceHash(req)],
    );
    trialAvailable = !used.mine && !used.device;
  }

  return {
    active,
    expiresOn: access ? (access.expires_on as string) : null,
    daysLeft: access ? Number(access.days_left) : null,
    trialAvailable,
    trialDays: TRIAL_DAYS,
  };
}

export async function claimTrial(user: SessionUser, req: VercelRequest) {
  const email = user.email.toLowerCase();
  const [registered] = await q("SELECT 1 AS ok FROM pro_access WHERE email = $1", [email]);
  if (!registered) throw new HttpError(403, "Promo PRO belum tersedia untuk akun ini.");

  // ON CONFLICT menangani dua kasus sekaligus: akun sudah pernah ikut promo, atau perangkat sudah dipakai akun lain.
  const inserted = await q(
    "INSERT INTO pro_trials (user_id, device_hash) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING user_id",
    [user.id, deviceHash(req)],
  );
  if (!inserted[0]) throw new HttpError(409, "Promo PRO sudah pernah dipakai di akun atau perangkat ini.");

  await q(
    `UPDATE pro_access SET expires_on = GREATEST(expires_on, ${TODAY} + ${TRIAL_DAYS}), updated_at = now() WHERE email = $1`,
    [email],
  );
  return proStatus(user, req);
}

export async function createOrder(user: SessionUser) {
  // Pesanan "pending" yang sudah ada dipakai ulang, supaya tidak menumpuk.
  const [existing] = await q(
    "SELECT id FROM pro_orders WHERE user_id = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
    [user.id],
  );
  if (existing) return { id: existing.id as string };
  const [row] = await q("INSERT INTO pro_orders (user_id, email) VALUES ($1, $2) RETURNING id", [
    user.id,
    user.email.toLowerCase(),
  ]);
  return { id: row.id as string };
}

export async function getOrder(user: SessionUser, id: string) {
  assertOrderId(id);
  const [row] = await q(
    "SELECT id, status, payment_method, created_at FROM pro_orders WHERE id = $1 AND user_id = $2",
    [id, user.id],
  );
  if (!row) throw new HttpError(404, "Pesanan tidak ditemukan.");
  return {
    order: {
      id: row.id as string,
      status: row.status as string,
      paymentMethod: (row.payment_method as string | null) ?? null,
      email: user.email,
      createdAt: row.created_at as string,
      priceIdr: readPrice(),
      adminWhatsappReady: adminNumber().length > 0,
    },
  };
}

export async function chooseMethod(user: SessionUser, id: string, method: unknown) {
  assertOrderId(id);
  const label = typeof method === "string" ? METHODS[method] : undefined;
  if (!label) throw new HttpError(400, "Metode pembayaran hanya DANA atau GoPay.");
  const number = adminNumber();
  if (!number) throw new HttpError(503, "Nomor WhatsApp admin belum diatur. Hubungi pengelola Ulanganku.");

  const [row] = await q(
    `UPDATE pro_orders SET payment_method = $3, status = 'waiting_payment', updated_at = now()
      WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'waiting_payment')
      RETURNING id`,
    [id, user.id, label],
  );
  if (!row) throw new HttpError(409, "Pesanan ini sudah tidak aktif. Buat pesanan baru dari dashboard.");

  const price = readPrice();
  const text = [
    "Halo Admin Ulanganku, saya ingin upgrade ke PRO.",
    "",
    `Kode pesanan: ${id}`,
    `Nama: ${user.name || "-"}`,
    `Email: ${user.email}`,
    `Metode pembayaran: ${label}`,
    ...(price ? [`Total: Rp ${price.toLocaleString("id-ID")}`] : []),
    "",
    "Saya akan segera melakukan pembayaran. Mohon konfirmasi setelah pembayaran diterima. Terima kasih.",
  ].join("\n");
  return { waUrl: `https://wa.me/${number}?text=${encodeURIComponent(text)}` };
}

/* ------------------------- Akses & validasi PRO ------------------------- */

/** Apakah pemilik akun ini sedang punya akses PRO aktif (dicek langsung ke tabel whitelist). */
export async function isProUser(userId: string): Promise<boolean> {
  const [row] = await q(
    `SELECT EXISTS(
       SELECT 1 FROM users u JOIN pro_access p ON p.email = lower(u.email)
        WHERE u.id = $1 AND p.expires_on >= ${TODAY}
     ) AS pro`,
    [userId],
  );
  return Boolean(row?.pro);
}

export async function requirePro(userId: string) {
  if (!(await isProUser(userId))) throw new HttpError(403, "Fitur ini khusus pengguna PRO.");
}

const IMAGE_URL_RE = /^\/api\/img\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** Pastikan URL gambar valid dan milik user ini. */
export async function assertOwnImageUrl(url: unknown, userId: string): Promise<string> {
  const match = typeof url === "string" ? IMAGE_URL_RE.exec(url) : null;
  if (!match) throw new HttpError(400, "Gambar tidak valid.");
  const [row] = await q("SELECT 1 AS ok FROM images WHERE id = $1 AND owner_id = $2", [match[1].toLowerCase(), userId]);
  if (!row) throw new HttpError(400, "Gambar tidak ditemukan. Unggah ulang gambarnya.");
  return url as string;
}

/** Kontras terhadap putih minimal 3:1 agar teks tombol tetap terbaca. */
function accentReadable(hex: string): boolean {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return 1.05 / (luminance + 0.05) >= 3;
}

/* ------------------------------ Branding ------------------------------ */

export async function getBranding(user: SessionUser) {
  const [row] = await q("SELECT accent, school_name, logo_url FROM pro_branding WHERE user_id = $1", [user.id]);
  return {
    active: await isProUser(user.id),
    branding: {
      accent: (row?.accent as string | null) ?? null,
      schoolName: (row?.school_name as string | undefined) ?? "",
      logoUrl: (row?.logo_url as string | null) ?? null,
    },
  };
}

export async function saveBranding(user: SessionUser, body: Record<string, any>) {
  await requirePro(user.id);

  let accent: string | null = null;
  if (body.accent !== null && body.accent !== undefined && body.accent !== "") {
    if (typeof body.accent !== "string" || !/^#[0-9a-fA-F]{6}$/.test(body.accent)) {
      throw new HttpError(400, "Warna harus berformat hex, contoh #1b78c8.");
    }
    if (!accentReadable(body.accent)) throw new HttpError(400, "Warna terlalu terang. Pilih warna yang lebih gelap agar teks tombol terbaca.");
    accent = body.accent.toLowerCase();
  }

  const schoolName = typeof body.schoolName === "string" ? body.schoolName.trim().replace(/\s+/g, " ").slice(0, 60) : "";
  const logoUrl = body.logoUrl ? await assertOwnImageUrl(body.logoUrl, user.id) : null;

  await q(
    `INSERT INTO pro_branding (user_id, accent, school_name, logo_url) VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET accent = EXCLUDED.accent, school_name = EXCLUDED.school_name,
       logo_url = EXCLUDED.logo_url, updated_at = now()`,
    [user.id, accent, schoolName, logoUrl],
  );
  return getBranding(user);
}

/* -------------------------------- AI PRO ------------------------------- */

// Batas permintaan AI per akun (disimpan di memori fungsi, cukup untuk mencegah penyalahgunaan sederhana).
const aiHits = new Map<string, number[]>();
function aiRateLimit(userId: string) {
  const now = Date.now();
  const recent = (aiHits.get(userId) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= 30) throw new HttpError(429, "Terlalu banyak permintaan AI. Tunggu satu menit lalu coba lagi.");
  recent.push(now);
  aiHits.set(userId, recent);
}

const OPTION_LETTERS = /^\s*[A-Ha-h][.)]\s+/;
const GENERATION_FORMATS = new Set(["multiple_choice", "multiple_select", "true_false", "short_answer", "fill_blank", "essay", "matching", "ordering", "numeric"]);
// Batch 10 soal terlalu berat untuk sebagian model Ollama Cloud dan bisa melewati
// batas waktu fungsi serverless. Batch kecil menjaga setiap permintaan tetap singkat.
const EXAM_GENERATION_BATCH_SIZE = 2;

function requestedQuestionCount(text: string) {
  // Tangani bentuk umum Indonesia/Inggris seperti "100+ soal", "minimal 100 soal",
  // "100 atau lebih pertanyaan", dan "at least 100 questions".
  const match = text.match(/\b(?:(?:minimal|setidaknya|sekurang-kurangnya|paling sedikit|at least|no fewer than)\s+)?(\d{1,3})\s*(?:\+|(?:atau|or)\s+(?:lebih|more))?\s*(?:soal|pertanyaan|questions?)\b/i)
    ?? text.match(/\b(?:buat(?:kan)?|bikin(?:kan)?|generate|create|make|build|write|prepare)\s+(\d{1,3})\b/i);
  return Math.min(200, Math.max(1, match ? Number(match[1]) : 10));
}

function requestedDuration(text: string): number | null {
  const match = text.match(/\b(\d{1,3})\s*[- ]?\s*(?:menit|minutes?|mins?)\b/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) && value >= 1 && value <= 600 ? value : null;
}

function estimateDuration(text: string, count: number) {
  // Perkiraan awal dapat diedit guru: uraian/analisis butuh lebih lama daripada soal objektif.
  const minutesPerQuestion = /uraian|essay|analisis|pembuktian|pemecahan masalah/i.test(text)
    ? 4
    : /matematika|fisika|kimia|numerik|hitungan|perhitungan/i.test(text)
      ? 2.5
      : 1.5;
  return Math.min(600, Math.max(10, Math.ceil((count * minutesPerQuestion) / 5) * 5));
}

function normalizedQuestion(text: string) {
  return text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function isNearDuplicate(left: string, right: string) {
  const a = normalizedQuestion(left).split(/\s+/).filter((word) => word.length > 2);
  const b = normalizedQuestion(right).split(/\s+/).filter((word) => word.length > 2);
  if (!a.length || !b.length) return false;
  const sa = new Set(a), sb = new Set(b);
  const intersection = [...sa].filter((word) => sb.has(word)).length;
  const union = new Set([...sa, ...sb]).size;
  return union > 0 && intersection / union >= 0.84;
}

function toGeneratedQuestion(item: any, index: number): Question | null {
  const text = String(item?.text ?? item?.question ?? "").trim().slice(0, 3000);
  if (!text) return null;
  const format = GENERATION_FORMATS.has(String(item?.format)) ? String(item.format) : "multiple_choice";
  let kind = String(item?.kind ?? format);
  if (!["story", "story_image", "image", ...GENERATION_FORMATS].includes(kind)) kind = format;
  // AI tidak dapat membuat gambar yang tersimpan milik guru; jenis bergambar tetap bisa dipilih/diisi manual di editor.
  if (kind === "story_image" || kind === "image") kind = item?.story ? "story" : format;
  const options = Array.isArray(item?.options) ? item.options.map((value: unknown) => String(value ?? "").replace(OPTION_LETTERS, "").trim()).slice(0, 8) : [];
  const answers = Array.isArray(item?.acceptedAnswers) ? item.acceptedAnswers.map((value: unknown) => String(value ?? "").trim()).filter(Boolean).slice(0, 10) :
    item?.answer !== undefined ? [String(item.answer).trim()].filter(Boolean) : [];
  const correctIndex = Number(item?.correctIndex ?? 0);
  const correctIndices = Array.isArray(item?.correctIndices) ? item.correctIndices.map(Number) : Number.isInteger(correctIndex) ? [correctIndex] : [];
  const rawPairs = Array.isArray(item?.matchPairs) ? item.matchPairs : [];
  const matchPairs = rawPairs.map((pair: any) => ({ left: String(pair?.left ?? "").trim(), right: String(pair?.right ?? "").trim() }));
  const orderItems = Array.isArray(item?.orderItems) ? item.orderItems.map((value: unknown) => String(value ?? "").trim()) : [];
  const correctOrder = Array.isArray(item?.correctOrder) ? item.correctOrder.map(Number) : orderItems.map((_: string, index: number) => index);
  const question: Question = {
    id: randomBytes(6).toString("hex"),
    kind: kind as any,
    format: format as any,
    text,
    story: String(item?.story ?? item?.passage ?? "").trim().slice(0, 6000),
    image: null,
    options,
    correctIndex,
    correctIndices,
    acceptedAnswers: answers,
    explanation: String(item?.explanation ?? "").trim().slice(0, 2000),
    matchPairs,
    orderItems,
    correctOrder,
    rubric: String(item?.rubric ?? "").trim().slice(0, 2000),
    points: Number.isInteger(Number(item?.points)) ? Math.min(100, Math.max(1, Number(item.points))) : 1,
  } as Question;
  try { return sanitizeQuestions([question])[0] ?? null; } catch { return null; }
}

export async function startExamGeneration(user: SessionUser, prompt: unknown, requestedModel?: unknown) {
  await requirePro(user.id);
  const text = typeof prompt === "string" ? prompt.trim().slice(0, 1800) : "";
  if (text.length < 5) throw new HttpError(400, "Tulis perintah yang lebih jelas, misalnya: buatkan ulangan IPA kelas 8 tentang tekanan, 40 soal.");
  aiRateLimit(user.id);
  const modelText = typeof requestedModel === "string" ? requestedModel.trim() : "";
  const model = await validateOllamaModel(modelText || OLLAMA_MODEL);
  const targetCount = requestedQuestionCount(text);
  const duration = requestedDuration(text);
  const [job] = await q(
    `INSERT INTO ai_generation_jobs (owner_id, prompt, target_count, generated_questions, model, title, class_name, duration_min, instructions, status)
     VALUES ($1, $2, $3, '[]'::jsonb, $4, 'Ulangan dari AI', '', $5, '', 'running') RETURNING id`,
    [user.id, text, targetCount, model, duration ?? estimateDuration(text, targetCount)],
  );
  return { jobId: String(job.id), model, requestedCount: targetCount, generatedCount: 0, done: false };
}

export async function generateExamBatch(user: SessionUser, rawJobId: unknown, rawBatchSize?: unknown) {
  await requirePro(user.id);
  const jobId = typeof rawJobId === "string" ? rawJobId : "";
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) throw new HttpError(400, "ID proses pembuatan ulangan tidak valid.");
  const [job] = await q("SELECT * FROM ai_generation_jobs WHERE id = $1 AND owner_id = $2", [jobId, user.id]);
  if (!job) throw new HttpError(404, "Proses pembuatan ulangan tidak ditemukan.");
  const existing = Array.isArray(job.generated_questions) ? job.generated_questions as Question[] : [];
  const targetCount = Number(job.target_count);
  if (job.status === "complete" || existing.length >= targetCount) {
    return { jobId, examId: job.exam_id, title: job.title, requestedCount: targetCount, generatedCount: existing.length, done: true, model: job.model };
  }
  aiRateLimit(user.id);
  const model = await validateOllamaModel(String(job.model || OLLAMA_MODEL));
  const requestedBatchSize = Number(rawBatchSize);
  const batchSize = Number.isInteger(requestedBatchSize)
    ? Math.min(EXAM_GENERATION_BATCH_SIZE, Math.max(1, requestedBatchSize))
    : EXAM_GENERATION_BATCH_SIZE;
  const batchCount = Math.min(batchSize, targetCount - existing.length);
  const prompt = String(job.prompt);
  // Cukup kirim contoh terbaru agar prompt tidak terus membesar pada batch berikutnya.
  // Pemeriksaan duplikasi tetap dilakukan terhadap seluruh soal yang sudah tersimpan.
  const priorStart = Math.max(0, existing.length - 12);
  const priorQuestions = existing.slice(priorStart).map((question, index) => `${priorStart + index + 1}. ${question.text.slice(0, 90)}`).join("\n");
  const system = [
    "Kamu adalah penyusun ujian yang teliti. Jawab hanya satu objek JSON valid tanpa markdown.",
    'Schema: {"title":string,"className":string,"durationMin":number,"instructions":string,"questions":[{"explanation":string,"kind":"multiple_choice|multiple_select|true_false|short_answer|fill_blank|essay|matching|ordering|story","format":"multiple_choice|multiple_select|true_false|short_answer|fill_blank|essay|matching|ordering|numeric","text":string,"story":string,"options":string[],"correctIndex":number,"correctIndices":number[],"acceptedAnswers":string[],"matchPairs":[{"left":string,"right":string}],"orderItems":string[],"correctOrder":number[],"rubric":string,"points":number}]}.',
    "Format pilihan: multiple_choice 2–6 opsi dan satu correctIndex; multiple_select 2–8 opsi dan correctIndices; true_false pakai correctIndex 0 untuk Benar atau 1 untuk Salah; short_answer/fill_blank/numeric isi acceptedAnswers; essay isi rubric; matching isi 2–10 matchPairs; ordering isi orderItems dan correctOrder berupa indeks item yang diurutkan benar (mulai dari 0).",
    "Sertakan instructions berupa petunjuk pengerjaan singkat yang sesuai dengan instruksi guru. Untuk bacaan gunakan kind=story dan isi story dengan bacaan yang relevan. Teks dapat memuat tabel sederhana, data, satuan, dan rumus tekstual. Jangan mengarang fakta. Buat beragam bentuk soal sesuai instruksi guru dan tingkat kelas.",
    "Setiap pertanyaan harus jelas, tidak ambigu, mempunyai kunci jawaban akurat, dan bobot points berupa integer 1–100. Jangan membuat soal bergambar karena gambar harus diunggah guru.",
  ].join(" ");
  const input = `Perintah guru: ${prompt}\n\nBuat tepat ${batchCount} soal baru untuk batch ini (soal ${existing.length + 1} sampai ${existing.length + batchCount}) dari target total ${targetCount}. Ikuti distribusi bentuk soal yang disebut guru. Pertanyaan harus berbeda dari daftar yang sudah dibuat. Judul, kelas, dan durasi ulangan dibuat konsisten dengan perintah. Durasi eksplisit dari guru: ${requestedDuration(prompt) ?? "tidak disebutkan"} menit.\nSoal terdahulu, jangan ditiru:\n${priorQuestions || "(batch pertama)"}`;
  // Batasi keluaran token agar model tidak menghabiskan seluruh batas waktu serverless.
  const budget = Math.min(1700, 500 + batchCount * 550);
  const raw = extractJson(await ollamaText(system, input, budget, { json: true, model }));
  const rawList: any[] = Array.isArray(raw?.questions) ? raw.questions.slice(0, batchCount + 4) : [];
  const next: Question[] = [];
  const priorTexts = existing.map((question) => question.text);
  for (const item of rawList) {
    const question = toGeneratedQuestion(item, existing.length + next.length);
    if (!question) continue;
    if ([...priorTexts, ...next.map((candidate) => candidate.text)].some((text) => isNearDuplicate(text, question.text))) continue;
    next.push(question);
    if (next.length >= batchCount) break;
  }
  if (!next.length) throw new HttpError(502, "Batch AI tidak menghasilkan soal valid yang berbeda. Coba ulangi batch atau ubah instruksi.");
  const combined = [...existing, ...next].slice(0, targetCount);
  const title = existing.length ? String(job.title) : String(raw?.title ?? "Ulangan dari AI").replace(/\s+/g, " ").trim().slice(0, 120) || "Ulangan dari AI";
  const instructions = existing.length ? String(job.instructions ?? "") : String(raw?.instructions ?? "").trim().slice(0, 2000);
  const className = existing.length ? String(job.class_name ?? "") : String(raw?.className ?? "").trim().slice(0, 40);
  const explicitDuration = requestedDuration(prompt);
  const modelDuration = Number(raw?.durationMin);
  const durationMin = explicitDuration ?? (Number.isInteger(modelDuration) && modelDuration >= 1 && modelDuration <= 600 ? modelDuration : Number(job.duration_min));
  let examId = job.exam_id ? String(job.exam_id) : "";
  const done = combined.length >= targetCount;
  if (!examId) {
    const [updated] = await q(
      `WITH created AS (
         INSERT INTO exams (owner_id, title, class_name, duration_min, questions, instructions)
         VALUES ($1, $2, $3, $4, $5::jsonb, $8) RETURNING id
       )
       UPDATE ai_generation_jobs SET generated_questions=$5::jsonb, exam_id=(SELECT id FROM created), title=$2, class_name=$3,
         duration_min=$4, instructions=$8, status=$6, updated_at=now() WHERE id=$7 AND owner_id=$1 RETURNING exam_id`,
      [user.id, title, className, durationMin, JSON.stringify(combined), done ? "complete" : "running", jobId, instructions],
    );
    examId = String(updated.exam_id);
  } else {
    const [updated] = await q(
      `WITH saved_exam AS (
         UPDATE exams SET questions=$1::jsonb, title=$2, class_name=$3, duration_min=$4, instructions=$9, updated_at=now()
         WHERE id=$5 AND owner_id=$6 RETURNING id
       )
       UPDATE ai_generation_jobs SET generated_questions=$1::jsonb, title=$2, class_name=$3, duration_min=$4, instructions=$9,
         status=$7, updated_at=now() WHERE id=$8 AND owner_id=$6 AND EXISTS (SELECT 1 FROM saved_exam) RETURNING exam_id`,
      [JSON.stringify(combined), title, className, durationMin, examId, user.id, done ? "complete" : "running", jobId, instructions],
    );
    if (!updated) throw new HttpError(409, "Draf ulangan tidak ditemukan lagi. Data batch belum dapat disimpan.");
  }
  return { jobId, examId, title, requestedCount: targetCount, generatedCount: combined.length, done, model, batchAdded: next.length };
}

export async function suggestTitle(user: SessionUser, texts: unknown) {
  await requirePro(user.id);
  const list = Array.isArray(texts)
    ? texts.map((t) => String(t ?? "").trim().slice(0, 300)).filter(Boolean).slice(0, 8)
    : [];
  if (list.length === 0) throw new HttpError(400, "Isi minimal satu soal dulu agar AI bisa membuat judul.");
  aiRateLimit(user.id);

  const system =
    "Buat satu judul ulangan yang singkat (maksimal 60 karakter) dalam bahasa Indonesia berdasarkan contoh soal berikut. " +
    "Jawab HANYA dengan judulnya saja, tanpa tanda kutip dan tanpa penjelasan.";
  const answer = await ollamaText(system, list.map((t, i) => `${i + 1}. ${t}`).join("\n"), 80);
  const title = answer.split("\n")[0].replace(/^["'“”\s]+|["'“”\s]+$/g, "").slice(0, 120);
  if (!title) throw new HttpError(502, "AI belum berhasil membuat judul. Coba lagi.");
  return { title };
}
