import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Brand, Icon } from "../components/Icon";
import { Modal, Spinner } from "../components/ui";
import { api, ApiError, type Answers, type AnswerValue, type PublicExam as PublicExamData, type PublicQuestion, type PublicSubmission } from "../lib/api";
import { FORMAT_LABEL } from "../lib/questions";
import { formatClock } from "../lib/format";
import { uid, useTitle } from "../lib/hooks";
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
  const [phase, setPhase] = useState<Phase>("loading");
  const [exam, setExam] = useState<PublicExamData | null>(null);
  const [submission, setSubmission] = useState<PublicSubmission | null>(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const deviceId = useMemo(getDeviceId, []);

  const brand = exam?.brand ?? null;
  const brandName = brand?.name || "Ulanganku";
  useTitle(exam ? `${exam.title} - ${brandName}` : "Ulangan - Ulanganku", true);

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
    return <NotFound title="Ulangan tidak ditemukan" text="Tautan ini tidak aktif atau sudah dihapus oleh guru. Periksa kembali tautan yang kamu terima." />;
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
            <h1>Gagal memuat ulangan</h1>
            <p>{error}</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>Muat ulang</button>
          </div>
        )}

        {phase === "closed" && exam && (
          <div className="student-card center">
            <div className="empty-icon"><Icon name="lock" size={22} /></div>
            <h1>{exam.title}</h1>
            <p>Ulangan ini sudah ditutup oleh guru, jadi belum bisa dikerjakan.</p>
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
            exam={exam}
            submission={submission}
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
      <span className="eyebrow">ULANGAN</span>
      <h1>{exam.title}</h1>
      <div className="exam-meta">
        {exam.className && <span><Icon name="users" size={15} /> Kelas {exam.className}</span>}
        <span><Icon name="file" size={15} /> {exam.questions.length} soal</span>
        <span><Icon name="clock" size={15} /> {exam.durationMin} menit</span>
      </div>

      <label className="field">
        <span>Nama lengkap</span>
        <input
          className="plain-input"
          placeholder="Tulis namamu"
          value={name}
          maxLength={60}
          autoFocus
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && name.trim().length >= 2 && !busy && submit()}
        />
      </label>

      <ul className="rules">
        <li>Waktu berjalan sejak kamu menekan tombol mulai.</li>
        <li>Jawaban tersimpan otomatis. Jika terputus, buka tautan ini lagi dari perangkat yang sama.</li>
        <li>
          {exam.allowRetake
            ? exam.maxAttempts > 0
              ? `Kamu boleh mengerjakan ulang di perangkat ini, maksimal ${exam.maxAttempts} kali.`
              : "Kamu boleh mengerjakan ulang di perangkat ini setelah selesai."
            : "Satu perangkat hanya mendapat satu kesempatan mengerjakan."}
        </li>
      </ul>

      {error && <div className="notice notice-danger" role="alert"><Icon name="alert" size={16} /><span>{error}</span></div>}

      <button className="btn btn-primary btn-lg btn-block" disabled={busy || name.trim().length < 2} onClick={submit}>
        {busy ? "Memulai..." : "Mulai mengerjakan"}
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
          <span>{answered} dari {questions.length} dijawab{submission.attempt > 1 ? ` · Percobaan ke-${submission.attempt}` : ""}</span>
        </div>
        <div className={`runner-timer ${urgent ? "runner-timer-urgent" : ""}`} role="timer" aria-label="Sisa waktu">
          <Icon name="clock" size={16} /> {formatClock(remaining)}
        </div>
        <div className="runner-progress" aria-hidden="true"><span style={{ width: `${(answered / Math.max(1, questions.length)) * 100}%` }} /></div>
      </div>

      {saveState === "offline" && (
        <div className="notice notice-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>Belum terhubung ke server. Jawabanmu masih ada di layar dan akan dicoba disimpan lagi.</span>
        </div>
      )}

      {timeUp && (
        <div className="notice" role="status">
          <Icon name="clock" size={16} />
          <span>Waktu habis. Jawabanmu sedang dikumpulkan...</span>
        </div>
      )}

      <div className="student-questions">
        {questions.map((question, index) => (
          <fieldset className="student-question" key={question.id} disabled={timeUp || submitting}>
            <legend className="sr-only">Soal {index + 1}</legend>
            <div className="sq-head">
              <span className="question-number">{index + 1}</span>
              <span className="sq-meta">
                {FORMAT_LABEL[question.format]}
                {question.points > 1 ? ` · bobot ${question.points}` : ""}
              </span>
            </div>
            {question.story && <div className="story-box">{question.story}</div>}
            {question.image && <img className="question-image" src={question.image} alt={`Gambar soal ${index + 1}`} loading="lazy" />}
            <p className="question-text">{question.text}</p>
            <AnswerInput question={question} value={answers[question.id]} onChange={(value) => choose(question.id, value)} />
          </fieldset>
        ))}
      </div>

      <div className="runner-footer">
        <span className="muted">
          {saveState === "saving" ? "Menyimpan..." : saveState === "offline" ? "Gagal menyimpan" : "Jawaban tersimpan"}
        </span>
        <button className="btn btn-primary btn-lg" onClick={() => setConfirming(true)} disabled={timeUp || submitting}>
          Kumpulkan jawaban
        </button>
      </div>

      {submitError && !confirming && (
        <div className="notice notice-danger" role="alert"><Icon name="alert" size={16} /><span>{submitError}</span></div>
      )}

      {confirming && (
        <Modal
          icon="alert"
          title="Kumpulkan jawaban?"
          description="Setelah dikumpulkan, jawaban tidak bisa diubah."
          onClose={() => !submitting && setConfirming(false)}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setConfirming(false)} disabled={submitting}>Kembali</button>
              <button className="btn btn-primary" onClick={finish} disabled={submitting}>{submitting ? "Mengumpulkan..." : "Ya, kumpulkan"}</button>
            </>
          }
        >
          <p className="modal-text">
            {unanswered > 0 ? <><b>{unanswered} soal</b> belum kamu jawab.</> : "Semua soal sudah dijawab."} Sisa waktu {formatClock(remaining)}.
          </p>
          {submitError && <div className="notice notice-danger" role="alert"><Icon name="alert" size={16} /><span>{submitError}</span></div>}
        </Modal>
      )}
    </>
  );
}

function AnswerInput({ question, value, onChange }: { question: PublicQuestion; value: AnswerValue | undefined; onChange: (value: AnswerValue | undefined) => void }) {
  if (question.format === "short_answer") {
    return (
      <input
        className="plain-input"
        placeholder="Ketik jawabanmu"
        aria-label="Jawaban singkat"
        maxLength={300}
        autoComplete="off"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  if (question.format === "essay") {
    const text = typeof value === "string" ? value : "";
    return (
      <div>
        <textarea
          className="question-input essay-input"
          rows={6}
          placeholder="Tulis jawabanmu di sini..."
          aria-label="Jawaban uraian"
          maxLength={5000}
          value={text}
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="char-count">{text.length} / 5000</div>
      </div>
    );
  }
  return (
    <div className={`student-options ${question.format === "true_false" ? "student-options-row" : ""}`}>
      {question.options.map((option, oi) => (
        <label className={`student-option ${value === oi ? "student-option-on" : ""}`} key={oi}>
          <input type="radio" name={`q-${question.id}`} checked={value === oi} onChange={() => onChange(oi)} />
          {question.format === "multiple_choice" && <span className="option-letter">{String.fromCharCode(65 + oi)}</span>}
          <span>{option}</span>
        </label>
      ))}
    </div>
  );
}

function Result({ exam, submission, onRetake }: { exam: PublicExamData; submission: PublicSubmission; onRetake: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const result = submission.result;
  return (
    <div className="student-card center">
      <div className="success-check"><Icon name="check" size={26} /></div>
      <h1>Jawaban sudah dikumpulkan</h1>
      <p>{exam.title}</p>
      {result?.showScore && result.score !== null ? (
        <div className="score-box">
          <strong>{new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(result.score)}</strong>
          <span>{result.correct} dari {result.total} soal benar</span>
        </div>
      ) : (
        <p className="muted">Nilai akan disampaikan oleh gurumu.</p>
      )}
      {result && result.pending > 0 && (
        <p className="muted">Ada {result.pending} soal uraian yang masih dinilai guru. Nilai di atas bisa berubah.</p>
      )}
      {submission.canRetake ? (
        <>
          <button
            className="btn btn-primary btn-lg"
            disabled={busy}
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
            <Icon name="refresh" size={16} /> {busy ? "Menyiapkan..." : "Kerjakan lagi"}
          </button>
          <p className="muted">
            {submission.attemptsLeft === null ? "Percobaan tidak dibatasi." : `Sisa percobaan: ${submission.attemptsLeft}.`} Percobaan ke-{submission.attempt} sudah selesai.
          </p>
          {error && <div className="notice notice-danger" role="alert"><Icon name="alert" size={16} /><span>{error}</span></div>}
        </>
      ) : (
        <p className="muted">Kamu boleh menutup halaman ini.</p>
      )}
    </div>
  );
}
