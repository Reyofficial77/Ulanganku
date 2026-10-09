import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { ErrorState, Modal, Spinner, StatusBadge } from "../../components/ui";
import { api, type Exam, type Question } from "../../lib/api";
import { slugify } from "../../lib/format";
import { copyText, uid, useTitle } from "../../lib/hooks";
import { Link } from "../../lib/router";
import { Topbar, useShell } from "./shell";

type SaveState = "saved" | "dirty" | "saving" | "error";
type SlugCheck = { state: "idle" | "checking" | "ok" | "bad"; reason?: string | null };

const blankQuestion = (): Question => ({ id: uid(), type: "multiple_choice", text: "", options: ["", "", "", ""], correctIndex: 0, correctAnswer: null, imageUrl: null, required: true });

const questionTypeLabels: Record<Question["type"], string> = {
  multiple_choice: "Pilihan ganda", short_answer: "Jawaban singkat", essay: "Uraian", true_false: "Benar / Salah",
  story: "Soal cerita", story_image: "Soal cerita + gambar", image: "Soal bergambar",
};

export default function Editor({ id }: { id: string }) {
  const { notify } = useShell();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<"publish" | "success" | "close" | null>(null);
  const [tick, setTick] = useState(0);
  const [durationText, setDurationText] = useState("45");

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
        allowRetakes: current.allowRetakes,
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

  function updateQuestion(qid: string, changes: Partial<Question>) {
    patch({ questions: exam!.questions.map((q) => (q.id === qid ? { ...q, ...changes } : q)) });
  }

  function addQuestion() {
    const question = blankQuestion();
    patch({ questions: [...exam!.questions, question] });
    setSelectedId(question.id);
    window.setTimeout(() => document.getElementById(`q-${question.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }

  function removeQuestion(qid: string) {
    if (exam!.questions.length === 1) return;
    const remaining = exam!.questions.filter((q) => q.id !== qid);
    patch({ questions: remaining });
    if (selectedId === qid) setSelectedId(remaining[0]?.id ?? null);
  }

  function setOption(question: Question, index: number, text: string) {
    updateQuestion(question.id, { options: question.options.map((o, i) => (i === index ? text : o)) });
  }

  function addOption(question: Question) {
    if (question.options.length >= 6) return;
    updateQuestion(question.id, { options: [...question.options, ""] });
  }

  function removeOption(question: Question, index: number) {
    if (question.options.length <= 2) return;
    const options = question.options.filter((_, i) => i !== index);
    let correctIndex = question.correctIndex;
    if (index < correctIndex) correctIndex -= 1;
    else if (index === correctIndex) correctIndex = 0;
    updateQuestion(question.id, { options, correctIndex });
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
                const incomplete = !question.text.trim() || (["multiple_choice", "story", "story_image", "image"].includes(question.type) && (question.options.some((o) => !o.trim()) || question.correctIndex === null)) || ((question.type === "short_answer" || question.type === "true_false") && !question.correctAnswer?.trim());
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
                    <p>{question.text.trim() || "Soal belum ditulis"}</p>
                    {incomplete && <i className="dot-warn" title="Belum lengkap" />}
                  </button>
                );
              })}
            </div>
            {!locked && (
              <button className="btn btn-outline btn-block" onClick={addQuestion}><Icon name="plus" size={16} /> Tambah soal</button>
            )}
          </aside>

          <div className="question-canvas">
            {exam.questions.map((question, qi) => (
              <article
                id={`q-${question.id}`}
                key={question.id}
                className={`question-card ${selectedId === question.id ? "question-card-active" : ""}`}
                onFocus={() => setSelectedId(question.id)}
              >
                <div className="question-card-head">
                  <div className="question-number">{qi + 1}</div>
                  <div className="question-content">
                    <div className="question-type-row">
                      <select
                        className="question-type-select"
                        value={question.type}
                        disabled={locked}
                        onChange={(event) => {
                          const type = event.target.value as Question["type"];
                          updateQuestion(question.id, {
                            type,
                            options: ["multiple_choice", "story", "story_image", "image"].includes(type) ? (question.options.length >= 2 ? question.options : ["", ""]) : [],
                            correctIndex: ["multiple_choice", "story", "story_image", "image"].includes(type) ? (question.correctIndex ?? 0) : null,
                            correctAnswer: type === "true_false" ? (question.correctAnswer ?? "true") : type === "short_answer" ? question.correctAnswer : null,
                          });
                        }}
                      >
                        {Object.entries(questionTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                      <label className="question-required">
                        <input type="checkbox" checked={question.required} disabled={locked} onChange={(event) => updateQuestion(question.id, { required: event.target.checked })} />
                        Wajib dijawab
                      </label>
                    </div>
                    <textarea
                      className="question-input"
                      rows={2}
                      aria-label={`Pertanyaan ${qi + 1}`}
                      placeholder={question.type === "story" || question.type === "story_image" ? "Tulis teks cerita dan pertanyaannya di sini..." : "Tulis pertanyaan di sini..."}
                      readOnly={locked}
                      maxLength={5000}
                      value={question.text}
                      onChange={(event) => updateQuestion(question.id, { text: event.target.value })}
                    />
                  </div>
                  {!locked && (
                    <button className="icon-button icon-danger" aria-label={`Hapus soal ${qi + 1}`} disabled={exam.questions.length === 1} onClick={() => removeQuestion(question.id)}>
                      <Icon name="trash" size={17} />
                    </button>
                  )}
                </div>

                {(question.type === "image" || question.type === "story_image") && (
                  <div className="question-image-editor">
                    <label className="field"><span>URL gambar</span><input className="plain-input" placeholder="https://contoh.com/gambar.jpg" readOnly={locked} value={question.imageUrl ?? ""} onChange={(event) => updateQuestion(question.id, { imageUrl: event.target.value })} /></label>
                    {question.imageUrl && <img src={question.imageUrl} alt="Pratinjau soal" />}
                  </div>
                )}

                {["multiple_choice", "story", "story_image", "image"].includes(question.type) && (
                  <div className="options-list">
                    {question.options.map((option, oi) => {
                      const correct = question.correctIndex === oi;
                      return (
                        <div className={`option ${correct ? "option-correct" : ""}`} key={oi}>
                          <button type="button" className={`radio ${correct ? "radio-on" : ""}`} role="radio" aria-checked={correct} aria-label={`Jadikan pilihan ${String.fromCharCode(65 + oi)} sebagai kunci jawaban`} disabled={locked} onClick={() => updateQuestion(question.id, { correctIndex: oi })}>
                            {correct && <Icon name="check" size={12} />}
                          </button>
                          <span className="option-letter">{String.fromCharCode(65 + oi)}</span>
                          <input aria-label={`Pilihan ${String.fromCharCode(65 + oi)} soal ${qi + 1}`} placeholder={`Pilihan ${String.fromCharCode(65 + oi)}`} readOnly={locked} maxLength={500} value={option} onChange={(event) => setOption(question, oi, event.target.value)} />
                          {correct && <span className="answer-key">Kunci jawaban</span>}
                          {!locked && question.options.length > 2 && <button className="icon-button icon-sm" aria-label={`Hapus pilihan ${String.fromCharCode(65 + oi)}`} onClick={() => removeOption(question, oi)}><Icon name="close" size={14} /></button>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {question.type === "true_false" && (
                  <label className="field"><span>Jawaban benar</span><select className="plain-input" disabled={locked} value={question.correctAnswer ?? "true"} onChange={(event) => updateQuestion(question.id, { correctAnswer: event.target.value })}><option value="true">Benar</option><option value="false">Salah</option></select></label>
                )}

                {question.type === "short_answer" && (
                  <label className="field"><span>Kunci jawaban</span><input className="plain-input" placeholder="Jawaban yang dianggap benar" readOnly={locked} maxLength={1000} value={question.correctAnswer ?? ""} onChange={(event) => updateQuestion(question.id, { correctAnswer: event.target.value })} /></label>
                )}

                {question.type === "essay" && <div className="info-note"><Icon name="info" size={16} /><p>Jawaban uraian disimpan untuk diperiksa guru dan tidak dinilai otomatis.</p></div>}

                {["multiple_choice", "story", "story_image", "image"].includes(question.type) && !locked && question.options.length < 6 && <button className="text-button" onClick={() => addOption(question)}><Icon name="plus" size={14} /> Tambah pilihan</button>}
              </article>
            ))}

            {!locked && (
              <button className="large-add" onClick={addQuestion}><Icon name="plus" size={18} /> Tambah soal baru</button>
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
                <strong>Izinkan pengerjaan ulang</strong>
                <span>Murid boleh mengerjakan lagi dari device yang sama</span>
              </div>
              <button className={`toggle ${exam.allowRetakes ? "toggle-on" : ""}`} role="switch" aria-checked={exam.allowRetakes} aria-label="Izinkan pengerjaan ulang di device yang sama" onClick={() => patch({ allowRetakes: !exam.allowRetakes })}>
                <span />
              </button>
            </div>
            <div className="info-note">
              <Icon name="shield" size={16} />
              <p>Jawaban murid tersimpan otomatis. Pengaturan pengerjaan ulang menentukan apakah device yang sama boleh membuat attempt baru.</p>
            </div>
          </aside>
        </div>
      </div>

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
