import { HttpError } from "./http";

const MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite";

/** Panggil Gemini (Interactions API, sama seperti chatbot) dan kembalikan teks jawabannya. */
export async function geminiText(system: string, input: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new HttpError(503, "AI belum dikonfigurasi. Tambahkan GEMINI_API_KEY di Environment Variables Vercel.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 27_000);
  try {
    const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        system_instruction: system,
        input,
        store: false,
        generation_config: { max_output_tokens: maxTokens },
      }),
      signal: controller.signal,
    });
    const result = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      console.error("Gemini error:", { status: upstream.status, message: String(result?.error?.message ?? "").slice(0, 200) });
      if (upstream.status === 429) throw new HttpError(502, "Kuota Gemini tercapai. Coba lagi beberapa saat.");
      throw new HttpError(502, `Gemini mengembalikan HTTP ${upstream.status}. Periksa GEMINI_API_KEY dan log Vercel.`);
    }
    const blocks = Array.isArray(result?.steps)
      ? result.steps.filter((s: any) => s?.type === "model_output" && Array.isArray(s.content)).flatMap((s: any) => s.content)
      : Array.isArray(result?.outputs)
        ? result.outputs
        : Array.isArray(result?.output)
          ? result.output
          : [];
    const fromBlocks = blocks
      .filter((b: any) => b?.type === "text" && typeof b.text === "string")
      .map((b: any) => b.text)
      .join("\n")
      .trim();
    const text = (typeof result?.output_text === "string" ? result.output_text : fromBlocks).trim();
    if (!text) throw new HttpError(502, "Gemini tidak mengembalikan jawaban. Coba lagi.");
    return text;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (controller.signal.aborted) {
      console.error("Gemini request timed out:", { model: MODEL, maxTokens, timeoutMs: 27_000 });
      throw new HttpError(504, "AI belum merespons dalam 27 detik. Coba buat 5–10 soal per permintaan atau coba lagi sebentar.");
    }
    console.error("Gemini request failed:", error);
    throw new HttpError(502, "Tidak dapat menghubungi Gemini API.");
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
