import { useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import {
  FORMAT_LABEL,
  KIND_META,
  changeFormat,
  changeKind,
  hasImage,
  hasStory,
  isBasicKind,
  uploadImage,
} from "../../lib/questions";
import type { Format, Kind, Question } from "../../lib/api";

type Props = {
  question: Question;
  index: number;
  locked: boolean;
  active: boolean;
  canRemove: boolean;
  onChange: (question: Question) => void;
  onRemove: () => void;
  onFocus: () => void;
};

const letter = (i: number) => String.fromCharCode(65 + i);

export default function QuestionCard({ question, index, locked, active, canRemove, onChange, onRemove, onFocus }: Props) {
  const set = (changes: Partial<Question>) => onChange({ ...question, ...changes });
  const n = index + 1;

  return (
    <article id={`q-${question.id}`} className={`question-card ${active ? "question-card-active" : ""}`} onFocus={onFocus}>
      <div className="question-card-head">
        <div className="question-number">{n}</div>
        <strong className="question-title">Soal {n}</strong>
        {!locked && (
          <button className="icon-button icon-danger" aria-label={`Hapus soal ${n}`} disabled={!canRemove} onClick={onRemove}>
            <Icon name="trash" size={17} />
          </button>
        )}
      </div>

      <div className="question-toolbar">
        <label className="mini-field">
          <span>Tipe soal</span>
          <select
            className="select"
            value={question.kind}
            disabled={locked}
            aria-label={`Tipe soal ${n}`}
            onChange={(event) => onChange(changeKind(question, event.target.value as Kind))}
          >
            {KIND_META.map((item) => (
              <option key={item.kind} value={item.kind}>{item.label}</option>
            ))}
          </select>
        </label>
        {!isBasicKind(question.kind) && (
          <label className="mini-field">
            <span>Bentuk jawaban</span>
            <select
              className="select"
              value={question.format}
              disabled={locked}
              aria-label={`Bentuk jawaban soal ${n}`}
              onChange={(event) => onChange(changeFormat(question, event.target.value as Format))}
            >
              {(Object.keys(FORMAT_LABEL) as Format[]).map((format) => (
                <option key={format} value={format}>{FORMAT_LABEL[format]}</option>
              ))}
            </select>
          </label>
        )}
        <label className="mini-field mini-field-points">
          <span>Bobot</span>
          <input
            className="select"
            inputMode="numeric"
            aria-label={`Bobot soal ${n}`}
            value={question.points}
            readOnly={locked}
            onChange={(event) => {
              const value = Number(event.target.value.replace(/\D/g, "").slice(0, 3));
              set({ points: Math.min(100, Math.max(1, value || 1)) });
            }}
          />
        </label>
      </div>

      <div className="question-body">
        {hasStory(question.kind) && (
          <label className="field">
            <span>Teks cerita / bacaan</span>
            <textarea
              className="question-input story-input"
              rows={5}
              placeholder="Tulis cerita atau bacaan yang menjadi dasar soal..."
              readOnly={locked}
              maxLength={6000}
              value={question.story}
              onChange={(event) => set({ story: event.target.value })}
            />
          </label>
        )}

        {hasImage(question.kind) && <ImageField question={question} locked={locked} onChange={(image) => set({ image })} />}

        <label className="field">
          <span>Pertanyaan</span>
          <textarea
            className="question-input"
            rows={2}
            aria-label={`Pertanyaan ${n}`}
            placeholder="Tulis pertanyaan di sini..."
            readOnly={locked}
            maxLength={3000}
            value={question.text}
            onChange={(event) => set({ text: event.target.value })}
          />
        </label>

        <AnswerEditor question={question} locked={locked} onChange={onChange} />
        <label className="field question-explanation-field">
          <span>Penjelasan jawaban <small>(opsional, hanya untuk guru)</small></span>
          <textarea className="question-input" rows={2} maxLength={2000} placeholder="Mengapa jawaban tersebut benar?" readOnly={locked} value={question.explanation ?? ""} onChange={(event) => set({ explanation: event.target.value })} />
        </label>
      </div>
    </article>
  );
}

function ImageField({ question, locked, onChange }: { question: Question; locked: boolean; onChange: (image: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadImage(file));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="field">
      <span>Gambar soal</span>
      {question.image ? (
        <div className="image-preview">
          <img src={question.image} alt="Gambar soal" />
          {!locked && (
            <div className="image-actions">
              <button className="btn btn-outline" onClick={() => input.current?.click()} disabled={busy}>
                <Icon name="upload" size={15} /> {busy ? "Mengunggah..." : "Ganti gambar"}
              </button>
              <button className="btn btn-outline" onClick={() => onChange(null)} disabled={busy}>
                <Icon name="trash" size={15} /> Hapus
              </button>
            </div>
          )}
        </div>
      ) : (
        <button type="button" className="image-drop" onClick={() => input.current?.click()} disabled={locked || busy}>
          <Icon name="image" size={22} />
          <strong>{busy ? "Mengunggah gambar..." : "Unggah gambar"}</strong>
          <small>JPG, PNG, atau WebP. Otomatis diperkecil agar ringan.</small>
        </button>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(event) => pick(event.target.files?.[0])} />
      {error && <small className="text-bad">{error}</small>}
    </div>
  );
}

function AnswerEditor({ question, locked, onChange }: { question: Question; locked: boolean; onChange: (q: Question) => void }) {
  const set = (changes: Partial<Question>) => onChange({ ...question, ...changes });

  if (question.format === "multiple_choice" || question.format === "multiple_select") {
    const multi = question.format === "multiple_select";
    const removeOption = (index: number) => {
      if (question.options.length <= 2) return;
      let correctIndex = question.correctIndex;
      if (index < correctIndex) correctIndex -= 1;
      else if (index === correctIndex) correctIndex = 0;
      const correctIndices = (question.correctIndices ?? []).filter((value) => value !== index).map((value) => value > index ? value - 1 : value);
      set({ options: question.options.filter((_, i) => i !== index), correctIndex, correctIndices });
    };
    return (
      <div>
        <div className="answer-label">Pilihan jawaban <small>{multi ? "Tandai semua pilihan yang benar" : "Klik lingkaran untuk menandai kunci jawaban"}</small></div>
        <div className="options-list">
          {question.options.map((option, oi) => {
            const correct = multi ? (question.correctIndices ?? []).includes(oi) : question.correctIndex === oi;
            return (
              <div className={`option ${correct ? "option-correct" : ""}`} key={oi}>
                <button
                  type="button"
                  className={`radio ${correct ? "radio-on" : ""}`}
                  role={multi ? "checkbox" : "radio"}
                  aria-checked={correct}
                  aria-label={`Jadikan pilihan ${letter(oi)} sebagai ${multi ? "salah satu kunci jawaban" : "kunci jawaban"}`}
                  disabled={locked}
                  onClick={() => set(multi
                    ? { correctIndices: correct ? (question.correctIndices ?? []).filter((value) => value !== oi) : [...(question.correctIndices ?? []), oi] }
                    : { correctIndex: oi })}
                >
                  {correct && <Icon name="check" size={12} />}
                </button>
                <span className="option-letter">{letter(oi)}</span>
                <input
                  aria-label={`Pilihan ${letter(oi)}`}
                  placeholder={`Pilihan ${letter(oi)}`}
                  readOnly={locked}
                  maxLength={500}
                  value={option}
                  onChange={(event) => set({ options: question.options.map((o, i) => (i === oi ? event.target.value : o)) })}
                />
                {correct && <span className="answer-key">Kunci {multi ? "benar" : "jawaban"}</span>}
                {!locked && question.options.length > 2 && (
                  <button className="icon-button icon-sm" aria-label={`Hapus pilihan ${letter(oi)}`} onClick={() => removeOption(oi)}>
                    <Icon name="close" size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {!locked && question.options.length < 8 && (
          <button className="text-button" onClick={() => set({ options: [...question.options, ""] })}>
            <Icon name="plus" size={14} /> Tambah pilihan
          </button>
        )}
      </div>
    );
  }

  if (question.format === "true_false") {
    return (
      <div>
        <div className="answer-label">Kunci jawaban <small>Pilih jawaban yang benar</small></div>
        <div className="tf-options">
          {question.options.map((option, oi) => {
            const correct = question.correctIndex === oi;
            return (
              <button
                type="button"
                key={option}
                className={`tf-option ${correct ? "tf-option-on" : ""}`}
                role="radio"
                aria-checked={correct}
                disabled={locked}
                onClick={() => set({ correctIndex: oi })}
              >
                {correct && <Icon name="check" size={14} />} {option}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (["short_answer", "fill_blank", "numeric"].includes(question.format)) {
    const answers = question.acceptedAnswers;
    const answerLabel = question.format === "numeric" ? "Angka yang dianggap benar" : question.format === "fill_blank" ? "Jawaban untuk bagian rumpang" : "Jawaban yang dianggap benar";
    return (
      <div>
        <div className="answer-label">{answerLabel} <small>Huruf besar/kecil dan spasi berlebih diabaikan. Angka 3,5 dan 3.5 dianggap sama.</small></div>
        <div className="options-list">
          {answers.map((answer, ai) => (
            <div className="option option-correct" key={ai}>
              <span className="option-letter">{ai + 1}</span>
              <input
                aria-label={`Jawaban benar ${ai + 1}`}
                placeholder={ai === 0 ? "Jawaban utama" : "Variasi jawaban lain"}
                readOnly={locked}
                maxLength={200}
                value={answer}
                onChange={(event) => set({ acceptedAnswers: answers.map((a, i) => (i === ai ? event.target.value : a)) })}
              />
              {!locked && answers.length > 1 && (
                <button className="icon-button icon-sm" aria-label={`Hapus jawaban ${ai + 1}`} onClick={() => set({ acceptedAnswers: answers.filter((_, i) => i !== ai) })}>
                  <Icon name="close" size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        {!locked && answers.length < 10 && (
          <button className="text-button" onClick={() => set({ acceptedAnswers: [...answers, ""] })}>
            <Icon name="plus" size={14} /> Tambah variasi jawaban
          </button>
        )}
      </div>
    );
  }

  if (question.format === "matching") {
    const pairs = question.matchPairs ?? [];
    return (
      <div>
        <div className="answer-label">Pasangan yang benar <small>Masukkan pernyataan di kiri dan jawaban pasangannya di kanan.</small></div>
        <div className="options-list">
          {pairs.map((pair, index) => (
            <div className="option matching-editor-row" key={index}>
              <input aria-label={`Pernyataan pasangan ${index + 1}`} placeholder={`Pernyataan ${index + 1}`} maxLength={300} readOnly={locked} value={pair.left} onChange={(event) => set({ matchPairs: pairs.map((item, i) => i === index ? { ...item, left: event.target.value } : item) })} />
              <span aria-hidden="true">↔</span>
              <input aria-label={`Jawaban pasangan ${index + 1}`} placeholder={`Pasangan ${index + 1}`} maxLength={300} readOnly={locked} value={pair.right} onChange={(event) => set({ matchPairs: pairs.map((item, i) => i === index ? { ...item, right: event.target.value } : item) })} />
              {!locked && pairs.length > 2 && <button className="icon-button icon-sm" aria-label={`Hapus pasangan ${index + 1}`} onClick={() => set({ matchPairs: pairs.filter((_, i) => i !== index) })}><Icon name="close" size={14} /></button>}
            </div>
          ))}
        </div>
        {!locked && pairs.length < 10 && <button className="text-button" onClick={() => set({ matchPairs: [...pairs, { left: "", right: "" }] })}><Icon name="plus" size={14} /> Tambah pasangan</button>}
      </div>
    );
  }

  if (question.format === "ordering") {
    const items = question.orderItems ?? [];
    return (
      <div>
        <div className="answer-label">Urutan yang benar <small>Susun item di sini dari langkah pertama sampai terakhir. Tampilan murid akan diacak.</small></div>
        <div className="options-list">
          {items.map((item, index) => (
            <div className="option" key={index}>
              <span className="option-letter">{index + 1}</span>
              <input aria-label={`Item urutan ${index + 1}`} placeholder={`Item ${index + 1}`} maxLength={300} readOnly={locked} value={item} onChange={(event) => set({ orderItems: items.map((value, i) => i === index ? event.target.value : value), correctOrder: items.map((_, i) => i) })} />
              {!locked && items.length > 2 && <button className="icon-button icon-sm" aria-label={`Hapus item ${index + 1}`} onClick={() => { const next = items.filter((_, i) => i !== index); set({ orderItems: next, correctOrder: next.map((_, i) => i) }); }}><Icon name="close" size={14} /></button>}
            </div>
          ))}
        </div>
        {!locked && items.length < 10 && <button className="text-button" onClick={() => { const next = [...items, ""]; set({ orderItems: next, correctOrder: next.map((_, i) => i) }); }}><Icon name="plus" size={14} /> Tambah item</button>}
      </div>
    );
  }

  return (
    <div>
      <div className="info-note essay-note">
        <Icon name="edit" size={16} />
        <p>Murid menjawab dengan teks panjang. Jawaban dinilai manual oleh guru dari halaman Hasil, dengan nilai 0 sampai bobot soal.</p>
      </div>
      <label className="field">
        <span>Pedoman penilaian <small>(opsional, hanya terlihat oleh guru)</small></span>
        <textarea
          className="question-input"
          rows={3}
          placeholder="Contoh: Jawaban benar menyebut tiga poin utama..."
          readOnly={locked}
          maxLength={2000}
          value={question.rubric}
          onChange={(event) => set({ rubric: event.target.value })}
        />
      </label>
    </div>
  );
}
