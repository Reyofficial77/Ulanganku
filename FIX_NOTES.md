# Catatan Perbaikan Ulanganku

## Error 500 saat login Google (ERR_MODULE_NOT_FOUND '/var/task/api/_session')
- Log: `Cannot find module '/var/task/api/_session' imported from /var/task/api/auth/google.js`.
- Penyebab: file lama `api/auth/google.ts` (dan kemungkinan `api/auth/callback.ts`, `api/auth/me.ts`) masih ada di repo GitHub/Vercel. Menimpa repo dengan isi zip TIDAK menghapus file yang sudah tidak ada di zip. File lama itu mengimpor `./_session` tanpa `.js`, dan karena `package.json` memakai `"type": "module"`, Node ESM menolaknya, sehingga fungsi crash (500). File di `api/` juga diprioritaskan sebelum `rewrites`, jadi router baru `api/index.ts` tidak pernah dipakai untuk `/api/auth/google`.
- Perbaikan: hapus file lama di repo (lihat langkah di bawah). `api/_session.ts` dan `api/_db.ts` yang tersisa di zip sebelumnya juga sudah dihapus (tidak dipakai siapa pun, `_db.ts` bahkan mengimpor `@vercel/postgres` yang tidak ada di dependencies).
- Langkah wajib di GitHub: hapus `api/auth/google.ts`, `api/auth/callback.ts`, `api/auth/me.ts`, `api/_session.ts`, `api/_db.ts` jika ada, lalu redeploy.
- Redirect URI dibuat otomatis dari domain request (`https://<domain>/api/auth/google/callback`), bukan dari env Vercel. Daftarkan semua domain yang dipakai di Google Cloud Console > Authorized redirect URIs.

## Login Google berpindah domain (myulangan.my.id -> ulanganku.vercel.app)
- Penyebab: file lama `api/auth/google.ts` dan `api/auth/callback.ts` (plus `_session.ts`, `_db.ts`, `me.ts`) masih ada. Di Vercel, file fungsi di folder `api/` diprioritaskan sebelum `rewrites`, sehingga `/api/auth/google` memakai handler lama yang membaca `APP_URL` (https://ulanganku.vercel.app) sebagai redirect_uri. Hasilnya login selalu kembali ke domain vercel.app.
- Perbaikan: file lama dihapus. Semua `/api/auth/*` sekarang ditangani `api/index.ts`, yang memakai domain dari request (`x-forwarded-host`), jadi login tetap di domain tempat pengguna memulai.
- Wajib setelah deploy: daftarkan `https://www.myulangan.my.id/api/auth/google/callback` di Google Cloud Console (Authorized redirect URIs) dan hapus env `APP_URL` di Vercel (tidak dipakai lagi).

## Logout admin (revisi terbaru)
- Logout sekarang menggunakan endpoint mandiri `api/auth/logout.ts` supaya tidak mengimpor handler utama, JWT, atau database.
- Endpoint hanya menerima `POST`, menghapus cookie sesi dan OAuth, dan mengembalikan respons JSON tanpa bergantung pada `SESSION_SECRET` atau database.
- Cookie kedaluwarsa menggunakan `Path=/`, `HttpOnly`, `SameSite=Lax`, `Max-Age=0`, `Expires`, dan `Secure` di deployment HTTPS.
- Jalur umum di `api/index.ts` tetap memiliki fallback logout untuk kompatibilitas.

## Chatbot Ulanganku
- Tombol Bantuan AI tersedia di landing page dan dashboard.
- Backend memanggil Ollama Cloud (`https://ollama.com/api/chat`) dengan model default `gemma4:31b`. Chatbot dan fitur PRO (buat ulangan dan judul otomatis) memakai provider yang sama.
- API key hanya dibaca dari environment server `OLLAMA_API_KEY`, bukan dari browser.
- Model diatur di `api/_lib/ollama.ts`; variabel `OLLAMA_MODEL` dapat menimpanya tanpa mengubah kode.
- Error upstream dipetakan menjadi pesan yang bisa ditindaklanjuti (API key, kuota, izin, model, rate limit, atau gangguan provider) dan detail teknis dicatat di log fungsi Vercel tanpa mencetak API key.
- Label di widget chat diperbarui menjadi Ollama Cloud · Gemma 4 31B.
- Panjang input/riwayat, jumlah permintaan per IP, dan waktu tunggu upstream dibatasi.

## Environment dan deployment
1. Buat API key Ollama melalui https://ollama.com/settings/keys.
2. Buka Vercel > Project Settings > Environment Variables lalu tambahkan `OLLAMA_API_KEY`. Opsional, tambahkan `OLLAMA_MODEL=gemma4:31b`. Hapus `GEMINI_API_KEY` dan `GEMINI_MODEL` karena tidak dipakai lagi.
3. Setelah mengubah environment variable, lakukan redeploy.
4. Jika chatbot gagal, gunakan pesan yang tampil dan log fungsi Vercel. HTTP 401 biasanya berarti key tidak valid; HTTP 403 akses ditolak; HTTP 429 kuota/batas terlampaui; HTTP 404 model tidak ditemukan. Jangan membagikan API key dalam screenshot atau log.
5. Jangan menaruh API key di variabel `VITE_*` atau meng-commit `.env`.

Pemeriksaan sintaks TypeScript/TSX dilakukan pada seluruh file yang dapat ditranspilasi. Build produksi penuh belum dijalankan karena dependensi proyek tidak terpasang di lingkungan kerja ini.
