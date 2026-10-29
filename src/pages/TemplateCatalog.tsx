import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Icon, Brand } from "../components/Icon";
import { EmptyState, Modal, Spinner } from "../components/ui";
import { api, type Template } from "../lib/api";
import { useAuth } from "../lib/auth";
import { copyText, useTitle } from "../lib/hooks";
import { Link, navigate } from "../lib/router";

const SUBJECTS = ["Matematika", "Bahasa Indonesia", "Bahasa Inggris", "IPA", "IPS", "PPKn", "Sejarah", "Geografi", "Biologi", "Fisika", "Kimia", "Informatika", "Ekonomi", "Pendidikan Agama", "Kejuruan/SMK"];
const TYPES = [
  ["multiple_choice", "Pilihan ganda"], ["multiple_select", "Pilihan ganda kompleks"], ["true_false", "Benar / salah"],
  ["short_answer", "Jawaban singkat"], ["fill_blank", "Isian rumpang"], ["essay", "Uraian"], ["matching", "Menjodohkan"], ["ordering", "Mengurutkan"], ["numeric", "Numerik"],
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
  useTitle(detail ? `${detail.name} - Template Ulanganku` : "Template Soal - Ulanganku", true);

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
      setFormOpen(false); setNotice(editing ? "Template berhasil diperbarui." : "Template berhasil dibuat.");
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
    if (action === "delete" && !window.confirm(`Hapus template “${template.name}”? Tindakan ini tidak bisa dibatalkan.`)) return;
    setActionBusy(template.id); setNotice(null);
    try {
      if (action === "duplicate") {
        await api(`/templates/${template.id}/duplicate`, { method: "POST", body: {} });
        setNotice("Template berhasil diduplikasi sebagai draf privat.");
      } else if (action === "delete") {
        await api(`/templates/${template.id}`, { method: "DELETE" });
        setNotice("Template dihapus.");
      } else if (action === "publish") {
        await api(`/templates/${template.id}`, { method: "PUT", body: { status: template.status === "published" ? "draft" : "published" } });
        setNotice(template.status === "published" ? "Template dijadikan draf." : "Template dipublikasikan.");
      } else if (action === "visibility") {
        await api(`/templates/${template.id}`, { method: "PUT", body: { visibility: template.visibility === "public" ? "private" : "public" } });
        setNotice(template.visibility === "public" ? "Template sekarang privat." : "Template sekarang publik.");
      } else {
        const ok = await copyText(`${window.location.origin}/template/${template.slug}`);
        setNotice(ok ? "URL template disalin." : "Gagal menyalin URL template.");
      }
      await loadList();
      if (slug === template.slug && action !== "copy") await loadDetail();
    } catch (err) { setNotice((err as Error).message); }
    finally { setActionBusy(null); }
  }

  if (slug) {
    return (
      <main className="template-page">
        <header className="template-topbar"><Link to="/" aria-label="Beranda Ulanganku"><Brand /></Link><nav><Link to="/template"><Icon name="file" size={15} /> Semua template</Link>{user ? <Link to="/dashboard">Dashboard</Link> : <Link to={`/login?next=${encodeURIComponent(`/template/${slug}`)}`}>Masuk</Link>}</nav></header>
        <div className="template-container">
          {loading ? <Spinner label="Memuat detail template…" /> : error ? <div className="template-error"><Icon name="alert" size={20} /><h2>Template tidak tersedia</h2><p>{error}</p><Link to="/template" className="btn btn-outline">Kembali ke katalog</Link></div> : detail ? (
            <>
              <div className="template-breadcrumb"><Link to="/template">Template</Link><Icon name="chevron" size={13} /><span>{detail.subject}</span></div>
              <section className="template-detail-hero">
                <span className="template-category">{detail.isBuiltin ? "TEMPLATE BAWAAN" : detail.category.toUpperCase()}</span>
                <h1>{detail.name}</h1><p>{detail.description || "Template yang dapat disesuaikan sebelum digunakan untuk membuat ulangan."}</p>
                <div className="template-tags"><span>{detail.subject}</span>{detail.gradeLevel && <span>{detail.gradeLevel}</span>}<span>{detail.difficulty}</span><span>{detail.visibility === "public" ? "Publik" : "Privat"}</span></div>
                <div className="template-detail-stats"><div><strong>{detail.questionCount}</strong><span>Soal yang disarankan</span></div><div><strong>{detail.durationMin} menit</strong><span>Durasi</span></div><div><strong>{detail.questionConfig.questionTypes?.length ?? 1}</strong><span>Tipe soal</span></div></div>
                <button className="btn btn-primary btn-lg" onClick={() => void useTemplate(detail)} disabled={actionBusy === detail.id}><Icon name="plus" size={17} /> {actionBusy === detail.id ? "Menyiapkan ulangan…" : "Gunakan template ini"}</button>
              </section>
              <section className="template-detail-section">
                <h2>Konfigurasi awal</h2>
                <div className="template-config-list"><div><span>Mata pelajaran</span><strong>{detail.subject}</strong></div><div><span>Kelas</span><strong>{detail.gradeLevel || "Belum ditentukan"}</strong></div><div><span>Tingkat kesulitan</span><strong>{detail.difficulty}</strong></div><div><span>Jumlah soal</span><strong>{detail.questionCount}</strong></div><div><span>Durasi</span><strong>{detail.durationMin} menit</strong></div></div>
                {detail.instructions && <div className="template-instructions"><h3>Petunjuk siswa</h3><p>{detail.instructions}</p></div>}
                <h3>Tipe soal yang digunakan</h3><div className="template-tags">{(detail.questionConfig.questionTypes ?? Object.keys(detail.questionConfig.distribution ?? {})).map((type) => <span key={type}>{TYPES.find(([key]) => key === type)?.[1] ?? type}</span>)}</div>
              </section>
              {user && detail.ownerId === user.id && !detail.isBuiltin && <section className="template-detail-section"><h2>Kelola template</h2><div className="template-actions"><button className="btn btn-outline" onClick={() => openEdit(detail)}><Icon name="edit" size={15} /> Edit</button><button className="btn btn-outline" onClick={() => void runTemplateAction(detail, "duplicate")}>Duplikat</button><button className="btn btn-outline" onClick={() => void runTemplateAction(detail, "publish")}>{detail.status === "published" ? "Jadikan draf" : "Publikasikan"}</button><button className="btn btn-outline" onClick={() => void runTemplateAction(detail, "visibility")}>{detail.visibility === "public" ? "Jadikan privat" : "Jadikan publik"}</button><button className="btn btn-outline" onClick={() => void runTemplateAction(detail, "copy")}>Salin URL</button><button className="btn btn-danger" onClick={() => void runTemplateAction(detail, "delete")}>Hapus</button></div></section>}
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
      <header className="template-topbar"><Link to="/" aria-label="Beranda Ulanganku"><Brand /></Link><nav><Link to="/">Beranda</Link>{user ? <Link to="/dashboard">Dashboard</Link> : <Link to="/login">Masuk</Link>}</nav></header>
      <div className="template-container">
        <div className="template-page-heading"><div><span className="template-category">BANK TEMPLATE</span><h1>Mulai dari template soal</h1><p>Pilih struktur ulangan sesuai mata pelajaran dan kelas, lalu sesuaikan sebelum dibagikan ke murid.</p></div>{user && <button className="btn btn-primary" onClick={openCreate}><Icon name="plus" size={16} /> Buat template</button>}</div>
        {notice && <div className="template-notice" role="status">{notice}</div>}
        <div className="template-filter-bar"><label className="template-search"><Icon name="search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari template atau mata pelajaran…" aria-label="Cari template" /></label><label><span className="sr-only">Filter mata pelajaran</span><select value={subject} onChange={(event) => setSubject(event.target.value)}><option value="">Semua mata pelajaran</option>{[...new Set([...SUBJECTS, ...templates.map((item) => item.subject)])].sort().map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label><span className="sr-only">Filter kelas</span><select value={grade} onChange={(event) => setGrade(event.target.value)}><option value="">Semua kelas</option>{grades.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div>
        {loading ? <Spinner label="Memuat template…" /> : error ? <div className="template-error"><Icon name="alert" size={20} /><h2>Template gagal dimuat</h2><p>{error}</p><button className="btn btn-outline" onClick={() => void loadList()}>Coba lagi</button></div> : (
          <>
            {user && ownedTemplates.length > 0 && <section className="template-section"><div className="template-section-heading"><div><h2>Template saya</h2><p>Kelola template yang kamu buat.</p></div><span>{ownedTemplates.length}</span></div><div className="template-grid">{ownedTemplates.map((template) => <TemplateCard key={template.id} template={template} busy={actionBusy === template.id} onOpen={() => navigate(`/template/${template.slug}`)} onUse={() => void useTemplate(template)} onEdit={() => openEdit(template)} onDuplicate={() => void runTemplateAction(template, "duplicate")} onDelete={() => void runTemplateAction(template, "delete")} onPublish={() => void runTemplateAction(template, "publish")} onVisibility={() => void runTemplateAction(template, "visibility")} onCopy={() => void runTemplateAction(template, "copy")} canManage />)}</div></section>}
            <section className="template-section"><div className="template-section-heading"><div><h2>{query || subject || grade ? "Hasil pencarian" : "Template siap pakai"}</h2><p>Semua template bisa diedit lagi setelah digunakan.</p></div><span>{publicTemplates.length}</span></div>{publicTemplates.length ? <div className="template-grid">{publicTemplates.map((template) => <TemplateCard key={template.id} template={template} busy={actionBusy === template.id} onOpen={() => navigate(`/template/${template.slug}`)} onUse={() => void useTemplate(template)} onEdit={() => openEdit(template)} onDuplicate={() => void runTemplateAction(template, "duplicate")} onDelete={() => void runTemplateAction(template, "delete")} onPublish={() => void runTemplateAction(template, "publish")} onVisibility={() => void runTemplateAction(template, "visibility")} onCopy={() => void runTemplateAction(template, "copy")} canManage={Boolean(user && template.ownerId === user.id && !template.isBuiltin)} />)}</div> : <EmptyState icon="search" title="Template tidak ditemukan" text="Coba ubah kata kunci atau filter mata pelajaran dan kelas." />}</section>
          </>
        )}
        {authLoading && <div className="template-auth-note">Memeriksa sesi akun…</div>}
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
  return <article className="template-card">
    <button type="button" className="template-card-main" onClick={onOpen}>
      <span className="template-card-icon"><Icon name="file" size={19} /></span><div className="template-card-copy"><div className="template-card-meta"><span>{template.subject}</span>{template.isBuiltin ? <em>Bawaan</em> : <em>{template.status === "published" ? "Terbit" : "Draf"}</em>}</div><h3>{template.name}</h3><p>{template.description || "Template ulangan yang dapat disesuaikan."}</p><div className="template-tags"><span>{template.gradeLevel || "Kelas fleksibel"}</span><span>{template.questionCount} soal</span><span>{template.durationMin} menit</span></div></div><Icon name="chevron" size={16} /></button>
    <div className="template-card-actions"><button className="btn btn-primary btn-sm" onClick={onUse} disabled={busy}><Icon name="plus" size={14} /> {busy ? "Menyiapkan…" : "Gunakan"}</button>{canManage ? <><button className="btn btn-outline btn-sm" onClick={onEdit} disabled={busy}>Edit</button><button className="btn btn-outline btn-sm" onClick={onPublish} disabled={busy}>{template.status === "published" ? "Jadikan draf" : "Terbitkan"}</button><button className="btn btn-outline btn-sm" onClick={onVisibility} disabled={busy}>{template.visibility === "public" ? "Privat" : "Publik"}</button><button className="btn btn-outline btn-sm" onClick={onDuplicate} disabled={busy}>Duplikat</button><button className="btn btn-outline btn-sm" onClick={onCopy} disabled={busy}>Salin URL</button><button className="btn btn-outline btn-sm" onClick={onDelete} disabled={busy}>Hapus</button></> : <button className="btn btn-outline btn-sm" onClick={onDuplicate} disabled={busy}>Duplikat</button>}</div>
  </article>;
}

function TemplateFormModal({
  form, editing, saving, slugTouched, onSlugEdited, onChange, onClose, onSubmit,
}: {
  form: TemplateFormState; editing: Template | null; saving: boolean; slugTouched: boolean; onSlugEdited: () => void;
  onChange: (key: keyof TemplateFormState, value: string | string[]) => void; onClose: () => void; onSubmit: (event: FormEvent) => void;
}) {
  return <Modal icon="file" title={editing ? "Edit template" : "Buat template"} description="Atur konfigurasi awal. Template tetap dapat disesuaikan sebelum dipublikasikan sebagai ulangan." onClose={() => !saving && onClose()} wide footer={<><button className="btn btn-outline" onClick={onClose} disabled={saving}>Batal</button><button className="btn btn-primary" form="template-form" type="submit" disabled={saving}>{saving ? "Menyimpan…" : "Simpan template"}</button></>}>
    <form id="template-form" className="template-form" onSubmit={onSubmit}>
      <label className="field"><span>Nama template *</span><input required minLength={3} maxLength={100} value={form.name} onChange={(event) => onChange("name", event.target.value)} placeholder="Contoh: Matematika - Persamaan Linear" /></label>
      <label className="field"><span>Slug URL *</span><input required minLength={3} maxLength={64} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={(event) => { onSlugEdited(); onChange("slug", toSlug(event.target.value)); }} placeholder="matematika-persamaan-linear" /><small>URL: {window.location.origin}/template/{form.slug || toSlug(form.name) || "nama-template"}. {slugTouched ? "Slug dapat diubah selama belum dipakai template lain." : "Slug dibuat otomatis dari nama."}</small></label>
      <label className="field"><span>Deskripsi</span><textarea rows={2} maxLength={1200} value={form.description} onChange={(event) => onChange("description", event.target.value)} placeholder="Ringkasan kegunaan template" /></label>
      <div className="template-form-grid"><label className="field"><span>Mata pelajaran *</span><input list="template-subject-options" required maxLength={60} value={form.subject} onChange={(event) => onChange("subject", event.target.value)} /><datalist id="template-subject-options">{SUBJECTS.map((item) => <option key={item} value={item} />)}</datalist></label><label className="field"><span>Kelas</span><input maxLength={80} value={form.gradeLevel} onChange={(event) => onChange("gradeLevel", event.target.value)} placeholder="Kelas 8" /></label><label className="field"><span>Kategori</span><input maxLength={60} value={form.category} onChange={(event) => onChange("category", event.target.value)} placeholder="Latihan" /></label><label className="field"><span>Kesulitan</span><select value={form.difficulty} onChange={(event) => onChange("difficulty", event.target.value)}><option>Mudah</option><option>Menengah</option><option>Sulit</option><option>Campuran</option></select></label><label className="field"><span>Jumlah soal (1–200)</span><input type="number" required min={1} max={200} value={form.questionCount} onChange={(event) => onChange("questionCount", event.target.value)} /></label><label className="field"><span>Durasi (menit)</span><input type="number" required min={1} max={600} value={form.durationMin} onChange={(event) => onChange("durationMin", event.target.value)} /></label></div>
      <fieldset className="template-type-field"><legend>Tipe soal yang disarankan</legend><div className="template-type-grid">{TYPES.map(([type, label]) => <label key={type}><input type="checkbox" checked={form.questionTypes.includes(type)} onChange={(event) => onChange("questionTypes", event.target.checked ? [...form.questionTypes, type] : form.questionTypes.filter((item) => item !== type))} />{label}</label>)}</div></fieldset>
      <label className="field"><span>Petunjuk pengerjaan</span><textarea rows={2} maxLength={2000} value={form.instructions} onChange={(event) => onChange("instructions", event.target.value)} /></label>
      <div className="template-form-grid"><label className="field"><span>Visibilitas</span><select value={form.visibility} onChange={(event) => onChange("visibility", event.target.value)}><option value="private">Privat — hanya saya</option><option value="public">Publik</option></select></label><label className="field"><span>Status</span><select value={form.status} onChange={(event) => onChange("status", event.target.value)}><option value="draft">Draf</option><option value="published">Dipublikasikan</option></select></label></div>
    </form>
  </Modal>;
}
