import { HttpError } from "./http.js";

/** Hosted Gemini API endpoint backed by Google AI Studio. */
export const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
export const GEMINI_MODEL = (process.env.GEMINI_MODEL?.trim() || "gemini-4-hydrogen").replace(/^models\//, "");
export const AI_GRADER_MODEL = "gemini-5-flash-lite";
export const PRO_GEMINI_MODELS = [
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite", description: "Model ringan dan hemat kuota untuk tugas cepat" },
  { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash", description: "Model cepat untuk percakapan dan penyusunan soal" },
  { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash", description: "Model cepat dan seimbang untuk berbagai tugas" },
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", description: "Model cepat generasi terbaru dengan penalaran lebih baik" },
  { id: "gemini-4-argon", label: "Gemini 4 Argon", description: "Model Gemini 4 untuk penalaran dan pembuatan soal" },
  { id: "gemini-4-hydrogen", label: "Gemini 4 Hydrogen", description: "Model default untuk chat, penalaran, dan penilaian" },
];
export const DOCUMENT_READER_MODELS = Array.from(new Set([GEMINI_MODEL, ...PRO_GEMINI_MODELS.map((model) => model.id)]));

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

let modelCatalogCache: { models: GeminiModelChoice[]; expiresAt: number; source: "curated" } | null = null;
let liveModelsCache: { models: string[]; expiresAt: number } | null = null;

const NON_TEXT_MODEL_RE = /-(tts|image|audio|live)|embedding|aqa|robotics|computer-use|deep-research|imagen|veo/i;

/** Discover live generateContent-capable Gemini models for emergency fallback when configured models fail or 503. */
export async function discoverGeminiModels(): Promise<string[]> {
  if (liveModelsCache && liveModelsCache.expiresAt > Date.now()) return liveModelsCache.models;
  const apiKey = geminiApiKey();
  if (!apiKey) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4_000);
  try {
    const response = await fetch(`${GEMINI_API_BASE_URL}/models?pageSize=200`, {
      headers: { "x-goog-api-key": apiKey },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const payload = await response.json().catch(() => null);
    const entries = Array.isArray(payload?.models) ? payload.models : [];
    const ids = new Set<string>();
    for (const entry of entries) {
      const id = String(entry?.baseModelId || entry?.name || "").replace(/^models\//, "").trim();
      const methods = Array.isArray(entry?.supportedGenerationMethods) ? entry.supportedGenerationMethods : [];
      if (!/^gemini-/i.test(id) || NON_TEXT_MODEL_RE.test(id) || !methods.includes("generateContent")) continue;
      ids.add(id);
    }
    const rank = (id: string) => {
      if (/flash-lite/i.test(id)) return 0;
      if (/flash/i.test(id)) return 1;
      if (/pro/i.test(id)) return 2;
      return 3;
    };
    const sorted = [...ids].sort((a, b) => rank(a) - rank(b) || b.localeCompare(a));
    liveModelsCache = { models: sorted, expiresAt: Date.now() + 10 * 60_000 };
    return sorted;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Katalog model Gemini yang dapat dipilih khusus pengguna PRO. */
export async function availableGeminiModels(forceRefresh = false): Promise<{
  models: string[];
  groups: GeminiModelGroup[];
  defaultModel: string;
  source: "curated";
}> {
  if (forceRefresh || !modelCatalogCache || modelCatalogCache.expiresAt <= Date.now()) {
    modelCatalogCache = {
      models: PRO_GEMINI_MODELS.map((model) => ({ ...model })),
      expiresAt: Date.now() + 5 * 60_000,
      source: "curated",
    };
  }
  return formatCatalog(modelCatalogCache);
}

function formatCatalog(catalog: NonNullable<typeof modelCatalogCache>) {
  const defaultModel = catalog.models.some((model) => model.id === GEMINI_MODEL) ? GEMINI_MODEL : "gemini-4-hydrogen";
  return {
    models: catalog.models.map((model) => model.id),
    groups: [{
      id: "gemini",
      label: "Model Gemini · PRO",
      description: "Daftar model Gemini yang tersedia khusus untuk pengguna PRO.",
      models: catalog.models.map((model) => ({ ...model })),
    }],
    defaultModel,
    source: catalog.source,
  };
}

export async function validateGeminiModel(model: string): Promise<string> {
  const raw = model.trim().replace(/^models\//, "");
  const allowed = new Set([GEMINI_MODEL, ...PRO_GEMINI_MODELS.map((item) => item.id)]);
  if (!allowed.has(raw)) {
    throw new HttpError(400, "Model tidak valid. Pilih salah satu model Gemini PRO yang tersedia.");
  }
  return raw;
}

export function readGeminiText(result: any): string {
  const parts = result?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  const outputParts = parts.filter((part: any) => !part?.thought && typeof part?.text === "string");
  const target = outputParts.length ? outputParts : parts;
  return target.map((part: any) => typeof part?.text === "string" ? part.text : "").join("").trim();
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
  retryOn503 = true,
): Promise<string> {
  const apiKey = requireApiKey();
  const safeTimeout = Number.isFinite(timeoutMs) ? Math.min(27_000, Math.max(4_000, Number(timeoutMs))) : 27_000;
  const maxAttempts = retryOn503 ? 2 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
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
        console.error("Gemini API error:", { status: response.status, model, attempt, message: detail });
        const normalized = detail.toLowerCase();
        if (response.status === 401 || /api key not valid|invalid api key|api_key_invalid|authentication failed/.test(normalized) || (response.status === 403 && /api key|authentication|permission/i.test(detail))) {
          throw new HttpError(502, "Gemini API key tidak valid atau tidak memiliki izin. Periksa GEMINI_API_KEY dari Google AI Studio di Vercel.");
        }
        if (response.status === 404 || /model.*(not found|not supported|does not exist)/.test(normalized)) {
          throw new HttpError(502, `Model Gemini tidak ditemukan atau tidak tersedia pada Gemini API: ${model}. Periksa konfigurasi model.`);
        }
        if (response.status === 429 || /quota|rate.?limit|resource_exhausted/.test(normalized)) {
          throw new HttpError(502, "Kuota atau batas permintaan Gemini API tercapai. Periksa penggunaan dan limit Google AI Studio.");
        }
        if (response.status === 503 && attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 450));
          continue;
        }
        const suffix = detail ? ` (${detail})` : "";
        throw new HttpError(
          response.status === 503 ? 503 : 502,
          `Google AI Studio menolak permintaan [${model}] (HTTP ${response.status})${suffix}. Periksa model, API key, dan konfigurasi Gemini.`,
        );
      }
      const answer = readGeminiText(result);
      if (!answer) {
        const reason = result?.promptFeedback?.blockReason || result?.candidates?.[0]?.finishReason;
        throw new HttpError(502, reason ? `Gemini tidak menghasilkan teks (status: ${String(reason)}). Ubah permintaan lalu coba lagi.` : "Gemini API tidak mengembalikan teks jawaban. Coba lagi.");
      }
      return answer;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (controller.signal.aborted) throw new HttpError(504, `AI [${model}] memerlukan waktu terlalu lama. Coba lagi dengan permintaan atau lampiran yang lebih kecil.`);
      console.error("Gemini API request failed:", error);
      throw new HttpError(502, "Tidak dapat menghubungi Google AI Studio. Periksa koneksi dan konfigurasi Gemini API.");
    } finally {
      clearTimeout(timer);
    }
  }
  throw new HttpError(503, `Google AI Studio menolak permintaan [${model}] (HTTP 503).`);
}

export async function geminiText(
  system: string,
  input: string,
  maxTokens: number,
  opts: { json?: boolean; model?: string; timeoutMs?: number; retryOn503?: boolean } = {},
): Promise<string> {
  const instruction = opts.json ? `${system}\n\nKeluaran harus berupa satu objek JSON valid saja, tanpa markdown atau teks di luar JSON.` : system;
  return geminiGenerateContent(
    opts.model || GEMINI_MODEL,
    [{ role: "user", parts: [{ text: input }] }],
    instruction,
    maxTokens,
    opts.timeoutMs,
    opts.retryOn503 ?? true,
  );
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
