import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomBytes } from "node:crypto";
import { q } from "./_lib/db.js";
import { HttpError, getIp, getOrigin, json, maskIp, parseCookies, safeNext, serializeCookie } from "./_lib/http.js";
import {
  SESSION_COOKIE,
  STATE_COOKIE,
  assertSameOrigin,
  clearSessionCookie,
  createSessionCookie,
  getSession,
  requireUser,
  setCookie,
} from "./_lib/session.js";
import { buildAuthUrl, exchangeCode } from "./_lib/google.js";
import {
  SUMMARY_SQL,
  gradeSubmission,
  hydrateQuestions,
  num,
  publishProblem,
  sanitizeAnswers,
  sanitizeQuestions,
  toExam,
  toSummary,
  validateSlug,
  type Answers,
  type Question,
} from "./_lib/exams.js";

type Ctx = {
  req: VercelRequest;
  res: VercelResponse;
  url: URL;
  segs: string[];
  method: string;
  body: Record<string, any>;
  secure: boolean;
  origin: string;
};

const DISCONNECT_AFTER_MS = 90_000;

// Jangan biarkan promise yang gagal di mana pun mematikan seluruh fungsi (berujung 500 tanpa pesan).
const g = globalThis as { __ulanganku_guard?: boolean };
if (!g.__ulanganku_guard) {
  g.__ulanganku_guard = true;
  process.on("unhandledRejection", (reason) => console.error("unhandledRejection:", reason));
  process.on("uncaughtException", (error) => console.error("uncaughtException:", error));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await handle(req, res);
  } catch (fatal) {
    console.error("fatal:", fatal);
    if (!res.headersSent) {
      const message = fatal instanceof Error ? fatal.message : String(fatal);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "Terjadi kesalahan server.", detail: message.slice(0, 200) }));
    }
  }
}

async function handle(req: VercelRequest, res: VercelResponse) {
  try {
    assertSameOrigin(req);
    const origin = getOrigin(req);
    const url = new URL(req.url ?? "/", origin);
    // vercel.json mengarahkan semua /api/* ke fungsi ini dengan path asli di query "__p".
    const forwarded = url.searchParams.get("__p");
    url.searchParams.delete("__p");
    const rawPath = forwarded !== null ? `/api/${forwarded}` : url.pathname;
    const segs = rawPath
      .replace(/^\/api\/?/, "")
      .split("/")
      .filter(Boolean)
      .map(decodeURIComponent);
    const ctx: Ctx = {
      req,
      res,
      url,
      segs,
      method: (req.method ?? "GET").toUpperCase(),
      body: req.body && typeof req.body === "object" ? req.body : {},
      secure: origin.startsWith("https://"),
      origin,
    };
    await route(ctx);
  } catch (error) {
    if (error instanceof HttpError) {
      return json(res, error.status, { error: error.message });
    }
    console.error(error);
    const message = error instanceof Error ? error.message : "Terjadi kesalahan server.";
    const isConfig = /belum diatur/.test(message);
    // Detail teknis hanya dikirim ke pengguna yang sedang login (guru), agar mudah ditelusuri.
    const session = await getSession(req).catch(() => null);
    return json(res, 500, {
      error: isConfig ? message : "Terjadi kesalahan server.",
      ...(session && !isConfig ? { detail: message.slice(0, 300) } : {}),
    });
  }
}

async function route(ctx: Ctx) {
  const { segs, method, res } = ctx;
  const [a, b, c, d] = segs;

  if (a === "auth") return authRoutes(ctx);

  if (a === "health" && method === "GET") {
    const started = Date.now();
    let db: Record<string, unknown>;
    try {
      const [meta] = await q("SELECT version FROM schema_meta WHERE id = 1");
      db = { ok: true, schemaVersion: meta ? Number(meta.version) : null, ms: Date.now() - started };
    } catch (error) {
      db = { ok: false, error: error instanceof Error ? error.message.slice(0, 200) : "error" };
    }
    return json(res, 200, { ok: true, node: process.version, region: process.env.VERCEL_REGION ?? null, db });
  }

  if (a === "me" && method === "GET") {
    const user = await getSession(ctx.req);
    return json(res, 200, { user });
  }

  if (a === "public") return publicRoutes(ctx);
  if (a === "img" && b && method === "GET") return serveImage(ctx, b);

  // Semua route di bawah ini butuh login.
  const user = await requireUser(ctx.req);

  if (a === "images" && !b && method === "POST") return uploadImage(ctx, user.id);

  if (a === "dashboard" && method === "GET") return dashboard(ctx, user.id);

  if (a === "slug-check" && method === "GET") {
    const exclude = ctx.url.searchParams.get("exclude");
    return json(res, 200, await slugStatus(ctx.url.searchParams.get("slug"), exclude));
  }

  if (a === "exams") {
    if (!b) {
      if (method === "GET") {
        const rows = await q(`${SUMMARY_SQL} WHERE e.owner_id = $1 ORDER BY e.updated_at DESC`, [user.id]);
        return json(res, 200, { exams: rows.map(toSummary) });
      }
      if (method === "POST") return createExam(ctx, user.id);
    } else if (!c) {
      if (method === "GET") return json(res, 200, { exam: await loadExam(b, user.id) });
      if (method === "PUT") return updateExam(ctx, b, user.id);
      if (method === "DELETE") {
        await loadExam(b, user.id);
        await q("DELETE FROM exams WHERE id = $1 AND owner_id = $2", [b, user.id]);
        return json(res, 200, { ok: true });
      }
    } else if (!d) {
      if (c === "publish" && method === "POST") return publishExam(ctx, b, user.id);
      if (c === "close" && method === "POST") {
        await loadExam(b, user.id);
        await q("UPDATE exams SET status = 'closed', updated_at = now() WHERE id = $1", [b]);
        return json(res, 200, { exam: await loadExam(b, user.id) });
      }
      if (c === "results" && method === "GET") return results(ctx, b, user.id);
    } else if (c === "submissions" && d) {
      if (segs[4] === "grade" && method === "PUT") return gradeEssays(ctx, b, d, user.id);
      if (!segs[4] && method === "GET") return submissionDetail(ctx, b, d, user.id);
    }
  }

  throw new HttpError(404, "Endpoint tidak ditemukan.");
}

/* ----------------------------- Autentikasi ----------------------------- */

async function authRoutes(ctx: Ctx) {
  const { segs, method, res, req, secure, origin } = ctx;
  const redirectUri = `${origin}/api/auth/google/callback`;

  if (segs[1] === "google" && !segs[2] && method === "GET") {
    const state = randomBytes(24).toString("hex");
    const next = safeNext(ctx.url.searchParams.get("next"));
    res.setHeader("Set-Cookie", serializeCookie(STATE_COOKIE, `${state}|${next}`, { maxAge: 600, secure }));
    return res.redirect(302, buildAuthUrl(redirectUri, state));
  }

  if (segs[1] === "google" && segs[2] === "callback" && method === "GET") {
    const cookies = parseCookies(req);
    const [expectedState, next] = (cookies[STATE_COOKIE] ?? "").split("|");
    const state = ctx.url.searchParams.get("state");
    const code = ctx.url.searchParams.get("code");
    const clearState = serializeCookie(STATE_COOKIE, "", { maxAge: 0, secure });

    if (ctx.url.searchParams.get("error") || !code || !state || !expectedState || state !== expectedState) {
      res.setHeader("Set-Cookie", clearState);
      return res.redirect(302, "/login?error=oauth");
    }

    try {
      const profile = await exchangeCode(code, redirectUri);
      await q(
        `INSERT INTO users (id, email, name, picture) VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, picture = EXCLUDED.picture`,
        [profile.id, profile.email, profile.name, profile.picture],
      );
      const session = await createSessionCookie(profile, secure);
      setCookie(res, session, clearState);
      return res.redirect(302, safeNext(next));
    } catch (error) {
      console.error(error);
      res.setHeader("Set-Cookie", clearState);
      return res.redirect(302, "/login?error=oauth");
    }
  }

  if (segs[1] === "logout" && method === "POST") {
    res.setHeader("Set-Cookie", clearSessionCookie(secure));
    return json(res, 200, { ok: true });
  }

  throw new HttpError(404, "Endpoint tidak ditemukan.");
}

/* ------------------------------- Dashboard ------------------------------ */

async function dashboard(ctx: Ctx, userId: string) {
  const [stats] = await q(
    `SELECT
       (SELECT count(*)::int FROM exams WHERE owner_id = $1) AS total_exams,
       (SELECT count(*)::int FROM exams WHERE owner_id = $1 AND created_at >= date_trunc('month', now())) AS exams_this_month,
       (SELECT count(*)::int FROM exams WHERE owner_id = $1 AND status = 'published') AS active_exams,
       (SELECT count(*)::int FROM (
          SELECT DISTINCT s.exam_id, s.device_id FROM submissions s JOIN exams e ON e.id = s.exam_id WHERE e.owner_id = $1
        ) p) AS participants,
       (SELECT count(*)::int FROM (
          SELECT DISTINCT s.exam_id, s.device_id FROM submissions s JOIN exams e ON e.id = s.exam_id
          WHERE e.owner_id = $1 AND s.started_at >= date_trunc('month', now())
        ) p) AS participants_this_month,
       (SELECT round(avg(b.best)::numeric, 1) FROM (
          SELECT max(s.score) AS best FROM submissions s JOIN exams e ON e.id = s.exam_id
          WHERE e.owner_id = $1 AND s.status = 'done' GROUP BY s.exam_id, s.device_id
        ) b) AS avg_score,
       (SELECT count(*)::int FROM submissions s JOIN exams e ON e.id = s.exam_id
          WHERE e.owner_id = $1 AND s.status = 'done' AND s.pending > 0) AS pending_review`,
    [userId],
  );

  const live = await q(
    `${SUMMARY_SQL} WHERE e.owner_id = $1 AND e.status = 'published' ORDER BY e.published_at DESC NULLS LAST LIMIT 5`,
    [userId],
  );
  const recent = await q(`${SUMMARY_SQL} WHERE e.owner_id = $1 ORDER BY e.updated_at DESC LIMIT 5`, [userId]);
  const activity = await q(
    `SELECT s.id, s.student_name, s.status, s.score, s.attempt, s.last_activity, s.submitted_at, e.title, e.id AS exam_id
     FROM submissions s JOIN exams e ON e.id = s.exam_id
     WHERE e.owner_id = $1 ORDER BY s.last_activity DESC LIMIT 8`,
    [userId],
  );

  return json(ctx.res, 200, {
    stats: {
      totalExams: Number(stats.total_exams),
      examsThisMonth: Number(stats.exams_this_month),
      activeExams: Number(stats.active_exams),
      participants: Number(stats.participants),
      participantsThisMonth: Number(stats.participants_this_month),
      avgScore: num(stats.avg_score),
      pendingReview: Number(stats.pending_review),
    },
    live: live.map(toSummary),
    recent: recent.map(toSummary),
    activity: activity.map((row) => ({
      id: row.id,
      examId: row.exam_id,
      examTitle: row.title,
      studentName: row.student_name,
      attempt: Number(row.attempt),
      status: row.status as "working" | "done",
      score: num(row.score),
      at: row.status === "done" ? row.submitted_at ?? row.last_activity : row.last_activity,
    })),
    serverNow: new Date().toISOString(),
  });
}

/* --------------------------------- Gambar ------------------------------- */

const IMAGE_MAX_BYTES = 1_500_000;
const IMAGE_QUOTA = 400;

function detectMime(buffer: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buffer.length > 12 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length > 12 && buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

async function uploadImage(ctx: Ctx, userId: string) {
  const dataUrl = String(ctx.body.dataUrl ?? "");
  const match = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new HttpError(400, "Format gambar harus JPG, PNG, atau WebP.");
  const buffer = Buffer.from(match[1], "base64");
  if (buffer.length > IMAGE_MAX_BYTES) throw new HttpError(413, "Ukuran gambar maksimal 1,5 MB.");
  const mime = detectMime(buffer);
  if (!mime) throw new HttpError(400, "File bukan gambar yang valid.");

  const [count] = await q("SELECT count(*)::int AS n FROM images WHERE owner_id = $1", [userId]);
  if (Number(count.n) >= IMAGE_QUOTA) throw new HttpError(400, "Batas jumlah gambar tercapai.");

  const rows = await q("INSERT INTO images (owner_id, mime, data, size) VALUES ($1, $2, $3, $4) RETURNING id", [
    userId,
    mime,
    match[1],
    buffer.length,
  ]);
  return json(ctx.res, 201, { url: `/api/img/${rows[0].id}` });
}

async function serveImage(ctx: Ctx, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "Gambar tidak ditemukan.");
  const rows = await q("SELECT mime, data FROM images WHERE id = $1", [id]);
  if (!rows[0]) throw new HttpError(404, "Gambar tidak ditemukan.");
  const { res } = ctx;
  res.status(200);
  res.setHeader("Content-Type", rows[0].mime);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(Buffer.from(rows[0].data, "base64"));
}

/* --------------------------------- Ulangan ------------------------------ */

async function loadExam(id: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "Ulangan tidak ditemukan.");
  const rows = await q(
    `SELECT e.*, (SELECT count(*)::int FROM submissions s WHERE s.exam_id = e.id) AS participants_n
     FROM exams e WHERE e.id = $1 AND e.owner_id = $2`,
    [id, userId],
  );
  if (!rows[0]) throw new HttpError(404, "Ulangan tidak ditemukan.");
  return { ...toExam(rows[0]), participants: Number(rows[0].participants_n) };
}

async function createExam(ctx: Ctx, userId: string) {
  const title = String(ctx.body.title ?? "").trim().slice(0, 120) || "Ulangan tanpa judul";
  const starter: Question[] = [
    {
      id: randomBytes(6).toString("hex"),
      kind: "multiple_choice",
      format: "multiple_choice",
      text: "",
      story: "",
      image: null,
      options: ["", "", "", ""],
      correctIndex: 0,
      acceptedAnswers: [],
      rubric: "",
      points: 1,
    },
  ];
  const rows = await q(
    `INSERT INTO exams (owner_id, title, questions) VALUES ($1, $2, $3::jsonb) RETURNING *`,
    [userId, title, JSON.stringify(starter)],
  );
  return json(ctx.res, 201, { exam: { ...toExam(rows[0]), participants: 0 } });
}

async function assertOwnImages(questions: Question[], userId: string) {
  const ids = [
    ...new Set(
      questions
        .map((question) => question.image?.replace("/api/img/", "").toLowerCase())
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (ids.length === 0) return;
  const placeholders = ids.map((_, i) => `$${i + 2}`).join(", ");
  const rows = await q(`SELECT id FROM images WHERE owner_id = $1 AND id::text IN (${placeholders})`, [userId, ...ids]);
  if (rows.length !== ids.length) throw new HttpError(400, "Ada gambar soal yang tidak ditemukan. Unggah ulang gambarnya.");
}

async function updateExam(ctx: Ctx, id: string, userId: string) {
  const current = await loadExam(id, userId);
  const body = ctx.body;

  const title = String(body.title ?? current.title).trim().slice(0, 120);
  if (!title) throw new HttpError(400, "Judul ulangan wajib diisi.");
  const className = String(body.className ?? current.className).trim().slice(0, 40);
  const durationMin = Number(body.durationMin ?? current.durationMin);
  if (!Number.isInteger(durationMin) || durationMin < 1 || durationMin > 600) {
    throw new HttpError(400, "Durasi harus antara 1 dan 600 menit.");
  }
  const shuffle = typeof body.shuffle === "boolean" ? body.shuffle : current.shuffle;
  const showScore = typeof body.showScore === "boolean" ? body.showScore : current.showScore;
  const allowRetake = typeof body.allowRetake === "boolean" ? body.allowRetake : current.allowRetake;
  const maxAttempts = Number(body.maxAttempts ?? current.maxAttempts);
  if (!Number.isInteger(maxAttempts) || maxAttempts < 0 || maxAttempts > 99) {
    throw new HttpError(400, "Maksimal percobaan harus 0 (tanpa batas) sampai 99.");
  }

  let questions = current.questions;
  if (body.questions !== undefined) {
    const next = sanitizeQuestions(body.questions);
    if (current.participants > 0 && JSON.stringify(next) !== JSON.stringify(current.questions)) {
      throw new HttpError(409, "Soal terkunci karena sudah ada murid yang mengerjakan.");
    }
    await assertOwnImages(next, userId);
    questions = next;
  }

  await q(
    `UPDATE exams SET title = $1, class_name = $2, duration_min = $3, shuffle = $4, show_score = $5,
       allow_retake = $6, max_attempts = $7, questions = $8::jsonb, updated_at = now() WHERE id = $9 AND owner_id = $10`,
    [title, className, durationMin, shuffle, showScore, allowRetake, maxAttempts, JSON.stringify(questions), id, userId],
  );
  return json(ctx.res, 200, { exam: await loadExam(id, userId) });
}

async function slugStatus(rawSlug: string | null, excludeId: string | null) {
  try {
    const slug = validateSlug(rawSlug);
    const rows = await q("SELECT id FROM exams WHERE slug = $1", [slug]);
    const taken = rows.length > 0 && rows[0].id !== excludeId;
    return taken
      ? { available: false, slug, reason: "URL ini sudah dipakai." }
      : { available: true, slug, reason: null };
  } catch (error) {
    if (error instanceof HttpError) return { available: false, slug: rawSlug, reason: error.message };
    throw error;
  }
}

async function publishExam(ctx: Ctx, id: string, userId: string) {
  const exam = await loadExam(id, userId);
  const problem = publishProblem(exam.questions);
  if (problem) throw new HttpError(422, problem);

  // URL dikunci setelah pertama kali dipublish agar tautan yang sudah dibagikan tidak berubah.
  const slug = exam.slug && exam.publishedAt ? exam.slug : validateSlug(ctx.body.slug);

  try {
    await q(
      `UPDATE exams SET status = 'published', slug = $1, published_at = COALESCE(published_at, now()), updated_at = now()
       WHERE id = $2 AND owner_id = $3`,
      [slug, id, userId],
    );
  } catch (error: any) {
    if (error?.code === "23505" || /unique/i.test(String(error?.message))) {
      throw new HttpError(409, "URL ini sudah dipakai ulangan lain.");
    }
    throw error;
  }
  return json(ctx.res, 200, { exam: await loadExam(id, userId), url: `${ctx.origin}/${slug}` });
}

/* --------------------------------- Hasil -------------------------------- */

function submissionState(row: Record<string, any>): "done" | "working" | "disconnected" {
  if (row.status === "done") return "done";
  const idle = Date.now() - new Date(row.last_activity).getTime();
  return idle > DISCONNECT_AFTER_MS ? "disconnected" : "working";
}

async function results(ctx: Ctx, id: string, userId: string) {
  const exam = await loadExam(id, userId);
  const rows = await q(
    `SELECT id, student_name, device_id, attempt, ip_masked, status, score, correct, total, pending, answers, grades,
            started_at, submitted_at, last_activity
     FROM submissions WHERE exam_id = $1
     ORDER BY (status = 'done') DESC, score DESC NULLS LAST, started_at ASC`,
    [id],
  );

  const submissions = rows.map((row) => {
    const end = row.submitted_at ?? row.last_activity;
    const seconds = Math.max(0, Math.round((new Date(end).getTime() - new Date(row.started_at).getTime()) / 1000));
    const answers = (row.answers ?? {}) as Answers;
    // Nilai sementara untuk murid yang masih mengerjakan.
    const live = row.status === "done" ? null : gradeSubmission(exam.questions, answers);
    return {
      id: row.id as string,
      studentName: row.student_name as string,
      attempt: Number(row.attempt),
      ipMasked: (row.ip_masked as string | null) ?? "•••",
      state: submissionState(row),
      score: row.status === "done" ? num(row.score) : live?.score ?? 0,
      correct: row.status === "done" ? Number(row.correct) : live?.correct ?? 0,
      total: row.status === "done" ? Number(row.total) : exam.questions.length,
      pending: row.status === "done" ? Number(row.pending) : 0,
      answered: Object.keys(answers).length,
      seconds,
      startedAt: row.started_at,
      lastActivity: row.status === "done" ? row.submitted_at : row.last_activity,
    };
  });

  // Statistik memakai nilai tertinggi tiap perangkat.
  const doneRows = rows.filter((row) => row.status === "done");
  const bestByDevice = new Map<string, Record<string, any>>();
  for (const row of doneRows) {
    const best = bestByDevice.get(row.device_id);
    if (!best || Number(row.score) > Number(best.score) || (Number(row.score) === Number(best.score) && row.attempt > best.attempt)) {
      bestByDevice.set(row.device_id, row);
    }
  }
  const best = [...bestByDevice.values()];
  const scores = best.map((row) => Number(row.score));
  const avg = scores.length ? Math.round((scores.reduce((x, y) => x + y, 0) / scores.length) * 10) / 10 : null;
  const top = best.length ? best.reduce((a, b) => (Number(b.score) > Number(a.score) ? b : a)) : null;
  const joined = new Set(rows.map((row) => row.device_id)).size;

  const buckets = [
    { label: "90–100", count: scores.filter((s) => s >= 90).length },
    { label: "80–89", count: scores.filter((s) => s >= 80 && s < 90).length },
    { label: "70–79", count: scores.filter((s) => s >= 70 && s < 80).length },
    { label: "60–69", count: scores.filter((s) => s >= 60 && s < 70).length },
    { label: "< 60", count: scores.filter((s) => s < 60).length },
  ];

  const graded = best.map((row) => gradeSubmission(exam.questions, (row.answers ?? {}) as Answers, (row.grades ?? {}) as Record<string, number>));
  const questionStats = exam.questions.map((question, index) => {
    const relevant = graded.filter((g) => g.detail[question.id].status !== "pending");
    const correct = relevant.filter((g) => g.detail[question.id].status === "correct").length;
    return {
      number: index + 1,
      text: question.text,
      correctRate: relevant.length ? Math.round((correct / relevant.length) * 100) : null,
    };
  });
  const hardest = questionStats
    .filter((item) => item.correctRate !== null)
    .sort((x, y) => (x.correctRate as number) - (y.correctRate as number))[0] ?? null;

  return json(ctx.res, 200, {
    exam: {
      id: exam.id,
      title: exam.title,
      className: exam.className,
      durationMin: exam.durationMin,
      status: exam.status,
      slug: exam.slug,
      questionCount: exam.questions.length,
      allowRetake: exam.allowRetake,
      maxAttempts: exam.maxAttempts,
      hasEssay: exam.questions.some((question) => question.format === "essay"),
      publishedAt: exam.publishedAt,
    },
    summary: {
      joined,
      submitted: best.length,
      attempts: rows.length,
      pendingReview: doneRows.filter((row) => Number(row.pending) > 0).length,
      avgScore: avg,
      topScore: top ? Number(top.score) : null,
      topStudent: top ? (top.student_name as string) : null,
    },
    distribution: buckets,
    hardest,
    submissions,
    serverNow: new Date().toISOString(),
  });
}

async function loadSubmission(examId: string, submissionId: string, userId: string) {
  const exam = await loadExam(examId, userId);
  if (!/^[0-9a-f-]{36}$/i.test(submissionId)) throw new HttpError(404, "Jawaban tidak ditemukan.");
  const rows = await q("SELECT * FROM submissions WHERE id = $1 AND exam_id = $2", [submissionId, examId]);
  if (!rows[0]) throw new HttpError(404, "Jawaban tidak ditemukan.");
  return { exam, row: rows[0] };
}

function detailPayload(exam: Awaited<ReturnType<typeof loadExam>>, row: Record<string, any>) {
  const answers = (row.answers ?? {}) as Answers;
  const grades = (row.grades ?? {}) as Record<string, number>;
  const result = gradeSubmission(exam.questions, answers, grades);
  return {
    submission: {
      id: row.id as string,
      studentName: row.student_name as string,
      attempt: Number(row.attempt),
      status: row.status as "working" | "done",
      score: result.score,
      earned: result.earned,
      maxPoints: result.max,
      pending: row.status === "done" ? result.pending : 0,
      answers,
      grades,
      detail: result.detail,
    },
    questions: exam.questions,
  };
}

async function submissionDetail(ctx: Ctx, examId: string, submissionId: string, userId: string) {
  const { exam, row } = await loadSubmission(examId, submissionId, userId);
  return json(ctx.res, 200, detailPayload(exam, row));
}

async function gradeEssays(ctx: Ctx, examId: string, submissionId: string, userId: string) {
  const { exam, row } = await loadSubmission(examId, submissionId, userId);
  if (row.status !== "done") throw new HttpError(409, "Murid belum mengumpulkan jawaban.");

  const incoming = ctx.body.grades;
  if (!incoming || typeof incoming !== "object") throw new HttpError(400, "Data nilai tidak valid.");
  const grades: Record<string, number> = { ...((row.grades ?? {}) as Record<string, number>) };

  for (const [questionId, value] of Object.entries(incoming as Record<string, unknown>)) {
    const question = exam.questions.find((item) => item.id === questionId);
    if (!question || question.format !== "essay") throw new HttpError(400, "Hanya soal uraian yang bisa dinilai manual.");
    const points = Number(value);
    if (!Number.isFinite(points) || points < 0 || points > question.points) {
      throw new HttpError(400, `Nilai soal uraian harus antara 0 dan ${question.points}.`);
    }
    grades[questionId] = Math.round(points * 100) / 100;
  }

  const result = gradeSubmission(exam.questions, (row.answers ?? {}) as Answers, grades);
  const updated = await q(
    `UPDATE submissions SET grades = $1::jsonb, score = $2, correct = $3, total = $4, pending = $5
     WHERE id = $6 RETURNING *`,
    [JSON.stringify(grades), result.score, result.correct, result.total, result.pending, submissionId],
  );
  return json(ctx.res, 200, detailPayload(exam, updated[0]));
}

/* ------------------------- Halaman publik (murid) ------------------------ */

function publicExam(row: Record<string, any>) {
  const exam = toExam(row);
  return {
    title: exam.title,
    className: exam.className,
    durationMin: exam.durationMin,
    shuffle: exam.shuffle,
    showScore: exam.showScore,
    allowRetake: exam.allowRetake,
    maxAttempts: exam.maxAttempts,
    status: exam.status,
    // Kunci jawaban, jawaban benar, dan rubrik tidak pernah dikirim ke murid.
    questions: exam.questions.map((q) => ({
      id: q.id,
      kind: q.kind,
      format: q.format,
      text: q.text,
      story: q.story,
      image: q.image,
      options: q.format === "multiple_choice" || q.format === "true_false" ? q.options : [],
      points: q.points,
    })),
  };
}

async function loadPublic(slug: string) {
  const rows = await q("SELECT * FROM exams WHERE slug = $1 AND published_at IS NOT NULL", [slug]);
  if (!rows[0]) throw new HttpError(404, "Ulangan tidak ditemukan.");
  return rows[0];
}

function deviceIdOf(body: Record<string, any>) {
  const id = String(body.deviceId ?? "");
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) throw new HttpError(400, "Perangkat tidak valid.");
  return id;
}

function canRetake(exam: Record<string, any>, latest: Record<string, any>) {
  if (!exam.allow_retake || exam.status !== "published") return false;
  const max = Number(exam.max_attempts ?? 0);
  return max === 0 || Number(latest.attempt) < max;
}

function submissionPayload(row: Record<string, any>, exam: Record<string, any>) {
  const done = row.status === "done";
  const max = Number(exam.max_attempts ?? 0);
  const showScore = Boolean(exam.show_score);
  return {
    id: row.id as string,
    status: row.status as "working" | "done",
    attempt: Number(row.attempt),
    startedAt: row.started_at,
    answers: (row.answers ?? {}) as Answers,
    canRetake: done && canRetake(exam, row),
    attemptsLeft: exam.allow_retake && max > 0 ? Math.max(0, max - Number(row.attempt)) : null,
    result: done
      ? {
          showScore,
          score: showScore ? num(row.score) : null,
          correct: showScore ? Number(row.correct) : null,
          total: Number(row.total),
          pending: Number(row.pending ?? 0),
        }
      : null,
  };
}

async function latestSubmission(examId: string, deviceId: string) {
  const rows = await q("SELECT * FROM submissions WHERE exam_id = $1 AND device_id = $2 ORDER BY attempt DESC LIMIT 1", [
    examId,
    deviceId,
  ]);
  return rows[0] as Record<string, any> | undefined;
}

async function publicRoutes(ctx: Ctx) {
  const { segs, method, res, req, body } = ctx;
  const slug = (segs[1] ?? "").toLowerCase();
  if (!slug) throw new HttpError(404, "Ulangan tidak ditemukan.");
  const action = segs[2];

  if (!action && method === "GET") {
    const row = await loadPublic(slug);
    return json(res, 200, { exam: publicExam(row), serverNow: new Date().toISOString() });
  }

  if (action === "start" && method === "POST") {
    const row = await loadPublic(slug);
    const deviceId = deviceIdOf(body);
    const reply = (submission: Record<string, any>) =>
      json(res, 200, {
        exam: publicExam(row),
        submission: submissionPayload(submission, row),
        serverNow: new Date().toISOString(),
      });

    const latest = await latestSubmission(row.id, deviceId);

    if (latest) {
      if (latest.status === "working") {
        await q("UPDATE submissions SET last_activity = now() WHERE id = $1", [latest.id]);
        return reply(latest);
      }
      if (body.retake === true) {
        if (!canRetake(row, latest)) throw new HttpError(403, "Kamu tidak bisa mengulang ulangan ini lagi.");
        await q(
          `INSERT INTO submissions (exam_id, student_name, device_id, ip_masked, attempt) VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (exam_id, device_id, attempt) DO NOTHING`,
          [row.id, latest.student_name, deviceId, maskIp(getIp(req)), Number(latest.attempt) + 1],
        );
        return reply((await latestSubmission(row.id, deviceId)) as Record<string, any>);
      }
      return reply(latest);
    }

    if (row.status !== "published") throw new HttpError(403, "Ulangan ini sudah ditutup.");
    const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 60) throw new HttpError(400, "Nama harus 2–60 karakter.");

    await q(
      `INSERT INTO submissions (exam_id, student_name, device_id, ip_masked) VALUES ($1, $2, $3, $4)
       ON CONFLICT (exam_id, device_id, attempt) DO NOTHING`,
      [row.id, name, deviceId, maskIp(getIp(req))],
    );
    return reply((await latestSubmission(row.id, deviceId)) as Record<string, any>);
  }

  if ((action === "save" || action === "submit") && method === "POST") {
    const row = await loadPublic(slug);
    const deviceId = deviceIdOf(body);
    const submission = await latestSubmission(row.id, deviceId);
    if (!submission) throw new HttpError(404, "Sesi pengerjaan tidak ditemukan.");
    const questions = hydrateQuestions(row.questions);

    if (submission.status === "done") {
      if (action === "save") throw new HttpError(409, "Ulangan sudah dikumpulkan.");
      return json(res, 200, { submission: submissionPayload(submission, row) });
    }

    const incoming = sanitizeAnswers(body.answers, questions);

    if (action === "save") {
      await q("UPDATE submissions SET answers = $1::jsonb, last_activity = now() WHERE id = $2", [
        JSON.stringify(incoming),
        submission.id,
      ]);
      return json(res, 200, { ok: true, serverNow: new Date().toISOString() });
    }

    // Submit: jawaban terakhir dari klien hanya dipakai bila masih dalam batas waktu (+90 detik toleransi).
    const deadline = new Date(submission.started_at).getTime() + Number(row.duration_min) * 60_000 + 90_000;
    const answers = Date.now() <= deadline ? incoming : sanitizeAnswers(submission.answers, questions);
    const result = gradeSubmission(questions, answers);
    const updated = await q(
      `UPDATE submissions SET answers = $1::jsonb, score = $2, correct = $3, total = $4, pending = $5,
         status = 'done', submitted_at = now(), last_activity = now()
       WHERE id = $6 AND status = 'working' RETURNING *`,
      [JSON.stringify(answers), result.score, result.correct, result.total, result.pending, submission.id],
    );
    const final = updated[0] ?? (await latestSubmission(row.id, deviceId));
    return json(res, 200, { submission: submissionPayload(final as Record<string, any>, row) });
  }

  throw new HttpError(404, "Endpoint tidak ditemukan.");
}
