/**
 * Helper upload bersama. Semua fitur upload (gambar soal, banner, logo PRO, lampiran chat AI)
 * WAJIB memanggil `uploadName()` / `renameForUpload()` sebelum file dikirim ke server, sehingga
 * nama asli file dari perangkat pengguna tidak ikut terkirim.
 *
 * Format nama: Ulanganku_UserFile_01.jpg, Ulanganku_UserFile_02.pdf, ...
 */

const SEQ_KEY = "ulanganku_upload_seq";
export const UPLOAD_NAME_PATTERN = /^Ulanganku_UserFile_\d{2,}\.[a-z0-9]{1,5}$/;

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/csv": "csv",
  "application/json": "json",
};

let memorySeq = 0;

function nextSequence(): number {
  try {
    const current = Number.parseInt(localStorage.getItem(SEQ_KEY) ?? "0", 10);
    const next = (Number.isFinite(current) && current > 0 ? current : 0) + 1;
    localStorage.setItem(SEQ_KEY, String(next));
    return next;
  } catch {
    // localStorage bisa dinonaktifkan; pakai penghitung di memori.
    memorySeq += 1;
    return memorySeq;
  }
}

/** Ekstensi file berdasarkan MIME, dengan cadangan dari nama asli. */
export function extensionFor(mime: string, originalName = ""): string {
  const fromMime = MIME_EXT[mime.toLowerCase()];
  if (fromMime) return fromMime;
  const match = /\.([a-z0-9]{1,5})$/i.exec(originalName.trim());
  return match ? match[1].toLowerCase() : "bin";
}

/** Nama baru berurutan, contoh: Ulanganku_UserFile_01.jpg */
export function uploadName(mime: string, originalName = ""): string {
  const seq = String(nextSequence()).padStart(2, "0");
  return `Ulanganku_UserFile_${seq}.${extensionFor(mime, originalName)}`;
}

/** Buat salinan File dengan nama baru (isi file tidak berubah). */
export function renameForUpload(file: File): File {
  return new File([file], uploadName(file.type, file.name), { type: file.type, lastModified: file.lastModified });
}

/** Baca File sebagai base64 murni (tanpa prefix data:). */
export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("File tidak bisa dibaca."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}
