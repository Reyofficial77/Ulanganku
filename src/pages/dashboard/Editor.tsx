import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { ErrorState, Modal, Spinner, StatusBadge } from "../../components/ui";
import { api, type Exam, type Question } from "../../lib/api";
import { kindLabel, blankQuestion, isComplete, KIND_META } from "../../lib/questions";
import { slugify } from "../../lib/format";
import { copyText, useTitle } from "../../lib/hooks";
import { Link } from "../../lib/router";
import QuestionCard from "./QuestionCard";
import { Topbar, useShell } from "./shell";

type SaveState = "saved" | "dirty" | "saving" | "error";
type SlugCheck = { state: "idle" | "checking" | "ok" | "bad"; reason?: string | null };

export default function Editor({ id }: { id: string }) {
  const { notify } = useShell();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<"publish" | "success" | "close" | "pick" | null>(null);
  const [tick, setTick] = useState(0);
  const [durationText, setDurationText] = useState("45");
  const [attemptsText, setAttemptsText] = useState("");

  const rev = useRef(0);
  const inFlight = useRef(false);
  const examRef = useRef<Exam | null>(null);
  examRef.current = exam;

  useTitle(`${exam?.title || "Editor"} - Ulanganku`, true);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const { exam: data } = await api<{ exam: Exam }>(`/exams/${id}`);
      setExam(data);
      setSelectedId(data.questions[0]?.id ?? null);
      setDurationText(String(data.durationMin));
      setAttemptsText(data.maxAttempts > 0 ? String(data.maxAttempts) : "");
    } catch (error) {
      setLoadError((error as Error).message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = useCallback((changes: Partial<Exam>) => {
    setExam((prev) => (prev ? { ...prev, ...changes } : prev));
    rev.current += 1;
    setSaveState("dirty");
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    const current = examRef.current;
    if (!current) return false;
    if (inFlight.current) return false;
    inFlight.current = true;
    const started = rev.current;
    setSaveState("saving");
    try {
      const body: Record<string, unknown> = {
        title: current.title.trim() ? current.title : undefined,
        className: current.className,
        durationMin: current.durationMin,
        shuffle: current.shuffle,
        showScore: current.showScore,
        allowRetake: current.allowRetake,
        maxAttempts: current.maxAttempts,
      };
      if (current.participants === 0) body.questions = current.questions;
      const { exam: saved } = await api<{ exam: Exam }>(`/exams/${id}`, { method: "PUT", body });
      setExam((prev) => (prev ? { ...prev, participants: saved.participants, updatedAt: saved.updatedAt } : prev));
      setSaveError(null);
      if (rev.current === started) {
        setSaveState("saved");
      } else {
        setSaveState("dirty");
        setTick((value) => value + 1);
      }
      return rev.current === started;
    } catch (error) {
      setSaveState("error");
      setSaveError((error as Error).message);
      return false;
    } finally {
      inFlight.current = false;
    }
  }, [id]);

  // Simpan otomatis setelah berhenti mengetik.
  useEffect(() => {
    if (saveState !== "dirty") return;
    const timer = window.setTimeout(save, 900);
    return () => window.clearTimeout(timer);
  }, [saveState, exam, tick, save]);

  useEffect(() => {
    if (saveState === "saved") return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveState]);

  if (loadError) {
    return (
      <>
        <Topbar title="Editor" />
        <div className="page-content"><ErrorState message={loadError} onRetry={load} /></div>
      </>
    );
  }
  if (!exam) {
    return (
      <>
        <Topbar title="Editor" />
        <div className="page-content"><Spinner /></div>
      </>
    );
  }

  const locked = exam.participants > 0;
  const shareUrl = exam.slug ? `${window.location.origin}/${exam.slug}` : "";

  function updateQuestion(next: Question) {
    patch({ questions: exam!.questions.map((q) => (q.id === next.id ? next : q)) });
  }

  function addQuestion(kind: Question["kind"]) {
    const question = blankQuestion(kind);
    patch({ questions: [...exam!.questions, question] });
    setSelectedId(question.id);
    setModal(null);
    window.setTimeout(() => document.getElementById(`q-${question.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  }

  function removeQuestion(qid: string) {
    if (exam!.questions.length === 1) return;
    const remaining = exam!.questions.filter((q) => q.id !== qid);
    patch({ questions: remaining });
    if (selectedId === qid) setSelectedId(remaining[0]?.id ?? null);
  }

  function commitDuration(value: string) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 600) {
      if (parsed !== exam!.durationMin) patch({ durationMin: parsed });
    }
  }

  async function copyShare() {
    const ok = await copyText(shareUrl);
    notify(ok ? "Tautan disalin." : "Gagal menyalin tautan.");
  }

  async function closeExam() {
    try {
      const { exam: updated } = await api<{ exam: Exam }>(`/exams/${id}/close`, { method: "POST", body: {} });
      setExam((prev) => (prev ? { ...prev, status: updated.status } : prev));
      setModal(null);
      notify("Ulangan ditutup. Murid tidak bisa memulai lagi.");
    } catch (error) {
      notify((error as Error).message);
    }
  }

  const saveLabel =
    saveState === "saving" ? "Menyimpan..." : saveState === "dirty" ? "Belum tersimpan" : saveState === "error" ? "Gagal menyimpan" : "Tersimpan";

  return (
    <>
      <Topbar
        title={
          <div className="breadcrumb">
            <Link to="/dashboard/ulangan">Ulangan</Link>
            <Icon name="chevron" size={14} />
            <strong>{exam.title || "Tanpa judul"}</strong>
          </div>
        }
      >
        <span className={`save-state save-${saveState}`} role="status">
          <Icon name={saveState === "error" ? "alert" : saveState === "saved" ? "check" : "refresh"} size={14} />
          <span className="hide-sm">{saveLabel}</span>
        </span>
        {saveState === "error" && (
          <button className="btn btn-outline" onClick={() => save()}>Coba lagi</button>
        )}
        {exam.status === "published" ? (
          <button className="btn btn-outline" onClick={() => setModal("close")}>Tutup ulangan</button>
        ) : (
          <button className="btn btn-primary" onClick={() => setModal("publish")}>
            {exam.publishedAt ? "Publish ulang" : "Publish"}
          </button>
        )}
      </Topbar>

      <div className="page-content editor-page">
        <section className="editor-heading">
          <div className="editor-heading-main">
            <div className="heading-row">
              <span className="eyebrow">EDITOR ULANGAN</span>
              <StatusBadge status={exam.status} />
            </div>
            <input
              className="title-input"
              aria-label="Judul ulangan"
              placeholder="Judul ulangan"
              maxLength={120}
              value={exam.title}
              onChange={(event) => patch({ title: event.target.value })}
            />
            <div className="exam-meta">
              <span><Icon name="clock" size={15} /> {exam.durationMin} menit</span>
              <span><Icon name="file" size={15} /> {exam.questions.length} soal</span>
              {exam.className && <span><Icon name="users" size={15} /> Kelas {exam.className}</span>}
              {exam.participants > 0 && (
                <Link to={`/dashboard/hasil/${exam.id}`} className="text-link"><Icon name="chart" size={15} /> {exam.participants} peserta</Link>
              )}
            </div>
          </div>
        </section>

        {saveError && (
          <div className="notice notice-danger" role="alert"><Icon name="alert" size={16} /><span>{saveError}</span></div>
        )}

        {exam.status === "published" && exam.slug && (
          <div className="share-bar">
            <Icon name="link" size={17} />
            <code>{shareUrl}</code>
            <button className="btn btn-outline" onClick={copyShare}><Icon name="copy" size={15} /> Salin</button>
            <a className="btn btn-outline" href={shareUrl} target="_blank" rel="noreferrer"><Icon name="external" size={15} /> Buka</a>
          </div>
        )}

        {locked && (
          <div className="notice">
            <Icon name="lock" size={16} />
            <span>Soal dikunci karena sudah ada {exam.participants} murid yang mengerjakan. Pengaturan lain masih bisa diubah.</span>
          </div>
        )}

        <div className="editor-layout">
          <aside className="question-outline">
            <div className="outline-header"><span>DAFTAR SOAL</span><strong>{exam.questions.length}</strong></div>
            <div className="outline-list">
              {exam.questions.map((question, index) => {
                const incomplete = !isComplete(question);
                return (
                  <button
                    key={question.id}
                    className={selectedId === question.id ? "selected" : ""}
                    onClick={() => {
                      setSelectedId(question.id);
                      document.getElementById(`q-${question.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                  >
                    <span>{index + 1}</span>
                    <p>{question.text.trim() || "Soal belum ditulis"}<small>{kindLabel(question.kind)}</small></p>
                    {incomplete && <i className="dot-warn" title="Belum lengkap" />}
                  </button>
                );
              })}
            </div>
            {!locked && (
              <button className="btn btn-outline btn-block" onClick={() => setModal("pick")}><Icon name="plus" size={16} /> Tambah soal</button>
            )}
          </aside>

          <div className="question-canvas">
            {exam.questions.map((question, qi) => (
              <QuestionCard
                key={question.id}
                question={question}
                index={qi}
                locked={locked}
                active={selectedId === question.id}
                canRemove={exam.questions.length > 1}
                onChange={updateQuestion}
                onRemove={() => removeQuestion(question.id)}
                onFocus={() => setSelectedId(question.id)}
              />
            ))}

            {!locked && (
              <button className="large-add" onClick={() => setModal("pick")}><Icon name="plus" size={18} /> Tambah soal baru</button>
            )}
          </div>

          <aside className="settings-panel">
            <div className="settings-title">Pengaturan ulangan</div>
            <label className="field">
              <span>Durasi pengerjaan</span>
              <div className="field-with-suffix">
                <input
                  inputMode="numeric"
                  value={durationText}
                  onChange={(event) => {
                    const value = event.target.value.replace(/\D/g, "").slice(0, 3);
                    setDurationText(value);
                    commitDuration(value);
                  }}
                  onBlur={() => setDurationText(String(exam.durationMin))}
                />
                <span>menit</span>
              </div>
            </label>
            <label className="field">
              <span>Kelas</span>
              <input
                className="plain-input"
                placeholder="Contoh: 8A"
                maxLength={40}
                value={exam.className}
                onChange={(event) => patch({ className: event.target.value })}
              />
            </label>
            <div className="toggle-row">
              <div>
                <strong>Acak urutan soal</strong>
                <span>Setiap murid mendapat urutan berbeda</span>
              </div>
              <button className={`toggle ${exam.shuffle ? "toggle-on" : ""}`} role="switch" aria-checked={exam.shuffle} aria-label="Acak urutan soal" onClick={() => patch({ shuffle: !exam.shuffle })}>
                <span />
              </button>
            </div>
            <div className="toggle-row">
              <div>
                <strong>Tampilkan nilai</strong>
                <span>Murid melihat nilai setelah selesai</span>
              </div>
              <button className={`toggle ${exam.showScore ? "toggle-on" : ""}`} role="switch" aria-checked={exam.showScore} aria-label="Tampilkan nilai ke murid" onClick={() => patch({ showScore: !exam.showScore })}>
                <span />
              </button>
            </div>
            <div className="toggle-row">
              <div>
                <strong>Boleh mengulang</strong>
                <span>Murid bisa mengerjakan lagi di perangkat yang sama</span>
              </div>
              <button className={`toggle ${exam.allowRetake ? "toggle-on" : ""}`} role="switch" aria-checked={exam.allowRetake} aria-label="Izinkan murid mengulang di perangkat yang sama" onClick={() => patch({ allowRetake: !exam.allowRetake })}>
                <span />
              </button>
            </div>
            {exam.allowRetake && (
              <label className="field retake-field">
                <span>Maksimal percobaan</span>
                <div className="field-with-suffix">
                  <input
                    inputMode="numeric"
                    placeholder="Tanpa batas"
                    value={attemptsText}
                    onChange={(event) => {
                      const value = event.target.value.replace(/\D/g, "").slice(0, 2);
                      setAttemptsText(value);
                      const parsed = value === "" ? 0 : Number(value);
                      if (parsed === 0 || parsed >= 2) patch({ maxAttempts: parsed });
                    }}
                    onBlur={() => setAttemptsText(exam.maxAttempts > 0 ? String(exam.maxAttempts) : "")}
                  />
                  <span>kali</span>
                </div>
                <small>Kosongkan untuk tanpa batas. Minimal 2. Nilai tertinggi yang dipakai di statistik.</small>
              </label>
            )}
            <div className="info-note">
              <Icon name="shield" size={16} />
              <p>{exam.allowRetake ? "Jawaban murid tersimpan otomatis. Setiap percobaan dicatat terpisah." : "Jawaban murid tersimpan otomatis dan satu perangkat hanya mendapat satu kesempatan."}</p>
            </div>
          </aside>
        </div>
      </div>

      {modal === "pick" && (
        <Modal icon="file" title="Pilih tipe soal" description="Tipe bisa diubah lagi nanti dari kartu soal." onClose={() => setModal(null)}>
          <div className="kind-grid">
            {KIND_META.map((item) => (
              <button key={item.kind} className="kind-card" onClick={() => addQuestion(item.kind)}>
                <span className="kind-icon"><Icon name={item.icon} size={18} /></span>
                <strong>{item.label}</strong>
                <small>{item.desc}</small>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {modal === "publish" && (
        <PublishModal
          exam={exam}
          onClose={() => setModal(null)}
          beforePublish={async () => {
            if (saveState === "saved") return true;
            return save();
          }}
          onPublished={(updated) => {
            setExam((prev) => (prev ? { ...prev, status: updated.status, slug: updated.slug, publishedAt: updated.publishedAt } : prev));
            setModal("success");
          }}
        />
      )}

      {modal === "success" && exam.slug && (
        <Modal icon="check" title="Ulangan berhasil dipublish" description="Tautan sudah aktif. Bagikan ke murid untuk mulai mengerjakan." onClose={() => setModal(null)}
          footer={<button className="btn btn-primary" onClick={() => setModal(null)}>Selesai</button>}>
          <div className="generated-url">
            <span>{shareUrl}</span>
            <button className="btn btn-outline" onClick={copyShare}><Icon name="copy" size={15} /> Salin</button>
          </div>
          <div className="notice"><Icon name="users" size={16} /><span>Murid tidak perlu membuat akun atau login untuk mengerjakan.</span></div>
        </Modal>
      )}

      {modal === "close" && (
        <Modal icon="alert" title="Tutup ulangan?" description="Murid yang belum mulai tidak bisa membuka ulangan ini lagi." onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setModal(null)}>Batal</button>
              <button className="btn btn-danger" onClick={closeExam}>Ya, tutup</button>
            </>
          }>
          <p className="modal-text">Murid yang sedang mengerjakan tetap bisa mengumpulkan jawabannya. Kamu bisa membuka lagi kapan saja lewat tombol Publish ulang.</p>
        </Modal>
      )}
    </>
  );
}

function PublishModal({
  exam,
  onClose,
  beforePublish,
  onPublished,
}: {
  exam: Exam;
  onClose: () => void;
  beforePublish: () => Promise<boolean>;
  onPublished: (exam: Exam) => void;
}) {
  const locked = Boolean(exam.publishedAt && exam.slug);
  const [slug, setSlug] = useState(exam.slug ?? slugify(`${exam.title} ${exam.className}`));
  const [check, setCheck] = useState<SlugCheck>({ state: "idle" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const host = window.location.host;

  useEffect(() => {
    if (locked) return;
    if (!slug) {
      setCheck({ state: "idle" });
      return;
    }
    setCheck({ state: "checking" });
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const result = await api<{ available: boolean; reason: string | null }>(
          `/slug-check?slug=${encodeURIComponent(slug)}&exclude=${exam.id}`,
          { signal: controller.signal },
        );
        setCheck(result.available ? { state: "ok" } : { state: "bad", reason: result.reason });
      } catch (err) {
        if ((err as Error).name !== "AbortError") setCheck({ state: "bad", reason: (err as Error).message });
      }
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [slug, locked, exam.id]);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      if (!(await beforePublish())) throw new Error("Perubahan belum tersimpan. Coba lagi sebentar.");
      const result = await api<{ exam: Exam }>(`/exams/${exam.id}/publish`, { body: { slug } });
      onPublished(result.exam);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canPublish = !busy && (locked || check.state === "ok");

  return (
    <Modal
      title={locked ? "Publish ulang ulangan" : "Publish ulangan"}
      description="Buat tautan yang akan dibagikan kepada murid."
      onClose={() => !busy && onClose()}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>Batal</button>
          <button className="btn btn-primary" onClick={confirm} disabled={!canPublish}>{busy ? "Memproses..." : "Konfirmasi & publish"}</button>
        </>
      }
    >
      <label className="field">
        <span>URL ulangan</span>
        <div className="url-field">
          <span>{host}/</span>
          <input
            value={slug}
            disabled={locked}
            maxLength={60}
            placeholder="nama-ulangan"
            onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}
          />
        </div>
        {locked ? (
          <small>URL dikunci agar tautan yang sudah dibagikan tetap berlaku.</small>
        ) : check.state === "checking" ? (
          <small>Memeriksa ketersediaan...</small>
        ) : check.state === "ok" ? (
          <small className="text-ok">URL tersedia.</small>
        ) : check.state === "bad" ? (
          <small className="text-bad">{check.reason}</small>
        ) : (
          <small>Gunakan huruf kecil, angka, dan tanda hubung. URL tidak bisa diubah setelah publish.</small>
        )}
      </label>
      <div className="publish-summary">
        <div><Icon name="file" size={17} /><span><strong>{exam.questions.length} soal</strong>Total pertanyaan</span></div>
        <div><Icon name="clock" size={17} /><span><strong>{exam.durationMin} menit</strong>Waktu pengerjaan</span></div>
      </div>
      {error && <div className="notice notice-danger" role="alert"><Icon name="alert" size={16} /><span>{error}</span></div>}
    </Modal>
  );
}
