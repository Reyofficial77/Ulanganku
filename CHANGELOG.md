# Changelog Version 3.1

## Bantuan AI

- Tombol **Bantuan AI** dapat digeser ke posisi mana pun; posisinya tersimpan. Jendela AI mengikuti letak tombol dan selalu berada di dalam layar.
- Sembunyikan tombol: klik kanan lalu **Sembunyikan (Hide)**, atau di HP tahan tombol sekitar 2 detik. Tombol muncul lagi di kunjungan berikutnya, atau langsung lewat **Urungkan**.
- Lampiran di chat AI (khusus pengguna yang login): foto (JPG/PNG/WebP/GIF), PDF, DOCX, TXT, MD, CSV, JSON. Maksimal 3 file per pesan, 2 MB per file, 3 MB total.
- Semua fitur upload (gambar soal, banner, logo PRO, lampiran chat) mengganti nama file sebelum dikirim ke server, contoh `Ulanganku_UserFile_01.jpg`. Nama asli dari perangkat tidak ikut terkirim.
- Perbaikan: fungsi `checkChatRateLimit` dipakai oleh /api/chat tetapi belum didefinisikan; sudah ditambahkan.

Catatan deploy: tambah dependensi `unpdf` dan `mammoth` (jalankan `pnpm install`); kolom `images.filename` dibuat otomatis oleh API.

---

# Changelog Version 3.0

**Ulanganku Changelog V 3.0**

## What's New?

Fitur **PRO** sekarang tersedia. Pihak sekolah dapat upgrade lewat tombol **Upgrade ke PRO** di sidebar dashboard, memilih pembayaran DANA atau GoPay, lalu dikonfirmasi admin lewat WhatsApp.

Pengguna PRO mendapatkan:
- Warna aksen khusus di halaman ulangan murid (hanya di `ulanganku.vercel.app/nama-ulangan`).
- Nama sekolah dan logo sekolah menggantikan nama dan ikon Ulanganku.
- Gambar banner landscape di atas halaman ulangan.
- Chatbot yang dapat membuat draf ulangan dari perintah, serta judul ulangan otomatis.

Promo: uji coba PRO gratis 30 hari untuk akun terdaftar, satu kali per perangkat.

---

# Changelog Version 2.0

**Ulanganku Changelog V 2.0**

## What's New?

Kami menambahkan sebuah chatbot berbasis AI yang dapat anda akses di [Landing Page](https://ulanganku.vercel.app) atau [Dashboard](https://ulanganku.vercel.app/dashboard). Chatbot AI sudah di lengkapi dengan model `gemini-3.8-flash`. 

Kami juga menambahkan fitur log out agar guru dapat mengakses akun lain.

**© 2026 Ulanganku. Platform ulangan digital untuk sekolah.**