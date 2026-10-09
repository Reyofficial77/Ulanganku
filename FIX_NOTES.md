# Catatan Perbaikan Ulanganku

## Logout admin (revisi terbaru)
- Logout sekarang menggunakan endpoint mandiri `api/auth/logout.ts` supaya tidak mengimpor handler utama, JWT, atau database.
- Endpoint hanya menerima `POST`, menghapus cookie sesi dan OAuth, dan mengembalikan respons JSON tanpa bergantung pada `SESSION_SECRET` atau database.
- Cookie kedaluwarsa menggunakan `Path=/`, `HttpOnly`, `SameSite=Lax`, `Max-Age=0`, `Expires`, dan `Secure` di deployment HTTPS.
- Jalur umum di `api/index.ts` tetap memiliki fallback logout untuk kompatibilitas.

## Chatbot Ulanganku
- Tombol Bantuan AI tersedia di landing page dan dashboard.
- Backend memanggil Gemini Interactions API dengan model default `gemini-3.8-flash`.
- API key hanya dibaca dari environment server `GEMINI_API_KEY`, bukan dari browser.
- Model diatur melalui konstanta `CHAT_MODEL` pada `api/index.ts`; variabel `GEMINI_MODEL` dapat menimpanya tanpa mengubah kode.
- Error upstream dipetakan menjadi pesan yang bisa ditindaklanjuti (API key, kuota, izin, model, rate limit, atau gangguan provider) dan detail teknis dicatat di log fungsi Vercel tanpa mencetak API key.
- Label di widget chat diperbarui menjadi Google Gemini 3.8 Flash.
- Panjang input/riwayat, jumlah permintaan per IP, dan waktu tunggu upstream dibatasi.

## Environment dan deployment
1. Buat API key Gemini melalui https://aistudio.google.com/apikey.
2. Buka Vercel > Project Settings > Environment Variables lalu tambahkan `GEMINI_API_KEY`. Opsional, tambahkan `GEMINI_MODEL=gemini-3.8-flash`.
3. Setelah mengubah environment variable, lakukan redeploy.
4. Jika chatbot gagal, gunakan pesan yang tampil dan log fungsi Vercel. HTTP 401 biasanya berarti key tidak valid; HTTP 403 akses ditolak; HTTP 429 kuota/batas terlampaui; HTTP 404 model tidak ditemukan. Jangan membagikan API key dalam screenshot atau log.
5. Jangan menaruh API key di variabel `VITE_*` atau meng-commit `.env`.

Pemeriksaan sintaks TypeScript/TSX dilakukan pada seluruh file yang dapat ditranspilasi. Build produksi penuh belum dijalankan karena dependensi proyek tidak terpasang di lingkungan kerja ini.
