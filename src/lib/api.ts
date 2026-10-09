export type ExamStatus = "draft" | "published" | "closed";

export type Format = "multiple_choice" | "true_false" | "short_answer" | "essay";
export type Kind = Format | "story" | "story_image" | "image";
export type AnswerValue = number | string;
export type Answers = Record<string, AnswerValue>;

export type Question = {
  id: string;
  kind: Kind;
  format: Format;
  text: string;
  story: string;
  image: string | null;
  options: string[];
  correctIndex: number;
  acceptedAnswers: string[];
  rubric: string;
  points: number;
};

export type User = { id: string; email: string; name: string; picture: string | null };

export type ExamSummary = {
  id: string;
  title: string;
  className: string;
  durationMin: number;
  status: ExamStatus;
  slug: string | null;
  questionCount: number;
  participants: number;
  submitted: number;
  pendingReview: number;
  avgScore: number | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type Exam = {
  id: string;
  title: string;
  className: string;
  durationMin: number;
  shuffle: boolean;
  showScore: boolean;
  allowRetake: boolean;
  maxAttempts: number;
  status: ExamStatus;
  slug: string | null;
  questions: Question[];
  participants: number;
  publishedAt: string | null;
  updatedAt: string;
};

export type DashboardData = {
  stats: {
    totalExams: number;
    examsThisMonth: number;
    activeExams: number;
    participants: number;
    participantsThisMonth: number;
    avgScore: number | null;
    pendingReview: number;
  };
  live: ExamSummary[];
  recent: ExamSummary[];
  activity: {
    id: string;
    examId: string;
    examTitle: string;
    studentName: string;
    attempt: number;
    status: "working" | "done";
    score: number | null;
    at: string;
  }[];
  serverNow: string;
};

export type ResultsData = {
  exam: {
    id: string;
    title: string;
    className: string;
    durationMin: number;
    status: ExamStatus;
    slug: string | null;
    questionCount: number;
    allowRetake: boolean;
    maxAttempts: number;
    hasEssay: boolean;
    publishedAt: string | null;
  };
  summary: {
    joined: number;
    submitted: number;
    attempts: number;
    pendingReview: number;
    avgScore: number | null;
    topScore: number | null;
    topStudent: string | null;
  };
  distribution: { label: string; count: number }[];
  hardest: { number: number; text: string; correctRate: number | null } | null;
  submissions: {
    id: string;
    studentName: string;
    attempt: number;
    ipMasked: string;
    state: "done" | "working" | "disconnected";
    score: number | null;
    correct: number;
    total: number;
    pending: number;
    answered: number;
    seconds: number;
    startedAt: string;
    lastActivity: string | null;
  }[];
  serverNow: string;
};

export type PublicQuestion = {
  id: string;
  kind: Kind;
  format: Format;
  text: string;
  story: string;
  image: string | null;
  options: string[];
  points: number;
};

export type PublicExam = {
  title: string;
  className: string;
  durationMin: number;
  shuffle: boolean;
  showScore: boolean;
  allowRetake: boolean;
  maxAttempts: number;
  status: ExamStatus;
  questions: PublicQuestion[];
};

export type PublicSubmission = {
  id: string;
  status: "working" | "done";
  attempt: number;
  startedAt: string;
  answers: Answers;
  canRetake: boolean;
  attemptsLeft: number | null;
  result: { showScore: boolean; score: number | null; correct: number | null; total: number; pending: number } | null;
};

export type QuestionResult = {
  earned: number;
  max: number;
  status: "correct" | "partial" | "wrong" | "blank" | "pending";
};

export type SubmissionDetail = {
  submission: {
    id: string;
    studentName: string;
    attempt: number;
    status: "working" | "done";
    score: number;
    earned: number;
    maxPoints: number;
    pending: number;
    answers: Answers;
    grades: Record<string, number>;
    detail: Record<string, QuestionResult>;
  };
  questions: Question[];
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
      headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: "same-origin",
      signal: options.signal,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError(0, "Tidak dapat terhubung ke server. Periksa koneksi internet.");
  }

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Respons bukan JSON (misalnya server API belum berjalan).
  }
  if (!response.ok) {
    throw new ApiError(response.status, data?.error ?? "Terjadi kesalahan. Coba lagi.");
  }
  if (data === null) throw new ApiError(502, "Server API tidak merespons dengan benar.");
  return data as T;
}
