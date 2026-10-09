export type ExamStatus = "draft" | "published" | "closed";

export type QuestionType = "multiple_choice" | "short_answer" | "essay" | "true_false" | "story" | "story_image" | "image";
export type AnswerValue = string | number | boolean;
export type Question = {
  id: string;
  type: QuestionType;
  text: string;
  options: string[];
  correctIndex: number | null;
  correctAnswer: string | null;
  imageUrl: string | null;
  required: boolean;
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
  allowRetakes: boolean;
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
  };
  live: ExamSummary[];
  recent: ExamSummary[];
  activity: {
    id: string;
    examId: string;
    examTitle: string;
    studentName: string;
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
    publishedAt: string | null;
  };
  summary: {
    joined: number;
    submitted: number;
    avgScore: number | null;
    topScore: number | null;
    topStudent: string | null;
  };
  distribution: { label: string; count: number }[];
  hardest: { number: number; text: string; correctRate: number | null } | null;
  submissions: {
    id: string;
    attemptNo: number;
    studentName: string;
    ipMasked: string;
    state: "done" | "working" | "disconnected";
    score: number | null;
    correct: number;
    total: number;
    answered: number;
    gradable: number;
    seconds: number;
    startedAt: string;
    lastActivity: string | null;
  }[];
  serverNow: string;
};

export type PublicExam = {
  title: string;
  className: string;
  durationMin: number;
  shuffle: boolean;
  showScore: boolean;
  allowRetakes: boolean;
  status: ExamStatus;
  questions: { id: string; type: QuestionType; text: string; options: string[]; imageUrl: string | null; required: boolean }[];
};

export type PublicSubmission = {
  id: string;
  status: "working" | "done";
  startedAt: string;
  answers: Record<string, AnswerValue>;
  result: { showScore: boolean; score: number | null; correct: number | null; total: number; gradable: number } | null;
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
