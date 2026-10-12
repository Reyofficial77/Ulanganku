import { useEffect, useState } from "react";
import { Icon } from "../../components/Icon";
import { Modal, Spinner } from "../../components/ui";
import { api, type SubmissionDetail } from "../../lib/api";
import { formatNumber } from "../../lib/format";
import { FORMAT_LABEL } from "../../lib/questions";

const statusText = { correct: "Benar", partial: "Sebagian", wrong: "Salah", blank: "Tidak dijawab", pending: "Perlu dinilai" } as const;

export default function SubmissionModal({
  examId,
  submissionId,
  onClose,
  onSaved,
}: {
  examId: string;
  submissionId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState<SubmissionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function hydrate(detail: SubmissionDetail) {
    setData(detail);
    const next: Record<string, string> = {};
    for (const [id, value] of Object.entries(detail.submission.grades)) next[id] = String(value);
    setInputs(next);
  }

  useEffect(() => {
    let active = true;
    api<SubmissionDetail>(`/exams/${examId}/submissions/${submissionId}`)
      .then((detail) => active && hydrate(detail))
      .catch((err) => active && setError((err as Error).message));
    return () => {
      active = false;
    };
  }, [examId, submissionId]);

  async function save() {
    if (!data) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const grades: Record<string, number> = {};
      for (const question of data.questions) {
        if (question.format !== "essay") continue;
        const raw = (inputs[question.id] ?? "").replace(",", ".").trim();
        if (raw === "") continue;
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 0 || value > question.points) {
          throw new Error(`Nilai soal uraian harus antara 0 dan ${question.points}.`);
        }
        grades[question.id] = value;
      }
      const updated = await api<SubmissionDetail>(`/exams/${examId}/submissions/${submissionId}/grade`, {
        method: "PUT",
        body: { grades },
      });
      hydrate(updated);
      setSaved(true);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const hasEssay = data?.questions.some((q) => q.format === "essay") ?? false;
  const canGrade = data?.submission.status === "done";

  return (
    <Modal
      wide
      icon="file"
      title={data ? `Jawaban ${data.submission.studentName}` : "Jawaban murid"}
      description={data ? `Percobaan ke-${data.submission.attempt} · nilai ${formatNumber(data.submission.score)} (${formatNumber(data.submission.earned)} dari ${data.submission.maxPoints} poin)` : undefined}
      onClose={() => !saving && onClose()}
      footer={
        data && hasEssay && canGrade ? (
          <>
            <button className="btn btn-outline" onClick={onClose} disabled={saving}>Tutup</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Menyimpan..." : "Simpan penilaian"}</button>
          </>
        ) : (
          <button className="btn btn-outline" onClick={onClose}>Tutup</button>
        )
      }
    >
      {!data && !error && <Spinner />}
      {error && <div className="notice notice-danger" role="alert"><Icon name="alert" size={16} /><span>{error}</span></div>}
      {saved && <div className="notice"><Icon name="check" size={16} /><span>Penilaian tersimpan dan nilai akhir diperbarui.</span></div>}
      {data && !canGrade && hasEssay && (
        <div className="notice"><Icon name="clock" size={16} /><span>Murid belum mengumpulkan jawaban, jadi soal uraian belum bisa dinilai.</span></div>
      )}

      {data?.questions.map((question, index) => {
        const answer = data.submission.answers[question.id];
        const result = data.submission.detail[question.id];
        return (
          <section className="review-item" key={question.id}>
            <div className="review-head">
              <span className="question-number">{index + 1}</span>
              <span className="sq-meta">{FORMAT_LABEL[question.format]} · bobot {question.points}</span>
              <em className={`badge review-${result.status}`}>
                {statusText[result.status]}
                {result.status !== "blank" && result.status !== "pending" ? ` · ${formatNumber(result.earned)}/${result.max}` : ""}
              </em>
            </div>
            {question.story && <div className="story-box">{question.story}</div>}
            {question.image && <img className="question-image" src={question.image} alt={`Gambar soal ${index + 1}`} loading="lazy" />}
            <p className="question-text">{question.text}</p>

            {(question.format === "multiple_choice" || question.format === "true_false") && (
              <div className="review-options">
                {question.options.map((option, oi) => {
                  const chosen = answer === oi;
                  const correct = question.correctIndex === oi;
                  return (
                    <div key={oi} className={`review-option ${correct ? "review-option-correct" : ""} ${chosen && !correct ? "review-option-wrong" : ""}`}>
                      {question.format === "multiple_choice" && <span className="option-letter">{String.fromCharCode(65 + oi)}</span>}
                      <span>{option}</span>
                      {chosen && <b>Jawaban murid</b>}
                      {correct && <b className="tag-key">Kunci</b>}
                    </div>
                  );
                })}
              </div>
            )}

            {question.format === "short_answer" && (
              <div className="review-text">
                <div><small>Jawaban murid</small><p>{typeof answer === "string" ? answer : "–"}</p></div>
                <div><small>Jawaban benar</small><p>{question.acceptedAnswers.filter((a) => a.trim()).join("  /  ")}</p></div>
              </div>
            )}

            {question.format === "essay" && (
              <div>
                <div className="review-essay">
                  <small>Jawaban murid</small>
                  <p>{typeof answer === "string" ? answer : "Tidak dijawab"}</p>
                </div>
                {question.rubric && (
                  <div className="review-rubric"><small>Pedoman penilaian</small><p>{question.rubric}</p></div>
                )}
                {typeof answer === "string" && canGrade && (
                  <label className="grade-row">
                    <span>Nilai (0 – {question.points})</span>
                    <input
                      className="plain-input"
                      inputMode="decimal"
                      placeholder="0"
                      value={inputs[question.id] ?? ""}
                      onChange={(event) => setInputs((prev) => ({ ...prev, [question.id]: event.target.value }))}
                    />
                    <button className="btn btn-outline" type="button" onClick={() => setInputs((prev) => ({ ...prev, [question.id]: String(question.points) }))}>
                      Nilai penuh
                    </button>
                  </label>
                )}
              </div>
            )}
          </section>
        );
      })}
    </Modal>
  );
}
