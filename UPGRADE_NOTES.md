# Ulanganku — catatan upgrade

## Perubahan utama

- Chatbot PRO memiliki pemilih model yang ringkas di sebelah tombol lampiran. Katalog berisi 10 model Ollama Cloud yang dikelompokkan: 3 untuk membaca gambar/dokumen, 4 untuk membuat soal/ulangan, dan 3 untuk tanya-jawab.
- Pemilih model ditampilkan untuk pengguna PRO di chatbot landing maupun dashboard. Pesan publik memakai model default `gemma4:31b-cloud` bila pengguna tidak memilih model.
- Sapaan chatbot landing dibedakan dari sapaan dashboard. Komposer dipadatkan, textarea mengecil saat kosong, dan tombol kirim dijaga berukuran tetap agar tidak memanjang mengikuti input.
- Chatbot bantuan memiliki pemeriksaan batas topik di backend. Pertanyaan di luar penggunaan Ulanganku diarahkan kembali ke fitur platform, sedangkan permintaan pembuatan soal/ulangan diproses langsung dari chat melalui generator draf yang memvalidasi login dan akses PRO.
- Jawaban chatbot merender Markdown dasar secara aman: teks tebal/miring/coret, kode inline dan blok kode, daftar bernomor/berpoin, judul, kutipan, garis pemisah, tabel, serta tautan HTTP(S). Konten dirender sebagai elemen React, bukan HTML mentah.
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
- Pemeriksaan setelah perubahan chatbot/model: transpile/sintaks TypeScript/TSX untuk file yang diubah lulus; pemeriksaan statis lima ID model, konteks landing/dashboard, default Gemma publik, dan ukuran tombol lulus.
- Pemeriksaan chatbot terbaru: transpile sintaks untuk `api/index.ts` dan `Chatbot.tsx` lulus; 10 kasus batas topik/percakapan diuji, termasuk penolakan kode Python, penolakan pertanyaan umum, bantuan login/dashboard, serta follow-up yang masih relevan.
- Build penuh dan pemeriksaan tipe belum dapat diverifikasi: `npm ci` mengalami timeout dan `tsc --noEmit` terblokir karena `@types/node` tidak tersedia. Jalankan `pnpm install` lalu `pnpm build` setelah mengunduh sebelum deploy.

## Authentication route consolidation

Google OAuth entry and callback are handled by `api/index.ts` through the `/api/:path*` rewrite. Legacy standalone handlers under `api/auth/google.ts`, `api/auth/callback.ts`, and `api/auth/me.ts` were removed because they used the obsolete `_session` cookie implementation and shadowed the current router. Keep the Google OAuth authorized redirect URI set to `https://<your-domain>/api/auth/google/callback`. The dedicated `api/auth/logout.ts` remains in place for the standalone logout path.


## Tambahan: AI grading dan composer chat (30 Oktober 2026)
- Model penilai jawaban terbuka dikunci di backend ke `gemma4:31b-cloud` (Gemma 4 31B), terpisah dari model yang dipilih pengguna untuk chatting atau membuat soal.
- Jawaban singkat, isian, numerik, dan uraian dinilai otomatis oleh Gemma 4 31B. Bentuk jawaban matematis yang setara (mis. `0,3`, `0.30`, `3/10`) diterima; daftar alternatif yang dipisahkan slash juga didukung. Penilaian objektif tetap langsung memakai kunci jawaban agar konsisten dan tidak memerlukan panggilan AI yang tidak perlu.
- Output grading bisa berupa daftar maupun map JSON dan menerima skor desimal koma, persentase, serta rasio. Proses berjalan dalam kelompok kecil dan dapat dilanjutkan bila sebagian jawaban masih pending.
- Parser generator dibuat lebih toleran terhadap variasi JSON dan model melakukan satu percobaan pemulihan otomatis menggunakan Gemma 4 31B saat batch pertama gagal divalidasi. Deteksi duplikat tidak lagi menolak pertanyaan hanya karena kemiripan frasa umum.
- Scrollbar panel chatbot disembunyikan tanpa menonaktifkan scrolling. Pemilih model dan tombol upload dipertahankan dalam satu baris tanpa teks helper format file di sebelahnya.
- Katalog model yang dipakai: dokumen (`gemma4:31b-cloud`, `deepseek-v4.1-flash:cloud`, `glm-5.3-flash:cloud`); pembuatan soal (`kimi-k2.6:cloud`, `beam:cloud`, `minimax-m3:cloud`, `glm-5.3:cloud`); tanya-jawab (`kimi-k3:cloud`, `mistral-large-4:cloud`, `minimax-m3.1-flash:cloud`).
