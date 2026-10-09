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
  grade,
  num,
  publishProblem,
  sanitizeAnswers,
  sanitizeQuestions,
  toExam,
  toSummary,
  validateSlug,
  type Question,
  type AnswerValue,
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    return json(res, 500, { error: isConfig ? message : "Terjadi kesalahan server." });
  }
}

async function route(ctx: Ctx) {
  const { segs, method, res } = ctx;
  const [a, b, c, d] = segs;

  if (a === "auth") return authRoutes(ctx);

  if (a === "me" && method === "GET") {
    const user = await getSession(ctx.req);
    return json(res, 200, { user });
  }

  if (a === "public") return publicRoutes(ctx);

  // Semua route di bawah ini butuh login.
  const user = await requireUser(ctx.req);

  if (a === "dashboard" && method === "GET") return dashboard(ctx, user.id);

  if (a === "slug-check" && method === "GET") {
    const exclude = ctx.url.searchParams.get("exclude");
    return json(res, 200, await slugStatus(ctx.url.searchParams.get("slug"), exclude));
  }

  if (a === "exams") {
    if (!b) {
      if (method === "GET") {
        const rows = await q(`${SUMMARY_SQL} WHERE e.owner_id = $1 GROUP BY e.id ORDER BY e.updated_at DESC`, [user.id]);
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
       (SELECT count(*)::int FROM submissions s JOIN exams e ON e.id = s.exam_id WHERE e.owner_id = $1) AS participants,
       (SELECT count(*)::int FROM submissions s JOIN exams e ON e.id = s.exam_id
          WHERE e.owner_id = $1 AND s.started_at >= date_trunc('month', now())) AS participants_this_month,
       (SELECT round(avg(s.score)::numeric, 1) FROM submissions s JOIN exams e ON e.id = s.exam_id
          WHERE e.owner_id = $1 AND s.status = 'done') AS avg_score`,
    [userId],
  );

  const live = await q(
    `${SUMMARY_SQL} WHERE e.owner_id = $1 AND e.status = 'published' GROUP BY e.id ORDER BY e.published_at DESC NULLS LAST LIMIT 5`,
    [userId],
  );
  const recent = await q(`${SUMMARY_SQL} WHERE e.owner_id = $1 GROUP BY e.id ORDER BY e.updated_at DESC LIMIT 5`, [userId]);
  const activity = await q(
    `SELECT s.id, s.student_name, s.status, s.score, s.last_activity, s.submitted_at, e.title, e.id AS exam_id
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
    },
    live: live.map(toSummary),
    recent: recent.map(toSummary),
    activity: activity.map((row) => ({
      id: row.id,
      examId: row.exam_id,
      examTitle: row.title,
      studentName: row.student_name,
      status: row.status as "working" | "done",
      score: num(row.score),
      at: row.status === "done" ? row.submitted_at ?? row.last_activity : row.last_activity,
    })),
    serverNow: new Date().toISOString(),
  });
}

/* --------------------------------- Ulangan ------------------------------ */

async function loadExam(id: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "Ulangan tidak ditemukan.");
  const rows = await q("SELECT * FROM exams WHERE id = $1 AND owner_id = $2", [id, userId]);
  if (!rows[0]) throw new HttpError(404, "Ulangan tidak ditemukan.");
  const [count] = await q("SELECT count(*)::int AS n FROM submissions WHERE exam_id = $1", [id]);
  return { ...toExam(rows[0]), participants: Number(count.n) };
}

async function createExam(ctx: Ctx, userId: string) {
  const title = String(ctx.body.title ?? "").trim().slice(0, 120) || "Ulangan tanpa judul";
  const starter: Question[] = [
    { id: randomBytes(6).toString("hex"), type: "multiple_choice", text: "", options: ["", "", "", ""], correctIndex: 0, correctAnswer: null, imageUrl: null, required: true },
  ];
  const rows = await q(
    `INSERT INTO exams (owner_id, title, questions) VALUES ($1, $2, $3::jsonb) RETURNING id`,
    [userId, title, JSON.stringify(starter)],
  );
  return json(ctx.res, 201, { exam: await loadExam(rows[0].id, userId) });
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
  const allowRetakes = typeof body.allowRetakes === "boolean" ? body.allowRetakes : current.allowRetakes;

  let questions = current.questions;
  if (body.questions !== undefined) {
    const next = sanitizeQuestions(body.questions);
    if (current.participants > 0 && JSON.stringify(next) !== JSON.stringify(current.questions)) {
      throw new HttpError(409, "Soal terkunci karena sudah ada murid yang mengerjakan.");
    }
    questions = next;
  }

  await q(
    `UPDATE exams SET title = $1, class_name = $2, duration_min = $3, shuffle = $4, show_score = $5, allow_retakes = $6,
       questions = $7::jsonb, updated_at = now() WHERE id = $8 AND owner_id = $9`,
    [title, className, durationMin, shuffle, showScore, allowRetakes, JSON.stringify(questions), id, userId],
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
    `SELECT id, student_name, ip_masked, status, score, correct, total, gradable, attempt_no, answers, started_at, submitted_at, last_activity
     FROM submissions WHERE exam_id = $1 ORDER BY (status = 'done') DESC, score DESC NULLS LAST, started_at ASC`,
    [id],
  );

  const submissions = rows.map((row) => {
    const end = row.submitted_at ?? row.last_activity;
    const seconds = Math.max(0, Math.round((new Date(end).getTime() - new Date(row.started_at).getTime()) / 1000));
    const answers = (row.answers ?? {}) as Record<string, AnswerValue>;
    // Nilai sementara untuk murid yang masih mengerjakan.
    const live = row.status === "done" ? null : grade(exam.questions, answers);
    return {
      id: row.id as string,
      attemptNo: Number(row.attempt_no ?? 1),
      studentName: row.student_name as string,
      ipMasked: (row.ip_masked as string | null) ?? "•••",
      state: submissionState(row),
      score: row.status === "done" ? num(row.score) : live?.score ?? null,
      correct: row.status === "done" ? Number(row.correct) : live?.correct ?? 0,
      total: row.status === "done" ? Number(row.total) : exam.questions.length,
      gradable: row.status === "done" ? Number(row.gradable ?? row.total) : live?.gradable ?? exam.questions.filter((q) => q.type !== "essay").length,
      answered: Object.keys(answers).length,
      seconds,
      startedAt: row.started_at,
      lastActivity: row.status === "done" ? row.submitted_at : row.last_activity,
    };
  });

  const done = rows.filter((row) => row.status === "done");
  const scores = done.filter((row) => row.score !== null && row.score !== undefined).map((row) => Number(row.score));
  const avg = scores.length ? Math.round((scores.reduce((x, y) => x + y, 0) / scores.length) * 10) / 10 : null;
  const top = done.length ? done.reduce((best, row) => (Number(row.score) > Number(best.score) ? row : best)) : null;

  const buckets = [
    { label: "90–100", count: scores.filter((s) => s >= 90).length },
    { label: "80–89", count: scores.filter((s) => s >= 80 && s < 90).length },
    { label: "70–79", count: scores.filter((s) => s >= 70 && s < 80).length },
    { label: "60–69", count: scores.filter((s) => s >= 60 && s < 70).length },
    { label: "< 60", count: scores.filter((s) => s < 60).length },
  ];

  const questionStats = exam.questions.map((question, index) => {
    const correct = done.filter((row) => (row.answers ?? {})[question.id] === question.correctIndex).length;
    return {
      number: index + 1,
      text: question.text,
      correctRate: done.length ? Math.round((correct / done.length) * 100) : null,
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
      publishedAt: exam.publishedAt,
    },
    summary: {
      joined: rows.length,
      submitted: done.length,
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

/* ------------------------- Halaman publik (murid) ------------------------ */

function publicExam(row: Record<string, any>) {
  const exam = toExam(row);
  return {
    title: exam.title,
    className: exam.className,
    durationMin: exam.durationMin,
    shuffle: exam.shuffle,
    showScore: exam.showScore,
    allowRetakes: exam.allowRetakes,
    status: exam.status,
    // Kunci jawaban tidak pernah dikirim ke murid.
    questions: exam.questions.map(({ id, type, text, options, imageUrl, required }) => ({ id, type, text, options, imageUrl, required })),
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

function submissionPayload(row: Record<string, any>, showScore: boolean) {
  const done = row.status === "done";
  return {
    id: row.id as string,
    status: row.status as "working" | "done",
    startedAt: row.started_at,
    answers: (row.answers ?? {}) as Record<string, AnswerValue>,
    result: done
      ? { showScore, score: showScore ? num(row.score) : null, correct: showScore && row.correct !== null ? Number(row.correct) : null, total: Number(row.total), gradable: Number(row.gradable ?? row.total) }
      : null,
  };
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
    const working = await q("SELECT * FROM submissions WHERE exam_id = $1 AND device_id = $2 AND status = 'working' ORDER BY started_at DESC LIMIT 1", [row.id, deviceId]);
    if (working[0]) {
      await q("UPDATE submissions SET last_activity = now() WHERE id = $1", [working[0].id]);
      return json(res, 200, {
        exam: publicExam(row),
        submission: submissionPayload(working[0], row.show_score),
        serverNow: new Date().toISOString(),
      });
    }

    if (row.status !== "published") throw new HttpError(403, "Ulangan ini sudah ditutup.");
    const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 60) {
      const done = await q("SELECT * FROM submissions WHERE exam_id = $1 AND device_id = $2 AND status = 'done' ORDER BY attempt_no DESC LIMIT 1", [row.id, deviceId]);
      if (done[0] && !row.allow_retakes) return json(res, 200, { exam: publicExam(row), submission: submissionPayload(done[0], row.show_score), serverNow: new Date().toISOString() });
      throw new HttpError(400, "Nama harus 2–60 karakter.");
    }

    const [last] = await q("SELECT COALESCE(MAX(attempt_no), 0)::int AS n FROM submissions WHERE exam_id = $1 AND device_id = $2", [row.id, deviceId]);
    const attemptNo = Number(last?.n ?? 0) + 1;
    if (!row.allow_retakes && attemptNo > 1) {
      const done = await q("SELECT * FROM submissions WHERE exam_id = $1 AND device_id = $2 ORDER BY attempt_no DESC LIMIT 1", [row.id, deviceId]);
      return json(res, 200, { exam: publicExam(row), submission: submissionPayload(done[0], row.show_score), serverNow: new Date().toISOString() });
    }

    const inserted = await q(
      `INSERT INTO submissions (exam_id, student_name, device_id, ip_masked, attempt_no) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [row.id, name, deviceId, maskIp(getIp(req)), attemptNo],
    );
    return json(res, 200, {
      exam: publicExam(row),
      submission: submissionPayload(inserted[0], row.show_score),
      serverNow: new Date().toISOString(),
    });
  }

  if ((action === "save" || action === "submit") && method === "POST") {
    const row = await loadPublic(slug);
    const deviceId = deviceIdOf(body);
    const rows = await q("SELECT * FROM submissions WHERE exam_id = $1 AND device_id = $2 AND status = 'working' ORDER BY started_at DESC LIMIT 1", [row.id, deviceId]);
    const submission = rows[0];
    if (!submission) throw new HttpError(404, "Sesi pengerjaan tidak ditemukan.");
    const questions = (row.questions ?? []) as Question[];

    if (submission.status === "done") {
      if (action === "save") throw new HttpError(409, "Ulangan sudah dikumpulkan.");
      return json(res, 200, { submission: submissionPayload(submission, row.show_score) });
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
    const { total, gradable, correct, score } = grade(questions, answers);
    const updated = await q(
      `UPDATE submissions SET answers = $1::jsonb, score = $2, correct = $3, total = $4, gradable = $5,
         status = 'done', submitted_at = now(), last_activity = now()
       WHERE id = $5 AND status = 'working' RETURNING *`,
      [JSON.stringify(answers), score, correct, total, gradable, submission.id],
    );
    const final = updated[0] ?? (await q("SELECT * FROM submissions WHERE id = $1", [submission.id]))[0];
    return json(res, 200, { submission: submissionPayload(final, row.show_score) });
  }

  throw new HttpError(404, "Endpoint tidak ditemukan.");
}
