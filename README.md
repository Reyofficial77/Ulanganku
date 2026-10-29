# Ulanganku

Platform ulangan online: guru login dengan Google, membuat soal, publish, lalu membagikan tautan `https://domain-kamu/{namaUlangan}` ke murid.

## Struktur

- `src/` — frontend React + Vite (landing `/`, `/login`, `/dashboard/*`, halaman murid `/{namaUlangan}`)
- `api/index.ts` — backend (Vercel Serverless Function) + `api/_lib/*`
- `schema.sql` — skema database (dibuat otomatis saat request pertama)
- `vercel.json` — fallback SPA ke `index.html`

## Route

| URL | Isi |
| --- | --- |
| `/` | Landing page |
| `/login` | Login Google |
| `/dashboard` | Beranda dashboard |
| `/dashboard/ulangan`, `/dashboard/ulangan/:id` | Daftar ulangan, editor |
| `/dashboard/hasil`, `/dashboard/hasil/:id` | Hasil & analitik, detail |
| `/template` | Katalog template publik dan pengelolaan template milik guru |
| `/template/:slug` | Detail template dan aksi untuk menggunakan atau mengelolanya |
| `/{namaUlangan}` | Halaman murid (tanpa login) |

URL ulangan selalu memakai origin yang sedang dibuka (`window.location.origin`), jadi otomatis `https://ulanganku.vercel.app/{namaUlangan}` di produksi.

## Setup

1. **Database**: di Vercel buka Storage > Create > Neon (Postgres). `DATABASE_URL` terisi otomatis.
2. **Google OAuth**: Google Cloud Console > APIs & Services > Credentials > Create OAuth client ID > Web application.
   - Authorized redirect URI (daftarkan semua domain yang dipakai):
     - `https://ulanganku.vercel.app/api/auth/google/callback`
     - `https://www.myulangan.my.id/api/auth/google/callback`
     - (opsional, bila apex dipakai) `https://myulangan.my.id/api/auth/google/callback`
   - Authorized JavaScript origins: `https://ulanganku.vercel.app`, `https://www.myulangan.my.id`
   - Untuk lokal tambahkan `http://localhost:3000/api/auth/google/callback`
3. **Environment variables** di Vercel (lihat `.env.example`): `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET` (`openssl rand -hex 32`), dan `OLLAMA_API_KEY` untuk chatbot. Opsional: `OLLAMA_MODEL` untuk mengganti model default serta `OLLAMA_MODELS` sebagai daftar fallback yang dipisahkan koma jika katalog model tidak dapat dimuat dari API.
4. Buat API key di [Ollama Cloud](https://ollama.com/settings/keys), lalu isi `OLLAMA_API_KEY` di Vercel > Project Settings > Environment Variables untuk Production, Preview, dan/atau Development yang digunakan. Jangan menaruh key di kode frontend atau meng-commit `.env`.
5. Deploy. Lokal: `pnpm install && vercel dev` (butuh Vercel CLI agar `/api` berjalan; `pnpm dev` saja hanya frontend).

Chatbot tampil sebagai tombol **Bantuan AI** di landing page dan dashboard. Backend memakai Ollama Cloud (`https://ollama.com/api/chat`) dengan model default `gemma4:31b`; endpoint publik dibatasi panjang riwayat, jumlah permintaan per IP per instance serverless, dan waktu tunggu. Pesan error membedakan masalah API key, kuota, izin, model, dan gangguan provider. Untuk pengguna PRO, pemilih model pada area input mengambil katalog aktual dari `https://ollama.com/api/tags`; jika API katalog tidak tersedia, aplikasi menggunakan `OLLAMA_MODEL` dan `OLLAMA_MODELS` sebagai fallback yang diberi label. Model pilihan disimpan di browser pengguna, kemudian tetap divalidasi di server. API key hanya dibaca server melalui `OLLAMA_API_KEY`.

Perintah pembuatan ulangan AI mendukung soal pilihan ganda, pilihan ganda kompleks, benar/salah, jawaban singkat, isian rumpang, numerik, menjodohkan, mengurutkan, dan uraian. Permintaan hingga 200 soal diproses dalam batch, divalidasi, diperiksa kemiripannya, dan disimpan secara bertahap agar batch yang berhasil tidak perlu dibuat ulang saat batch berikutnya gagal. Guru tetap perlu memeriksa draf sebelum dipublikasikan. Durasi yang disebut eksplisit oleh guru dipertahankan; jika tidak disebut, aplikasi memberi perkiraan awal yang bisa diedit.

Database membuat/memperbarui skema pada request API pertama setelah deploy dan menambahkan 24 template bawaan. Perubahan skema memakai `schema_meta`; jangan menghapus tabel `schema_meta` di database produksi kecuali memang ingin migrasi dijalankan ulang. Template milik guru dapat disimpan sebagai draf, diatur publik/privat, diterbitkan, diduplikasi, digunakan untuk membuat draf ulangan, dan dihapus oleh pemiliknya. Endpoint server memeriksa kepemilikan/visibilitas; kunci jawaban pada template publik tidak dikirim ke katalog/detail publik.

Logout memakai endpoint terpisah `api/auth/logout.ts`, agar penghapusan cookie tidak bergantung pada database atau verifikasi sesi.

Catatan: URL preview Vercel (`*-git-*.vercel.app`) harus didaftarkan satu per satu di Google bila ingin login di sana.

## Tipe soal

Dipilih per soal di editor (dashboard):

| Tipe | Penilaian |
| --- | --- |
| Pilihan ganda, pilihan ganda kompleks, Benar/Salah | Otomatis |
| Jawaban singkat, isian rumpang, numerik | Otomatis (tidak peka huruf besar/kecil; angka `7,5` = `7.5`; bisa beberapa jawaban benar) |
| Menjodohkan, mengurutkan | Otomatis |
| Uraian | Manual oleh guru (Hasil > klik nama murid > beri nilai), dengan rubrik dan penjelasan opsional |
| Soal cerita, soal cerita + gambar, soal bergambar | Bisa memakai format jawaban yang sesuai dari editor |

Setiap soal punya bobot (1–100). Gambar diunggah ke tabel `images` dan dilayani lewat `/api/img/:id`.

## Mengerjakan berkali-kali

Di pengaturan ulangan: aktifkan "Izinkan mengerjakan berkali-kali" dan (opsional) batas jumlah percobaan. Tiap percobaan tercatat terpisah; statistik memakai nilai terbaik per perangkat.

## Performa

Samakan region Function Vercel dengan region database Neon (Vercel: Settings > Functions > Function Region) agar tiap query cepat. Skema database hanya dimigrasi sekali (ditandai tabel `schema_meta`); selanjutnya cukup 1 query pengecekan per cold start.
