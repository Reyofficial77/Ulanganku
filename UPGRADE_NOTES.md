# Ulanganku — catatan upgrade

## Perubahan utama

- Chatbot memiliki pemilih model PRO di area komposer. Daftar model dicoba dari katalog Ollama Cloud; `OLLAMA_MODEL` dan `OLLAMA_MODELS` digunakan sebagai fallback yang dilabeli.
- Generator ulangan mendukung sembilan format jawaban, estimasi durasi, preservasi durasi eksplisit, validasi kunci/struktur, deteksi soal mirip, dan penyimpanan bertahap dalam batch sampai 200 soal.
- Editor menyediakan preview interaktif yang memakai kondisi edit saat ini, tanpa mengirim jawaban atau memublikasikan ulangan.
- Katalog `/template` memuat 24 template bawaan, pencarian/filter, detail slug, dan pengelolaan template guru.
- Template mendukung draf/publikasi, publik/privat, duplikasi, penghapusan, penggunaan untuk membuat ulangan, dan pemeriksaan kepemilikan di server.
- Data kunci jawaban/rubrik pada template privat tidak diberikan kepada pengguna tak berwenang; respons katalog/detail publik tidak mengirim pertanyaan reusable atau kunci jawaban.
- Skema ditambahkan secara backward-compatible oleh migrasi API saat request pertama setelah deploy. `schema.sql` turut diperbarui sebagai dokumentasi/manual setup.

## Environment

Wajib untuk database dan login: `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`. Untuk AI: `OLLAMA_API_KEY`. Opsional: `OLLAMA_MODEL` dan `OLLAMA_MODELS` (daftar dipisahkan koma).

Jangan pernah memasukkan API key ke kode frontend, file template, atau repository.

## Pemeriksaan lokal

- Pemeriksaan transpile/sintaks TypeScript/TSX: 43 file diperiksa, 0 error sintaks.
- Uji logika grading terarah: pilihan ganda, pilihan ganda kompleks, benar/salah, numerik, menjodohkan, dan mengurutkan lulus.
- Uji data template: 24 template, slug unik, dan distribusi soal sesuai jumlah default.
- Uji parsing jumlah soal: 9 pola instruksi berhasil, termasuk `100+ soal`, `100 atau lebih soal`, `at least 100 questions`, dan batas maksimal 200.
- Build penuh dan pemeriksaan tipe belum dapat diverifikasi di lingkungan pembuatan ZIP ini karena instalasi dependensi tidak lengkap (`vite` dan berkas tipe Node tidak tersedia setelah instalasi terputus). Jalankan `pnpm install` lalu `pnpm build` setelah mengunduh sebelum deploy.
