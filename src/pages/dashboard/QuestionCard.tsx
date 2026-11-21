import { useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { usePreferences } from "../../lib/preferences";
import {
  FORMAT_LABEL,
  changeFormat,
  changeKind,
  getFormatLabel,
  getKindMeta,
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
  const { t } = usePreferences();
  const set = (changes: Partial<Question>) => onChange({ ...question, ...changes });
  const n = index + 1;

  return (
    <article id={`q-${question.id}`} className={`question-card ${active ? "question-card-active" : ""}`} onFocus={onFocus}>
      <div className="question-card-head">
        <div className="question-number">{n}</div>
        <strong className="question-title">{t("Soal", "Question")} {n}</strong>
        {!locked && (
          <button className="icon-button icon-danger" aria-label={`${t("Hapus soal", "Delete question")} ${n}`} disabled={!canRemove} onClick={onRemove}>
            <Icon name="trash" size={17} />
          </button>
        )}
      </div>

      <div className="question-toolbar">
        <label className="mini-field">
          <span>{t("Tipe soal", "Question type")}</span>
          <select
            className="select"
            value={question.kind}
            disabled={locked}
            aria-label={`${t("Tipe soal", "Question type")} ${n}`}
            onChange={(event) => onChange(changeKind(question, event.target.value as Kind))}
          >
            {getKindMeta().map((item) => (
              <option key={item.kind} value={item.kind}>{item.label}</option>
            ))}
          </select>
        </label>
        {!isBasicKind(question.kind) && (
          <label className="mini-field">
            <span>{t("Bentuk jawaban", "Answer format")}</span>
            <select
              className="select"
              value={question.format}
              disabled={locked}
              aria-label={`${t("Bentuk jawaban soal", "Question answer format")} ${n}`}
              onChange={(event) => onChange(changeFormat(question, event.target.value as Format))}
            >
              {(Object.keys(FORMAT_LABEL) as Format[]).map((format) => (
                <option key={format} value={format}>{getFormatLabel(format)}</option>
              ))}
            </select>
          </label>
        )}
        <label className="mini-field mini-field-points">
          <span>{t("Bobot", "Points")}</span>
          <input
            className="select"
            inputMode="numeric"
            aria-label={`${t("Bobot soal", "Question points")} ${n}`}
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
            <span>{t("Teks cerita / bacaan", "Story / reading passage")}</span>
            <textarea
              className="question-input story-input"
              rows={5}
              placeholder={t("Tulis cerita atau bacaan yang menjadi dasar soal...", "Write the story or passage for this question...")}
              readOnly={locked}
              maxLength={6000}
              value={question.story}
              onChange={(event) => set({ story: event.target.value })}
            />
          </label>
        )}

        {hasImage(question.kind) && <ImageField question={question} locked={locked} onChange={(image) => set({ image })} />}

        <label className="field">
          <span>{t("Pertanyaan", "Question")}</span>
          <textarea
            className="question-input"
            rows={2}
            aria-label={`${t("Pertanyaan", "Question")} ${n}`}
            placeholder={t("Tulis pertanyaan di sini...", "Write your question here...")}
            readOnly={locked}
            maxLength={3000}
            value={question.text}
            onChange={(event) => set({ text: event.target.value })}
          />
        </label>

        <AnswerEditor question={question} locked={locked} onChange={onChange} />
        <label className="field question-explanation-field">
          <span>{t("Penjelasan jawaban", "Answer explanation")} <small>({t("opsional, hanya untuk guru", "optional, teacher only")})</small></span>
          <textarea className="question-input" rows={2} maxLength={2000} placeholder={t("Mengapa jawaban tersebut benar?", "Why is this answer correct?")} readOnly={locked} value={question.explanation ?? ""} onChange={(event) => set({ explanation: event.target.value })} />
        </label>
      </div>
    </article>
  );
}

function ImageField({ question, locked, onChange }: { question: Question; locked: boolean; onChange: (image: string | null) => void }) {
  const { t } = usePreferences();
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
      <span>{t("Gambar soal", "Question image")}</span>
      {question.image ? (
        <div className="image-preview">
          <img src={question.image} alt={t("Gambar soal", "Question image")} />
          {!locked && (
            <div className="image-actions">
              <button className="btn btn-outline" onClick={() => input.current?.click()} disabled={busy}>
                <Icon name="upload" size={15} /> {busy ? t("Mengunggah...", "Uploading...") : t("Ganti gambar", "Change image")}
              </button>
              <button className="btn btn-outline" onClick={() => onChange(null)} disabled={busy}>
                <Icon name="trash" size={15} /> {t("Hapus", "Remove")}
              </button>
            </div>
          )}
        </div>
      ) : (
        <button type="button" className="image-drop" onClick={() => input.current?.click()} disabled={locked || busy}>
          <Icon name="image" size={22} />
          <strong>{busy ? t("Mengunggah gambar...", "Uploading image...") : t("Unggah gambar", "Upload image")}</strong>
          <small>{t("JPG, PNG, atau WebP. Otomatis diperkecil agar ringan.", "JPG, PNG, or WebP. Automatically resized for speed.")}</small>
        </button>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(event) => pick(event.target.files?.[0])} />
      {error && <small className="text-bad">{error}</small>}
    </div>
  );
}

function AnswerEditor({ question, locked, onChange }: { question: Question; locked: boolean; onChange: (q: Question) => void }) {
  const { t } = usePreferences();
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
        <div className="answer-label">{t("Pilihan jawaban", "Answer choices")} <small>{multi ? t("Tandai semua pilihan yang benar", "Mark all correct choices") : t("Klik lingkaran untuk menandai kunci jawaban", "Click the circle to mark the answer key")}</small></div>
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
                  aria-label={`${t("Jadikan pilihan", "Mark choice")} ${letter(oi)} ${multi ? t("sebagai salah satu kunci jawaban", "as a correct answer") : t("sebagai kunci jawaban", "as answer key")}`}
                  disabled={locked}
                  onClick={() => set(multi
                    ? { correctIndices: correct ? (question.correctIndices ?? []).filter((value) => value !== oi) : [...(question.correctIndices ?? []), oi] }
                    : { correctIndex: oi })}
                >
                  {correct && <Icon name="check" size={12} />}
                </button>
                <span className="option-letter">{letter(oi)}</span>
                <input
                  aria-label={`${t("Pilihan", "Choice")} ${letter(oi)}`}
                  placeholder={`${t("Pilihan", "Choice")} ${letter(oi)}`}
                  readOnly={locked}
                  maxLength={500}
                  value={option}
                  onChange={(event) => set({ options: question.options.map((o, i) => (i === oi ? event.target.value : o)) })}
                />
                {correct && <span className="answer-key">{multi ? t("Kunci benar", "Correct") : t("Kunci jawaban", "Answer key")}</span>}
                {!locked && question.options.length > 2 && (
                  <button className="icon-button icon-sm" aria-label={`${t("Hapus pilihan", "Remove choice")} ${letter(oi)}`} onClick={() => removeOption(oi)}>
                    <Icon name="close" size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {!locked && question.options.length < 8 && (
          <button className="text-button" onClick={() => set({ options: [...question.options, ""] })}>
            <Icon name="plus" size={14} /> {t("Tambah pilihan", "Add choice")}
          </button>
        )}
      </div>
    );
  }

  if (question.format === "true_false") {
    return (
      <div>
        <div className="answer-label">{t("Kunci jawaban", "Answer key")} <small>{t("Pilih jawaban yang benar", "Select the correct answer")}</small></div>
        <div className="tf-options">
          {question.options.map((option, oi) => {
            const correct = question.correctIndex === oi;
            const displayOption = option === "Benar" ? t("Benar", "True") : option === "Salah" ? t("Salah", "False") : option;
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
                {correct && <Icon name="check" size={14} />} {displayOption}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (["short_answer", "fill_blank", "numeric"].includes(question.format)) {
    const answers = question.acceptedAnswers;
    const answerLabel = question.format === "numeric" ? t("Angka yang dianggap benar", "Accepted numbers") : question.format === "fill_blank" ? t("Jawaban untuk bagian rumpang", "Accepted fill-in answers") : t("Jawaban yang dianggap benar", "Accepted answers");
    return (
      <div>
        <div className="answer-label">{answerLabel} <small>{t("Huruf besar/kecil dan spasi berlebih diabaikan. Angka 3,5 dan 3.5 dianggap sama.", "Case and extra spaces are ignored. 3,5 and 3.5 are treated equally.")}</small></div>
        <div className="options-list">
          {answers.map((answer, ai) => (
            <div className="option option-correct" key={ai}>
              <span className="option-letter">{ai + 1}</span>
              <input
                aria-label={`${t("Jawaban benar", "Accepted answer")} ${ai + 1}`}
                placeholder={ai === 0 ? t("Jawaban utama", "Primary answer") : t("Variasi jawaban lain", "Alternative answer")}
                readOnly={locked}
                maxLength={200}
                value={answer}
                onChange={(event) => set({ acceptedAnswers: answers.map((a, i) => (i === ai ? event.target.value : a)) })}
              />
              {!locked && answers.length > 1 && (
                <button className="icon-button icon-sm" aria-label={`${t("Hapus jawaban", "Remove answer")} ${ai + 1}`} onClick={() => set({ acceptedAnswers: answers.filter((_, i) => i !== ai) })}>
                  <Icon name="close" size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        {!locked && answers.length < 10 && (
          <button className="text-button" onClick={() => set({ acceptedAnswers: [...answers, ""] })}>
            <Icon name="plus" size={14} /> {t("Tambah variasi jawaban", "Add answer variation")}
          </button>
        )}
      </div>
    );
  }

  if (question.format === "matching") {
    const pairs = question.matchPairs ?? [];
    return (
      <div>
        <div className="answer-label">{t("Pasangan yang benar", "Correct pairs")} <small>{t("Masukkan pernyataan di kiri dan jawaban pasangannya di kanan.", "Enter the prompt on the left and its matching answer on the right.")}</small></div>
        <div className="options-list">
          {pairs.map((pair, index) => (
            <div className="option matching-editor-row" key={index}>
              <input aria-label={`${t("Pernyataan pasangan", "Pair prompt")} ${index + 1}`} placeholder={`${t("Pernyataan", "Prompt")} ${index + 1}`} maxLength={300} readOnly={locked} value={pair.left} onChange={(event) => set({ matchPairs: pairs.map((item, i) => i === index ? { ...item, left: event.target.value } : item) })} />
              <span aria-hidden="true">↔</span>
              <input aria-label={`${t("Jawaban pasangan", "Pair match")} ${index + 1}`} placeholder={`${t("Pasangan", "Match")} ${index + 1}`} maxLength={300} readOnly={locked} value={pair.right} onChange={(event) => set({ matchPairs: pairs.map((item, i) => i === index ? { ...item, right: event.target.value } : item) })} />
              {!locked && pairs.length > 2 && <button className="icon-button icon-sm" aria-label={`${t("Hapus pasangan", "Remove pair")} ${index + 1}`} onClick={() => set({ matchPairs: pairs.filter((_, i) => i !== index) })}><Icon name="close" size={14} /></button>}
            </div>
          ))}
        </div>
        {!locked && pairs.length < 10 && <button className="text-button" onClick={() => set({ matchPairs: [...pairs, { left: "", right: "" }] })}><Icon name="plus" size={14} /> {t("Tambah pasangan", "Add pair")}</button>}
      </div>
    );
  }

  if (question.format === "ordering") {
    const items = question.orderItems ?? [];
    return (
      <div>
        <div className="answer-label">{t("Urutan yang benar", "Correct order")} <small>{t("Susun item di sini dari langkah pertama sampai terakhir. Tampilan murid akan diacak.", "Arrange items from first to last here. Students will see them shuffled.")}</small></div>
        <div className="options-list">
          {items.map((item, index) => (
            <div className="option" key={index}>
              <span className="option-letter">{index + 1}</span>
              <input aria-label={`${t("Item urutan", "Order item")} ${index + 1}`} placeholder={`${t("Item", "Item")} ${index + 1}`} maxLength={300} readOnly={locked} value={item} onChange={(event) => set({ orderItems: items.map((value, i) => i === index ? event.target.value : value), correctOrder: items.map((_, i) => i) })} />
              {!locked && items.length > 2 && <button className="icon-button icon-sm" aria-label={`${t("Hapus item", "Remove item")} ${index + 1}`} onClick={() => { const next = items.filter((_, i) => i !== index); set({ orderItems: next, correctOrder: next.map((_, i) => i) }); }}><Icon name="close" size={14} /></button>}
            </div>
          ))}
        </div>
        {!locked && items.length < 10 && <button className="text-button" onClick={() => { const next = [...items, ""]; set({ orderItems: next, correctOrder: next.map((_, i) => i) }); }}><Icon name="plus" size={14} /> {t("Tambah item", "Add item")}</button>}
      </div>
    );
  }

  return (
    <div>
      <div className="info-note essay-note">
        <Icon name="edit" size={16} />
        <p>{t("Murid menjawab dengan teks panjang. Jawaban dinilai oleh AI (gemini-5-flash-lite) atau manual oleh guru dari halaman Hasil, dengan nilai 0 sampai bobot soal.", "Students write a long-form answer. Responses are graded by AI (gemini-5-flash-lite) or manually by the teacher on the Results page, up to the question's points.")}</p>
      </div>
      <label className="field">
        <span>{t("Pedoman penilaian", "Grading rubric")} <small>({t("opsional, hanya terlihat oleh guru", "optional, teacher only")})</small></span>
        <textarea
          className="question-input"
          rows={3}
          placeholder={t("Contoh: Jawaban benar menyebut tiga poin utama...", "Example: Full credit mentions three key points...")}
          readOnly={locked}
          maxLength={2000}
          value={question.rubric}
          onChange={(event) => set({ rubric: event.target.value })}
        />
      </label>
    </div>
  );
}
