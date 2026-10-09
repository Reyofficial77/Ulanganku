import { useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { EmptyState, ErrorState, Modal, Spinner, StatusBadge } from "../../components/ui";
import { api, type ExamStatus, type ExamSummary } from "../../lib/api";
import { formatDateShort, formatNumber, timeAgo } from "../../lib/format";
import { copyText, useApi, useTitle } from "../../lib/hooks";
import { Link, navigate } from "../../lib/router";
import { Topbar, useShell } from "./shell";

type Filter = "all" | ExamStatus;

export default function ExamList({ mode }: { mode: "exams" | "results" }) {
  const isResults = mode === "results";
  useTitle(`${isResults ? "Hasil & Analitik" : "Ulangan"} - Ulanganku`, true);
  const { data, error, loading, reload, setData } = useApi<{ exams: ExamSummary[] }>("/exams", isResults ? 15000 : 0);
  const { createExam, creating, notify } = useShell();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [toDelete, setToDelete] = useState<ExamSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const exams = useMemo(() => {
    const source = (data?.exams ?? []).filter((exam) => !isResults || exam.status !== "draft");
    return source.filter(
      (exam) =>
        (filter === "all" || exam.status === filter) &&
        `${exam.title} ${exam.className}`.toLowerCase().includes(query.trim().toLowerCase()),
    );
  }, [data, filter, query, isResults]);

  const counts = useMemo(() => {
    const source = (data?.exams ?? []).filter((exam) => !isResults || exam.status !== "draft");
    return {
      all: source.length,
      draft: source.filter((e) => e.status === "draft").length,
      published: source.filter((e) => e.status === "published").length,
      closed: source.filter((e) => e.status === "closed").length,
    };
  }, [data, isResults]);

  async function copyLink(exam: ExamSummary) {
    if (!exam.slug) return;
    const ok = await copyText(`${window.location.origin}/${exam.slug}`);
    notify(ok ? "Tautan ulangan disalin." : "Gagal menyalin. Salin manual dari editor.");
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api(`/exams/${toDelete.id}`, { method: "DELETE" });
      setData((prev) => (prev ? { exams: prev.exams.filter((e) => e.id !== toDelete.id) } : prev));
      notify("Ulangan dihapus.");
      setToDelete(null);
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "Semua" },
    ...(isResults ? [] : [{ key: "draft" as Filter, label: "Draft" }]),
    { key: "published", label: "Aktif" },
    { key: "closed", label: "Ditutup" },
  ];

  return (
    <>
      <Topbar title={isResults ? "Hasil & Analitik" : "Ulangan"}>
        <button className="btn btn-primary" onClick={createExam} disabled={creating}>
          <Icon name="plus" size={16} /> Buat ulangan
        </button>
      </Topbar>

      <div className="page-content">
        <section className="welcome-row">
          <div>
            <h1>{isResults ? "Hasil & Analitik" : "Semua ulangan"}</h1>
            <p>{isResults ? "Pilih ulangan untuk melihat nilai murid dan analisisnya." : "Buat, ubah, dan kelola ulangan yang kamu miliki."}</p>
          </div>
        </section>

        {loading && !data && <Spinner />}
        {error && !data && <ErrorState message={error.message} onRetry={reload} />}

        {data && (
          <section className="panel">
            <div className="list-toolbar">
              <div className="tabs" role="tablist">
                {tabs.map((tab) => (
                  <button key={tab.key} role="tab" aria-selected={filter === tab.key} className={filter === tab.key ? "tab tab-on" : "tab"} onClick={() => setFilter(tab.key)}>
                    {tab.label} <span>{counts[tab.key]}</span>
                  </button>
                ))}
              </div>
              <label className="search-field">
                <Icon name="search" size={16} />
                <input placeholder="Cari ulangan..." value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Cari ulangan" />
              </label>
            </div>

            {exams.length === 0 ? (
              <EmptyState
                icon={query || filter !== "all" ? "search" : "file"}
                title={query || filter !== "all" ? "Tidak ada hasil" : isResults ? "Belum ada hasil" : "Belum ada ulangan"}
                text={
                  query || filter !== "all"
                    ? "Coba ubah kata kunci atau filter."
                    : isResults
                      ? "Hasil akan muncul setelah ulangan dipublish dan murid mulai mengerjakan."
                      : "Mulai dengan membuat ulangan pertamamu."
                }
              />
            ) : (
              <div className="table">
                <div className="table-row table-head list-cols">
                  <span>Nama ulangan</span><span>Kelas</span><span>Peserta</span><span>Rata-rata</span><span>Status</span><span />
                </div>
                {exams.map((exam) => (
                  <div className="table-row list-cols row-with-actions" key={exam.id}>
                    <Link to={isResults ? `/dashboard/hasil/${exam.id}` : `/dashboard/ulangan/${exam.id}`} className="cell-main row-link">
                      <b>{exam.title}</b>
                      <small>
                        {exam.questionCount} soal · {exam.status === "draft" ? `diubah ${timeAgo(exam.updatedAt)}` : `dibuat ${formatDateShort(exam.createdAt)}`}
                      </small>
                      <small className="show-sm">
                        {[exam.className && `Kelas ${exam.className}`, `${exam.participants} peserta`, exam.avgScore !== null && `rata-rata ${formatNumber(exam.avgScore)}`].filter(Boolean).join(" · ")}
                      </small>
                    </Link>
                    <span className="hide-sm">{exam.className || "–"}</span>
                    <span className="hide-sm">{exam.participants}</span>
                    <span className="hide-sm"><b>{formatNumber(exam.avgScore)}</b></span>
                    <span><StatusBadge status={exam.status} /></span>
                    <span className="row-actions">
                      {exam.slug && exam.status === "published" && (
                        <button className="icon-button" aria-label={`Salin tautan ${exam.title}`} title="Salin tautan" onClick={() => copyLink(exam)}>
                          <Icon name="copy" size={16} />
                        </button>
                      )}
                      {!isResults && exam.status !== "draft" && (
                        <button className="icon-button" aria-label={`Hasil ${exam.title}`} title="Lihat hasil" onClick={() => navigate(`/dashboard/hasil/${exam.id}`)}>
                          <Icon name="chart" size={16} />
                        </button>
                      )}
                      {!isResults && (
                        <button className="icon-button icon-danger" aria-label={`Hapus ${exam.title}`} title="Hapus" onClick={() => setToDelete(exam)}>
                          <Icon name="trash" size={16} />
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {toDelete && (
        <Modal
          icon="trash"
          title="Hapus ulangan?"
          description="Tindakan ini tidak bisa dibatalkan."
          onClose={() => !deleting && setToDelete(null)}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setToDelete(null)} disabled={deleting}>Batal</button>
              <button className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>{deleting ? "Menghapus..." : "Ya, hapus"}</button>
            </>
          }
        >
          <p className="modal-text">
            <b>{toDelete.title}</b>
            {toDelete.participants > 0 ? ` beserta ${toDelete.participants} hasil pengerjaan murid akan dihapus permanen.` : " akan dihapus permanen."}
            {toDelete.status === "published" && " Tautan yang sudah dibagikan tidak akan bisa dibuka lagi."}
          </p>
        </Modal>
      )}
    </>
  );
}
