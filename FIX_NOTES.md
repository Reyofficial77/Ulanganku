# Catatan Perbaikan Ulanganku

Perubahan pada paket ini dibuat berdasarkan ZIP `Ulanganku_website_builder_backend(1).zip`.

## 1. Logout admin
- Endpoint logout tidak lagi ditolak oleh pemeriksaan same-origin ketika host/domain yang diteruskan oleh reverse proxy berbeda.
- Cookie sesi dihapus menggunakan `Max-Age=0` dan `Expires` di masa lalu.
- Dashboard tidak mengalihkan pengguna seolah logout berhasil jika API gagal; pesan error ditampilkan agar bisa dicoba lagi.

## 2. Pengerjaan ulang ujian
- Percobaan baru dibuat dengan satu statement database dan pemeriksaan nomor percobaan terakhir.
- Permintaan ganda atau bersamaan tidak seharusnya membuat duplikat percobaan.
- Migrasi skema versi 5 memindahkan nomor percobaan dari kolom legacy `attempt_no` bila ada, lalu menghapus indeks legacy `submissions_exam_device_attempt_idx` yang bisa bertabrakan dengan kolom `attempt` yang saat ini dipakai.
- Data submission yang ada tidak dihapus.

## Penerapan
1. Unggah/commit seluruh isi ZIP ini ke repositori yang terhubung ke Vercel.
2. Deploy ulang. API akan menjalankan migrasi skema otomatis ketika menerima request database berikutnya.
3. Uji login/logout admin dan coba kerjakan ulang dari halaman hasil murid.

## Catatan verifikasi
Pemeriksaan sintaks TypeScript/TSX dilakukan. Build penuh belum dapat dijalankan di lingkungan pembuat ZIP ini karena dependensi tidak tersedia dan akses registry paket tidak berhasil.
