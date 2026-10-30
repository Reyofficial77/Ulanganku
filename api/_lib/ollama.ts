import { HttpError } from "./http.js";

/** Endpoint Ollama Cloud (API langsung, autentikasi memakai Bearer API key). */
export const OLLAMA_URL = "https://ollama.com/api/chat";
/** Model default dan model penilai. Penilaian jawaban selalu memakai Gemma 4 31B. */
const configuredModel = process.env.OLLAMA_MODEL?.trim() || "gemma4:31b-cloud";
export const OLLAMA_MODEL = configuredModel === "gemma4:31b" ? "gemma4:31b-cloud" : configuredModel;
export const AI_GRADER_MODEL = "gemma4:31b-cloud";

export type OllamaModelChoice = { id: string; label: string; description: string };
export type OllamaModelGroup = { id: string; label: string; description: string; models: OllamaModelChoice[] };

/**
 * Katalog sengaja dikurasi dan dikelompokkan berdasarkan pekerjaan.
 * Ollama /api/tags dapat mengembalikan semua model akun sehingga tidak dipakai
 * sebagai daftar UI; daftar besar tersebut membuat pemilih model membingungkan.
 */
export const PRO_MODEL_GROUPS: OllamaModelGroup[] = [
  {
    id: "documents",
    label: "Baca gambar & dokumen",
    description: "Untuk memahami foto, hasil scan, diagram, dan materi dokumen.",
    models: [
      { id: "gemma4:31b-cloud", label: "Gemma 4 31B", description: "Vision, OCR, dan pemahaman materi" },
      { id: "deepseek-v4.1-flash:cloud", label: "DeepSeek V4.1 Flash", description: "Analisis gambar dan teks panjang" },
      { id: "glm-5.3-flash:cloud", label: "GLM 5.3 Flash", description: "Multimodal untuk gambar dan dokumen" },
    ],
  },
  {
    id: "exam",
    label: "Membuat soal & ulangan",
    description: "Dipilih untuk menyusun pertanyaan, kunci, pembahasan, dan variasi tingkat kesulitan.",
    models: [
      { id: "kimi-k2.6:cloud", label: "Kimi K2.6", description: "Penyusunan soal multi-langkah" },
      { id: "beam:cloud", label: "Beam", description: "Penalaran dan pembuatan soal" },
      { id: "minimax-m3:cloud", label: "MiniMax M3", description: "Pembuatan konten dan penalaran" },
      { id: "glm-5.3:cloud", label: "GLM 5.3", description: "Penalaran dan struktur soal" },
    ],
  },
  {
    id: "chat",
    label: "Tanya jawab umum",
    description: "Untuk diskusi materi dan bantuan penggunaan Ulanganku.",
    models: [
      { id: "kimi-k3:cloud", label: "Kimi K3", description: "Tanya jawab dan penalaran multimodal" },
      { id: "mistral-large-4:cloud", label: "Mistral Large 4", description: "Tanya jawab dan penjelasan mendalam" },
      { id: "minimax-m3.1-flash:cloud", label: "MiniMax M3.1 Flash", description: "Tanya jawab cepat" },
    ],
  },
];

export const PRO_OLLAMA_MODELS = PRO_MODEL_GROUPS.flatMap((group) => group.models.map((model) => model.id));
export const DOCUMENT_READER_MODELS = PRO_MODEL_GROUPS.find((group) => group.id === "documents")!.models.map((model) => model.id);
export const EXAM_GENERATION_MODELS = PRO_MODEL_GROUPS.find((group) => group.id === "exam")!.models.map((model) => model.id);

export function ollamaApiKey(): string {
  return process.env.OLLAMA_API_KEY?.trim() || "";
}

let catalogCache: { models: string[]; groups: OllamaModelGroup[]; expiresAt: number; source: "curated" } | null = null;

/** Katalog tetap ringkas: 3 pembaca dokumen, 4 pembuat soal, dan 3 model tanya jawab. */
export async function availableOllamaModels(_forceRefresh = false): Promise<{ models: string[]; groups: OllamaModelGroup[]; defaultModel: string; source: "curated" }> {
  if (!catalogCache || catalogCache.expiresAt <= Date.now()) {
    catalogCache = {
      models: [...PRO_OLLAMA_MODELS],
      groups: PRO_MODEL_GROUPS.map((group) => ({ ...group, models: group.models.map((model) => ({ ...model })) })),
      expiresAt: Date.now() + 5 * 60_000,
      source: "curated",
    };
  }
  return {
    models: [...catalogCache.models],
    groups: catalogCache.groups.map((group) => ({ ...group, models: group.models.map((model) => ({ ...model })) })),
    defaultModel: PRO_OLLAMA_MODELS.includes(OLLAMA_MODEL) ? OLLAMA_MODEL : "gemma4:31b-cloud",
    source: catalogCache.source,
  };
}

/** Ekstrak isi pembelajaran dari gambar melalui model vision bawaan. */
export async function ollamaVisionText(
  system: string,
  input: string,
  images: string[],
  maxTokens: number,
  model = "gemma4:31b-cloud",
): Promise<string> {
  const apiKey = ollamaApiKey();
  if (!apiKey) throw new HttpError(503, "AI belum dikonfigurasi. Tambahkan OLLAMA_API_KEY di Environment Variables Vercel.");
  if (!images.length) return "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 21_000);
  try {
    const upstream = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        think: false,
        messages: [
          { role: "system", content: system },
          { role: "user", content: input, images },
        ],
        options: { num_predict: maxTokens },
      }),
      signal: controller.signal,
    });
    const result = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const detail = readOllamaError(result).toLowerCase();
      if (upstream.status === 401) throw new HttpError(502, "API key Ollama tidak valid. Periksa OLLAMA_API_KEY di Vercel.");
      if (upstream.status === 404) throw new HttpError(502, `Model vision ${model} tidak tersedia. Periksa konfigurasi model Gemma 4 31B.`);
      if (upstream.status === 429 || /quota|rate.?limit/.test(detail)) throw new HttpError(502, "Kuota Ollama Cloud tercapai saat membaca gambar. Coba lagi nanti atau gunakan PDF yang memiliki teks.");
      throw new HttpError(502, `Ollama Cloud gagal membaca gambar (HTTP ${upstream.status}).`);
    }
    const answer = readOllamaText(result);
    if (!answer) throw new HttpError(502, "AI tidak menemukan isi yang bisa dibaca dari gambar. Coba gunakan gambar yang lebih jelas.");
    return answer.slice(0, 12_000);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (controller.signal.aborted) throw new HttpError(504, "AI kehabisan waktu saat membaca gambar. Coba kirim satu gambar dengan resolusi lebih kecil.");
    console.error("Ollama vision request failed:", error);
    throw new HttpError(502, "Tidak dapat membaca gambar melalui Ollama Cloud. Coba lagi.");
  } finally {
    clearTimeout(timer);
  }
}

export async function validateOllamaModel(model: string): Promise<string> {
  const raw = model.trim();
  if (!/^[a-zA-Z0-9._:/-]{1,120}$/.test(raw)) throw new HttpError(400, "Nama model tidak valid.");
  const value = raw === "gemma4:31b" ? "gemma4:31b-cloud" : raw;
  if (!PRO_OLLAMA_MODELS.includes(value)) throw new HttpError(400, "Model tidak ada dalam daftar pilihan Ulanganku. Pilih salah satu dari 10 model yang tersedia.");
  return value;
}

/** Ambil teks jawaban dari respons /api/chat (message.content). */
export function readOllamaText(result: any): string {
  const content = result?.message?.content;
  return typeof content === "string" ? content.trim() : "";
}

/** Ambil pesan error dari Ollama (bisa berupa string atau objek { message }). */
export function readOllamaError(result: any): string {
  const error = result?.error;
  const message = typeof error === "string" ? error : typeof error?.message === "string" ? error.message : "";
  return message.slice(0, 240);
}

/** Panggil Ollama Cloud (/api/chat) dan kembalikan teks jawabannya. Opsi json=true meminta keluaran JSON. */
export async function ollamaText(
  system: string,
  input: string,
  maxTokens: number,
  opts: { json?: boolean; model?: string; timeoutMs?: number } = {},
): Promise<string> {
  const apiKey = ollamaApiKey();
  if (!apiKey) throw new HttpError(503, "AI belum dikonfigurasi. Tambahkan OLLAMA_API_KEY di Environment Variables Vercel.");
  const model = opts.model || OLLAMA_MODEL;

  const controller = new AbortController();
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? Math.min(27_000, Math.max(5_000, Number(opts.timeoutMs))) : 27_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const upstream = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        think: false,
        messages: [
          { role: "system", content: system },
          { role: "user", content: input },
        ],
        options: { num_predict: maxTokens },
        ...(opts.json ? { format: "json" } : {}),
      }),
      signal: controller.signal,
    });
    const result = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      console.error("Ollama error:", { status: upstream.status, model, message: readOllamaError(result) });
      if (upstream.status === 401) throw new HttpError(502, "API key Ollama tidak valid. Periksa OLLAMA_API_KEY di Vercel.");
      if (upstream.status === 404) throw new HttpError(502, `Model Ollama tidak ditemukan: ${model}. Periksa daftar model yang tersedia.`);
      if (upstream.status === 429) throw new HttpError(502, "Kuota atau batas permintaan Ollama Cloud tercapai. Coba lagi nanti.");
      throw new HttpError(502, `Ollama Cloud menolak permintaan (HTTP ${upstream.status}). Periksa model dan konfigurasi API key.`);
    }
    const answer = readOllamaText(result);
    if (!answer) throw new HttpError(502, "Ollama tidak mengembalikan teks jawaban. Coba lagi.");
    return answer;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (controller.signal.aborted) throw new HttpError(504, "AI memerlukan waktu terlalu lama. Batch terakhir belum tersimpan. Tekan Lanjutkan pembuatan untuk mencoba lagi dengan 1 soal per batch.");
    console.error("Ollama API request failed:", error);
    throw new HttpError(502, "Tidak dapat menghubungi Ollama Cloud. Periksa konfigurasi lalu coba lagi.");
  } finally {
    clearTimeout(timer);
  }
}

/** Extract a JSON object from providers that occasionally wrap valid JSON in fences or text. */
export function extractJson(text: string): any {
  const value = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try { return JSON.parse(value); } catch { /* try to isolate the first balanced object */ }
  const start = value.indexOf("{");
  if (start < 0) throw new HttpError(502, "AI tidak mengembalikan objek JSON yang valid.");
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const char = value[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try { return JSON.parse(value.slice(start, index + 1)); }
        catch { break; }
      }
    }
  }
  throw new HttpError(502, "JSON dari AI tidak lengkap atau tidak valid. Coba ulangi batch.");
}
