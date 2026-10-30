import { HttpError } from "./http.js";

/**
 * Lampiran chat AI: gambar dikirim ke model sebagai input visual, dokumen diubah menjadi teks.
 * Semua validasi memakai isi file (magic bytes), bukan MIME/nama dari klien.
 */

export const CHAT_MAX_FILES = 3;
export const CHAT_MAX_FILE_BYTES = 2_000_000;
/** Batas Vercel untuk body request adalah 4,5 MB; base64 menambah ~33%. */
export const CHAT_MAX_TOTAL_BYTES = 3_000_000;
export const DOC_TEXT_LIMIT = 12_000;
/** Total teks dokumen (baru + dari giliran sebelumnya) yang boleh masuk ke konteks model. */
export const DOC_CONTEXT_TOTAL_LIMIT = 24_000;

export const UPLOAD_NAME_PATTERN = /^Ulanganku_UserFile_\d{2,}\.[a-z0-9]{1,5}$/;

export type AttachmentKind = "image" | "pdf" | "docx" | "text";
export type ChatDoc = { name: string; text: string; truncated: boolean };
export type ChatImage = { name: string; base64: string };
export type ProcessedAttachments = { images: ChatImage[]; docs: ChatDoc[] };

const TEXT_EXTENSIONS = new Set(["txt", "md", "csv", "json"]);

function detectKind(buffer: Buffer, name: string): AttachmentKind | null {
  if (buffer.length > 12 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image";
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image";
  if (buffer.length > 12 && buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP") return "image";
  if (buffer.length > 5 && buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return /\.docx$/i.test(name) ? "docx" : null;
  }
  const ext = /\.([a-z0-9]{1,5})$/i.exec(name)?.[1]?.toLowerCase() ?? "";
  if (TEXT_EXTENSIONS.has(ext) && !buffer.includes(0)) return "text";
  return null;
}

/** Nama yang sampai ke server harus sudah berformat Ulanganku_UserFile_NN.ext; jika tidak, buat nama pengganti. */
export function safeUploadName(candidate: unknown, fallbackIndex: number, ext: string): string {
  const value = typeof candidate === "string" ? candidate.trim() : "";
  if (UPLOAD_NAME_PATTERN.test(value)) return value;
  return `Ulanganku_UserFile_${String(fallbackIndex).padStart(2, "0")}.${ext}`;
}

function clip(text: string): { text: string; truncated: boolean } {
  const clean = text.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
  if (clean.length <= DOC_TEXT_LIMIT) return { text: clean, truncated: false };
  return { text: clean.slice(0, DOC_TEXT_LIMIT), truncated: true };
}

async function pdfToText(buffer: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  if (pdf.numPages > 40) throw new HttpError(400, "PDF terlalu panjang (maksimal 40 halaman).");
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

async function docxToText(buffer: Buffer): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

/** Validasi dan proses semua lampiran dari pesan pengguna terbaru. */
export async function processAttachments(raw: unknown): Promise<ProcessedAttachments> {
  const result: ProcessedAttachments = { images: [], docs: [] };
  if (raw === undefined || raw === null) return result;
  if (!Array.isArray(raw)) throw new HttpError(400, "Format lampiran tidak valid.");
  if (raw.length > CHAT_MAX_FILES) throw new HttpError(400, `Maksimal ${CHAT_MAX_FILES} lampiran per pesan.`);

  let total = 0;
  for (let index = 0; index < raw.length; index += 1) {
    const item = raw[index] as { name?: unknown; data?: unknown } | null;
    const data = typeof item?.data === "string" ? item.data : "";
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new HttpError(400, "Isi lampiran tidak valid.");
    const buffer = Buffer.from(data, "base64");
    if (buffer.length > CHAT_MAX_FILE_BYTES) throw new HttpError(413, "Ukuran satu lampiran maksimal 2 MB.");
    total += buffer.length;
    if (total > CHAT_MAX_TOTAL_BYTES) throw new HttpError(413, "Total ukuran lampiran maksimal 3 MB per pesan.");

    const claimedName = typeof item?.name === "string" ? item.name : "";
    const kind = detectKind(buffer, claimedName);
    if (!kind) throw new HttpError(400, "Jenis file tidak didukung. Gunakan JPG, PNG, WebP, PDF, DOCX, TXT, MD, CSV, atau JSON.");

    const ext = kind === "image" ? (/\.(png|webp)$/i.exec(claimedName)?.[1]?.toLowerCase() ?? "jpg") : kind === "text" ? (/\.([a-z0-9]{1,5})$/i.exec(claimedName)?.[1]?.toLowerCase() ?? "txt") : kind;
    const name = safeUploadName(claimedName, index + 1, ext);

    if (kind === "image") {
      result.images.push({ name, base64: data });
      continue;
    }
    let text = "";
    try {
      if (kind === "pdf") text = await pdfToText(buffer);
      else if (kind === "docx") text = await docxToText(buffer);
      else text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error("Attachment extraction failed:", { kind, message: error instanceof Error ? error.message : "error" });
      throw new HttpError(400, "Dokumen tidak bisa dibaca. Pastikan file tidak rusak atau dilindungi kata sandi.");
    }
    const clipped = clip(text);
    if (!clipped.text) throw new HttpError(400, "Tidak ada teks yang bisa dibaca dari dokumen ini (mungkin hasil scan). Coba kirim sebagai foto.");
    result.docs.push({ name, ...clipped });
  }
  return result;
}

/** Teks dokumen yang sudah diekstrak pada giliran sebelumnya (dikirim ulang klien sebagai teks biasa). */
export function sanitizePriorDocs(raw: unknown): ChatDoc[] {
  if (!Array.isArray(raw)) return [];
  const docs: ChatDoc[] = [];
  for (const item of raw.slice(0, CHAT_MAX_FILES)) {
    const text = typeof item?.text === "string" ? item.text.slice(0, DOC_TEXT_LIMIT) : "";
    const name = typeof item?.name === "string" && UPLOAD_NAME_PATTERN.test(item.name) ? item.name : "";
    if (text && name) docs.push({ name, text, truncated: false });
  }
  return docs;
}

/** Bungkus teks dokumen sebagai DATA agar isi dokumen tidak diperlakukan sebagai perintah. */
export function formatDocsForPrompt(docs: ChatDoc[]): string {
  let budget = DOC_CONTEXT_TOTAL_LIMIT;
  const blocks: string[] = [];
  for (const doc of docs) {
    if (budget <= 0) break;
    const text = doc.text.slice(0, budget);
    budget -= text.length;
    blocks.push(`<dokumen nama="${doc.name}"${doc.truncated ? " dipotong=\"ya\"" : ""}>\n${text}\n</dokumen>`);
  }
  return blocks.join("\n\n");
}
