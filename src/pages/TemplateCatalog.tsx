import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Icon, Brand } from "../components/Icon";
import { EmptyState, Modal, Spinner } from "../components/ui";
import { api, type Template } from "../lib/api";
import { useAuth } from "../lib/auth";
import { copyText, useTitle } from "../lib/hooks";
import { usePreferences } from "../lib/preferences";
import { getFormatLabel } from "../lib/questions";
import { Link, navigate } from "../lib/router";

const SUBJECTS = ["Matematika", "Bahasa Indonesia", "Bahasa Inggris", "IPA", "IPS", "PPKn", "Sejarah", "Geografi", "Biologi", "Fisika", "Kimia", "Informatika", "Ekonomi", "Pendidikan Agama", "Kejuruan/SMK"];
const TYPES = [
  "multiple_choice", "multiple_select", "true_false",
  "short_answer", "fill_blank", "essay", "matching", "ordering", "numeric",
] as const;
type TemplateFormState = {
  name: string; slug: string; description: string; subject: string; gradeLevel: string; category: string; questionCount: string;
  durationMin: string; difficulty: string; instructions: string; visibility: "public" | "private"; status: "draft" | "published"; questionTypes: string[];
};
const emptyForm = (): TemplateFormState => ({
  name: "", slug: "", description: "", subject: "Matematika", gradeLevel: "Kelas 8", category: "Latihan", questionCount: "20",
  durationMin: "45", difficulty: "Menengah", instructions: "Baca setiap soal dengan teliti sebelum menjawab.", visibility: "private", status: "draft", questionTypes: ["multiple_choice"],
});
const toForm = (template: Template): TemplateFormState => ({
  name: template.name, slug: template.slug, description: template.description, subject: template.subject, gradeLevel: template.gradeLevel,
  category: template.category, questionCount: String(template.questionCount), durationMin: String(template.durationMin), difficulty: template.difficulty,
  instructions: template.instructions, visibility: template.visibility, status: template.status,
  questionTypes: template.questionConfig.questionTypes?.length ? template.questionConfig.questionTypes : Object.keys(template.questionConfig.distribution ?? { multiple_choice: 1 }),
});
const toSlug = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
function getDistribution(types: string[], rawCount: string) {
  const count = Math.max(1, Math.min(200, Number(rawCount) || 1));
  const active = types.length ? types : ["multiple_choice"];
  const distribution: Record<string, number> = {};
  active.forEach((type, index) => { distribution[type] = Math.floor(count / active.length) + (index < count % active.length ? 1 : 0); });
  return distribution;
}

export default function TemplateCatalog({ slug }: { slug?: string }) {
  const { t } = usePreferences();
  const { user, loading: authLoading } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [detail, setDetail] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState<TemplateFormState>(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useTitle(detail ? `${detail.name} - ${t("Template Ulanganku", "Ulanganku Templates")}` : `${t("Template Soal", "Exam Templates")} - Ulanganku`, true);

  const loadList = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (subject) params.set("subject", subject);
      if (grade) params.set("grade", grade);
      const path = `/templates${params.size ? `?${params.toString()}` : ""}`;
      const result = await api<{ templates: Template[] }>(path);
      setTemplates(result.templates);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, [query, subject, grade]);

  const loadDetail = useCallback(async () => {
    if (!slug) { setDetail(null); return; }
    setLoading(true); setError(null);
    try {
      const result = await api<{ template: Template }>(`/templates/${encodeURIComponent(slug)}`);
      setDetail(result.template);
    } catch (err) { setDetail(null); setError((err as Error).message); }
    finally { setLoading(false); }
  }, [slug]);

  useEffect(() => { if (slug) void loadDetail(); else void loadList(); }, [slug, loadDetail, loadList]);
  const grades = useMemo(() => [...new Set(templates.map((item) => item.gradeLevel).filter(Boolean))].sort(), [templates]);
  const ownedTemplates = useMemo(() => templates.filter((item) => item.ownerId === user?.id && !item.isBuiltin), [templates, user?.id]);
  const publicTemplates = useMemo(() => templates.filter((item) => item.isBuiltin || (item.visibility === "public" && item.status === "published")), [templates]);

  function openCreate() {
    setEditing(null); setForm(emptyForm()); setSlugTouched(false); setFormOpen(true);
  }
  function openEdit(template: Template) {
    setEditing(template); setForm(toForm(template)); setSlugTouched(true); setFormOpen(true);
  }
  function changeForm(key: keyof TemplateFormState, value: string | string[]) {
    setForm((previous) => {
      const next = { ...previous, [key]: value } as TemplateFormState;
      if (key === "name" && !slugTouched && typeof value === "string") next.slug = toSlug(value);
      return next;
    });
  }

  async function saveTemplate(event: FormEvent) {
    event.preventDefault(); setSaving(true); setNotice(null);
    try {
      const distribution = getDistribution(form.questionTypes, form.questionCount);
      const body = {
        name: form.name, slug: form.slug || toSlug(form.name), description: form.description, subject: form.subject, gradeLevel: form.gradeLevel,
        category: form.category, questionCount: Number(form.questionCount), durationMin: Number(form.durationMin), difficulty: form.difficulty,
        instructions: form.instructions, visibility: form.visibility, status: form.status,
        questionConfig: { distribution, questionTypes: Object.keys(distribution) },
        ...(editing ? {} : { reusableQuestions: [] }),
      };
      let savedSlug = editing?.slug;
      if (editing) {
        const result = await api<{ template: Template }>(`/templates/${editing.id}`, { method: "PUT", body });
        savedSlug = result.template.slug;
      } else {
        await api("/templates", { method: "POST", body });
      }
      setFormOpen(false); setNotice(editing ? t("Template berhasil diperbarui.", "Template updated.") : t("Template berhasil dibuat.", "Template created."));
      await loadList();
      if (slug && editing?.slug === slug) {
        if (savedSlug && savedSlug !== slug) navigate(`/template/${savedSlug}`);
        else await loadDetail();
      }
    } catch (err) { setNotice((err as Error).message); }
    finally { setSaving(false); }
  }

  async function useTemplate(template: Template) {
    if (!user) { navigate(`/login?next=${encodeURIComponent(`/template/${template.slug}`)}`); return; }
    setActionBusy(template.id); setNotice(null);
    try {
      const result = await api<{ exam: { id: string; title: string; questionCount: number } }>(`/templates/${template.id}/use`, { method: "POST", body: {} });
      navigate(`/dashboard/ulangan/${result.exam.id}`);
    } catch (err) { setNotice((err as Error).message); }
    finally { setActionBusy(null); }
  }

  async function runTemplateAction(template: Template, action: "duplicate" | "delete" | "publish" | "visibility" | "copy") {
    if (action === "duplicate" && !user) {
      navigate(`/login?next=${encodeURIComponent(`/template/${template.slug}`)}`);
      return;
    }
    if (action === "delete" && !window.confirm(t(`Hapus template “${template.name}”? Tindakan ini tidak bisa dibatalkan.`, `Delete template "${template.name}"? This cannot be undone.`))) return;
    setActionBusy(template.id); setNotice(null);
    try {
      if (action === "duplicate") {
        await api(`/templates/${template.id}/duplicate`, { method: "POST", body: {} });
        setNotice(t("Template berhasil diduplikasi sebagai draf privat.", "Template duplicated as a private draft."));
      } else if (action === "delete") {
        await api(`/templates/${template.id}`, { method: "DELETE" });
        setNotice(t("Template dihapus.", "Template deleted."));
      } else if (action === "publish") {
        await api(`/templates/${template.id}`, { method: "PUT", body: { status: template.status === "published" ? "draft" : "published" } });
        setNotice(template.status === "published" ? t("Template dijadikan draf.", "Template set to draft.") : t("Template dipublikasikan.", "Template published."));
      } else if (action === "visibility") {
        await api(`/templates/${template.id}`, { method: "PUT", body: { visibility: template.visibility === "public" ? "private" : "public" } });
        setNotice(template.visibility === "public" ? t("Template sekarang privat.", "Template is now private.") : t("Template sekarang publik.", "Template is now public."));
      } else {
        const ok = await copyText(`${window.location.origin}/template/${template.slug}`);
        setNotice(ok ? t("URL template disalin.", "Template URL copied.") : t("Gagal menyalin URL template.", "Failed to copy template URL."));
      }
      await loadList();
      if (slug === template.slug && action !== "copy") await loadDetail();
    } catch (err) { setNotice((err as Error).message); }
    finally { setActionBusy(null); }
  }

  if (slug) {
    return (
      <main className="template-page">
        <header className="template-topbar"><Link to="/" aria-label={t("Beranda Ulanganku", "Ulanganku Home")}><Brand /></Link><nav><Link to="/template"><Icon name="file" size={15} /> {t("Semua template", "All templates")}</Link>{user ? <Link to="/dashboard">Dashboard</Link> : <Link to={`/login?next=${encodeURIComponent(`/template/${slug}`)}`}>{t("Masuk", "Sign in")}</Link>}</nav></header>
        <div className="template-container">
          {loading ? <Spinner label={t("Memuat detail template…", "Loading template details…")} /> : error ? <div className="template-error"><Icon name="alert" size={20} /><h2>{t("Template tidak tersedia", "Template unavailable")}</h2><p>{error}</p><Link to="/template" className="btn btn-outline">{t("Kembali ke katalog", "Back to catalog")}</Link></div> : detail ? (
            <>
              <div className="template-breadcrumb"><Link to="/template">{t("Template", "Templates")}</Link><Icon name="chevron" size={13} /><span>{detail.subject}</span></div>
              <section className="template-detail-hero">
                <span className="template-category">{detail.isBuiltin ? t("TEMPLATE BAWAAN", "BUILT-IN TEMPLATE") : detail.category.toUpperCase()}</span>
                <h1>{detail.name}</h1><p>{detail.description || t("Template yang dapat disesuaikan sebelum digunakan untuk membuat ulangan.", "Template you can customize before creating an exam.")}</p>
                <div className="template-tags"><span>{detail.subject}</span>{detail.gradeLevel && <span>{detail.gradeLevel}</span>}<span>{detail.difficulty}</span><span>{detail.visibility === "public" ? t("Publik", "Public") : t("Privat", "Private")}</span></div>
                <div className="template-detail-stats"><div><strong>{detail.questionCount}</strong><span>{t("Soal yang disarankan", "Suggested questions")}</span></div><div><strong>{detail.durationMin} {t("menit", "min")}</strong><span>{t("Durasi", "Duration")}</span></div><div><strong>{detail.questionConfig.questionTypes?.length ?? 1}</strong><span>{t("Tipe soal", "Question types")}</span></div></div>
                <button className="btn btn-primary btn-lg" onClick={() => void useTemplate(detail)} disabled={actionBusy === detail.id}><Icon name="plus" size={17} /> {actionBusy === detail.id ? t("Menyiapkan ulangan…", "Preparing exam…") : t("Gunakan template ini", "Use this template")}</button>
              </section>
              <section className="template-detail-section">
                <h2>{t("Konfigurasi awal", "Initial configuration")}</h2>
                <div className="template-config-list"><div><span>{t("Mata pelajaran", "Subject")}</span><strong>{detail.subject}</strong></div><div><span>{t("Kelas", "Grade")}</span><strong>{detail.gradeLevel || t("Belum ditentukan", "Not specified")}</strong></div><div><span>{t("Tingkat kesulitan", "Difficulty")}</span><strong>{detail.difficulty}</strong></div><div><span>{t("Jumlah soal", "Questions")}</span><strong>{detail.questionCount}</strong></div><div><span>{t("Durasi", "Duration")}</span><strong>{detail.durationMin} {t("menit", "min")}</strong></div></div>
                {detail.instructions && <div className="template-instructions"><h3>{t("Petunjuk siswa", "Student instructions")}</h3><p>{detail.instructions}</p></div>}
                <h3>{t("Tipe soal yang digunakan", "Question types included")}</h3><div className="template-tags">{(detail.questionConfig.questionTypes ?? Object.keys(detail.questionConfig.distribution ?? {})).map((type) => <span key={type}>{TYPES.includes(type as (typeof TYPES)[number]) ? getFormatLabel(type as (typeof TYPES)[number]) : type}</span>)}</div>
              </section>
              {user && detail.ownerId === user.id && !detail.isBuiltin && <section className="template-detail-section"><h2>{t("Kelola template", "Manage template")}</h2><div className="template-actions"><button className="btn btn-outline" onClick={() => openEdit(detail)}><Icon name="edit" size={15} /> {t("Edit", "Edit")}</button><button className="btn btn-outline" onClick={() => void runTemplateAction(detail, "duplicate")}>{t("Duplikat", "Duplicate")}</button><button className="btn btn-outline" onClick={() => void runTemplateAction(detail, "publish")}>{detail.status === "published" ? t("Jadikan draf", "Set draft") : t("Publikasikan", "Publish")}</button><button className="btn btn-outline" onClick={() => void runTemplateAction(detail, "visibility")}>{detail.visibility === "public" ? t("Jadikan privat", "Make private") : t("Jadikan publik", "Make public")}</button><button className="btn btn-outline" onClick={() => void runTemplateAction(detail, "copy")}>{t("Salin URL", "Copy URL")}</button><button className="btn btn-danger" onClick={() => void runTemplateAction(detail, "delete")}>{t("Hapus", "Delete")}</button></div></section>}
            </>
          ) : null}
          {notice && <div className="template-notice" role="status">{notice}</div>}
        </div>
        {formOpen && <TemplateFormModal form={form} editing={editing} saving={saving} slugTouched={slugTouched} onSlugEdited={() => setSlugTouched(true)} onChange={changeForm} onClose={() => setFormOpen(false)} onSubmit={saveTemplate} />}
      </main>
    );
  }

  return (
    <main className="template-page">
      <header className="template-topbar"><Link to="/" aria-label={t("Beranda Ulanganku", "Ulanganku Home")}><Brand /></Link><nav><Link to="/">{t("Beranda", "Home")}</Link>{user ? <Link to="/dashboard">Dashboard</Link> : <Link to="/login">{t("Masuk", "Sign in")}</Link>}</nav></header>
      <div className="template-container">
        <div className="template-page-heading"><div><span className="template-category">{t("BANK TEMPLATE", "TEMPLATE LIBRARY")}</span><h1>{t("Mulai dari template soal", "Start from an exam template")}</h1><p>{t("Pilih struktur ulangan sesuai mata pelajaran dan kelas, lalu sesuaikan sebelum dibagikan ke murid.", "Choose a template by subject and grade level, then customize before sharing with students.")}</p></div>{user && <button className="btn btn-primary" onClick={openCreate}><Icon name="plus" size={16} /> {t("Buat template", "Create template")}</button>}</div>
        {notice && <div className="template-notice" role="status">{notice}</div>}
        <div className="template-filter-bar"><label className="template-search"><Icon name="search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Cari template atau mata pelajaran…", "Search templates or subjects…")} aria-label={t("Cari template", "Search templates")} /></label><label><span className="sr-only">{t("Filter mata pelajaran", "Filter subject")}</span><select value={subject} onChange={(event) => setSubject(event.target.value)}><option value="">{t("Semua mata pelajaran", "All subjects")}</option>{[...new Set([...SUBJECTS, ...templates.map((item) => item.subject)])].sort().map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label><span className="sr-only">{t("Filter kelas", "Filter grade")}</span><select value={grade} onChange={(event) => setGrade(event.target.value)}><option value="">{t("Semua kelas", "All grades")}</option>{grades.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div>
        {loading ? <Spinner label={t("Memuat template…", "Loading templates…")} /> : error ? <div className="template-error"><Icon name="alert" size={20} /><h2>{t("Template gagal dimuat", "Failed to load templates")}</h2><p>{error}</p><button className="btn btn-outline" onClick={() => void loadList()}>{t("Coba lagi", "Try again")}</button></div> : (
          <>
            {user && ownedTemplates.length > 0 && <section className="template-section"><div className="template-section-heading"><div><h2>{t("Template saya", "My templates")}</h2><p>{t("Kelola template yang kamu buat.", "Manage templates you created.")}</p></div><span>{ownedTemplates.length}</span></div><div className="template-grid">{ownedTemplates.map((template) => <TemplateCard key={template.id} template={template} busy={actionBusy === template.id} onOpen={() => navigate(`/template/${template.slug}`)} onUse={() => void useTemplate(template)} onEdit={() => openEdit(template)} onDuplicate={() => void runTemplateAction(template, "duplicate")} onDelete={() => void runTemplateAction(template, "delete")} onPublish={() => void runTemplateAction(template, "publish")} onVisibility={() => void runTemplateAction(template, "visibility")} onCopy={() => void runTemplateAction(template, "copy")} canManage />)}</div></section>}
            <section className="template-section"><div className="template-section-heading"><div><h2>{query || subject || grade ? t("Hasil pencarian", "Search results") : t("Template siap pakai", "Ready-to-use templates")}</h2><p>{t("Semua template bisa diedit lagi setelah digunakan.", "All templates can be edited further after use.")}</p></div><span>{publicTemplates.length}</span></div>{publicTemplates.length ? <div className="template-grid">{publicTemplates.map((template) => <TemplateCard key={template.id} template={template} busy={actionBusy === template.id} onOpen={() => navigate(`/template/${template.slug}`)} onUse={() => void useTemplate(template)} onEdit={() => openEdit(template)} onDuplicate={() => void runTemplateAction(template, "duplicate")} onDelete={() => void runTemplateAction(template, "delete")} onPublish={() => void runTemplateAction(template, "publish")} onVisibility={() => void runTemplateAction(template, "visibility")} onCopy={() => void runTemplateAction(template, "copy")} canManage={Boolean(user && template.ownerId === user.id && !template.isBuiltin)} />)}</div> : <EmptyState icon="search" title={t("Template tidak ditemukan", "No templates found")} text={t("Coba ubah kata kunci atau filter mata pelajaran dan kelas.", "Try changing your keywords or subject and grade filters.")} />}</section>
          </>
        )}
        {authLoading && <div className="template-auth-note">{t("Memeriksa sesi akun…", "Checking account session…")}</div>}
      </div>
      {formOpen && <TemplateFormModal form={form} editing={editing} saving={saving} slugTouched={slugTouched} onSlugEdited={() => setSlugTouched(true)} onChange={changeForm} onClose={() => setFormOpen(false)} onSubmit={saveTemplate} />}
    </main>
  );
}

function TemplateCard({
  template, busy, onOpen, onUse, onEdit, onDuplicate, onDelete, onPublish, onVisibility, onCopy, canManage,
}: {
  template: Template; busy: boolean; onOpen: () => void; onUse: () => void; onEdit: () => void; onDuplicate: () => void; onDelete: () => void;
  onPublish: () => void; onVisibility: () => void; onCopy: () => void; canManage: boolean;
}) {
  const { t } = usePreferences();
  return <article className="template-card">
    <button type="button" className="template-card-main" onClick={onOpen}>
      <span className="template-card-icon"><Icon name="file" size={19} /></span><div className="template-card-copy"><div className="template-card-meta"><span>{template.subject}</span>{template.isBuiltin ? <em>{t("Bawaan", "Built-in")}</em> : <em>{template.status === "published" ? t("Terbit", "Published") : t("Draf", "Draft")}</em>}</div><h3>{template.name}</h3><p>{template.description || t("Template ulangan yang dapat disesuaikan.", "Customizable exam template.")}</p><div className="template-tags"><span>{template.gradeLevel || t("Kelas fleksibel", "Any grade")}</span><span>{template.questionCount} {t("soal", "questions")}</span><span>{template.durationMin} {t("menit", "min")}</span></div></div><Icon name="chevron" size={16} /></button>
    <div className="template-card-actions"><button className="btn btn-primary btn-sm" onClick={onUse} disabled={busy}><Icon name="plus" size={14} /> {busy ? t("Menyiapkan…", "Preparing…") : t("Gunakan", "Use")}</button>{canManage ? <><button className="btn btn-outline btn-sm" onClick={onEdit} disabled={busy}>{t("Edit", "Edit")}</button><button className="btn btn-outline btn-sm" onClick={onPublish} disabled={busy}>{template.status === "published" ? t("Jadikan draf", "Set draft") : t("Terbitkan", "Publish")}</button><button className="btn btn-outline btn-sm" onClick={onVisibility} disabled={busy}>{template.visibility === "public" ? t("Privat", "Private") : t("Publik", "Public")}</button><button className="btn btn-outline btn-sm" onClick={onDuplicate} disabled={busy}>{t("Duplikat", "Duplicate")}</button><button className="btn btn-outline btn-sm" onClick={onCopy} disabled={busy}>{t("Salin URL", "Copy URL")}</button><button className="btn btn-outline btn-sm" onClick={onDelete} disabled={busy}>{t("Hapus", "Delete")}</button></> : <button className="btn btn-outline btn-sm" onClick={onDuplicate} disabled={busy}>{t("Duplikat", "Duplicate")}</button>}</div>
  </article>;
}

function TemplateFormModal({
  form, editing, saving, slugTouched, onSlugEdited, onChange, onClose, onSubmit,
}: {
  form: TemplateFormState; editing: Template | null; saving: boolean; slugTouched: boolean; onSlugEdited: () => void;
  onChange: (key: keyof TemplateFormState, value: string | string[]) => void; onClose: () => void; onSubmit: (event: FormEvent) => void;
}) {
  const { t } = usePreferences();
  return <Modal icon="file" title={editing ? t("Edit template", "Edit template") : t("Buat template", "Create template")} description={t("Atur konfigurasi awal. Template tetap dapat disesuaikan sebelum dipublikasikan sebagai ulangan.", "Set initial defaults. Templates can still be adjusted before publishing an exam.")} onClose={() => !saving && onClose()} wide footer={<><button className="btn btn-outline" onClick={onClose} disabled={saving}>{t("Batal", "Cancel")}</button><button className="btn btn-primary" form="template-form" type="submit" disabled={saving}>{saving ? t("Menyimpan…", "Saving…") : t("Simpan template", "Save template")}</button></>}>
    <form id="template-form" className="template-form" onSubmit={onSubmit}>
      <label className="field"><span>{t("Nama template *", "Template name *")}</span><input required minLength={3} maxLength={100} value={form.name} onChange={(event) => onChange("name", event.target.value)} placeholder={t("Contoh: Matematika - Persamaan Linear", "Example: Math - Linear Equations")} /></label>
      <label className="field"><span>{t("Slug URL *", "URL slug *")}</span><input required minLength={3} maxLength={64} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={(event) => { onSlugEdited(); onChange("slug", toSlug(event.target.value)); }} placeholder="math-linear-equations" /><small>URL: {window.location.origin}/template/{form.slug || toSlug(form.name) || "template-name"}. {slugTouched ? t("Slug dapat diubah selama belum dipakai template lain.", "Slug can be changed as long as it isn't used by another template.") : t("Slug dibuat otomatis dari nama.", "Slug is generated automatically from the name.")}</small></label>
      <label className="field"><span>{t("Deskripsi", "Description")}</span><textarea rows={2} maxLength={1200} value={form.description} onChange={(event) => onChange("description", event.target.value)} placeholder={t("Ringkasan kegunaan template", "Summary of template purpose")} /></label>
      <div className="template-form-grid"><label className="field"><span>{t("Mata pelajaran *", "Subject *")}</span><input list="template-subject-options" required maxLength={60} value={form.subject} onChange={(event) => onChange("subject", event.target.value)} /><datalist id="template-subject-options">{SUBJECTS.map((item) => <option key={item} value={item} />)}</datalist></label><label className="field"><span>{t("Kelas", "Grade")}</span><input maxLength={80} value={form.gradeLevel} onChange={(event) => onChange("gradeLevel", event.target.value)} placeholder={t("Kelas 8", "Grade 8")} /></label><label className="field"><span>{t("Kategori", "Category")}</span><input maxLength={60} value={form.category} onChange={(event) => onChange("category", event.target.value)} placeholder={t("Latihan", "Practice")} /></label><label className="field"><span>{t("Kesulitan", "Difficulty")}</span><select value={form.difficulty} onChange={(event) => onChange("difficulty", event.target.value)}><option value="Mudah">{t("Mudah", "Easy")}</option><option value="Menengah">{t("Menengah", "Medium")}</option><option value="Sulit">{t("Sulit", "Hard")}</option><option value="Campuran">{t("Campuran", "Mixed")}</option></select></label><label className="field"><span>{t("Jumlah soal (1–200)", "Questions (1–200)")}</span><input type="number" required min={1} max={200} value={form.questionCount} onChange={(event) => onChange("questionCount", event.target.value)} /></label><label className="field"><span>{t("Durasi (menit)", "Duration (min)")}</span><input type="number" required min={1} max={600} value={form.durationMin} onChange={(event) => onChange("durationMin", event.target.value)} /></label></div>
      <fieldset className="template-type-field"><legend>{t("Tipe soal yang disarankan", "Suggested question types")}</legend><div className="template-type-grid">{TYPES.map((type) => <label key={type}><input type="checkbox" checked={form.questionTypes.includes(type)} onChange={(event) => onChange("questionTypes", event.target.checked ? [...form.questionTypes, type] : form.questionTypes.filter((item) => item !== type))} />{getFormatLabel(type)}</label>)}</div></fieldset>
      <label className="field"><span>{t("Petunjuk pengerjaan", "Student instructions")}</span><textarea rows={2} maxLength={2000} value={form.instructions} onChange={(event) => onChange("instructions", event.target.value)} /></label>
      <div className="template-form-grid"><label className="field"><span>{t("Visibilitas", "Visibility")}</span><select value={form.visibility} onChange={(event) => onChange("visibility", event.target.value)}><option value="private">{t("Privat — hanya saya", "Private — only me")}</option><option value="public">{t("Publik", "Public")}</option></select></label><label className="field"><span>{t("Status", "Status")}</span><select value={form.status} onChange={(event) => onChange("status", event.target.value)}><option value="draft">{t("Draf", "Draft")}</option><option value="published">{t("Dipublikasikan", "Published")}</option></select></label></div>
    </form>
  </Modal>;
}
