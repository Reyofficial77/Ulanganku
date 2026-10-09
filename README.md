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
| `/{namaUlangan}` | Halaman murid (tanpa login) |

URL ulangan selalu memakai origin yang sedang dibuka (`window.location.origin`), jadi otomatis `https://ulanganku.vercel.app/{namaUlangan}` di produksi.

## Setup

1. **Database**: di Vercel buka Storage > Create > Neon (Postgres). `DATABASE_URL` terisi otomatis.
2. **Google OAuth**: Google Cloud Console > APIs & Services > Credentials > Create OAuth client ID > Web application.
   - Authorized redirect URI: `https://ulanganku.vercel.app/api/auth/google/callback`
   - Untuk lokal tambahkan `http://localhost:3000/api/auth/google/callback`
3. **Environment variables** di Vercel (lihat `.env.example`): `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET` (`openssl rand -hex 32`).
4. Deploy. Lokal: `pnpm install && vercel dev` (butuh Vercel CLI agar `/api` berjalan; `pnpm dev` saja hanya frontend).

Catatan: URL preview Vercel (`*-git-*.vercel.app`) harus didaftarkan satu per satu di Google bila ingin login di sana.

## Tipe soal

Dipilih per soal di editor (dashboard):

| Tipe | Penilaian |
| --- | --- |
| Pilihan ganda, Benar/Salah | Otomatis |
| Jawaban singkat | Otomatis (tidak peka huruf besar/kecil, angka `7,5` = `7.5`, bisa beberapa jawaban benar) |
| Uraian | Manual oleh guru (Hasil > klik nama murid > beri nilai) |
| Soal cerita, Soal cerita + gambar, Soal bergambar | Pilih bentuk jawabannya: pilihan ganda, benar/salah, singkat, atau uraian |

Setiap soal punya bobot (1–100). Gambar diunggah ke tabel `images` dan dilayani lewat `/api/img/:id`.

## Mengerjakan berkali-kali

Di pengaturan ulangan: aktifkan "Izinkan mengerjakan berkali-kali" dan (opsional) batas jumlah percobaan. Tiap percobaan tercatat terpisah; statistik memakai nilai terbaik per perangkat.
