import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { Modal, Spinner } from "../../components/ui";
import { api, type SubmissionDetail } from "../../lib/api";
import { formatNumber } from "../../lib/format";
import { usePreferences } from "../../lib/preferences";
import { getFormatLabel } from "../../lib/questions";

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
  const { t } = usePreferences();
  const statusText = {
    correct: t("Benar", "Correct"),
    partial: t("Sebagian", "Partial"),
    wrong: t("Salah", "Wrong"),
    blank: t("Tidak dijawab", "Unanswered"),
    pending: t("Menunggu penilaian AI", "Awaiting AI grading"),
  } as const;
  const [data, setData] = useState<SubmissionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [aiGrading, setAiGrading] = useState(false);
  const autoGradedRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const hydrate = useCallback((detail: SubmissionDetail) => {
    setData(detail);
    const next: Record<string, string> = {};
    for (const [id, value] of Object.entries(detail.submission.grades)) next[id] = String(value);
    setInputs(next);
  }, []);

  const runAiGrading = useCallback(async (initialPending: number) => {
    if (initialPending <= 0) return;
    setAiGrading(true);
    setError(null);
    let remaining = initialPending;
    let changed = false;
    try {
      for (let step = 0; step < 60 && remaining > 0 && mountedRef.current; step += 1) {
        const res = await api<SubmissionDetail & { processed: number; model: string }>(
          `/exams/${examId}/submissions/${submissionId}/grade-ai`,
          { method: "POST", body: {} },
        );
        if (!mountedRef.current) return;
        hydrate(res);
        if (res.processed > 0) changed = true;
        remaining = res.submission.pending;
        if (!res.processed) break;
      }
      if (changed) onSaved();
    } catch (err) {
      if (mountedRef.current) setError((err as Error).message);
    } finally {
      if (mountedRef.current) setAiGrading(false);
    }
  }, [examId, hydrate, onSaved, submissionId]);

  useEffect(() => {
    let active = true;
    autoGradedRef.current = null;
    api<SubmissionDetail>(`/exams/${examId}/submissions/${submissionId}`)
      .then((detail) => {
        if (!active) return;
        hydrate(detail);
        if (detail.submission.status === "done" && detail.submission.pending > 0 && autoGradedRef.current !== submissionId) {
          autoGradedRef.current = submissionId;
          void runAiGrading(detail.submission.pending);
        }
      })
      .catch((err) => active && setError((err as Error).message));
    return () => {
      active = false;
    };
  }, [examId, hydrate, runAiGrading, submissionId]);

  async function save() {
    if (!data) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const grades: Record<string, number> = {};
      for (const question of data.questions) {
        if (!(["short_answer", "fill_blank", "numeric", "essay"] as string[]).includes(question.format)) continue;
        const raw = (inputs[question.id] ?? "").replace(",", ".").trim();
        if (raw === "") continue;
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 0 || value > question.points) {
          throw new Error(t(`Nilai soal harus antara 0 dan ${question.points}.`, `Question score must be between 0 and ${question.points}.`));
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

  const hasEssay = data?.questions.some((q) => ["short_answer", "fill_blank", "numeric", "essay"].includes(q.format)) ?? false;
  const canGrade = data?.submission.status === "done";

  return (
    <Modal
      wide
      icon="file"
      title={data ? `${t("Jawaban", "Answers:")} ${data.submission.studentName}` : t("Jawaban murid", "Student answers")}
      description={data ? `${t("Percobaan ke-", "Attempt #")}${data.submission.attempt} · ${t("nilai", "score")} ${formatNumber(data.submission.score)} (${formatNumber(data.submission.earned)} ${t("dari", "of")} ${data.submission.maxPoints} ${t("poin", "pts")})` : undefined}
      onClose={() => !saving && !aiGrading && onClose()}
      footer={
        data && hasEssay && canGrade ? (
          <>
            <button className="btn btn-outline" onClick={onClose} disabled={saving || aiGrading}>{t("Tutup", "Close")}</button>
            {data.submission.pending > 0 && (
              <button className="btn btn-outline" type="button" onClick={() => void runAiGrading(data.submission.pending)} disabled={saving || aiGrading}>
                <Icon name="sparkle" size={14} /> {aiGrading ? t("Menilai AI...", "AI Grading...") : t("Nilai dengan AI", "Grade with AI")}
              </button>
            )}
            <button className="btn btn-primary" onClick={save} disabled={saving || aiGrading}>{saving ? t("Menyimpan...", "Saving...") : t("Simpan penilaian", "Save grades")}</button>
          </>
        ) : (
          <button className="btn btn-outline" onClick={onClose}>{t("Tutup", "Close")}</button>
        )
      }
    >
      {!data && !error && <Spinner />}
      {error && <div className="notice notice-danger" role="alert"><Icon name="alert" size={16} /><span>{error}</span></div>}
      {saved && <div className="notice"><Icon name="check" size={16} /><span>{t("Penilaian tersimpan dan nilai akhir diperbarui.", "Grades saved and final score updated.")}</span></div>}
      {aiGrading && data && (
        <div className="notice" role="status">
          <Icon name="sparkle" size={16} />
          <span>{t("Model", "Model")} <code>gemini-5-flash-lite</code> {t(`sedang menilai ${data.submission.pending} jawaban terbuka...`, `is grading ${data.submission.pending} open-ended answer(s)...`)}</span>
        </div>
      )}
      {data && !canGrade && hasEssay && (
        <div className="notice"><Icon name="clock" size={16} /><span>{t("Murid belum mengumpulkan jawaban, jadi jawaban terbuka belum bisa dinilai.", "Student hasn't submitted yet, so open-ended answers can't be graded.")}</span></div>
      )}

      {data?.questions.map((question, index) => {
        const answer = data.submission.answers[question.id];
        const result = data.submission.detail[question.id];
        return (
          <section className="review-item" key={question.id}>
            <div className="review-head">
              <span className="question-number">{index + 1}</span>
              <span className="sq-meta">{getFormatLabel(question.format)} · {t("bobot", "points")} {question.points}</span>
              <em className={`badge review-${result.status}`}>
                {statusText[result.status]}
                {result.status !== "blank" && result.status !== "pending" ? ` · ${formatNumber(result.earned)}/${result.max}` : ""}
              </em>
            </div>
            {question.story && <div className="story-box">{question.story}</div>}
            {question.image && <img className="question-image" src={question.image} alt={`${t("Gambar soal", "Question image")} ${index + 1}`} loading="lazy" />}
            <p className="question-text">{question.text}</p>

            {(question.format === "multiple_choice" || question.format === "multiple_select" || question.format === "true_false") && (
              <div className="review-options">
                {question.options.map((option, oi) => {
                  const chosen = Array.isArray(answer) ? answer.includes(oi) : answer === oi;
                  const correct = question.format === "multiple_select" ? (question.correctIndices ?? []).includes(oi) : question.correctIndex === oi;
                  return (
                    <div key={oi} className={`review-option ${correct ? "review-option-correct" : ""} ${chosen && !correct ? "review-option-wrong" : ""}`}>
                      {(question.format === "multiple_choice" || question.format === "multiple_select") && <span className="option-letter">{String.fromCharCode(65 + oi)}</span>}
                      <span>{option}</span>
                      {chosen && <b>{t("Jawaban murid", "Student answer")}</b>}
                      {correct && <b className="tag-key">{t("Kunci", "Key")}</b>}
                    </div>
                  );
                })}
              </div>
            )}

            {(["short_answer", "fill_blank", "numeric"] as string[]).includes(question.format) && (
              <div className="review-text">
                <div><small>{t("Jawaban murid", "Student answer")}</small><p>{typeof answer === "string" ? answer : "–"}</p></div>
                <div><small>{t("Jawaban benar", "Accepted answers")}</small><p>{question.acceptedAnswers.filter((a) => a.trim()).join("  /  ")}</p></div>
              </div>
            )}

            {question.format === "matching" && (() => {
              let selected: Record<string, string> = {};
              if (typeof answer === "string") { try { selected = JSON.parse(answer); } catch { selected = {}; } }
              return <div className="review-matching-list">{(question.matchPairs ?? []).map((pair, pairIndex) => <div key={pairIndex}><span>{pair.left}</span><span>{selected[pair.left] || t("Tidak dijawab", "Unanswered")}</span><b className={selected[pair.left] === pair.right ? "tag-key" : "review-wrong-label"}>{t("Kunci:", "Key:")} {pair.right}</b></div>)}</div>;
            })()}

            {question.format === "ordering" && (() => {
              const ranks = Array.isArray(answer) ? answer : [];
              const ordered = (question.orderItems ?? []).map((text, itemIndex) => ({ text, rank: ranks[itemIndex] ?? -1, correctRank: (question.correctOrder ?? []).indexOf(itemIndex) })).sort((a, b) => (a.rank < 0 ? 999 : a.rank) - (b.rank < 0 ? 999 : b.rank));
              return <div className="review-matching-list">{ordered.map((item, itemIndex) => <div key={`${item.text}-${itemIndex}`}><span>{item.rank < 0 ? "—" : item.rank + 1}. {item.text}</span><b>{item.correctRank + 1}. {item.text} ({t("urutan benar", "correct order")})</b></div>)}</div>;
            })()}

            {question.explanation?.trim() && <div className="review-rubric"><small>{t("Penjelasan jawaban untuk guru", "Answer explanation for teacher")}</small><p>{question.explanation}</p></div>}

            {(["short_answer", "fill_blank", "numeric", "essay"] as string[]).includes(question.format) && (
              <div>
                <div className="review-essay">
                  <small>{t("Jawaban murid", "Student answer")}</small>
                  <p>{typeof answer === "string" ? answer : t("Tidak dijawab", "Unanswered")}</p>
                </div>
                {question.rubric && (
                  <div className="review-rubric"><small>{t("Pedoman penilaian", "Grading rubric")}</small><p>{question.rubric}</p></div>
                )}
                {typeof answer === "string" && canGrade && (
                  <label className="grade-row">
                    <span>{t("Koreksi nilai (opsional,", "Adjust score (optional,")} 0 – {question.points})</span>
                    <input
                      className="plain-input"
                      inputMode="decimal"
                      placeholder="0"
                      value={inputs[question.id] ?? ""}
                      onChange={(event) => setInputs((prev) => ({ ...prev, [question.id]: event.target.value }))}
                    />
                    <button className="btn btn-outline" type="button" onClick={() => setInputs((prev) => ({ ...prev, [question.id]: String(question.points) }))}>
                      {t("Nilai penuh", "Full points")}
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
