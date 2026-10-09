import { Icon } from "../../components/Icon";
import { Avatar, EmptyState, ErrorState, Spinner, StatusBadge } from "../../components/ui";
import type { DashboardData } from "../../lib/api";
import { formatDateLong, formatNumber, greeting, timeAgo } from "../../lib/format";
import { useApi } from "../../lib/hooks";
import { Link } from "../../lib/router";
import { Topbar, useShell } from "./shell";

export default function Home({ name }: { name: string }) {
  const { data, error, loading, reload } = useApi<DashboardData>("/dashboard", 10000);
  const { createExam, creating } = useShell();
  const firstName = name.split(/\s+/)[0] || name;
  const now = data ? new Date(data.serverNow).getTime() : Date.now();

  return (
    <>
      <Topbar title="Beranda">
        <button className="btn btn-primary" onClick={createExam} disabled={creating}>
          <Icon name="plus" size={16} /> Buat ulangan
        </button>
      </Topbar>

      <div className="page-content">
        <section className="welcome-row">
          <div>
            <span className="eyebrow">{greeting().toUpperCase()}</span>
            <h1>Halo, {firstName}</h1>
            <p>Pantau aktivitas ulangan dalam satu tempat.</p>
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
              title="Belum ada ulangan"
              text="Buat ulangan pertamamu, publish, lalu bagikan tautannya ke murid."
              action={
                <button className="btn btn-primary" onClick={createExam} disabled={creating}>
                  <Icon name="plus" size={16} /> Buat ulangan pertama
                </button>
              }
            />
          </section>
        )}

        {data && data.stats.totalExams > 0 && (
          <>
            {data.stats.pendingReview > 0 && (
              <div className="notice notice-warn" role="status">
                <Icon name="edit" size={16} />
                <span>{data.stats.pendingReview} jawaban uraian menunggu penilaianmu. Buka Hasil & Analitik lalu pilih ulangan.</span>
              </div>
            )}

            <section className="metric-grid">
              <article className="metric">
                <div className="metric-icon"><Icon name="file" /></div>
                <div>
                  <span>Total ulangan</span>
                  <strong>{formatNumber(data.stats.totalExams)}</strong>
                  <small>{data.stats.examsThisMonth > 0 ? <><b>+{data.stats.examsThisMonth}</b> bulan ini</> : "Belum ada baru bulan ini"}</small>
                </div>
              </article>
              <article className="metric">
                <div className="metric-icon"><Icon name="users" /></div>
                <div>
                  <span>Total peserta</span>
                  <strong>{formatNumber(data.stats.participants)}</strong>
                  <small>{data.stats.participantsThisMonth > 0 ? <><b>+{formatNumber(data.stats.participantsThisMonth)}</b> bulan ini</> : "Belum ada bulan ini"}</small>
                </div>
              </article>
              <article className="metric">
                <div className="metric-icon"><Icon name="chart" /></div>
                <div>
                  <span>Rata-rata nilai</span>
                  <strong>{formatNumber(data.stats.avgScore)}</strong>
                  <small>Dari ulangan yang sudah dikumpulkan</small>
                </div>
              </article>
              <article className="metric">
                <div className="metric-icon"><Icon name="trend" /></div>
                <div>
                  <span>Ulangan aktif</span>
                  <strong>{formatNumber(data.stats.activeExams)}</strong>
                  <small>{data.stats.activeExams > 0 ? <><i className="live-dot" /> Sedang dibuka</> : "Tidak ada yang dibuka"}</small>
                </div>
              </article>
            </section>

            <div className="dashboard-grid">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="live-label"><i className="live-dot" /> LIVE SEKARANG</span>
                    <h2>Ulangan yang sedang dibuka</h2>
                  </div>
                  <Link to="/dashboard/hasil" className="text-link">Lihat semua <Icon name="arrow" size={14} /></Link>
                </div>
                {data.live.length === 0 ? (
                  <p className="panel-empty">Belum ada ulangan yang dipublish. Publish dari editor agar murid bisa mengerjakan.</p>
                ) : (
                  data.live.map((exam) => {
                    const percent = exam.participants ? Math.round((exam.submitted / exam.participants) * 100) : 0;
                    return (
                      <div className="live-exam" key={exam.id}>
                        <div className="exam-badge">{exam.title.slice(0, 2).toUpperCase()}</div>
                        <div className="live-exam-main">
                          <strong>{exam.title}</strong>
                          <span>
                            {[exam.className && `Kelas ${exam.className}`, `${exam.questionCount} soal`, `${exam.durationMin} menit`].filter(Boolean).join(" · ")}
                          </span>
                          <div className="progress">
                            <div><span style={{ width: `${percent}%` }} /></div>
                            <small>{exam.participants} bergabung · {exam.submitted} selesai{exam.pendingReview > 0 ? ` · ${exam.pendingReview} perlu dinilai` : ""}</small>
                          </div>
                        </div>
                        <div className="live-score">
                          <strong>{formatNumber(exam.avgScore)}</strong>
                          <span>Rata-rata</span>
                        </div>
                        <Link to={`/dashboard/hasil/${exam.id}`} className="btn btn-outline">Pantau</Link>
                      </div>
                    );
                  })
                )}
              </section>

              <section className="panel">
                <div className="panel-heading"><h2>Aktivitas terbaru</h2></div>
                {data.activity.length === 0 ? (
                  <p className="panel-empty">Aktivitas murid akan muncul di sini.</p>
                ) : (
                  data.activity.map((item) => (
                    <Link to={`/dashboard/hasil/${item.examId}`} className="activity-item" key={item.id}>
                      <Avatar name={item.studentName} size={32} />
                      <p>
                        <strong>{item.studentName}</strong>{" "}
                        {item.status === "done" ? `menyelesaikan ${item.examTitle}` : `sedang mengerjakan ${item.examTitle}`}
                        {item.status === "done" && item.score !== null && <b className="score-inline"> · nilai {formatNumber(item.score)}</b>}
                        <span>{timeAgo(item.at, now)}</span>
                      </p>
                    </Link>
                  ))
                )}
              </section>
            </div>

            <section className="panel">
              <div className="panel-heading">
                <div><h2>Ulangan terbaru</h2><p>Kelola ulangan yang sudah dibuat</p></div>
                <Link to="/dashboard/ulangan" className="text-link">Lihat semua <Icon name="arrow" size={14} /></Link>
              </div>
              <div className="table">
                <div className="table-row table-head recent-cols">
                  <span>Nama ulangan</span><span>Kelas</span><span>Peserta</span><span>Rata-rata</span><span>Status</span><span />
                </div>
                {data.recent.map((exam) => (
                  <Link to={`/dashboard/ulangan/${exam.id}`} className="table-row recent-cols" key={exam.id}>
                    <span className="cell-main"><b>{exam.title}</b><small>{exam.questionCount} soal · {exam.durationMin} menit</small>
                      <small className="show-sm">{[exam.className && `Kelas ${exam.className}`, `${exam.participants} peserta`, exam.avgScore !== null && `rata-rata ${formatNumber(exam.avgScore)}`].filter(Boolean).join(" · ")}</small></span>
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
    </>
  );
}
