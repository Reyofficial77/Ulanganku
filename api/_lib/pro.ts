import { createHash, randomBytes } from "node:crypto";
import type { VercelRequest } from "@vercel/node";
import { q } from "./db.js";
import { extractJson, geminiText } from "./gemini.js";
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
  if (recent.length >= 6) throw new HttpError(429, "Terlalu banyak permintaan AI. Tunggu satu menit lalu coba lagi.");
  recent.push(now);
  aiHits.set(userId, recent);
}

const OPTION_LETTERS = /^\s*[A-Ea-e][.)]\s+/;

export async function generateExam(user: SessionUser, prompt: unknown) {
  await requirePro(user.id);
  const text = typeof prompt === "string" ? prompt.trim().slice(0, 800) : "";
  if (text.length < 5) throw new HttpError(400, "Tulis perintah yang lebih jelas, misalnya: buatkan ulangan IPA kelas 8 tentang tekanan, 10 soal.");
  aiRateLimit(user.id);

  const system =
    "Kamu membantu guru Indonesia membuat soal ulangan pilihan ganda. Jawab HANYA dengan satu objek JSON tanpa teks lain, tanpa markdown. " +
    'Bentuk: {"title": string, "className": string, "durationMin": number, "questions": [{"text": string, "options": [string, string, string, string], "correctIndex": number}]}. ' +
    "Aturan: title singkat (maks 60 karakter). className diisi jika disebut perintah, jika tidak string kosong. " +
    "Jumlah soal sesuai perintah, jika tidak disebut buat 10, maksimal 20. Setiap soal punya tepat 4 pilihan tanpa awalan huruf (A, B, C). " +
    "correctIndex adalah indeks 0 sampai 3 dari jawaban benar. Soal harus akurat, jelas, dan satu jawaban benar. Gunakan bahasa Indonesia.";
  const raw = extractJson(await geminiText(system, `Perintah guru: ${text}`, 6000));

  const list: any[] = Array.isArray(raw?.questions) ? raw.questions.slice(0, 20) : [];
  const questions: Question[] = [];
  for (const item of list) {
    const options = Array.isArray(item?.options)
      ? item.options.map((o: unknown) => String(o ?? "").replace(OPTION_LETTERS, "").trim()).filter(Boolean)
      : [];
    const correct = Number(item?.correctIndex);
    const questionText = String(item?.text ?? "").trim();
    if (!questionText || options.length < 2 || options.length > 6) continue;
    if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) continue;
    questions.push({
      id: randomBytes(6).toString("hex"),
      kind: "multiple_choice",
      format: "multiple_choice",
      text: questionText,
      story: "",
      image: null,
      options,
      correctIndex: correct,
      acceptedAnswers: [],
      rubric: "",
      points: 1,
    });
  }
  if (questions.length === 0) throw new HttpError(502, "AI belum berhasil membuat soal yang valid. Coba ubah perintahnya.");

  const safe = sanitizeQuestions(questions);
  const title = String(raw?.title ?? "").replace(/\s+/g, " ").trim().slice(0, 120) || "Ulangan dari AI";
  const className = String(raw?.className ?? "").trim().slice(0, 40);
  const duration = Number(raw?.durationMin);
  const durationMin = Number.isInteger(duration) && duration >= 5 && duration <= 180 ? duration : Math.max(10, safe.length * 3);

  const [row] = await q(
    `INSERT INTO exams (owner_id, title, class_name, duration_min, questions) VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`,
    [user.id, title, className, durationMin, JSON.stringify(safe)],
  );
  return { examId: row.id as string, title, questionCount: safe.length };
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
  const answer = await geminiText(system, list.map((t, i) => `${i + 1}. ${t}`).join("\n"), 80);
  const title = answer.split("\n")[0].replace(/^["'“”\s]+|["'“”\s]+$/g, "").slice(0, 120);
  if (!title) throw new HttpError(502, "AI belum berhasil membuat judul. Coba lagi.");
  return { title };
}
