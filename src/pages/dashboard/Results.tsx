import { useState } from "react";
import { Icon } from "../../components/Icon";
import { Avatar, EmptyState, ErrorState, Spinner, StatusBadge } from "../../components/ui";
import type { ResultsData } from "../../lib/api";
import { downloadCsv, formatClock, formatNumber, slugify, timeAgo } from "../../lib/format";
import { copyText, useApi, useTitle } from "../../lib/hooks";
import { Link } from "../../lib/router";
import SubmissionModal from "./SubmissionModal";
import { Topbar, useShell } from "./shell";

const stateLabel = { done: "Selesai", working: "Mengerjakan", disconnected: "Terputus" } as const;
const labelOf = (s: { state: keyof typeof stateLabel; pending: number }) => (s.state === "done" && s.pending > 0 ? "Perlu dinilai" : stateLabel[s.state]);

export default function Results({ id }: { id: string }) {
  const { data, error, loading, reload } = useApi<ResultsData>(`/exams/${id}/results`, 5000);
  const { notify } = useShell();
  const [query, setQuery] = useState("");
  const [viewId, setViewId] = useState<string | null>(null);
  useTitle(`${data?.exam.title ?? "Hasil"} - Ulanganku`, true);

  if (error && !data) {
    return (
      <>
        <Topbar title="Hasil & Analitik" />
        <div className="page-content"><ErrorState message={error.message} onRetry={reload} /></div>
      </>
    );
  }
  if (loading || !data) {
    return (
      <>
        <Topbar title="Hasil & Analitik" />
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
    downloadCsv(`nilai-${slugify(exam.title) || "ulangan"}.csv`, [
      ["Nama", "Percobaan", "Status", "Soal benar", "Total soal", "Nilai", "Waktu pengerjaan", "IP"],
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
    notify(ok ? "Tautan disalin." : "Gagal menyalin tautan.");
  }

  return (
    <>
      <Topbar title="Hasil & Analitik">
        {shareUrl && (
          <button className="btn btn-outline hide-sm" onClick={copyLink}><Icon name="copy" size={15} /> Salin tautan</button>
        )}
        <button className="btn btn-outline" onClick={exportCsv} disabled={submissions.length === 0}>
          <Icon name="download" size={15} /> <span className="hide-sm">Export nilai</span>
        </button>
      </Topbar>

      <div className="page-content">
        <section className="results-header">
          <div>
            <div className="crumbs">
              <Link to="/dashboard/hasil">Hasil ulangan</Link>
              <Icon name="chevron" size={13} />
              <b>Detail</b>
            </div>
            <div className="heading-row">
              <h1>{exam.title}</h1>
              <StatusBadge status={exam.status} />
            </div>
            <p>{[exam.className && `Kelas ${exam.className}`, `${exam.questionCount} soal`, `${exam.durationMin} menit`].filter(Boolean).join(" · ")}</p>
          </div>
          <button className="live-state" onClick={reload} title="Perbarui sekarang">
            {live && <i className="live-dot" />}
            <span>
              <strong>{live ? "Live monitoring" : "Ringkasan hasil"}</strong>
              Diperbarui {timeAgo(data.serverNow, now).toLowerCase()}
            </span>
            <Icon name="refresh" size={15} />
          </button>
        </section>

        {summary.pendingReview > 0 && (
          <div className="notice notice-warn" role="status">
            <Icon name="edit" size={16} />
            <span>{summary.pendingReview} jawaban memiliki soal uraian yang belum dinilai. Klik Periksa pada murid untuk memberi nilai.</span>
          </div>
        )}

        <section className="results-metrics">
          <article>
            <span>Peserta bergabung</span>
            <strong>{summary.joined}</strong>
          </article>
          <article>
            <span>Sudah submit</span>
            <strong>{summary.submitted}</strong>
            <p className="muted">{percentDone}% selesai</p>
          </article>
          <article>
            <span>Rata-rata nilai</span>
            <strong>{formatNumber(summary.avgScore)}</strong>
          </article>
          <article>
            <span>Nilai tertinggi</span>
            <strong>{formatNumber(summary.topScore)}</strong>
            <p className="muted">{summary.topStudent ?? "Belum ada"}</p>
          </article>
        </section>

        <div className="results-layout">
          <section className="panel">
            <div className="list-toolbar">
              <div>
                <h2>Nilai peserta</h2>
                <span className="muted">{exam.allowRetake ? "Setiap percobaan tampil terpisah. Statistik memakai nilai tertinggi tiap murid." : "Data diperbarui otomatis tiap beberapa detik"}</span>
              </div>
              <label className="search-field">
                <Icon name="search" size={16} />
                <input placeholder="Cari nama murid..." value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Cari nama murid" />
              </label>
            </div>

            {submissions.length === 0 ? (
              <EmptyState
                icon="users"
                title="Belum ada peserta"
                text={live ? "Bagikan tautan ulangan ke murid. Peserta akan muncul di sini begitu mereka mulai." : "Belum ada murid yang mengerjakan ulangan ini."}
                action={shareUrl && live ? <button className="btn btn-primary" onClick={copyLink}><Icon name="copy" size={15} /> Salin tautan</button> : undefined}
              />
            ) : filtered.length === 0 ? (
              <EmptyState icon="search" title="Murid tidak ditemukan" text="Coba kata kunci lain." />
            ) : (
              <div className="table">
                <div className="table-row table-head student-cols">
                  <span>Nama murid</span><span>Status</span><span className="hide-sm">Benar</span><span>Nilai</span><span className="hide-sm">Waktu</span><span className="hide-sm">Aktivitas</span><span />
                </div>
                {filtered.map((s) => (
                  <div className="table-row student-cols" key={s.id}>
                    <span className="student-name">
                      <Avatar name={s.studentName} size={32} />
                      <b>{s.studentName}<small>{exam.allowRetake || s.attempt > 1 ? `Percobaan ${s.attempt} · ` : ""}IP {s.ipMasked}</small></b>
                    </span>
                    <span><em className={`badge ${s.state === "done" && s.pending > 0 ? "badge-warn" : `badge-${s.state}`}`}>{labelOf(s)}</em></span>
                    <span className="hide-sm">{s.correct}/{s.total}</span>
                    <span className="score-value">
                      <b>{formatNumber(s.score)}</b>
                      {s.state !== "done" && <small>Sementara</small>}
                    </span>
                    <span className="hide-sm">{formatClock(s.seconds)}</span>
                    <span className="hide-sm">{s.lastActivity ? timeAgo(s.lastActivity, now) : "–"}</span>
                    <span className="row-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => setViewId(s.id)} aria-label={`Periksa jawaban ${s.studentName}`}>
                        <Icon name="eye" size={14} /> <span className="hide-sm">Periksa</span>
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="results-side">
            <section className="panel">
              <div className="panel-heading"><h2>Distribusi nilai</h2><span className="muted">{summary.submitted} submit</span></div>
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
                  <strong>Insight ulangan</strong>
                  <p>
                    Soal nomor {hardest.number} paling banyak dijawab salah. Hanya {hardest.correctRate}% murid menjawab dengan benar.
                  </p>
                  <Link to={`/dashboard/ulangan/${exam.id}`} className="text-link">Lihat soal <Icon name="arrow" size={13} /></Link>
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
