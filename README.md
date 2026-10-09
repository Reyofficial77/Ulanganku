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

## Perbaikan terbaru

- Logout admin: endpoint logout tetap menghapus cookie sesi walau pemeriksaan origin proxy/domain berbeda, cookie diberi `Max-Age=0` dan `Expires`, dan UI menampilkan pesan jika permintaan logout gagal.
- Pengerjaan ulang murid: pembuatan attempt menggunakan `INSERT ... ON CONFLICT DO NOTHING` agar permintaan mulai yang bersamaan tidak menimbulkan error indeks unik `submissions_exam_device_attempt_idx`.
