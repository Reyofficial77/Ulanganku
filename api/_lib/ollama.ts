import { HttpError } from "./http.js";

/** Endpoint Ollama Cloud (API langsung, autentikasi memakai Bearer API key). */
export const OLLAMA_URL = "https://ollama.com/api/chat";
/** Model default. Nama model untuk API langsung tidak memakai akhiran "-cloud". */
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL?.trim() || "gemma4:31b";

export function ollamaApiKey(): string {
  return process.env.OLLAMA_API_KEY?.trim() || "";
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
export async function ollamaText(system: string, input: string, maxTokens: number, opts: { json?: boolean } = {}): Promise<string> {
  const apiKey = ollamaApiKey();
  if (!apiKey) throw new HttpError(503, "AI belum dikonfigurasi. Tambahkan OLLAMA_API_KEY di Environment Variables Vercel.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 27_000);
  try {
    const upstream = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
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
      console.error("Ollama error:", { status: upstream.status, model: OLLAMA_MODEL, message: readOllamaError(result) });
      if (upstream.status === 401) throw new HttpError(502, "API key Ollama tidak valid. Periksa OLLAMA_API_KEY di Vercel.");
      if (upstream.status === 404) throw new HttpError(502, `Model Ollama tidak ditemukan: ${OLLAMA_MODEL}. Periksa OLLAMA_MODEL.`);
      if (upstream.status === 429) throw new HttpError(502, "Kuota Ollama Cloud tercapai. Coba lagi beberapa saat.");
      throw new HttpError(502, `Ollama Cloud mengembalikan HTTP ${upstream.status}. Periksa OLLAMA_API_KEY dan log Vercel.`);
    }
    const text = readOllamaText(result);
    if (!text) throw new HttpError(502, "Ollama tidak mengembalikan jawaban. Coba lagi.");
    return text;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (controller.signal.aborted) {
      console.error("Ollama request timed out:", { model: OLLAMA_MODEL, maxTokens, timeoutMs: 27_000 });
      throw new HttpError(504, "AI belum merespons dalam 27 detik. Coba buat 5–10 soal per permintaan atau coba lagi sebentar.");
    }
    console.error("Ollama request failed:", error);
    throw new HttpError(502, "Tidak dapat menghubungi Ollama Cloud.");
  } finally {
    clearTimeout(timer);
  }
}

/** Ambil objek JSON dari jawaban model (menoleransi pagar ```json dan teks pembuka). */
export function extractJson(text: string): any {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new HttpError(502, "Jawaban AI tidak bisa dibaca. Coba lagi.");
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new HttpError(502, "Jawaban AI tidak bisa dibaca. Coba lagi.");
  }
}
