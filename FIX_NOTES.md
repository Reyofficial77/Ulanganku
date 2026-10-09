# Catatan Perbaikan Ulanganku

## Logout admin
- Endpoint POST untuk logout ditangani sebelum middleware umum agar penghapusan cookie tidak tergantung pada JWT, `SESSION_SECRET`, atau database.
- Cookie sesi dan state OAuth dihapus dengan `Path=/`, `HttpOnly`, `SameSite=Lax`, dan atribut `Secure` yang mengikuti protokol deployment.
- Frontend tidak lagi menutupi error API logout dengan redirect; jika gagal, pesan ditampilkan di dashboard.
- Pemeriksaan origin umum dinormalisasi untuk menangani host proxy yang dipisahkan koma.

## Chatbot Ulanganku
- Tombol Bantuan AI ada di landing page dan dashboard.
- Backend `POST /api/chat` memanggil OpenRouter dengan model `meta-llama/llama-3.1-8b-instruct`.
- Kunci dibaca dari environment server `OPENROUTER_API_KEY`; tidak dimasukkan ke JavaScript browser.
- Input dan riwayat percakapan dibatasi, permintaan per IP dibatasi secara sederhana per instance, dan permintaan upstream memiliki timeout.

## Wajib sebelum deploy
1. Buka Vercel > Project Settings > Environment Variables.
2. Tambahkan `OPENROUTER_API_KEY` dengan API key dari https://openrouter.ai/keys.
3. Pastikan key tersedia di environment yang dipakai (Production, Preview, dan/atau Development), lalu redeploy.
4. Jangan menaruh API key di variabel `VITE_*` atau di kode frontend.

Build penuh belum dijalankan di lingkungan ini karena dependensi paket proyek tidak terpasang.
