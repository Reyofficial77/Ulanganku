import { HttpError } from "./http.js";

/** Hosted Gemini API endpoint backed by Google AI Studio. */
export const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
export const GEMINI_MODEL = (process.env.GEMINI_MODEL?.trim() || "gemma-4-31b-it").replace(/^models\//, "");
export const AI_GRADER_MODEL = "gemma-4-31b-it";
export const DEFAULT_GEMMA_MODELS = [
  { id: "gemma-4-31b-it", label: "Gemma 4 31B IT", description: "Model default untuk chat, penalaran, dan penilaian" },
  { id: "gemma-4-26b-a4b-it", label: "Gemma 4 26B A4B IT", description: "Model MoE yang efisien untuk generasi teks dan gambar" },
];
export const DOCUMENT_READER_MODELS = DEFAULT_GEMMA_MODELS.map((model) => model.id);

export type GeminiModelChoice = { id: string; label: string; description: string };
export type GeminiModelGroup = { id: string; label: string; description: string; models: GeminiModelChoice[] };
export type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } };
export type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

export function geminiApiKey(): string {
  return process.env.GEMINI_API_KEY?.trim() || "";
}

function requireApiKey(): string {
  const key = geminiApiKey();
  if (!key) throw new HttpError(503, "AI belum dikonfigurasi. Tambahkan GEMINI_API_KEY dari Google AI Studio ke Environment Variables Vercel.");
  return key;
}

let modelCatalogCache: { models: GeminiModelChoice[]; expiresAt: number; source: "google-ai-studio" | "fallback" } | null = null;

/** Model list diambil dari Google AI Studio dan difilter ke Gemma yang mendukung generateContent. */
export async function availableGemmaModels(forceRefresh = false): Promise<{
  models: string[];
  groups: GeminiModelGroup[];
  defaultModel: string;
  source: "google-ai-studio" | "fallback";
}> {
  if (!forceRefresh && modelCatalogCache && modelCatalogCache.expiresAt > Date.now()) return formatCatalog(modelCatalogCache);

  let choices = DEFAULT_GEMMA_MODELS.map((model) => ({ ...model }));
  let source: "google-ai-studio" | "fallback" = "fallback";
  const apiKey = geminiApiKey();
  if (apiKey) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      let pageToken = "";
      const found = new Map<string, GeminiModelChoice>();
      for (let page = 0; page < 5; page += 1) {
        const params = new URLSearchParams({ pageSize: "1000" });
        if (pageToken) params.set("pageToken", pageToken);
        const response = await fetch(`${GEMINI_API_BASE_URL}/models?${params}`, { headers: { "x-goog-api-key": apiKey }, signal: controller.signal });
        if (!response.ok) break;
        const payload = await response.json().catch(() => null);
        const entries = Array.isArray(payload?.models) ? payload.models : [];
        for (const entry of entries) {
          const id = String(entry?.baseModelId || entry?.name || "").replace(/^models\//, "").trim();
          const methods = Array.isArray(entry?.supportedGenerationMethods) ? entry.supportedGenerationMethods : [];
          if (!/^gemma-[a-z0-9-]+$/i.test(id) || !methods.includes("generateContent")) continue;
          found.set(id, {
            id,
            label: String(entry?.displayName || id).trim().slice(0, 100),
            description: String(entry?.description || "Model Gemma yang tersedia melalui Google AI Studio").trim().slice(0, 180),
          });
        }
        pageToken = typeof payload?.nextPageToken === "string" ? payload.nextPageToken : "";
        if (!pageToken) break;
      }
      if (found.size) {
        choices = [...found.values()].sort((a, b) => a.id === GEMINI_MODEL ? -1 : b.id === GEMINI_MODEL ? 1 : a.label.localeCompare(b.label));
        source = "google-ai-studio";
      }
    } catch (error) {
      console.warn("Gemini model list could not be refreshed; using supported Gemma defaults:", error instanceof Error ? error.message : "unknown error");
    } finally {
      clearTimeout(timer);
    }
  }
  modelCatalogCache = { models: choices, expiresAt: Date.now() + 5 * 60_000, source };
  return formatCatalog(modelCatalogCache);
}

function formatCatalog(catalog: NonNullable<typeof modelCatalogCache>) {
  const defaultModel = catalog.models.some((model) => model.id === GEMINI_MODEL) ? GEMINI_MODEL : DEFAULT_GEMMA_MODELS[0].id;
  return {
    models: catalog.models.map((model) => model.id),
    groups: [{ id: "gemma", label: "Model Gemma · Google AI Studio", description: "Daftar model Gemma yang tersedia untuk Gemini API pada API key proyek ini.", models: catalog.models.map((model) => ({ ...model })) }],
    defaultModel,
    source: catalog.source,
  };
}

export async function validateGemmaModel(model: string, requireListed = false): Promise<string> {
  const raw = model.trim().replace(/^models\//, "");
  if (!/^gemma-[a-z0-9-]{1,110}$/i.test(raw)) throw new HttpError(400, "Model tidak valid. Pilih model dari keluarga Gemma.");
  if (requireListed) {
    const catalog = await availableGemmaModels();
    if (catalog.source === "google-ai-studio" && !catalog.models.includes(raw)) throw new HttpError(400, `Model ${raw} tidak tersedia melalui Google AI Studio untuk API key ini. Muat ulang daftar model dan pilih model Gemma yang tersedia.`);
  }
  return raw;
}

export function readGeminiText(result: any): string {
  const parts = result?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part: any) => typeof part?.text === "string" ? part.text : "").join("").trim();
}

export function readGeminiError(result: any): string {
  const message = result?.error?.message;
  return typeof message === "string" ? message.slice(0, 400) : "";
}

export async function geminiGenerateContent(
  model: string,
  contents: GeminiContent[],
  system: string,
  maxTokens: number,
  timeoutMs = 27_000,
): Promise<string> {
  const apiKey = requireApiKey();
  const controller = new AbortController();
  const safeTimeout = Number.isFinite(timeoutMs) ? Math.min(27_000, Math.max(5_000, Number(timeoutMs))) : 27_000;
  const timer = setTimeout(() => controller.abort(), safeTimeout);
  try {
    const response = await fetch(`${GEMINI_API_BASE_URL}/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { maxOutputTokens: Math.max(64, Math.min(8192, Math.floor(maxTokens))) },
      }),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = readGeminiError(result);
      console.error("Gemini API error:", { status: response.status, model, message: detail });
      const normalized = detail.toLowerCase();
      if (response.status === 401 || /api key not valid|invalid api key|api_key_invalid|authentication failed/.test(normalized) || (response.status === 403 && /api key|authentication|permission/i.test(detail))) {
        throw new HttpError(502, "Gemini API key tidak valid atau tidak memiliki izin. Periksa GEMINI_API_KEY dari Google AI Studio di Vercel.");
      }
      if (response.status === 404 || /model.*(not found|not supported|does not exist)/.test(normalized)) {
        throw new HttpError(502, `Model Gemma tidak ditemukan atau tidak tersedia pada Gemini API: ${model}. Perbarui daftar model dari Google AI Studio.`);
      }
      if (response.status === 429 || /quota|rate.?limit|resource_exhausted/.test(normalized)) {
        throw new HttpError(502, "Kuota atau batas permintaan Gemini API tercapai. Periksa penggunaan dan limit Google AI Studio.");
      }
      throw new HttpError(502, `Google AI Studio menolak permintaan (HTTP ${response.status}). Periksa model, API key, dan konfigurasi Gemini.`);
    }
    const answer = readGeminiText(result);
    if (!answer) {
      const reason = result?.promptFeedback?.blockReason || result?.candidates?.[0]?.finishReason;
      throw new HttpError(502, reason ? `Gemma tidak menghasilkan teks (status: ${String(reason)}). Ubah permintaan lalu coba lagi.` : "Gemini API tidak mengembalikan teks jawaban. Coba lagi.");
    }
    return answer;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (controller.signal.aborted) throw new HttpError(504, "AI memerlukan waktu terlalu lama. Coba lagi dengan permintaan atau lampiran yang lebih kecil.");
    console.error("Gemini API request failed:", error);
    throw new HttpError(502, "Tidak dapat menghubungi Google AI Studio. Periksa koneksi dan konfigurasi Gemini API.");
  } finally {
    clearTimeout(timer);
  }
}

export async function geminiText(system: string, input: string, maxTokens: number, opts: { json?: boolean; model?: string; timeoutMs?: number } = {}): Promise<string> {
  const instruction = opts.json ? `${system}\n\nKeluaran harus berupa satu objek JSON valid saja, tanpa markdown atau teks di luar JSON.` : system;
  return geminiGenerateContent(opts.model || GEMINI_MODEL, [{ role: "user", parts: [{ text: input }] }], instruction, maxTokens, opts.timeoutMs);
}

export async function geminiVisionText(system: string, input: string, images: string[], maxTokens: number, model = AI_GRADER_MODEL): Promise<string> {
  if (!images.length) return "";
  const parts: GeminiPart[] = [{ text: input }, ...images.map((data) => ({ inlineData: { mimeType: "image/jpeg", data } }))];
  return geminiGenerateContent(model, [{ role: "user", parts }], system, maxTokens, 21_000);
}

/** Extract a JSON object from model responses that occasionally include fences or explanatory text. */
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
