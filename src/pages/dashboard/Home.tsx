import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { Avatar, EmptyState, ErrorState, Modal, Spinner, StatusBadge } from "../../components/ui";
import { api, type DashboardData } from "../../lib/api";
import { formatDateLong, formatNumber, greeting, timeAgo } from "../../lib/format";
import { useApi } from "../../lib/hooks";
import { usePreferences } from "../../lib/preferences";
import { Link } from "../../lib/router";
import { Topbar, useShell } from "./shell";

export default function Home({ name }: { name: string }) {
  const { t } = usePreferences();
  const { data, setData, error, loading, reload } = useApi<DashboardData>("/dashboard", 10000);
  const { createExam, creating, notify } = useShell();
  const [confirmClearActivity, setConfirmClearActivity] = useState(false);
  const [clearingActivity, setClearingActivity] = useState(false);
  const [aiGrading, setAiGrading] = useState(false);
  const [aiGradeError, setAiGradeError] = useState("");
  const autoGradedRef = useRef(false);
  const gradingLockRef = useRef(false);
  const firstName = name.split(/\s+/)[0] || name;
  const now = data ? new Date(data.serverNow).getTime() : Date.now();

  const runDashboardAiGrading = useCallback(async () => {
    if (gradingLockRef.current) return;
    gradingLockRef.current = true;
    setAiGrading(true);
    setAiGradeError("");
    try {
      let anyProcessed = false;
      for (let step = 0; step < 100; step += 1) {
        const res = await api<{ processed: number; remainingSubmissions: number }>("/dashboard/grade-ai", {
          method: "POST",
          body: {},
        });
        if (res.processed > 0) anyProcessed = true;
        if (!res.processed || res.remainingSubmissions <= 0) break;
      }
      if (anyProcessed) reload();
    } catch (err) {
      setAiGradeError((err as Error).message);
    } finally {
      gradingLockRef.current = false;
      setAiGrading(false);
    }
  }, [reload]);

  useEffect(() => {
    if (data && data.stats.pendingReview > 0 && !autoGradedRef.current) {
      autoGradedRef.current = true;
      void runDashboardAiGrading();
    }
  }, [data, runDashboardAiGrading]);

  async function clearAllActivity() {
    setClearingActivity(true);
    try {
      await api("/dashboard/activity", { method: "DELETE" });
      setData((current) => (current ? { ...current, activity: [] } : current));
      setConfirmClearActivity(false);
      notify(t("Semua aktivitas terbaru telah dihapus.", "All recent activities have been cleared."));
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setClearingActivity(false);
    }
  }

  return (
    <>
      <Topbar title={t("Beranda", "Home")}>
        <button className="btn btn-primary" onClick={createExam} disabled={creating}>
          <Icon name="plus" size={16} /> {t("Buat ulangan", "Create exam")}
        </button>
      </Topbar>

      <div className="page-content">
        <section className="welcome-row">
          <div>
            <span className="eyebrow">{greeting().toUpperCase()}</span>
            <h1>{t("Halo,", "Hello,")} {firstName}</h1>
            <p>{t("Pantau aktivitas ulangan dalam satu tempat.", "Monitor exam activity in one place.")}</p>
          </div>
          <div className="chip">
            <Icon name="clock" size={15} /> {formatDateLong()}
          </div>
        </section>

        {loading && !data && <Spinner />}
        {error && !data && <ErrorState message={error.message} onRetry={reload} />}

        {data && data.stats.totalExams === 0 && (
          <section className="panel">
            <EmptyState
              title={t("Belum ada ulangan", "No exams yet")}
              text={t("Buat ulangan pertamamu, publish, lalu bagikan tautannya ke murid.", "Create your first exam, publish it, then share the link with students.")}
              action={
                <button className="btn btn-primary" onClick={createExam} disabled={creating}>
                  <Icon name="plus" size={16} /> {t("Buat ulangan pertama", "Create first exam")}
                </button>
              }
            />
          </section>
        )}

        {data && data.stats.totalExams > 0 && (
          <>
            {data.stats.pendingReview > 0 && (
              <div className="notice notice-warn" role="status">
                <Icon name={aiGrading ? "sparkle" : "edit"} size={16} />
                <span style={{ flex: 1 }}>
                  {aiGrading
                    ? t(`Model gemini-5-flash-lite sedang menilai ${data.stats.pendingReview} pengerjaan dengan jawaban singkat/uraian...`, `Model gemini-5-flash-lite is grading ${data.stats.pendingReview} submission(s) with short/essay answers...`)
                    : aiGradeError
                      ? t(`${data.stats.pendingReview} jawaban singkat/uraian masih menunggu penilaian AI (${aiGradeError}).`, `${data.stats.pendingReview} short/essay answers are still waiting for AI grading (${aiGradeError}).`)
                      : t(`${data.stats.pendingReview} jawaban singkat/uraian masih menunggu penilaian AI (gemini-5-flash-lite). Buka Hasil & Analitik untuk memeriksa hasil atau mengoreksi nilai bila diperlukan.`, `${data.stats.pendingReview} short/essay answers are awaiting AI grading (gemini-5-flash-lite). Open Results & Analytics to inspect or adjust scores if needed.`)}
                </span>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => void runDashboardAiGrading()} disabled={aiGrading}>
                  <Icon name="sparkle" size={14} /> {aiGrading ? t("Menilai...", "Grading...") : t("Nilai otomatis AI", "Auto-grade with AI")}
                </button>
              </div>
            )}

            <section className="metric-grid">
              <article className="metric">
                <div className="metric-icon"><Icon name="file" /></div>
                <div>
                  <span>{t("Total ulangan", "Total exams")}</span>
                  <strong>{formatNumber(data.stats.totalExams)}</strong>
                  <small>{data.stats.examsThisMonth > 0 ? <><b>+{data.stats.examsThisMonth}</b> {t("bulan ini", "this month")}</> : t("Belum ada baru bulan ini", "None new this month")}</small>
                </div>
              </article>
              <article className="metric">
                <div className="metric-icon"><Icon name="users" /></div>
                <div>
                  <span>{t("Total peserta", "Total participants")}</span>
                  <strong>{formatNumber(data.stats.participants)}</strong>
                  <small>{data.stats.participantsThisMonth > 0 ? <><b>+{formatNumber(data.stats.participantsThisMonth)}</b> {t("bulan ini", "this month")}</> : t("Belum ada bulan ini", "None this month")}</small>
                </div>
              </article>
              <article className="metric">
                <div className="metric-icon"><Icon name="chart" /></div>
                <div>
                  <span>{t("Rata-rata nilai", "Average score")}</span>
                  <strong>{formatNumber(data.stats.avgScore)}</strong>
                  <small>{t("Dari ulangan yang sudah dikumpulkan", "From submitted exams")}</small>
                </div>
              </article>
              <article className="metric">
                <div className="metric-icon"><Icon name="trend" /></div>
                <div>
                  <span>{t("Ulangan aktif", "Active exams")}</span>
                  <strong>{formatNumber(data.stats.activeExams)}</strong>
                  <small>{data.stats.activeExams > 0 ? <><i className="live-dot" /> {t("Sedang dibuka", "Currently open")}</> : t("Tidak ada yang dibuka", "None open")}</small>
                </div>
              </article>
            </section>

            <div className="dashboard-grid">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="live-label"><i className="live-dot" /> {t("LIVE SEKARANG", "LIVE NOW")}</span>
                    <h2>{t("Ulangan yang sedang dibuka", "Currently open exams")}</h2>
                  </div>
                  <Link to="/dashboard/hasil" className="text-link">{t("Lihat semua", "View all")} <Icon name="arrow" size={14} /></Link>
                </div>
                {data.live.length === 0 ? (
                  <p className="panel-empty">{t("Belum ada ulangan yang dipublish. Publish dari editor agar murid bisa mengerjakan.", "No published exams yet. Publish from the editor so students can start.")}</p>
                ) : (
                  data.live.map((exam) => {
                    const percent = exam.participants ? Math.round((exam.submitted / exam.participants) * 100) : 0;
                    return (
                      <div className="live-exam" key={exam.id}>
                        <div className="exam-badge">{exam.title.slice(0, 2).toUpperCase()}</div>
                        <div className="live-exam-main">
                          <strong>{exam.title}</strong>
                          <span>
                            {[exam.className && `${t("Kelas", "Class")} ${exam.className}`, `${exam.questionCount} ${t("soal", "questions")}`, `${exam.durationMin} ${t("menit", "min")}`].filter(Boolean).join(" · ")}
                          </span>
                          <div className="progress">
                            <div><span style={{ width: `${percent}%` }} /></div>
                            <small>{exam.participants} {t("bergabung", "joined")} · {exam.submitted} {t("selesai", "done")}{exam.pendingReview > 0 ? ` · ${exam.pendingReview} ${t("perlu dinilai", "needs grading")}` : ""}</small>
                          </div>
                        </div>
                        <div className="live-score">
                          <strong>{formatNumber(exam.avgScore)}</strong>
                          <span>{t("Rata-rata", "Average")}</span>
                        </div>
                        <Link to={`/dashboard/hasil/${exam.id}`} className="btn btn-outline">{t("Pantau", "Monitor")}</Link>
                      </div>
                    );
                  })
                )}
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <h2>{t("Aktivitas terbaru", "Recent activity")}</h2>
                  {data.activity.length > 0 && (
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setConfirmClearActivity(true)}>
                      <Icon name="trash" size={14} /> {t("Hapus semua", "Clear all")}
                    </button>
                  )}
                </div>
                {data.activity.length === 0 ? (
                  <p className="panel-empty">{t("Aktivitas murid akan muncul di sini.", "Student activity will appear here.")}</p>
                ) : (
                  data.activity.map((item) => (
                    <Link to={`/dashboard/hasil/${item.examId}`} className="activity-item" key={item.id}>
                      <Avatar name={item.studentName} size={32} />
                      <p>
                        <strong>{item.studentName}</strong>{" "}
                        {item.status === "done" ? `${t("menyelesaikan", "completed")} ${item.examTitle}` : `${t("sedang mengerjakan", "working on")} ${item.examTitle}`}
                        {item.status === "done" && item.score !== null && <b className="score-inline"> · {t("nilai", "score")} {formatNumber(item.score)}</b>}
                        <span>{timeAgo(item.at, now)}</span>
                      </p>
                    </Link>
                  ))
                )}
              </section>
            </div>

            <section className="panel">
              <div className="panel-heading">
                <div><h2>{t("Ulangan terbaru", "Recent exams")}</h2><p>{t("Kelola ulangan yang sudah dibuat", "Manage exams you have created")}</p></div>
                <Link to="/dashboard/ulangan" className="text-link">{t("Lihat semua", "View all")} <Icon name="arrow" size={14} /></Link>
              </div>
              <div className="table">
                <div className="table-row table-head recent-cols">
                  <span>{t("Nama ulangan", "Exam title")}</span><span>{t("Kelas", "Class")}</span><span>{t("Peserta", "Participants")}</span><span>{t("Rata-rata", "Average")}</span><span>{t("Status", "Status")}</span><span />
                </div>
                {data.recent.map((exam) => (
                  <Link to={`/dashboard/ulangan/${exam.id}`} className="table-row recent-cols" key={exam.id}>
                    <span className="cell-main"><b>{exam.title}</b><small>{exam.questionCount} {t("soal", "questions")} · {exam.durationMin} {t("menit", "min")}</small>
                      <small className="show-sm">{[exam.className && `${t("Kelas", "Class")} ${exam.className}`, `${exam.participants} ${t("peserta", "participants")}`, exam.avgScore !== null && `${t("rata-rata", "avg")} ${formatNumber(exam.avgScore)}`].filter(Boolean).join(" · ")}</small></span>
                    <span className="hide-sm">{exam.className || "–"}</span>
                    <span className="hide-sm">{exam.participants}</span>
                    <span className="hide-sm"><b>{formatNumber(exam.avgScore)}</b></span>
                    <span><StatusBadge status={exam.status} /></span>
                    <span className="cell-chevron"><Icon name="chevron" size={15} /></span>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      {confirmClearActivity && (
        <Modal
          icon="trash"
          title={t("Hapus semua aktivitas terbaru?", "Clear all recent activity?")}
          description={t("Daftar aktivitas terbaru di beranda akan dikosongkan.", "The recent activity list on Home will be cleared.")}
          onClose={() => !clearingActivity && setConfirmClearActivity(false)}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setConfirmClearActivity(false)} disabled={clearingActivity}>
                {t("Tidak", "No")}
              </button>
              <button type="button" className="btn btn-danger" onClick={() => void clearAllActivity()} disabled={clearingActivity}>
                {clearingActivity ? t("Menghapus...", "Clearing...") : t("Ya", "Yes")}
              </button>
            </>
          }
        >
          <p className="modal-text">
            {t("Apakah kamu yakin ingin menghapus semua daftar aktivitas terbaru? Data nilai dan jawaban murid di menu", "Are you sure you want to clear all recent activity items? Student scores and answers under")}{" "}
            <b>{t("Hasil & Analitik", "Results & Analytics")}</b>{" "}
            {t("tidak akan terhapus.", "will not be deleted.")}
          </p>
        </Modal>
      )}
    </>
  );
}
