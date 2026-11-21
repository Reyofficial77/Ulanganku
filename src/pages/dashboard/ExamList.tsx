import { useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { EmptyState, ErrorState, Modal, Spinner, StatusBadge } from "../../components/ui";
import { api, type ExamStatus, type ExamSummary } from "../../lib/api";
import { formatDateShort, formatNumber, timeAgo } from "../../lib/format";
import { copyText, useApi, useTitle } from "../../lib/hooks";
import { usePreferences } from "../../lib/preferences";
import { Link, navigate } from "../../lib/router";
import { Topbar, useShell } from "./shell";

type Filter = "all" | ExamStatus;

export default function ExamList({ mode }: { mode: "exams" | "results" }) {
  const { t } = usePreferences();
  const isResults = mode === "results";
  useTitle(`${isResults ? t("Hasil & Analitik", "Results & Analytics") : t("Ulangan", "Exams")} - Ulanganku`, true);
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
    notify(ok ? t("Tautan ulangan disalin.", "Exam link copied.") : t("Gagal menyalin. Salin manual dari editor.", "Failed to copy. Copy manually from the editor."));
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api(`/exams/${toDelete.id}`, { method: "DELETE" });
      setData((prev) => (prev ? { exams: prev.exams.filter((e) => e.id !== toDelete.id) } : prev));
      notify(t("Ulangan dihapus.", "Exam deleted."));
      setToDelete(null);
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: t("Semua", "All") },
    ...(isResults ? [] : [{ key: "draft" as Filter, label: t("Draft", "Draft") }]),
    { key: "published", label: t("Aktif", "Active") },
    { key: "closed", label: t("Ditutup", "Closed") },
  ];

  return (
    <>
      <Topbar title={isResults ? t("Hasil & Analitik", "Results & Analytics") : t("Ulangan", "Exams")}>
        <button className="btn btn-primary" onClick={createExam} disabled={creating}>
          <Icon name="plus" size={16} /> {t("Buat ulangan", "Create exam")}
        </button>
      </Topbar>

      <div className="page-content">
        <section className="welcome-row">
          <div>
            <h1>{isResults ? t("Hasil & Analitik", "Results & Analytics") : t("Semua ulangan", "All exams")}</h1>
            <p>{isResults ? t("Pilih ulangan untuk melihat nilai murid dan analisisnya.", "Select an exam to view student scores and analytics.") : t("Buat, ubah, dan kelola ulangan yang kamu miliki.", "Create, edit, and manage your exams.")}</p>
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
                <input placeholder={t("Cari ulangan...", "Search exams...")} value={query} onChange={(event) => setQuery(event.target.value)} aria-label={t("Cari ulangan", "Search exams")} />
              </label>
            </div>

            {exams.length === 0 ? (
              <EmptyState
                icon={query || filter !== "all" ? "search" : "file"}
                title={query || filter !== "all" ? t("Tidak ada hasil", "No results") : isResults ? t("Belum ada hasil", "No results yet") : t("Belum ada ulangan", "No exams yet")}
                text={
                  query || filter !== "all"
                    ? t("Coba ubah kata kunci atau filter.", "Try changing your keywords or filter.")
                    : isResults
                      ? t("Hasil akan muncul setelah ulangan dipublish dan murid mulai mengerjakan.", "Results will appear once an exam is published and students start.")
                      : t("Mulai dengan membuat ulangan pertamamu.", "Start by creating your first exam.")
                }
              />
            ) : (
              <div className="table">
                <div className="table-row table-head list-cols">
                  <span>{t("Nama ulangan", "Exam title")}</span><span>{t("Kelas", "Class")}</span><span>{t("Peserta", "Participants")}</span><span>{t("Rata-rata", "Average")}</span><span>{t("Status", "Status")}</span><span />
                </div>
                {exams.map((exam) => (
                  <div className="table-row list-cols row-with-actions" key={exam.id}>
                    <Link to={isResults ? `/dashboard/hasil/${exam.id}` : `/dashboard/ulangan/${exam.id}`} className="cell-main row-link">
                      <b>{exam.title}</b>
                      <small>
                        {exam.questionCount} {t("soal", "questions")} · {exam.status === "draft" ? `${t("diubah", "updated")} ${timeAgo(exam.updatedAt)}` : `${t("dibuat", "created")} ${formatDateShort(exam.createdAt)}`}
                      </small>
                      <small className="show-sm">
                        {[exam.className && `${t("Kelas", "Class")} ${exam.className}`, `${exam.participants} ${t("peserta", "participants")}`, exam.avgScore !== null && `${t("rata-rata", "avg")} ${formatNumber(exam.avgScore)}`].filter(Boolean).join(" · ")}
                      </small>
                    </Link>
                    <span className="hide-sm">{exam.className || "–"}</span>
                    <span className="hide-sm">{exam.participants}</span>
                    <span className="hide-sm"><b>{formatNumber(exam.avgScore)}</b></span>
                    <span><StatusBadge status={exam.status} /></span>
                    <span className="row-actions">
                      {exam.slug && exam.status === "published" && (
                        <button className="icon-button" aria-label={`${t("Salin tautan", "Copy link")} ${exam.title}`} title={t("Salin tautan", "Copy link")} onClick={() => copyLink(exam)}>
                          <Icon name="copy" size={16} />
                        </button>
                      )}
                      {!isResults && exam.status !== "draft" && (
                        <button className="icon-button" aria-label={`${t("Hasil", "Results")} ${exam.title}`} title={t("Lihat hasil", "View results")} onClick={() => navigate(`/dashboard/hasil/${exam.id}`)}>
                          <Icon name="chart" size={16} />
                        </button>
                      )}
                      {!isResults && (
                        <button className="icon-button icon-danger" aria-label={`${t("Hapus", "Delete")} ${exam.title}`} title={t("Hapus", "Delete")} onClick={() => setToDelete(exam)}>
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
          title={t("Hapus ulangan?", "Delete exam?")}
          description={t("Tindakan ini tidak bisa dibatalkan.", "This action cannot be undone.")}
          onClose={() => !deleting && setToDelete(null)}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setToDelete(null)} disabled={deleting}>{t("Batal", "Cancel")}</button>
              <button className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>{deleting ? t("Menghapus...", "Deleting...") : t("Ya, hapus", "Yes, delete")}</button>
            </>
          }
        >
          <p className="modal-text">
            <b>{toDelete.title}</b>
            {toDelete.participants > 0 ? t(` beserta ${toDelete.participants} hasil pengerjaan murid akan dihapus permanen.`, ` along with ${toDelete.participants} student submission(s) will be permanently deleted.`) : t(" akan dihapus permanen.", " will be permanently deleted.")}
            {toDelete.status === "published" && t(" Tautan yang sudah dibagikan tidak akan bisa dibuka lagi.", " Any shared link will no longer open.")}
          </p>
        </Modal>
      )}
    </>
  );
}
