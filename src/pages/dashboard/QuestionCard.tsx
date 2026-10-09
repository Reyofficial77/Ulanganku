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
        {!locked && (
          <button className="icon-button icon-danger" aria-label={`Hapus soal ${n}`} disabled={!canRemove} onClick={onRemove}>
            <Icon name="trash" size={17} />
          </button>
        )}
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

  if (question.format === "multiple_choice") {
    const removeOption = (index: number) => {
      if (question.options.length <= 2) return;
      let correctIndex = question.correctIndex;
      if (index < correctIndex) correctIndex -= 1;
      else if (index === correctIndex) correctIndex = 0;
      set({ options: question.options.filter((_, i) => i !== index), correctIndex });
    };
    return (
      <div>
        <div className="answer-label">Pilihan jawaban <small>Klik lingkaran untuk menandai kunci jawaban</small></div>
        <div className="options-list">
          {question.options.map((option, oi) => {
            const correct = question.correctIndex === oi;
            return (
              <div className={`option ${correct ? "option-correct" : ""}`} key={oi}>
                <button
                  type="button"
                  className={`radio ${correct ? "radio-on" : ""}`}
                  role="radio"
                  aria-checked={correct}
                  aria-label={`Jadikan pilihan ${letter(oi)} sebagai kunci jawaban`}
                  disabled={locked}
                  onClick={() => set({ correctIndex: oi })}
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
                {correct && <span className="answer-key">Kunci jawaban</span>}
                {!locked && question.options.length > 2 && (
                  <button className="icon-button icon-sm" aria-label={`Hapus pilihan ${letter(oi)}`} onClick={() => removeOption(oi)}>
                    <Icon name="close" size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {!locked && question.options.length < 6 && (
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

  if (question.format === "short_answer") {
    const answers = question.acceptedAnswers;
    return (
      <div>
        <div className="answer-label">Jawaban yang dianggap benar <small>Huruf besar/kecil dan spasi berlebih diabaikan. Angka 3,5 dan 3.5 dianggap sama.</small></div>
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
