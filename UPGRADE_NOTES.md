# Ulanganku — catatan upgrade

## Perubahan utama

- Chatbot memiliki pemilih model PRO yang ringkas di area komposer. Daftar katalog menggabungkan model dari Ollama Cloud dengan pilihan PRO bawaan: Beam, Kimi K2.6, MiniMax M2.7, GLM 5.1, dan Nemotron 3 Super.
- ID model Cloud yang digunakan: `beam:cloud`, `kimi-k2.6:cloud`, `minimax-m2.7:cloud`, `glm-5.1:cloud`, dan `nemotron-3-super:cloud`. Jika katalog tidak tersedia, kelima pilihan PRO tetap muncul sebagai fallback.
- Chatbot landing tidak menampilkan pemilih model dan backend mematok chat publik ke `gemma4:31b`; pemilih model hanya ditampilkan untuk pengguna PRO di dashboard.
- Sapaan chatbot landing dibedakan dari sapaan dashboard. Komposer dipadatkan, textarea mengecil saat kosong, dan tombol kirim dijaga berukuran tetap agar tidak memanjang mengikuti input.
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
- Pemeriksaan setelah perubahan chatbot/model: transpile/sintaks 43 file TypeScript/TSX lulus; pemeriksaan statis lima ID model, konteks landing/dashboard, default Gemma publik, dan ukuran tombol lulus.
- Build penuh dan pemeriksaan tipe belum dapat diverifikasi: `npm ci` mengalami timeout dan `tsc --noEmit` terblokir karena `@types/node` tidak tersedia. Jalankan `pnpm install` lalu `pnpm build` setelah mengunduh sebelum deploy.

## Authentication route consolidation

Google OAuth entry and callback are handled by `api/index.ts` through the `/api/:path*` rewrite. Legacy standalone handlers under `api/auth/google.ts`, `api/auth/callback.ts`, and `api/auth/me.ts` were removed because they used the obsolete `_session` cookie implementation and shadowed the current router. Keep the Google OAuth authorized redirect URI set to `https://<your-domain>/api/auth/google/callback`. The dedicated `api/auth/logout.ts` remains in place for the standalone logout path.
