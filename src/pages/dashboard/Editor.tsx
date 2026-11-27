import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "../../components/Icon";
import { ErrorState, Modal, Spinner, StatusBadge } from "../../components/ui";
import { api, type Exam, type ProStatus, type Question } from "../../lib/api";
import { kindLabel, blankQuestion, isComplete, getKindMeta, uploadImage } from "../../lib/questions";
import { slugify } from "../../lib/format";
import { copyText, useApi, useTitle } from "../../lib/hooks";
import { usePreferences } from "../../lib/preferences";
import { Link } from "../../lib/router";
import QuestionCard from "./QuestionCard";
import { Topbar, useShell } from "./shell";

type SaveState = "saved" | "dirty" | "saving" | "error";
type SlugCheck = { state: "idle" | "checking" | "ok" | "bad"; reason?: string | null };

export default function Editor({ id }: { id: string }) {
  const { t } = usePreferences();
  const { notify } = useShell();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<"publish" | "success" | "close" | "pick" | null>(null);
  const [tick, setTick] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [templateSaveOpen, setTemplateSaveOpen] = useState(false);
  const [templateSaveName, setTemplateSaveName] = useState("");
  const [templateSaveSlug, setTemplateSaveSlug] = useState("");
  const [templateSaveSubject, setTemplateSaveSubject] = useState("Umum");
  const [templateSaveVisibility, setTemplateSaveVisibility] = useState<"public" | "private">("private");
  const [templateSaveBusy, setTemplateSaveBusy] = useState(false);
  const [templateSaveError, setTemplateSaveError] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [durationText, setDurationText] = useState("45");
  const [attemptsText, setAttemptsText] = useState("");

  const { data: pro } = useApi<ProStatus>("/pro/status");
  const isPro = Boolean(pro?.active);
  const [bannerBusy, setBannerBusy] = useState(false);
  const [titleBusy, setTitleBusy] = useState(false);
  const bannerInput = useRef<HTMLInputElement>(null);

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
        instructions: current.instructions,
        durationMin: current.durationMin,
        shuffle: current.shuffle,
        showScore: current.showScore,
        allowRetake: current.allowRetake,
        maxAttempts: current.maxAttempts,
        bannerUrl: current.bannerUrl,
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
    notify(ok ? t("Tautan disalin.", "Link copied.") : t("Gagal menyalin tautan.", "Failed to copy link."));
  }

  async function closeExam() {
    try {
      const { exam: updated } = await api<{ exam: Exam }>(`/exams/${id}/close`, { method: "POST", body: {} });
      setExam((prev) => (prev ? { ...prev, status: updated.status } : prev));
      setModal(null);
      notify(t("Ulangan ditutup. Murid tidak bisa memulai lagi.", "Exam closed. Students can no longer start."));
    } catch (error) {
      notify((error as Error).message);
    }
  }

  async function pickBanner(file: File | undefined) {
    if (!file) return;
    setBannerBusy(true);
    try {
      patch({ bannerUrl: await uploadImage(file) });
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setBannerBusy(false);
      if (bannerInput.current) bannerInput.current.value = "";
    }
  }

  async function saveCurrentAsTemplate(event: FormEvent) {
    event.preventDefault();
    if (!exam) return;
    setTemplateSaveBusy(true);
    setTemplateSaveError(null);
    try {
      const distribution: Record<string, number> = {};
      for (const question of exam.questions.slice(0, 200)) distribution[question.format] = (distribution[question.format] ?? 0) + 1;
      const { template } = await api<{ template: { slug: string } }>("/templates", {
        method: "POST",
        body: {
          name: templateSaveName,
          slug: templateSaveSlug,
          description: `Dibuat dari ulangan ${exam.title || "tanpa judul"}. Soal dan kunci jawaban dapat digunakan ulang lalu diedit.`,
          subject: templateSaveSubject,
          gradeLevel: exam.className,
          category: "Template ulangan",
          questionConfig: { distribution, questionTypes: Object.keys(distribution) },
          questionCount: Math.max(1, Math.min(200, exam.questions.length)),
          durationMin: exam.durationMin,
          difficulty: "Campuran",
          instructions: exam.instructions ?? "",
          reusableQuestions: exam.questions.slice(0, 200),
          visibility: templateSaveVisibility,
          status: "draft",
        },
      });
      setTemplateSaveOpen(false);
      notify(t(`Template disimpan sebagai draf: /template/${template.slug}`, `Template saved as draft: /template/${template.slug}`));
    } catch (error) {
      setTemplateSaveError((error as Error).message);
    } finally {
      setTemplateSaveBusy(false);
    }
  }

  async function autoTitle() {
    if (!exam) return;
    setTitleBusy(true);
    try {
      const texts = exam.questions.map((question) => question.text.trim()).filter(Boolean);
      const { title } = await api<{ title: string }>("/pro/ai/title", { method: "POST", body: { texts } });
      patch({ title });
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setTitleBusy(false);
    }
  }

  const saveLabel =
    saveState === "saving" ? t("Menyimpan...", "Saving...") : saveState === "dirty" ? t("Belum tersimpan", "Unsaved") : saveState === "error" ? t("Gagal menyimpan", "Save failed") : t("Tersimpan", "Saved");

  return (
    <>
      <Topbar
        title={
          <div className="breadcrumb">
            <Link to="/dashboard/ulangan" className="hide-xs">{t("Ulangan", "Exams")}</Link>
            <span className="hide-xs" aria-hidden="true"><Icon name="chevron" size={14} /></span>
            <strong>{exam.title || t("Tanpa judul", "Untitled")}</strong>
          </div>
        }
      >
        <span className={`save-state save-${saveState}`} role="status" title={saveLabel}>
          <Icon name={saveState === "error" ? "alert" : saveState === "saved" ? "check" : "refresh"} size={14} />
          <span className="hide-sm">{saveLabel}</span>
        </span>
        <button
          type="button"
          className="btn btn-outline topbar-icon-btn"
          aria-label={t("Preview ulangan", "Preview exam")}
          title={t("Preview", "Preview")}
          onClick={() => { setPreviewIndex(0); setPreviewOpen(true); }}
        >
          <Icon name="eye" size={16} /> <span className="hide-sm">{t("Preview", "Preview")}</span>
        </button>
        <button
          type="button"
          className="btn btn-outline topbar-icon-btn"
          aria-label={t("Simpan sebagai template", "Save as template")}
          title={t("Simpan template", "Save template")}
          onClick={() => { setTemplateSaveName(exam.title || "Template ulangan"); setTemplateSaveSlug(slugify(exam.title || "template-ulangan")); setTemplateSaveSubject("Umum"); setTemplateSaveVisibility("private"); setTemplateSaveError(null); setTemplateSaveOpen(true); }}
        >
          <Icon name="copy" size={16} /> <span className="hide-sm">{t("Simpan template", "Save template")}</span>
        </button>
        {saveState === "error" && (
          <button type="button" className="btn btn-outline" onClick={() => save()}>{t("Coba lagi", "Retry")}</button>
        )}
        {exam.status === "published" ? (
          <button type="button" className="btn btn-outline" onClick={() => setModal("close")}>{t("Tutup ulangan", "Close exam")}</button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => setModal("publish")}>
            {exam.publishedAt ? t("Publish ulang", "Republish") : t("Publish", "Publish")}
          </button>
        )}
      </Topbar>

      <div className="page-content editor-page">
        <section className="editor-heading">
          <div className="editor-heading-main">
            <div className="heading-row">
              <span className="eyebrow">{t("EDITOR ULANGAN", "EXAM EDITOR")}</span>
              <StatusBadge status={exam.status} />
              {isPro && (
                <button type="button" className="btn btn-outline btn-sm" onClick={autoTitle} disabled={titleBusy} title={t("Buat judul dari isi soal dengan AI", "Generate title from questions with AI")}>
                  <Icon name="sparkle" size={14} /> {titleBusy ? t("Membuat judul...", "Generating title...") : t("Judul otomatis", "Auto title")}
                </button>
              )}
            </div>
            <input
              className="title-input"
              aria-label={t("Judul ulangan", "Exam title")}
              placeholder={t("Judul ulangan", "Exam title")}
              maxLength={120}
              value={exam.title}
              onChange={(event) => patch({ title: event.target.value })}
            />
            <div className="exam-meta">
              <span><Icon name="clock" size={15} /> {exam.durationMin} {t("menit", "min")}</span>
              <span><Icon name="file" size={15} /> {exam.questions.length} {t("soal", "questions")}</span>
              {exam.className && <span><Icon name="users" size={15} /> {t("Kelas", "Class")} {exam.className}</span>}
              {exam.participants > 0 && (
                <Link to={`/dashboard/hasil/${exam.id}`} className="text-link"><Icon name="chart" size={15} /> {exam.participants} {t("peserta", "participants")}</Link>
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
            <button className="btn btn-outline" onClick={copyShare}><Icon name="copy" size={15} /> {t("Salin", "Copy")}</button>
            <a className="btn btn-outline" href={shareUrl} target="_blank" rel="noreferrer"><Icon name="external" size={15} /> {t("Buka", "Open")}</a>
          </div>
        )}

        {locked && (
          <div className="notice">
            <Icon name="lock" size={16} />
            <span>{t(`Soal dikunci karena sudah ada ${exam.participants} murid yang mengerjakan. Pengaturan lain masih bisa diubah.`, `Questions are locked because ${exam.participants} student(s) have already started. Other settings can still be changed.`)}</span>
          </div>
        )}

        <div className="editor-layout">
          <aside className="question-outline">
            <div className="outline-header"><span>{t("DAFTAR SOAL", "QUESTIONS")}</span><strong>{exam.questions.length}</strong></div>
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
                    <p>{question.text.trim() || t("Soal belum ditulis", "Empty question")}<small>{kindLabel(question.kind)}</small></p>
                    {incomplete && <i className="dot-warn" title={t("Belum lengkap", "Incomplete")} />}
                  </button>
                );
              })}
            </div>
            {!locked && (
              <button className="btn btn-outline btn-block" onClick={() => setModal("pick")}><Icon name="plus" size={16} /> {t("Tambah soal", "Add question")}</button>
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
              <button className="large-add" onClick={() => setModal("pick")}><Icon name="plus" size={18} /> {t("Tambah soal baru", "Add new question")}</button>
            )}
          </div>

          <aside className={`settings-panel ${settingsOpen ? "settings-open" : ""}`}>
            <button type="button" className="settings-toggle" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((open) => !open)}>
              <span>
                <strong>{t("Pengaturan ulangan", "Exam settings")}</strong>
                <small>{exam.durationMin} {t("menit", "min")} · {exam.className ? `${t("Kelas", "Class")} ${exam.className}` : t("Kelas belum diisi", "Class not set")}{exam.allowRetake ? ` · ${t("Boleh mengulang", "Retake allowed")}` : ""}</small>
              </span>
              <Icon name="chevron" size={16} />
            </button>
            <div className="settings-title">{t("Pengaturan ulangan", "Exam settings")}</div>
            <div className="settings-body">
            <label className="field">
              <span>{t("Durasi pengerjaan", "Duration")}</span>
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
                <span>{t("menit", "min")}</span>
              </div>
            </label>
            <label className="field">
              <span>{t("Kelas", "Class")}</span>
              <input
                className="plain-input"
                placeholder={t("Contoh: 8A", "Example: 8A")}
                maxLength={40}
                value={exam.className}
                onChange={(event) => patch({ className: event.target.value })}
              />
            </label>
            <label className="field">
              <span>{t("Petunjuk untuk murid", "Instructions for students")}</span>
              <textarea className="plain-input exam-instructions-input" rows={3} maxLength={2000} placeholder={t("Contoh: Kerjakan secara mandiri dan baca setiap soal dengan teliti.", "Example: Work independently and read each question carefully.")} value={exam.instructions ?? ""} onChange={(event) => patch({ instructions: event.target.value })} />
            </label>
            <div className="toggle-row">
              <div>
                <strong>{t("Acak urutan soal", "Shuffle questions")}</strong>
                <span>{t("Setiap murid mendapat urutan berbeda", "Each student gets a different order")}</span>
              </div>
              <button className={`toggle ${exam.shuffle ? "toggle-on" : ""}`} role="switch" aria-checked={exam.shuffle} aria-label={t("Acak urutan soal", "Shuffle questions")} onClick={() => patch({ shuffle: !exam.shuffle })}>
                <span />
              </button>
            </div>
            <div className="toggle-row">
              <div>
                <strong>{t("Tampilkan nilai", "Show score")}</strong>
                <span>{t("Murid melihat nilai setelah selesai", "Students see their score after submitting")}</span>
              </div>
              <button className={`toggle ${exam.showScore ? "toggle-on" : ""}`} role="switch" aria-checked={exam.showScore} aria-label={t("Tampilkan nilai ke murid", "Show score to students")} onClick={() => patch({ showScore: !exam.showScore })}>
                <span />
              </button>
            </div>
            <div className="toggle-row">
              <div>
                <strong>{t("Boleh mengulang", "Allow retakes")}</strong>
                <span>{t("Murid bisa mengerjakan lagi di perangkat yang sama", "Students can retake on the same device")}</span>
              </div>
              <button className={`toggle ${exam.allowRetake ? "toggle-on" : ""}`} role="switch" aria-checked={exam.allowRetake} aria-label={t("Izinkan murid mengulang di perangkat yang sama", "Allow retakes on the same device")} onClick={() => patch({ allowRetake: !exam.allowRetake })}>
                <span />
              </button>
            </div>
            {exam.allowRetake && (
              <label className="field retake-field">
                <span>{t("Maksimal percobaan", "Max attempts")}</span>
                <div className="field-with-suffix">
                  <input
                    inputMode="numeric"
                    placeholder={t("Tanpa batas", "Unlimited")}
                    value={attemptsText}
                    onChange={(event) => {
                      const value = event.target.value.replace(/\D/g, "").slice(0, 2);
                      setAttemptsText(value);
                      const parsed = value === "" ? 0 : Number(value);
                      if (parsed === 0 || parsed >= 2) patch({ maxAttempts: parsed });
                    }}
                    onBlur={() => setAttemptsText(exam.maxAttempts > 0 ? String(exam.maxAttempts) : "")}
                  />
                  <span>{t("kali", "times")}</span>
                </div>
                <small>{t("Kosongkan untuk tanpa batas. Minimal 2. Nilai tertinggi yang dipakai di statistik.", "Leave blank for unlimited. Minimum 2. Highest score is used in stats.")}</small>
              </label>
            )}
            <div className="field banner-field">
              <span>{t("Gambar banner", "Banner image")} <em className="badge badge-working">PRO</em></span>
              {exam.bannerUrl ? (
                <div className="image-preview">
                  <img src={exam.bannerUrl} alt={t("Banner ulangan", "Exam banner")} />
                  <div className="image-actions">
                    {isPro && (
                      <button type="button" className="btn btn-outline btn-sm" disabled={bannerBusy} onClick={() => bannerInput.current?.click()}>
                        {bannerBusy ? t("Mengunggah...", "Uploading...") : t("Ganti", "Change")}
                      </button>
                    )}
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => patch({ bannerUrl: null })}>{t("Hapus", "Remove")}</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="image-drop" disabled={!isPro || bannerBusy} onClick={() => bannerInput.current?.click()}>
                  <Icon name="image" size={20} />
                  <strong>{bannerBusy ? t("Mengunggah...", "Uploading...") : t("Tambah banner", "Add banner")}</strong>
                  <small>{isPro ? t("Gambar landscape di atas halaman ulangan", "Landscape image at the top of the exam page") : t("Khusus PRO. Upgrade lewat tombol di sidebar.", "PRO only. Upgrade via the sidebar button.")}</small>
                </button>
              )}
              <input ref={bannerInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pickBanner(e.target.files?.[0])} />
            </div>
            <div className="info-note">
              <Icon name="shield" size={16} />
              <p>{exam.allowRetake ? t("Jawaban murid tersimpan otomatis. Setiap percobaan dicatat terpisah.", "Student answers are auto-saved. Each attempt is recorded separately.") : t("Jawaban murid tersimpan otomatis dan satu perangkat hanya mendapat satu kesempatan.", "Student answers are auto-saved and each device gets one attempt.")}</p>
            </div>
            </div>
          </aside>
        </div>
      </div>

      {previewOpen && (
        <ExamPreview
          exam={exam}
          index={previewIndex}
          onIndexChange={setPreviewIndex}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {templateSaveOpen && (
        <Modal icon="file" title={t("Simpan ulangan sebagai template", "Save exam as template")} description={t("Soal, jawaban benar, bobot, dan rubrik pada editor saat ini akan disalin menjadi template yang bisa digunakan kembali.", "Questions, answer keys, points, and rubrics in the editor will be copied into a reusable template.")} onClose={() => !templateSaveBusy && setTemplateSaveOpen(false)} footer={<><button className="btn btn-outline" onClick={() => setTemplateSaveOpen(false)} disabled={templateSaveBusy}>{t("Batal", "Cancel")}</button><button className="btn btn-primary" form="save-template-form" type="submit" disabled={templateSaveBusy}>{templateSaveBusy ? t("Menyimpan…", "Saving…") : t("Simpan template", "Save template")}</button></>}>
          <form id="save-template-form" className="template-form" onSubmit={saveCurrentAsTemplate}>
            <label className="field"><span>{t("Nama template", "Template name")}</span><input required minLength={3} maxLength={100} value={templateSaveName} onChange={(event) => { setTemplateSaveName(event.target.value); if (!templateSaveSlug || templateSaveSlug === slugify(templateSaveName)) setTemplateSaveSlug(slugify(event.target.value)); }} /></label>
            <label className="field"><span>{t("Slug URL", "URL slug")}</span><input required minLength={3} maxLength={64} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={templateSaveSlug} onChange={(event) => setTemplateSaveSlug(slugify(event.target.value))} /><small>{t("Alamat:", "URL:")} {window.location.origin}/template/{templateSaveSlug || "template-name"}</small></label>
            <label className="field"><span>{t("Mata pelajaran", "Subject")}</span><input required maxLength={60} value={templateSaveSubject} onChange={(event) => setTemplateSaveSubject(event.target.value)} /></label>
            <label className="field"><span>{t("Visibilitas template", "Template visibility")}</span><select value={templateSaveVisibility} onChange={(event) => setTemplateSaveVisibility(event.target.value as "public" | "private")}><option value="private">{t("Privat — hanya saya", "Private — only me")}</option><option value="public">{t("Publik — tampil setelah diterbitkan", "Public — shown after publishing")}</option></select></label>
            <div className="notice"><Icon name="file" size={15} /><span>{t(`${exam.questions.length} soal akan disimpan sebagai konten yang dapat digunakan ulang. Template dibuat sebagai draf sehingga belum masuk katalog publik.`, `${exam.questions.length} question(s) will be saved as reusable content. The template is created as a draft so it won't appear in the public catalog yet.`)}</span></div>
            {templateSaveError && <div className="notice notice-danger" role="alert"><Icon name="alert" size={15} /><span>{templateSaveError}</span></div>}
          </form>
        </Modal>
      )}

      {modal === "pick" && (
        <Modal icon="file" title={t("Pilih tipe soal", "Choose question type")} description={t("Tipe bisa diubah lagi nanti dari kartu soal.", "You can change the type later on the question card.")} onClose={() => setModal(null)}>
          <div className="kind-grid">
            {getKindMeta().map((item) => (
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
        <Modal icon="check" title={t("Ulangan berhasil dipublish", "Exam published")} description={t("Tautan sudah aktif. Bagikan ke murid untuk mulai mengerjakan.", "The link is active. Share it with students to begin.")} onClose={() => setModal(null)}
          footer={<button className="btn btn-primary" onClick={() => setModal(null)}>{t("Selesai", "Done")}</button>}>
          <div className="generated-url">
            <span>{shareUrl}</span>
            <button className="btn btn-outline" onClick={copyShare}><Icon name="copy" size={15} /> {t("Salin", "Copy")}</button>
          </div>
          <div className="notice"><Icon name="users" size={16} /><span>{t("Murid tidak perlu membuat akun atau login untuk mengerjakan.", "Students do not need an account or login to take the exam.")}</span></div>
        </Modal>
      )}

      {modal === "close" && (
        <Modal icon="alert" title={t("Tutup ulangan?", "Close exam?")} description={t("Murid yang belum mulai tidak bisa membuka ulangan ini lagi.", "Students who haven't started won't be able to open this exam.")} onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setModal(null)}>{t("Batal", "Cancel")}</button>
              <button className="btn btn-danger" onClick={closeExam}>{t("Ya, tutup", "Yes, close")}</button>
            </>
          }>
          <p className="modal-text">{t("Murid yang sedang mengerjakan tetap bisa mengumpulkan jawabannya. Kamu bisa membuka lagi kapan saja lewat tombol Publish ulang.", "Students currently taking the exam can still submit. You can reopen it anytime using Republish.")}</p>
        </Modal>
      )}
    </>
  );
}

function ExamPreview({
  exam,
  index,
  onIndexChange,
  onClose,
}: {
  exam: Exam;
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const { t } = usePreferences();
  const questions = exam.questions;
  const question = questions[Math.min(Math.max(0, index), Math.max(questions.length - 1, 0))];
  return (
    <Modal
      icon="file"
      title={t("Preview ulangan", "Exam preview")}
      description={t("Pratinjau ini memakai perubahan editor saat ini. Jawaban tidak disimpan dan ulangan tidak dipublikasikan.", "This preview uses your current editor changes. Answers are not saved and the exam is not published.")}
      onClose={onClose}
      wide
      footer={
        <div className="exam-preview-footer">
          <button className="btn btn-outline" onClick={() => onIndexChange(Math.max(0, index - 1))} disabled={index <= 0}>{t("Sebelumnya", "Previous")}</button>
          <span>{questions.length ? `${t("Soal", "Question")} ${index + 1} ${t("dari", "of")} ${questions.length}` : t("Belum ada soal", "No questions yet")}</span>
          <button className="btn btn-primary" onClick={() => onIndexChange(Math.min(questions.length - 1, index + 1))} disabled={index >= questions.length - 1}>{t("Berikutnya", "Next")}</button>
        </div>
      }
    >
      <div className="exam-preview">
        <div className="exam-preview-header">
          {exam.bannerUrl && <img src={exam.bannerUrl} alt={t("Banner ulangan", "Exam banner")} />}
          <span className="eyebrow">{t("PREVIEW SISWA", "STUDENT PREVIEW")}</span>
          <h2>{exam.title || t("Ulangan tanpa judul", "Untitled exam")}</h2>
          {exam.instructions?.trim() && <div className="exam-preview-instructions"><strong>{t("Petunjuk pengerjaan", "Instructions")}</strong><p>{exam.instructions}</p></div>}
          <div className="exam-meta">
            {exam.className && <span><Icon name="users" size={14} /> {t("Kelas", "Class")} {exam.className}</span>}
            <span><Icon name="clock" size={14} /> {exam.durationMin} {t("menit", "min")}</span>
            <span><Icon name="file" size={14} /> {questions.length} {t("soal", "questions")}</span>
          </div>
        </div>
        {questions.length === 0 ? (
          <div className="empty-state"><h3>{t("Belum ada soal", "No questions yet")}</h3><p>{t("Tambahkan soal untuk melihat pratinjau ulangan.", "Add questions to preview the exam.")}</p></div>
        ) : question ? (
          <article className="exam-preview-question" aria-live="polite">
            <div className="exam-preview-question-top"><span>{t("SOAL", "QUESTION")} {index + 1}</span><span>{kindLabel(question.kind)} · {question.points} {t("poin", "pts")}</span></div>
            {question.story && <div className="exam-preview-passage">{question.story}</div>}
            {question.image && <img className="exam-preview-image" src={question.image} alt={t("Gambar pendukung soal", "Question image")} />}
            <h3>{question.text || t("Teks soal belum ditulis", "Question text not written yet")}</h3>
            {question.format === "multiple_choice" || question.format === "multiple_select" || question.format === "true_false" ? (
              <div className="exam-preview-options">
                {(question.format === "true_false" ? [t("Benar", "True"), t("Salah", "False")] : question.options).map((option, optionIndex) => (
                  <div key={`${optionIndex}-${option}`} className="exam-preview-option"><span>{question.format === "true_false" ? (optionIndex === 0 ? "B" : "S") : String.fromCharCode(65 + optionIndex)}</span>{option || `${t("Pilihan", "Choice")} ${optionIndex + 1}`}</div>
                ))}
              </div>
            ) : question.format === "matching" ? (
              <div className="exam-preview-matching">{(question.matchPairs ?? []).map((pair, pairIndex) => <div key={pairIndex}><span>{pair.left || `${t("Pernyataan", "Prompt")} ${pairIndex + 1}`}</span><span className="exam-preview-placeholder">{t("Pilih pasangan…", "Select match…")}</span></div>)}</div>
            ) : question.format === "ordering" ? (
              <ol className="exam-preview-ordering">{(question.orderItems ?? []).map((item, itemIndex) => <li key={itemIndex}>{item || `${t("Item", "Item")} ${itemIndex + 1}`}</li>)}</ol>
            ) : question.format === "essay" ? (
              <div className="exam-preview-answer-box exam-preview-answer-large">{t("Jawaban uraian…", "Essay answer…")}</div>
            ) : question.format === "short_answer" || question.format === "fill_blank" || question.format === "numeric" ? (
              <div className="exam-preview-answer-box">{question.format === "numeric" ? t("Masukkan angka…", "Enter a number…") : t("Tulis jawabanmu…", "Write your answer…")}</div>
            ) : (
              <div className="exam-preview-answer-box">{t("Area jawaban murid", "Student answer area")}</div>
            )}
          </article>
        ) : null}
        {questions.length > 0 && <div className="exam-preview-progress"><span style={{ width: `${((index + 1) / questions.length) * 100}%` }} /></div>}
      </div>
    </Modal>
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
  const { t } = usePreferences();
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
      if (!(await beforePublish())) throw new Error(t("Perubahan belum tersimpan. Coba lagi sebentar.", "Changes aren't saved yet. Please try again in a moment."));
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
      title={locked ? t("Publish ulang ulangan", "Republish exam") : t("Publish ulangan", "Publish exam")}
      description={t("Buat tautan yang akan dibagikan kepada murid.", "Create the link to share with students.")}
      onClose={() => !busy && onClose()}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>{t("Batal", "Cancel")}</button>
          <button className="btn btn-primary" onClick={confirm} disabled={!canPublish}>{busy ? t("Memproses...", "Processing...") : t("Konfirmasi & publish", "Confirm & publish")}</button>
        </>
      }
    >
      <label className="field">
        <span>{t("URL ulangan", "Exam URL")}</span>
        <div className="url-field">
          <span>{host}/</span>
          <input
            value={slug}
            disabled={locked}
            maxLength={60}
            placeholder="exam-slug"
            onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}
          />
        </div>
        {locked ? (
          <small>{t("URL dikunci agar tautan yang sudah dibagikan tetap berlaku.", "URL is locked so previously shared links keep working.")}</small>
        ) : check.state === "checking" ? (
          <small>{t("Memeriksa ketersediaan...", "Checking availability...")}</small>
        ) : check.state === "ok" ? (
          <small className="text-ok">{t("URL tersedia.", "URL is available.")}</small>
        ) : check.state === "bad" ? (
          <small className="text-bad">{check.reason}</small>
        ) : (
          <small>{t("Gunakan huruf kecil, angka, dan tanda hubung. URL tidak bisa diubah setelah publish.", "Use lowercase letters, numbers, and hyphens. URL cannot be changed after publishing.")}</small>
        )}
      </label>
      <div className="publish-summary">
        <div><Icon name="file" size={17} /><span><strong>{exam.questions.length} {t("soal", "questions")}</strong>{t("Total pertanyaan", "Total questions")}</span></div>
        <div><Icon name="clock" size={17} /><span><strong>{exam.durationMin} {t("menit", "min")}</strong>{t("Waktu pengerjaan", "Duration")}</span></div>
      </div>
      {error && <div className="notice notice-danger" role="alert"><Icon name="alert" size={16} /><span>{error}</span></div>}
    </Modal>
  );
}
