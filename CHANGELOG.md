# Changelog Version 3.3

## Penilaian AI, Generator Lebih Tahan Gagal, dan Pilihan Model

- Jawaban terbuka (jawaban singkat, isian rumpang, numerik, uraian) dinilai otomatis oleh Gemma 4 31B melalui Ollama Cloud. Penilaian berjalan maksimal 3 jawaban per request dan berlanjut otomatis sampai selesai; guru tetap dapat mengoreksi nilai secara opsional.
- Soal objektif (pilihan ganda, pilihan ganda kompleks, benar/salah, menjodohkan, mengurutkan) dinilai otomatis berdasarkan kunci jawaban, sehingga hasilnya konsisten tanpa menunggu model AI.
- Normalisasi jawaban menerima koma/titik desimal, nol di akhir angka, pecahan, persen, dan beberapa variasi jawaban yang dipisahkan garis miring. Contoh `0,3/0,30` diterima untuk kunci `0,3`, `0,30`, atau `3/10`.
- Generator soal menerima variasi struktur JSON dari model, membedakan duplikat dengan lebih ketat, dan mencoba pemulihan otomatis menggunakan Gemma 4 31B bila batch pertama tidak menghasilkan soal valid.
- Pemilih model PRO sekarang berisi 10 pilihan yang dikelompokkan menjadi 3 model pembaca gambar/dokumen, 4 model pembuat soal, dan 3 model tanya-jawab.
- Pemilih model ditempatkan satu baris bersama tombol unggah. Teks keterangan format file di samping tombol unggah dihilangkan, dan scrollbar pesan disembunyikan tanpa menghilangkan kemampuan scroll.

# Changelog Version 3.2

## Bantuan AI, Template Soal, dan Pembuatan Soal dari Materi

- Tombol **Bantuan AI** tetap bisa digeser. Saat dilepas, tombol otomatis menempel di sisi kiri atau kanan terdekat dan posisi tersimpan. Efek docking dibuat halus, tersedia menu untuk menempel ke kiri/kanan, reset posisi, atau sembunyikan.
- Panel chat desktop menyesuaikan ruang kosong di sekitar tombol. Pada layar ponsel, chat tampil sebagai bottom sheet agar tidak menutupi area kerja secara acak.
- Lampiran yang gagal dikirim tetap berada di composer supaya pengguna dapat mencoba lagi tanpa memilih file dari awal.
- AI PRO dapat membuat draf ulangan berdasarkan materi yang dilampirkan di chat: gambar/foto (JPG/PNG/WebP/GIF), PDF, DOCX, TXT, MD, CSV, dan JSON. Maksimal 3 file per pesan, 2 MB per file, 3 MB total.
- Isi PDF/DOCX/teks diekstrak menjadi konteks soal. Gambar dianalisis dengan model vision Gemma 4 31B. PDF hasil scan tanpa teks perlu diunggah sebagai gambar halaman.
- Setiap 24 template bawaan memiliki 10 soal lengkap dengan jawaban dan penjelasan (240 soal total). Migrasi database versi 10 memperbarui template bawaan yang sudah tersimpan tanpa menimpa template buatan pengguna.
- Semua fitur upload mengganti nama file sebelum dikirim ke server; nama file asli dari perangkat tidak ikut dikirim.

Catatan deploy: gunakan Node.js 24 dan jalankan `pnpm install` agar dependensi `unpdf` dan `mammoth` tersedia.

---

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