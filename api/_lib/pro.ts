import { createHash, randomBytes } from "node:crypto";
import type { VercelRequest } from "@vercel/node";
import { q } from "./db.js";
import { extractJson, ollamaText } from "./ollama.js";
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

  // Parse prompt to extract parameters
  const parsed = parsePrompt(text);
  const {
    subject,
    grade,
    topic,
    questionDistribution, // e.g., { multiple_choice: 20, true_false: 10, short_answer: 10, essay: 5 }
    totalQuestions,
    difficulty,
    durationMin
  } = parsed;

  // Determine question counts per kind
  const counts = questionDistribution ?? {};
  let sum = 0;
  for (const kind of Object.keys(counts)) {
    sum += counts[kind];
  }
  // If totalQuestions is specified and differs from sum, adjust proportionally or use totalQuestions as override
  if (totalQuestions && totalQuestions !== sum) {
    // Scale the distribution to match totalQuestions
    const scale = totalQuestions / sum;
    for (const kind of Object.keys(counts)) {
      counts[kind] = Math.max(0, Math.round(counts[kind] * scale));
    }
    // Recalculate sum
    sum = 0;
    for (const kind of Object.keys(counts)) {
      sum += counts[kind];
    }
    // Adjust for rounding errors
    let diff = totalQuestions - sum;
    if (diff !== 0) {
      // Add/subtract from the first kind
      const firstKind = Object.keys(counts)[0];
      if (firstKind) {
        counts[firstKind] = Math.max(0, counts[firstKind] + diff);
      }
    }
  }
  // If no distribution but totalQuestions is given, default to multiple_choice
  if (sum === 0 && totalQuestions > 0) {
    counts["multiple_choice"] = totalQuestions;
    sum = totalQuestions;
  }
  // If still no questions, set a default
  if (sum === 0) {
    counts["multiple_choice"] = 10;
    sum = 10;
  }

  // Prepare system prompt for question generation
  const baseSystem = `Kamu adalah AI yang ahli dalam membuat soal pelajaran untuk tingkat ${grade ?? "sekolah"} ${subject ?? ""}. Buat soal dalam bahasa Indonesia yang jelas, akurat, dan sesuai dengan kurikulum. Setiap soal harus memiliki field yang sesuai dengan jenisnya.`;

  // We'll generate questions in batches to avoid token limits
  const batchSize = 20;
  const questions: Question[] = [];
  let remaining = sum;

  while (remaining > 0) {
    const currentBatchSize = Math.min(batchSize, remaining);
    // Determine distribution for this batch
    const batchCounts: Record<string, number> = {};
    let batchRemaining = currentBatchSize;
    for (const kind of Object.keys(counts)) {
      const proportion = counts[kind] / sum;
      const batchCount = Math.max(0, Math.round(proportion * currentBatchSize));
      batchCounts[kind] = batchCount;
      batchRemaining -= batchCount;
    }
    // Assign any remaining to the first kind
    if (batchRemaining > 0) {
      const firstKind = Object.keys(counts)[0];
      if (firstKind) {
        batchCounts[firstKind] += batchRemaining;
      }
    }

    // Build the prompt for this batch
    let questionTypesDesc = "";
    for (const [kind, count] of Object.entries(batchCounts)) {
      if (count > 0) {
        questionTypesDesc += `${count} soal jenis ${getKindLabel(kind)}, `;
      }
    }
    questionTypesDesc = questionTypesDesc.replace(/, $/, "");

    const batchPrompt = `Buat ${currentBatchSize} soal:${questionTypesDesc}.`;
    if (topic) {
      batchPrompt += ` Topik: ${topic}.`;
    }
    if (difficulty) {
      batchPrompt += ` Tingkat kesulitan: ${difficulty}.`;
    }
    batchPrompt += ` Kembalikan hasil sebagai array JSON objek soal. Setiap objek harus memiliki field: id (string acak), kind (jenis soal), format (format jawaban), text (pertanyaan), story (cerita jika relevan, kosong jika tidak), image (URL gambar jika relevan, null jika tidak), options (array string untuk pilihan ganda/benar-salah, kosong jika tidak), correctIndex (indeks jawaban benar untuk pilihan ganda/benar-salah), acceptedAnswers (array string untuk jawaban singkat, kosong jika tidak), rubric (string untuk penilaian uraian, kosong jika tidak), points (number, default 1).`;

    // Define expected structure per kind in the prompt
    const kindDetails = {
      multiple_choice: "untuk pilihan ganda: berikan 4 pilihan, correctIndex antara 0-3",
      true_false: "untuk benar/salah: gunakan options ['Benar', 'Salah'], correctIndex 0 atau 1",
      short_answer: "untuk jawaban singkat: berikan acceptedAnswers array dengan satu atau lebih jawaban benar",
      essay: "untuk uraian: berikan rubric penilaian",
      story: "untuk soal cerita: isi field story dengan teks cerita, text bisa berisi pertanyaan tentang cerita",
      story_image: "untuk soal cerita + gambar: isi story dan berikan image URL",
      image: "untuk soal bergambar: berikan image URL dan text berisi pertanyaan tentang gambar"
    };
    let kindDetailsDesc = "";
    for (const [kind, count] of Object.entries(batchCounts)) {
      if (count > 0 && kindDetails[kind]) {
        kindDetailsDesc += `${getKindLabel(kind)}: ${kindDetails[kind]}. `;
      }
    }
    if (kindDetailsDesc) {
      batchPrompt += " " + kindDetailsDesc;
    }

    const system = baseSystem + " " + `
      Jawab HANYA dengan array JSON tanpa teks lain, tanpa markdown.
      Contoh format untuk pilihan ganda: {"id": "abc123", "kind": "multiple_choice", "format": "multiple_choice", "text": "Apa ibu kota Indonesia?", "story": "", "image": null, "options": ["Jakarta", "Bandung", "Surabaya", "Medan"], "correctIndex": 0, "acceptedAnswers": [], "rubric": "", "points": 1}.
      Pastikan jumlah soal tepat ${currentBatchSize} soal.
    `;

    const outputBudget = Math.min(8000, 500 + currentBatchSize * 400); // Increase budget for more complex questions
    const raw = extractJson(await ollamaText(system, batchPrompt, outputBudget, { json: true }));

    const batchList: any[] = Array.isArray(raw) ? raw : [];
    for (const item of batchList) {
      // Validate and convert to Question object
      const q = validateAndConvertQuestion(item);
      if (q) {
        questions.push(q);
      }
    }

    remaining -= currentBatchSize;
  }

  // Sanitize questions
  const safe = sanitizeQuestions(questions);

  // Set default title, className, duration if not provided
  const title = parsed.title ?? `Ulangan ${subject ?? ""} ${grade ?? ""}`;
  const className = parsed.className ?? (parsed.grade ?? "");
  const durationMin = parsed.durationMin ?? Math.max(10, safe.length * 2); // Default 2 minutes per question

  // Insert exam
  const [row] = await q(
    `INSERT INTO exams (owner_id, title, class_name, duration_min, questions) VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`,
    [user.id, title, className, durationMin, JSON.stringify(safe)]
  );
  return { examId: row.id as string, title, questionCount: safe.length };
}

// Helper function to parse prompt
function parsePrompt(text: string) {
  const result: any = {
    subject: "",
    grade: "",
    topic: "",
    questionDistribution: {},
    totalQuestions: null,
    difficulty: "",
    durationMin: null,
    title: ""
  };

  // Extract total questions mentioned
  const totalMatch = text.match(/(\d+)\s*(soal|pertanyaan)/i);
  if (totalMatch) {
    result.totalQuestions = parseInt(totalMatch[1]);
  }

  // Extract question distribution by type
  const typePatterns = [
    { kind: "multiple_choice", pattern: /(\d+)\s*(multiple choice|pilihan ganda)/i },
    { kind: "true_false", pattern: /(\d+)\s*(true false|benar salah)/i },
    { kind: "short_answer", pattern: /(\d+)\s*(short answer|jawaban singket)/i },
    { kind: "essay", pattern: /(\d+)\s*(essay|uraian)/i },
    { kind: "story", pattern: /(\d+)\s*(story|cerita)/i },
    { kind: "story_image", pattern: /(\d+)\s*(story image|cerita gambar)/i },
    { kind: "image", pattern: /(\d+)\s*(image|gambar)/i }
  ];
  for (const { kind, pattern } of typePatterns) {
    const matches = text.matchAll(pattern);
    let sum = 0;
    for (const match of matches) {
      sum += parseInt(match[1]);
    }
    if (sum > 0) {
      result.questionDistribution[kind] = sum;
    }
  }

  // Extract subject, grade, topic
  const subjectMatch = text.match(/mata kuliah\s+([^,.;]+)/i) || text.match(/pelajaran\s+([^,.;]+)/i);
  if (subjectMatch) {
    result.subject = subjectMatch[1].trim();
  }
  const gradeMatch = text.match(/kelas\s+(\d+)/i) || text.match(/grade\s+(\d+)/i);
  if (gradeMatch) {
    result.grade = gradeMatch[1];
  }
  const topicMatch = text.match(/tentang\s+([^,.;]+)/i) || text.match(/topik\s+([^,.;]+)/i);
  if (topicMatch) {
    result.topic = topicMatch[1].trim();
  }

  // Extract difficulty
  const difficultyMatch = text.match(/tingkat kesulitan\s+(mudah|sedang|sulit)/i) || text.match(/difficulty\s+(easy|medium|hard)/i);
  if (difficultyMatch) {
    result.difficulty = difficultyMatch[1].toLowerCase();
  }

  // Extract duration
  const durationMatch = text.match(/durasi\s+(\d+)\s*menit/i) || text.match(/duration\s+(\d+)\s*min/i);
  if (durationMatch) {
    result.durationMin = parseInt(durationMatch[1]);
  }

  // Extract title
  const titleMatch = text.match(/(judul\\s*:?\\s*([^,.;]+))/i);
  if (titleMatch) {
    result.title = titleMatch[1].trim();
  }
// Helper function to validate and convert raw AI output to Question object
function validateAndConvertQuestion(raw: any): Question | null {
  if (!raw || typeof raw !== "object") return null;

  const kind = String(raw.kind ?? "").trim();
  const format = String(raw.format ?? "").trim();
  const id = String(raw.id ?? "").trim();
  if (!id) return null;

  // Hydrate using the existing hydrateQuestion function, which will map kinds and formats
  // We need to adjust the raw object to match what hydrateQuestion expects
  const hydrated = hydrateQuestion({
    id,
    kind,
    format,
    text: String(raw.text ?? ""),
    story: String(raw.story ?? ""),
    image: (typeof raw.image === "string" && raw.image) ?? null,
    options: Array.isArray(raw.options) ? raw.options.map(o => String(o ?? "")) : [],
    correctIndex: Number.isInteger(Number(raw.correctIndex)) ? Number(raw.correctIndex) : 0,
    acceptedAnswers: Array.isArray(raw.acceptedAnswers) ? raw.acceptedAnswers.map(a => String(a ?? "")) : [],
    rubric: String(raw.rubric ?? ""),
    points: Number.isInteger(Number(raw.points)) && Number(raw.points) >= 1 ? Number(raw.points) : 1
  });

  // Additional validation per kind
  switch (hydrated.kind) {
    case "multiple_choice":
    case "true_false":
      if (hydrated.options.length < 2 || hydrated.options.length > 6) return null;
      if (hydrated.kind === "true_false") {
        if (hydrated.options.length !== 2 || 
            !hydrated.options.some(o => o.toLowerCase() === "benar") ||
            !hydrated.options.some(o => o.toLowerCase() === "salah")) {
          // Force to Benar/Salah if not provided
          hydrated.options = ["Benar", "Salah"];
        }
        if (hydrated.correctIndex !== 0 && hydrated.correctIndex !== 1) {
          hydrated.correctIndex = 0;
        }
      } else {
        if (hydrated.correctIndex < 0 || hydrated.correctIndex >= hydrated.options.length) {
          hydrated.correctIndex = 0;
        }
      }
      break;
    case "short_answer":
      if (hydrated.acceptedAnswers.length === 0) {
        hydrated.acceptedAnswers = [""];
      }
      if (hydrated.acceptedAnswers.length > 10) {
        hydrated.acceptedAnswers = hydrated.acceptedAnswers.slice(0, 10);
      }
      break;
    case "essay":
      if (hydrated.rubric === undefined) hydrated.rubric = "";
      break;
    case "story":
    case "story_image":
      if (hydrated.story.trim() === "") {
        // If story is empty, we might still accept it but it's not ideal
        // We'll leave it as is, but the sanitizeQuestions will catch it if required
      }
      break;
    case "image":
      if (!hydrated.image) {
        // Image is required for this kind
        return null;
      }
      break;
    default:
      // Unknown kind, treat as multiple_choice
      break;
  }

  return hydrated;
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
