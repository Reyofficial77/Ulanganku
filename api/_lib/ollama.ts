import { HttpError } from "./http.js";

/** Endpoint Ollama Cloud (API langsung, autentikasi memakai Bearer API key). */
export const OLLAMA_URL = "https://ollama.com/api/chat";
/** Model default dapat diganti melalui Environment Variables. */
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL?.trim() || "gemma4:31b";
/** Fixed PRO model choices; IDs use Ollama Cloud's canonical model identifiers. */
export const PRO_OLLAMA_MODELS = [
  "beam:cloud",
  "kimi-k2.6:cloud",
  "minimax-m2.7:cloud",
  "glm-5.1:cloud",
  "nemotron-3-super:cloud",
] as const;

export function ollamaApiKey(): string {
  return process.env.OLLAMA_API_KEY?.trim() || "";
}

export function configuredOllamaModels(): string[] {
  const configured = (process.env.OLLAMA_MODELS ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter((model) => /^[a-zA-Z0-9._:/-]{1,120}$/.test(model));
  return [...new Set([OLLAMA_MODEL, ...configured])];
}

let catalogCache: { models: string[]; expiresAt: number; source: "api" | "environment" } | null = null;

/** Mengambil model melalui endpoint Ollama; environment fallback hanya dipakai bila katalog API tak tersedia/kosong. */
export async function availableOllamaModels(forceRefresh = false): Promise<{ models: string[]; source: "api" | "environment" }> {
  if (!forceRefresh && catalogCache && catalogCache.expiresAt > Date.now()) {
    return { models: [...catalogCache.models], source: catalogCache.source };
  }
  const apiKey = ollamaApiKey();
  if (apiKey) {
    try {
      const response = await fetch("https://ollama.com/api/tags", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8000),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && Array.isArray(data?.models)) {
        const listed = data.models
          .map((item: any) => String(item?.name ?? item?.model ?? "").trim())
          .filter((model: string) => /^[a-zA-Z0-9._:/-]{1,120}$/.test(model));
        if (listed.length) {
          // Preserve the curated PRO choices even when /api/tags omits cloud model aliases.
          const models = [...new Set([...PRO_OLLAMA_MODELS, ...listed])].sort((a, b) => a.localeCompare(b));
          catalogCache = { models, expiresAt: Date.now() + 5 * 60_000, source: "api" };
          return { models: [...models], source: "api" };
        }
      }
    } catch (error) {
      console.warn("Ollama model catalog unavailable; using OLLAMA_MODELS fallback.", error instanceof Error ? error.name : "error");
    }
  }
  const models = [...new Set([...PRO_OLLAMA_MODELS, ...configuredOllamaModels()])].sort((a, b) => a.localeCompare(b));
  catalogCache = { models, expiresAt: Date.now() + 60_000, source: "environment" };
  return { models: [...models], source: "environment" };
}

export async function validateOllamaModel(model: string): Promise<string> {
  const value = model.trim();
  if (!/^[a-zA-Z0-9._:/-]{1,120}$/.test(value)) throw new HttpError(400, "Nama model tidak valid.");
  const { models } = await availableOllamaModels();
  if (!models.includes(value)) throw new HttpError(400, "Model tidak ada dalam daftar yang tersedia. Muat ulang daftar model dan pilih model yang tersedia.");
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
  opts: { json?: boolean; model?: string } = {},
): Promise<string> {
  const apiKey = ollamaApiKey();
  if (!apiKey) throw new HttpError(503, "AI belum dikonfigurasi. Tambahkan OLLAMA_API_KEY di Environment Variables Vercel.");
  const model = opts.model || OLLAMA_MODEL;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 27_000);
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
    if (controller.signal.aborted) throw new HttpError(504, "Permintaan AI kehabisan waktu. Coba lagi dengan batch lebih kecil.");
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
