# Catatan Perbaikan Ulanganku

## Logout admin (revisi terbaru)
- Logout sekarang menggunakan endpoint mandiri `api/auth/logout.ts` supaya tidak mengimpor handler utama, JWT, atau database.
- Endpoint hanya menerima `POST`, menghapus cookie sesi dan OAuth, dan mengembalikan respons JSON tanpa bergantung pada `SESSION_SECRET` atau database.
- Cookie kedaluwarsa menggunakan `Path=/`, `HttpOnly`, `SameSite=Lax`, `Max-Age=0`, `Expires`, dan `Secure` di deployment HTTPS.
- Jalur umum di `api/index.ts` tetap memiliki fallback logout untuk kompatibilitas.

## Chatbot Ulanganku
- Tombol Bantuan AI tersedia di landing page dan dashboard.
- Backend memanggil OpenRouter melalui endpoint Chat Completions dengan model `meta-llama/llama-3.1-8b-instruct`.
- API key hanya dibaca dari environment server `OPENROUTER_API_KEY`, bukan dari browser.
- Header OpenRouter menggunakan `HTTP-Referer` dan `X-Title`.
- Error upstream dipetakan menjadi pesan yang bisa ditindaklanjuti (API key ditolak, kredit habis, izin, model, rate limit, atau gangguan provider) dan detail teknis dicatat di log fungsi Vercel tanpa mencetak API key.
- Input chatbot punya tinggi awal konsisten, ukuran mengikuti teks hingga batas tertentu, dan tombol kirim sejajar.
- Panjang input/riwayat, jumlah permintaan per IP, dan waktu tunggu upstream dibatasi.

## Environment dan deployment
1. Buka Vercel > Project Settings > Environment Variables.
2. Pastikan `OPENROUTER_API_KEY` berisi API key dari https://openrouter.ai/keys dan aktif untuk environment yang sedang digunakan.
3. Setelah mengubah environment variable, lakukan redeploy.
4. Jika chatbot masih gagal, pesan di jendela chatbot sekarang akan menjelaskan jenis error OpenRouter. Untuk HTTP 402 periksa Credits/Billing; HTTP 401 periksa key; HTTP 403 periksa akses akun/model. Jangan membagikan API key dalam screenshot atau log.
5. Jangan menaruh API key di variabel `VITE_*` atau meng-commit `.env`.

Pemeriksaan sintaks TypeScript/TSX dilakukan pada seluruh file yang dapat ditranspilasi. Build produksi penuh belum dijalankan karena dependensi proyek tidak terpasang di lingkungan kerja ini.
