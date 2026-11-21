import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Brand, Icon } from "../components/Icon";
import { Modal, Spinner } from "../components/ui";
import { api, ApiError, type Answers, type AnswerValue, type PublicExam as PublicExamData, type PublicQuestion, type PublicSubmission } from "../lib/api";
import { getFormatLabel } from "../lib/questions";
import { formatClock } from "../lib/format";
import { uid, useTitle } from "../lib/hooks";
import { usePreferences } from "../lib/preferences";
import NotFound from "./NotFound";

type Phase = "loading" | "notfound" | "closed" | "intro" | "exam" | "result" | "error";

function getDeviceId() {
  const key = "ulanganku_device_id";
  try {
    let value = localStorage.getItem(key);
    if (!value || !/^[A-Za-z0-9_-]{8,64}$/.test(value)) {
      value = uid() + uid();
      localStorage.setItem(key, value);
    }
    return value;
  } catch {
    return uid() + uid();
  }
}

function seededShuffle<T>(items: T[], seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const random = () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function PublicExam({ slug }: { slug: string }) {
  const { t } = usePreferences();
  const [phase, setPhase] = useState<Phase>("loading");
  const [exam, setExam] = useState<PublicExamData | null>(null);
  const [submission, setSubmission] = useState<PublicSubmission | null>(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const deviceId = useMemo(getDeviceId, []);
  const updateSubmission = useCallback((next: PublicSubmission) => setSubmission(next), []);

  const brand = exam?.brand ?? null;
  const brandName = brand?.name || "Ulanganku";
  useTitle(exam ? `${exam.title} - ${brandName}` : `${t("Ulangan", "Exam")} - Ulanganku`, true);

  // Ikon tab browser mengikuti logo sekolah (PRO), dan dikembalikan saat halaman ditutup.
  const logo = brand?.logo ?? null;
  useEffect(() => {
    if (!logo) return;
    const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (!link) return;
    const previous = link.href;
    link.href = logo;
    return () => {
      link.href = previous;
    };
  }, [logo]);

  // Warna aksen PRO hanya berlaku di halaman ulangan ini.
  const brandStyle: CSSProperties | undefined = brand?.accent && /^#[0-9a-f]{6}$/i.test(brand.accent)
    ? ({
        "--brand": brand.accent,
        "--brand-fill": brand.accent,
        "--brand-hover": `color-mix(in srgb, ${brand.accent} 85%, black)`,
        "--brand-soft": `color-mix(in srgb, ${brand.accent} 12%, white)`,
      } as CSSProperties)
    : undefined;

  const applyStart = useCallback((data: { exam: PublicExamData; submission: PublicSubmission; serverNow: string }) => {
    setExam(data.exam);
    setSubmission(data.submission);
    setOffset(new Date(data.serverNow).getTime() - Date.now());
    setPhase(data.submission.status === "done" ? "result" : "exam");
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const info = await api<{ exam: PublicExamData }>(`/public/${encodeURIComponent(slug)}`);
        if (!active) return;
        setExam(info.exam);
        try {
          const started = await api<{ exam: PublicExamData; submission: PublicSubmission; serverNow: string }>(
            `/public/${encodeURIComponent(slug)}/start`,
            { body: { deviceId } },
          );
          if (active) applyStart(started);
        } catch (err) {
          if (!active) return;
          const status = (err as ApiError).status;
          if (status === 403) setPhase("closed");
          else if (status === 400) setPhase("intro");
          else throw err;
        }
      } catch (err) {
        if (!active) return;
        if ((err as ApiError).status === 404) setPhase("notfound");
        else {
          setError((err as Error).message);
          setPhase("error");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [slug, deviceId, applyStart]);

  if (phase === "notfound") {
    return <NotFound title={t("Ulangan tidak ditemukan", "Exam not found")} text={t("Tautan ini tidak aktif atau sudah dihapus oleh guru. Periksa kembali tautan yang kamu terima.", "This link is inactive or was deleted by the teacher. Please check the link you received.")} />;
  }

  return (
    <div className="student-page" style={brandStyle}>
      <header className="student-header">
        <div className="student-container student-header-inner">
          <Brand size={24} name={brandName} logo={logo} />
        </div>
      </header>

      <main className="student-container">
        {exam?.banner && phase === "intro" && <img className="exam-banner" src={exam.banner} alt="" />}
        {phase === "loading" && <Spinner />}

        {phase === "error" && (
          <div className="student-card center">
            <div className="empty-icon empty-icon-danger"><Icon name="alert" size={22} /></div>
            <h1>{t("Gagal memuat ulangan", "Failed to load exam")}</h1>
            <p>{error}</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>{t("Muat ulang", "Reload")}</button>
          </div>
        )}

        {phase === "closed" && exam && (
          <div className="student-card center">
            <div className="empty-icon"><Icon name="lock" size={22} /></div>
            <h1>{exam.title}</h1>
            <p>{t("Ulangan ini sudah ditutup oleh guru, jadi belum bisa dikerjakan.", "This exam has been closed by the teacher.")}</p>
          </div>
        )}

        {phase === "intro" && exam && (
          <Intro
            exam={exam}
            onStart={async (name) => {
              const started = await api<{ exam: PublicExamData; submission: PublicSubmission; serverNow: string }>(
                `/public/${encodeURIComponent(slug)}/start`,
                { body: { deviceId, name } },
              );
              applyStart(started);
            }}
          />
        )}

        {phase === "exam" && exam && submission && (
          <Runner
            slug={slug}
            exam={exam}
            submission={submission}
            deviceId={deviceId}
            offset={offset}
            onDone={(done) => {
              setSubmission(done);
              setPhase("result");
              window.scrollTo(0, 0);
            }}
          />
        )}

        {phase === "result" && exam && submission && (
          <Result
            slug={slug}
            deviceId={deviceId}
            exam={exam}
            submission={submission}
            onSubmissionUpdate={updateSubmission}
            onRetake={async () => {
              const started = await api<{ exam: PublicExamData; submission: PublicSubmission; serverNow: string }>(
                `/public/${encodeURIComponent(slug)}/start`,
                { body: { deviceId, retake: true } },
              );
              applyStart(started);
              window.scrollTo(0, 0);
            }}
          />
        )}
      </main>
    </div>
  );
}

function Intro({ exam, onStart }: { exam: PublicExamData; onStart: (name: string) => Promise<void> }) {
  const { t } = usePreferences();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await onStart(name);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="student-card">
      <span className="eyebrow">{t("ULANGAN", "EXAM")}</span>
      <h1>{exam.title}</h1>
      {exam.instructions?.trim() && <div className="student-instructions"><strong>{t("Petunjuk pengerjaan", "Instructions")}</strong><p>{exam.instructions}</p></div>}
      <div className="exam-meta">
        {exam.className && <span><Icon name="users" size={15} /> {t("Kelas", "Class")} {exam.className}</span>}
        <span><Icon name="file" size={15} /> {exam.questions.length} {t("soal", "questions")}</span>
        <span><Icon name="clock" size={15} /> {exam.durationMin} {t("menit", "min")}</span>
      </div>

      <label className="field">
        <span>{t("Nama lengkap", "Full name")}</span>
        <input
          className="plain-input"
          placeholder={t("Tulis namamu", "Enter your name")}
          value={name}
          maxLength={60}
          autoFocus
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && name.trim().length >= 2 && !busy && submit()}
        />
      </label>

      <ul className="rules">
        <li>{t("Waktu berjalan sejak kamu menekan tombol mulai.", "The timer starts as soon as you press Start.")}</li>
        <li>{t("Jawaban tersimpan otomatis. Jika terputus, buka tautan ini lagi dari perangkat yang sama.", "Answers are auto-saved. If disconnected, reopen this link on the same device.")}</li>
        <li>
          {exam.allowRetake
            ? exam.maxAttempts > 0
              ? t(`Kamu boleh mengerjakan ulang di perangkat ini, maksimal ${exam.maxAttempts} kali.`, `You may retake this exam on this device up to ${exam.maxAttempts} times.`)
              : t("Kamu boleh mengerjakan ulang di perangkat ini setelah selesai.", "You may retake this exam on this device after finishing.")
            : t("Satu perangkat hanya mendapat satu kesempatan mengerjakan.", "Each device is allowed one attempt.")}
        </li>
      </ul>

      {error && <div className="notice notice-danger" role="alert"><Icon name="alert" size={16} /><span>{error}</span></div>}

      <button className="btn btn-primary btn-lg btn-block" disabled={busy || name.trim().length < 2} onClick={submit}>
        {busy ? t("Memulai...", "Starting...") : t("Mulai mengerjakan", "Start exam")}
      </button>
    </div>
  );
}

function Runner({
  slug,
  exam,
  submission,
  deviceId,
  offset,
  onDone,
}: {
  slug: string;
  exam: PublicExamData;
  submission: PublicSubmission;
  deviceId: string;
  offset: number;
  onDone: (submission: PublicSubmission) => void;
}) {
  const { t } = usePreferences();
  const [answers, setAnswers] = useState<Answers>(submission.answers);
  const [remaining, setRemaining] = useState(() => secondsLeft());
  const [saveState, setSaveState] = useState<"saved" | "saving" | "offline">("saved");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const dirty = useRef(false);
  const finished = useRef(false);
  const submittingRef = useRef(false);

  const questions = useMemo(
    () => (exam.shuffle ? seededShuffle(exam.questions, submission.id) : exam.questions),
    [exam, submission.id],
  );

  function secondsLeft() {
    const deadline = new Date(submission.startedAt).getTime() + exam.durationMin * 60_000;
    return (deadline - (Date.now() + offset)) / 1000;
  }

  const persist = useCallback(async () => {
    if (finished.current) return;
    setSaveState("saving");
    dirty.current = false;
    try {
      await api(`/public/${encodeURIComponent(slug)}/save`, { body: { deviceId, answers: answersRef.current } });
      setSaveState(dirty.current ? "saving" : "saved");
    } catch (err) {
      dirty.current = true;
      if ((err as ApiError).status === 409) finished.current = true;
      setSaveState("offline");
    }
  }, [slug, deviceId]);

  const finish = useCallback(async () => {
    if (finished.current || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await api<{ submission: PublicSubmission }>(`/public/${encodeURIComponent(slug)}/submit`, {
        body: { deviceId, answers: answersRef.current },
      });
      finished.current = true;
      onDone(result.submission);
    } catch (err) {
      setSubmitError((err as Error).message);
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [slug, deviceId, onDone]);

  // Timer.
  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(secondsLeft()), 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Simpan otomatis: debounce saat menjawab + detak berkala.
  useEffect(() => {
    if (!dirty.current) return;
    const timer = window.setTimeout(persist, 1200);
    return () => window.clearTimeout(timer);
  }, [answers, persist]);

  useEffect(() => {
    const beat = window.setInterval(persist, 20_000);
    return () => window.clearInterval(beat);
  }, [persist]);

  // Waktu habis: kumpulkan otomatis, ulangi (jeda 4 detik) bila gagal.
  const timeUp = remaining <= 0;
  useEffect(() => {
    if (!timeUp || submitting || finished.current) return;
    const timer = window.setTimeout(finish, submitError ? 4000 : 0);
    return () => window.clearTimeout(timer);
  }, [timeUp, submitting, submitError, finish]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!finished.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  function choose(questionId: string, value: AnswerValue | undefined) {
    dirty.current = true;
    setAnswers((prev) => {
      const next = { ...prev };
      if (value === undefined || value === "") delete next[questionId];
      else next[questionId] = value;
      return next;
    });
    setSaveState("saving");
  }

  const answered = questions.filter((q) => answers[q.id] !== undefined).length;
  const unanswered = questions.length - answered;
  const urgent = remaining <= 60 && !timeUp;

  return (
    <>
      <div className="runner-bar">
        <div className="runner-info">
          <strong>{exam.title}</strong>
          <span>{answered} {t("dari", "of")} {questions.length} {t("dijawab", "answered")}{submission.attempt > 1 ? ` · ${t("Percobaan ke-", "Attempt #")}${submission.attempt}` : ""}</span>
        </div>
        <div className={`runner-timer ${urgent ? "runner-timer-urgent" : ""}`} role="timer" aria-label={t("Sisa waktu", "Time remaining")}>
          <Icon name="clock" size={16} /> {formatClock(remaining)}
        </div>
        <div className="runner-progress" aria-hidden="true"><span style={{ width: `${(answered / Math.max(1, questions.length)) * 100}%` }} /></div>
      </div>

      {saveState === "offline" && (
        <div className="notice notice-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{t("Belum terhubung ke server. Jawabanmu masih ada di layar dan akan dicoba disimpan lagi.", "Not connected to the server. Your answers are still on screen and we will retry saving.")}</span>
        </div>
      )}

      {timeUp && (
        <div className="notice" role="status">
          <Icon name="clock" size={16} />
          <span>{t("Waktu habis. Jawabanmu sedang dikumpulkan...", "Time's up. Submitting your answers...")}</span>
        </div>
      )}

      <div className="student-questions">
        {questions.map((question, index) => (
          <fieldset className="student-question" key={question.id} disabled={timeUp || submitting}>
            <legend className="sr-only">{t("Soal", "Question")} {index + 1}</legend>
            <div className="sq-head">
              <span className="question-number">{index + 1}</span>
              <span className="sq-meta">
                {getFormatLabel(question.format)}
                {question.points > 1 ? ` · ${t("bobot", "points")} ${question.points}` : ""}
              </span>
            </div>
            {question.story && <div className="story-box">{question.story}</div>}
            {question.image && <img className="question-image" src={question.image} alt={`${t("Gambar soal", "Question image")} ${index + 1}`} loading="lazy" />}
            <p className="question-text">{question.text}</p>
            <AnswerInput question={question} value={answers[question.id]} onChange={(value) => choose(question.id, value)} />
          </fieldset>
        ))}
      </div>

      <div className="runner-footer">
        <span className="muted">
          {saveState === "saving" ? t("Menyimpan...", "Saving...") : saveState === "offline" ? t("Gagal menyimpan", "Save failed") : t("Jawaban tersimpan", "Answers saved")}
        </span>
        <button className="btn btn-primary btn-lg" onClick={() => setConfirming(true)} disabled={timeUp || submitting}>
          {t("Kumpulkan jawaban", "Submit answers")}
        </button>
      </div>

      {submitError && !confirming && (
        <div className="notice notice-danger" role="alert"><Icon name="alert" size={16} /><span>{submitError}</span></div>
      )}

      {confirming && (
        <Modal
          icon="alert"
          title={t("Kumpulkan jawaban?", "Submit answers?")}
          description={t("Setelah dikumpulkan, jawaban tidak bisa diubah.", "Once submitted, answers cannot be changed.")}
          onClose={() => !submitting && setConfirming(false)}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setConfirming(false)} disabled={submitting}>{t("Kembali", "Back")}</button>
              <button className="btn btn-primary" onClick={finish} disabled={submitting}>{submitting ? t("Mengumpulkan...", "Submitting...") : t("Ya, kumpulkan", "Yes, submit")}</button>
            </>
          }
        >
          <p className="modal-text">
            {unanswered > 0 ? <><b>{unanswered} {t("soal", "question(s)")}</b> {t("belum kamu jawab.", "remain unanswered.")}</> : t("Semua soal sudah dijawab.", "All questions answered.")} {t("Sisa waktu", "Time remaining")} {formatClock(remaining)}.
          </p>
          {submitError && <div className="notice notice-danger" role="alert"><Icon name="alert" size={16} /><span>{submitError}</span></div>}
        </Modal>
      )}
    </>
  );
}

function AnswerInput({ question, value, onChange }: { question: PublicQuestion; value: AnswerValue | undefined; onChange: (value: AnswerValue | undefined) => void }) {
  const { t } = usePreferences();
  if (["short_answer", "fill_blank", "numeric"].includes(question.format)) {
    const text = typeof value === "string" ? value : "";
    return (
      <input
        className="plain-input"
        placeholder={question.format === "numeric" ? t("Masukkan angka", "Enter a number") : question.format === "fill_blank" ? t("Lengkapi jawaban", "Fill in the blank") : t("Ketik jawabanmu", "Type your answer")}
        aria-label={getFormatLabel(question.format)}
        inputMode={question.format === "numeric" ? "decimal" : "text"}
        maxLength={300}
        autoComplete="off"
        value={text}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  if (question.format === "essay") {
    const text = typeof value === "string" ? value : "";
    return (
      <div>
        <textarea className="question-input essay-input" rows={6} placeholder={t("Tulis jawabanmu di sini...", "Write your answer here...")} aria-label={t("Jawaban uraian", "Essay answer")} maxLength={5000} value={text} onChange={(event) => onChange(event.target.value)} />
        <div className="char-count">{text.length} / 5000</div>
      </div>
    );
  }
  if (question.format === "multiple_select") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="student-options">
        <p className="muted student-answer-hint">{t("Pilih semua jawaban yang benar.", "Select all correct answers.")}</p>
        {question.options.map((option, index) => (
          <label className={`student-option ${selected.includes(index) ? "student-option-on" : ""}`} key={index}>
            <input type="checkbox" checked={selected.includes(index)} onChange={(event) => onChange(event.target.checked ? [...selected, index] : selected.filter((item) => item !== index))} />
            <span className="option-letter">{String.fromCharCode(65 + index)}</span><span>{option}</span>
          </label>
        ))}
      </div>
    );
  }
  if (question.format === "matching") {
    let selected: Record<string, string> = {};
    if (typeof value === "string") { try { selected = JSON.parse(value); } catch { selected = {}; } }
    const items = question.matchItems ?? [];
    const choices = question.matchOptions ?? [];
    return (
      <div className="matching-student-list">
        {items.map((item) => (
          <label className="matching-student-row" key={item}>
            <span>{item}</span>
            <select className="select" aria-label={`${t("Pasangan untuk", "Match for")} ${item}`} value={selected[item] ?? ""} onChange={(event) => onChange(JSON.stringify({ ...selected, [item]: event.target.value }))}>
              <option value="">{t("Pilih pasangan…", "Select match…")}</option>
              {choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
            </select>
          </label>
        ))}
      </div>
    );
  }
  if (question.format === "ordering") {
    const items = question.orderItems ?? [];
    const itemCount = items.length;
    const selected = Array.isArray(value) ? value : new Array(itemCount).fill(-1);
    return (
      <div className="ordering-student-list">
        <p className="muted student-answer-hint">{t(`Pilih posisi setiap item, dari 1 sampai ${itemCount}.`, `Choose each item's position, from 1 to ${itemCount}.`)}</p>
        {items.map((item) => (
          <label className="ordering-student-row" key={item.index}>
            <span>{item.text}</span>
            <select className="select" aria-label={`${t("Posisi untuk", "Position for")} ${item.text}`} value={selected[item.index] ?? -1} onChange={(event) => {
              const next = Array.from({ length: itemCount }, (_, i) => Number(selected[i] ?? -1));
              const nextRank = Number(event.target.value);
              const conflict = next.findIndex((rank, i) => i !== item.index && rank === nextRank);
              if (conflict >= 0) next[conflict] = -1;
              next[item.index] = nextRank;
              onChange(next);
            }}>
              <option value={-1}>{t("Pilih urutan", "Select order")}</option>
              {items.map((_, rank) => <option key={rank} value={rank} disabled={selected.some((value, i) => i !== item.index && value === rank)}>{rank + 1}</option>)}
            </select>
          </label>
        ))}
      </div>
    );
  }
  return (
    <div className={`student-options ${question.format === "true_false" ? "student-options-row" : ""}`}>
      {question.options.map((option, oi) => (
        <label className={`student-option ${value === oi ? "student-option-on" : ""}`} key={oi}>
          <input type="radio" name={`q-${question.id}`} checked={value === oi} onChange={() => onChange(oi)} />
          {question.format === "multiple_choice" && <span className="option-letter">{String.fromCharCode(65 + oi)}</span>}
          <span>{question.format === "true_false" ? (option === "Benar" ? t("Benar", "True") : option === "Salah" ? t("Salah", "False") : option) : option}</span>
        </label>
      ))}
    </div>
  );
}

function Result({ slug, deviceId, exam, submission, onSubmissionUpdate, onRetake }: {
  slug: string;
  deviceId: string;
  exam: PublicExamData;
  submission: PublicSubmission;
  onSubmissionUpdate: (submission: PublicSubmission) => void;
  onRetake: () => Promise<void>;
}) {
  const { t, prefs } = usePreferences();
  const [busy, setBusy] = useState(false);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gradingLock = useRef(false);
  const autoAttempted = useRef(false);
  const result = submission.result;

  const runAiGrading = useCallback(async () => {
    if (gradingLock.current || !submission.result?.pending) return;
    gradingLock.current = true;
    setGrading(true);
    setError(null);
    let current = submission;
    try {
      // Gemma 4 menilai maksimal 3 jawaban terbuka per request agar fungsi serverless
      // tidak timeout. Proses berlanjut otomatis sampai seluruh jawaban selesai dinilai.
      for (let batch = 0; batch < 80 && (current.result?.pending ?? 0) > 0; batch += 1) {
        const response = await api<{ submission: PublicSubmission; processed: number; model: string }>(
          `/public/${encodeURIComponent(slug)}/grade-ai`,
          { body: { deviceId } },
        );
        current = response.submission;
        onSubmissionUpdate(current);
        if (!response.processed) break;
      }
      if ((current.result?.pending ?? 0) > 0) {
        throw new Error(t("Sebagian jawaban belum berhasil dinilai AI. Tekan ‘Coba lagi’ untuk melanjutkan penilaian.", "Some answers could not be graded by AI yet. Press ‘Try again’ to continue grading."));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Penilaian AI gagal. Coba lagi.", "AI grading failed. Try again."));
    } finally {
      gradingLock.current = false;
      setGrading(false);
    }
  }, [deviceId, onSubmissionUpdate, slug, submission, t]);

  useEffect(() => {
    autoAttempted.current = false;
  }, [submission.id]);

  useEffect(() => {
    if ((result?.pending ?? 0) > 0 && !autoAttempted.current) {
      autoAttempted.current = true;
      void runAiGrading();
    }
  }, [result?.pending, runAiGrading]);

  return (
    <div className="student-card center">
      <div className="success-check"><Icon name="check" size={26} /></div>
      <h1>{t("Jawaban sudah dikumpulkan", "Answers submitted")}</h1>
      <p>{exam.title}</p>
      {result && result.pending > 0 ? (
        <p className="muted">{t("Penilaian jawaban sedang berlangsung. Hasil akan diperbarui setelah pemeriksaan selesai.", "Grading is in progress. Results will update automatically when complete.")}</p>
      ) : result?.showScore && result.score !== null ? (
        <div className="score-box">
          <strong>{new Intl.NumberFormat(prefs.language === "en" ? "en-US" : "id-ID", { maximumFractionDigits: 1 }).format(result.score)}</strong>
          <span>{result.correct} {t("dari", "of")} {result.total} {t("soal benar", "questions correct")}</span>
        </div>
      ) : (
        <p className="muted">{t("Nilai disembunyikan sesuai pengaturan guru.", "Score is hidden per teacher settings.")}</p>
      )}
      {result && result.pending > 0 && (
        <div className="notice" role="status" aria-live="polite">
          <Icon name={grading ? "sparkle" : "clock"} size={16} />
          <span>{grading ? t(`Model gemini-5-flash-lite sedang memeriksa ${result.pending} jawaban singkat, isian, dan uraian. Nilai akan diperbarui otomatis.`, `Model gemini-5-flash-lite is grading ${result.pending} short-answer, fill-in, and essay response(s). Scores will update automatically.`) : error || t(`${result.pending} jawaban masih menunggu penilaian AI.`, `${result.pending} answer(s) awaiting AI grading.`)}</span>
          {!grading && <button className="btn btn-outline btn-sm" type="button" onClick={() => { autoAttempted.current = true; void runAiGrading(); }}>{t("Coba lagi", "Retry")}</button>}
        </div>
      )}
      {submission.canRetake ? (
        <>
          <button
            className="btn btn-primary btn-lg"
            disabled={busy || grading}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onRetake();
              } catch (err) {
                setError((err as Error).message);
                setBusy(false);
              }
            }}
          >
            <Icon name="refresh" size={16} /> {busy ? t("Menyiapkan...", "Preparing...") : t("Kerjakan lagi", "Retake exam")}
          </button>
          <p className="muted">
            {submission.attemptsLeft === null ? t("Percobaan tidak dibatasi.", "Unlimited attempts.") : `${t("Sisa percobaan:", "Attempts left:")} ${submission.attemptsLeft}.`} {t(`Percobaan ke-${submission.attempt} sudah selesai.`, `Attempt #${submission.attempt} completed.`)}
          </p>
          {error && result?.pending === 0 && <div className="notice notice-danger" role="alert"><Icon name="alert" size={16} /><span>{error}</span></div>}
        </>
      ) : (
        <p className="muted">{t("Kamu boleh menutup halaman ini.", "You may close this page.")}</p>
      )}
    </div>
  );
}
