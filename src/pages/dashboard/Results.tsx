import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { Avatar, EmptyState, ErrorState, Spinner, StatusBadge } from "../../components/ui";
import { api, type ResultsData } from "../../lib/api";
import { downloadCsv, formatClock, formatNumber, slugify, timeAgo } from "../../lib/format";
import { copyText, useApi, useTitle } from "../../lib/hooks";
import { usePreferences } from "../../lib/preferences";
import { Link } from "../../lib/router";
import SubmissionModal from "./SubmissionModal";
import { Topbar, useShell } from "./shell";

export default function Results({ id }: { id: string }) {
  const { t } = usePreferences();
  const stateLabel = {
    done: t("Selesai", "Done"),
    working: t("Mengerjakan", "In progress"),
    disconnected: t("Terputus", "Disconnected"),
  } as const;
  const labelOf = (s: { state: keyof typeof stateLabel; pending: number }) =>
    s.state === "done" && s.pending > 0 ? t("Perlu dinilai", "Needs grading") : stateLabel[s.state];

  const { data, error, loading, reload } = useApi<ResultsData>(`/exams/${id}/results`, 5000);
  const { notify } = useShell();
  const [query, setQuery] = useState("");
  const [viewId, setViewId] = useState<string | null>(null);
  const [aiGrading, setAiGrading] = useState(false);
  const [aiGradeError, setAiGradeError] = useState("");
  const autoGradedExamRef = useRef<string | null>(null);
  const gradingLockRef = useRef(false);
  useTitle(`${data?.exam.title ?? t("Hasil", "Results")} - Ulanganku`, true);

  const runExamAiGrading = useCallback(async () => {
    if (gradingLockRef.current) return;
    gradingLockRef.current = true;
    setAiGrading(true);
    setAiGradeError("");
    try {
      let anyProcessed = false;
      for (let step = 0; step < 100; step += 1) {
        const res = await api<{ processed: number; remainingSubmissions: number }>(`/exams/${id}/grade-ai`, {
          method: "POST",
          body: {},
        });
        if (res.processed > 0) anyProcessed = true;
        if (!res.processed || res.remainingSubmissions <= 0) break;
      }
      if (anyProcessed) reload();
    } catch (err) {
      const msg = (err as Error).message;
      setAiGradeError(msg);
      notify(msg);
    } finally {
      gradingLockRef.current = false;
      setAiGrading(false);
    }
  }, [id, notify, reload]);

  useEffect(() => {
    autoGradedExamRef.current = null;
  }, [id]);

  useEffect(() => {
    if (data && data.summary.pendingReview > 0 && autoGradedExamRef.current !== id) {
      autoGradedExamRef.current = id;
      void runExamAiGrading();
    }
  }, [data, id, runExamAiGrading]);

  if (error && !data) {
    return (
      <>
        <Topbar title={t("Hasil & Analitik", "Results & Analytics")} />
        <div className="page-content"><ErrorState message={error.message} onRetry={reload} /></div>
      </>
    );
  }
  if (loading || !data) {
    return (
      <>
        <Topbar title={t("Hasil & Analitik", "Results & Analytics")} />
        <div className="page-content"><Spinner /></div>
      </>
    );
  }

  const { exam, summary, distribution, hardest, submissions } = data;
  const now = new Date(data.serverNow).getTime();
  const live = exam.status === "published";
  const shareUrl = exam.slug ? `${window.location.origin}/${exam.slug}` : "";
  const filtered = submissions.filter((s) => s.studentName.toLowerCase().includes(query.trim().toLowerCase()));
  const maxCount = Math.max(1, ...distribution.map((bucket) => bucket.count));
  const percentDone = summary.joined ? Math.round((summary.submitted / summary.joined) * 100) : 0;

  function exportCsv() {
    downloadCsv(`${t("nilai", "scores")}-${slugify(exam.title) || "exam"}.csv`, [
      [t("Nama", "Name"), t("Percobaan", "Attempt"), t("Status", "Status"), t("Soal benar", "Correct"), t("Total soal", "Total questions"), t("Nilai", "Score"), t("Waktu pengerjaan", "Duration"), "IP"],
      ...submissions.map((s) => [
        s.studentName,
        s.attempt,
        labelOf(s),
        s.correct,
        s.total,
        s.score === null ? "" : String(s.score).replace(".", ","),
        formatClock(s.seconds),
        s.ipMasked,
      ]),
    ]);
  }

  async function copyLink() {
    const ok = await copyText(shareUrl);
    notify(ok ? t("Tautan disalin.", "Link copied.") : t("Gagal menyalin tautan.", "Failed to copy link."));
  }

  return (
    <>
      <Topbar title={t("Hasil & Analitik", "Results & Analytics")}>
        {shareUrl && (
          <button className="btn btn-outline hide-sm" onClick={copyLink}><Icon name="copy" size={15} /> {t("Salin tautan", "Copy link")}</button>
        )}
        <button
          type="button"
          className="btn btn-outline topbar-icon-btn"
          aria-label={t("Export nilai", "Export scores")}
          title={t("Export nilai", "Export scores")}
          onClick={exportCsv}
          disabled={submissions.length === 0}
        >
          <Icon name="download" size={16} /> <span className="hide-sm">{t("Export nilai", "Export scores")}</span>
        </button>
      </Topbar>

      <div className="page-content">
        <section className="results-header">
          <div>
            <div className="crumbs">
              <Link to="/dashboard/hasil">{t("Hasil ulangan", "Exam results")}</Link>
              <Icon name="chevron" size={13} />
              <b>{t("Detail", "Detail")}</b>
            </div>
            <div className="heading-row">
              <h1>{exam.title}</h1>
              <StatusBadge status={exam.status} />
            </div>
            <p>{[exam.className && `${t("Kelas", "Class")} ${exam.className}`, `${exam.questionCount} ${t("soal", "questions")}`, `${exam.durationMin} ${t("menit", "min")}`].filter(Boolean).join(" · ")}</p>
          </div>
          <button className="live-state" onClick={reload} title={t("Perbarui sekarang", "Refresh now")}>
            {live && <i className="live-dot" />}
            <span>
              <strong>{live ? t("Live monitoring", "Live monitoring") : t("Ringkasan hasil", "Results summary")}</strong>
              {t("Diperbarui", "Updated")} {timeAgo(data.serverNow, now).toLowerCase()}
            </span>
            <Icon name="refresh" size={15} />
          </button>
        </section>

        {summary.pendingReview > 0 && (
          <div className="notice notice-warn" role="status">
            <Icon name={aiGrading ? "sparkle" : "edit"} size={16} />
            <span style={{ flex: 1 }}>
              {aiGrading
                ? t(`Model gemini-5-flash-lite sedang menilai ${summary.pendingReview} pengerjaan dengan jawaban singkat/uraian...`, `Model gemini-5-flash-lite is grading ${summary.pendingReview} submission(s) with short/essay answers...`)
                : aiGradeError
                  ? t(`${summary.pendingReview} jawaban singkat/uraian masih menunggu penilaian AI (${aiGradeError}).`, `${summary.pendingReview} short/essay answers are still awaiting AI grading (${aiGradeError}).`)
                  : t(`${summary.pendingReview} jawaban singkat/uraian masih menunggu penilaian AI (gemini-5-flash-lite). Buka Periksa untuk melihat status atau mengoreksi nilai secara opsional.`, `${summary.pendingReview} short/essay answers are awaiting AI grading (gemini-5-flash-lite). Open Review to inspect or optionally adjust scores.`)}
            </span>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => void runExamAiGrading()} disabled={aiGrading}>
              <Icon name="sparkle" size={14} /> {aiGrading ? t("Menilai...", "Grading...") : t("Nilai otomatis AI", "Auto-grade with AI")}
            </button>
          </div>
        )}

        <section className="results-metrics">
          <article>
            <span>{t("Peserta bergabung", "Joined")}</span>
            <strong>{summary.joined}</strong>
          </article>
          <article>
            <span>{t("Sudah submit", "Submitted")}</span>
            <strong>{summary.submitted}</strong>
            <p className="muted">{percentDone}% {t("selesai", "completed")}</p>
          </article>
          <article>
            <span>{t("Rata-rata nilai", "Average score")}</span>
            <strong>{formatNumber(summary.avgScore)}</strong>
          </article>
          <article>
            <span>{t("Nilai tertinggi", "Highest score")}</span>
            <strong>{formatNumber(summary.topScore)}</strong>
            <p className="muted">{summary.topStudent ?? t("Belum ada", "None yet")}</p>
          </article>
        </section>

        <div className="results-layout">
          <section className="panel">
            <div className="list-toolbar">
              <div>
                <h2>{t("Nilai peserta", "Student scores")}</h2>
                <span className="muted">{exam.allowRetake ? t("Setiap percobaan tampil terpisah. Statistik memakai nilai tertinggi tiap murid.", "Each attempt is shown separately. Stats use each student's highest score.") : t("Data diperbarui otomatis tiap beberapa detik", "Data refreshes automatically every few seconds")}</span>
              </div>
              <label className="search-field">
                <Icon name="search" size={16} />
                <input placeholder={t("Cari nama murid...", "Search student name...")} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t("Cari nama murid", "Search student name")} />
              </label>
            </div>

            {submissions.length === 0 ? (
              <EmptyState
                icon="users"
                title={t("Belum ada peserta", "No participants yet")}
                text={live ? t("Bagikan tautan ulangan ke murid. Peserta akan muncul di sini begitu mereka mulai.", "Share the exam link with students. Participants will appear here as soon as they start.") : t("Belum ada murid yang mengerjakan ulangan ini.", "No students have taken this exam yet.")}
                action={shareUrl && live ? <button className="btn btn-primary" onClick={copyLink}><Icon name="copy" size={15} /> {t("Salin tautan", "Copy link")}</button> : undefined}
              />
            ) : filtered.length === 0 ? (
              <EmptyState icon="search" title={t("Murid tidak ditemukan", "Student not found")} text={t("Coba kata kunci lain.", "Try another keyword.")} />
            ) : (
              <div className="table">
                <div className="table-row table-head student-cols">
                  <span>{t("Nama murid", "Student name")}</span><span>{t("Status", "Status")}</span><span className="hide-sm">{t("Benar", "Correct")}</span><span>{t("Nilai", "Score")}</span><span className="hide-md">{t("Waktu", "Time")}</span><span className="hide-md">{t("Aktivitas", "Activity")}</span><span />
                </div>
                {filtered.map((s) => (
                  <div className="table-row student-cols" key={s.id}>
                    <span className="student-name">
                      <Avatar name={s.studentName} size={32} />
                      <b>{s.studentName}<small>{exam.allowRetake || s.attempt > 1 ? `${t("Percobaan", "Attempt")} ${s.attempt} · ` : ""}IP {s.ipMasked}</small><small className="show-sm">{s.correct}/{s.total} {t("benar", "correct")} · {formatClock(s.seconds)}</small></b>
                    </span>
                    <span><em className={`badge ${s.state === "done" && s.pending > 0 ? "badge-warn" : `badge-${s.state}`}`}>{labelOf(s)}</em></span>
                    <span className="hide-sm">{s.correct}/{s.total}</span>
                    <span className="score-value">
                      <b>{formatNumber(s.score)}</b>
                      {s.state !== "done" && <small>{t("Sementara", "Provisional")}</small>}
                    </span>
                    <span className="hide-md">{formatClock(s.seconds)}</span>
                    <span className="hide-md">{s.lastActivity ? timeAgo(s.lastActivity, now) : "–"}</span>
                    <span className="row-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => setViewId(s.id)} aria-label={`${t("Periksa jawaban", "Review answers")} ${s.studentName}`}>
                        <Icon name="eye" size={14} /> <span>{t("Periksa", "Review")}</span>
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="results-side">
            <section className="panel">
              <div className="panel-heading"><h2>{t("Distribusi nilai", "Score distribution")}</h2><span className="muted">{summary.submitted} {t("submit", "submitted")}</span></div>
              {distribution.map((bucket) => (
                <div className="distribution-row" key={bucket.label}>
                  <span>{bucket.label}</span>
                  <div><i style={{ width: `${(bucket.count / maxCount) * 100}%` }} /></div>
                  <b>{bucket.count}</b>
                </div>
              ))}
            </section>

            {hardest && hardest.correctRate !== null && hardest.correctRate < 100 && (
              <section className="panel insight-card">
                <div className="insight-icon"><Icon name="sparkle" size={17} /></div>
                <div>
                  <strong>{t("Insight ulangan", "Exam insight")}</strong>
                  <p>
                    {t(
                      `Soal nomor ${hardest.number} paling banyak dijawab salah. Hanya ${hardest.correctRate}% murid menjawab dengan benar.`,
                      `Question #${hardest.number} was missed most often. Only ${hardest.correctRate}% of students answered it correctly.`,
                    )}
                  </p>
                  <Link to={`/dashboard/ulangan/${exam.id}`} className="text-link">{t("Lihat soal", "View question")} <Icon name="arrow" size={13} /></Link>
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>

      {viewId && <SubmissionModal examId={exam.id} submissionId={viewId} onClose={() => setViewId(null)} onSaved={reload} />}
    </>
  );
}
