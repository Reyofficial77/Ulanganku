# Catatan Perbaikan Ulanganku

## Template soal bawaan (isi pertanyaan dan kunci jawaban)
- Penyebab: seed template bawaan hanya menyimpan konfigurasi jumlah/jenis soal. Kolom `reusable_questions` diisi array kosong, lalu endpoint Gunakan membuat pertanyaan kosong.
- Perbaikan: 24 template bawaan masing-masing memiliki minimal 10 pertanyaan contoh terisi (6 pilihan ganda, 2 benar/salah, 2 jawaban singkat), lengkap dengan kunci jawaban dan penjelasan. Jumlah dan distribusi pada kartu template diselaraskan.
- Endpoint Gunakan menyalin soal contoh dengan ID baru, sehingga kunci jawaban ikut tersimpan di draf ulangan dan tidak berbagi ID dengan data template. Fallback langsung dari katalog seed juga disediakan untuk template bawaan lama.
- Versi skema dinaikkan ke 9. Saat deployment pertama setelah perubahan, migrasi memperbarui data 24 template bawaan yang sudah ada di database tanpa menimpa template buatan pengguna.


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
- Backend memanggil Ollama Cloud (`https://ollama.com/api/chat`) dengan model default `gemma4:31b-cloud`. Chatbot dan fitur PRO (buat ulangan dan judul otomatis) memakai provider yang sama.
- API key hanya dibaca dari environment server `OLLAMA_API_KEY`, bukan dari browser.
- Model diatur di `api/_lib/ollama.ts`; variabel `OLLAMA_MODEL` dapat menimpanya tanpa mengubah kode.
- Error upstream dipetakan menjadi pesan yang bisa ditindaklanjuti (API key, kuota, izin, model, rate limit, atau gangguan provider) dan detail teknis dicatat di log fungsi Vercel tanpa mencetak API key.
- Label di widget chat diperbarui menjadi Ollama Cloud · Gemma 4 31B.
- Panjang input/riwayat, jumlah permintaan per IP, dan waktu tunggu upstream dibatasi.

## Environment dan deployment
1. Buat API key Ollama melalui https://ollama.com/settings/keys.
2. Buka Vercel > Project Settings > Environment Variables lalu tambahkan `OLLAMA_API_KEY`. Opsional, atur `OLLAMA_MODEL=gemma4:31b-cloud`. Jawaban terbuka selalu dinilai oleh Gemma 4 31B (`gemma4:31b-cloud`); model penilai tidak dapat diganti dari pemilih model. Hapus `GEMINI_API_KEY` dan `GEMINI_MODEL` karena tidak dipakai lagi.
3. Setelah mengubah environment variable, lakukan redeploy.
4. Jika chatbot gagal, gunakan pesan yang tampil dan log fungsi Vercel. HTTP 401 biasanya berarti key tidak valid; HTTP 403 akses ditolak; HTTP 429 kuota/batas terlampaui; HTTP 404 model tidak ditemukan. Jangan membagikan API key dalam screenshot atau log.
5. Jangan menaruh API key di variabel `VITE_*` atau meng-commit `.env`.

Pemeriksaan sintaks TypeScript/TSX dilakukan pada seluruh file yang dapat ditranspilasi. Build produksi penuh belum dijalankan karena dependensi proyek tidak terpasang di lingkungan kerja ini.

## Chatbot: permintaan membuat soal langsung dari chat
- Penyebab: instruksi sistem chatbot melarang pembuatan soal langsung dari chat dan mengarahkan pengguna ke menu "Buat Ulangan AI". Selain itu, status PRO hanya dimuat pada konteks dashboard; chatbot landing tidak dapat mengenali pengguna PRO. Jika deteksi permintaan di browser tidak cocok, permintaan juga masuk ke endpoint chat biasa dan dijawab sebagai penolakan.
- Perbaikan: instruksi penolakan dihapus. Permintaan membuat soal/ulangan dari chat kini dikirim langsung ke `/pro/ai/exam` untuk akun yang login dan memiliki PRO, baik dari landing maupun dashboard. Status PRO diperiksa ulang dari server sebelum job dibuat. Pengguna tanpa login diminta masuk; akun tanpa PRO diberi informasi akses tanpa diarahkan ke menu yang tidak tersedia.
- Deteksi perintah diperluas untuk variasi seperti "buatkan 50 soal", "saya butuh 20 soal", "50 soal berdasarkan materi", dan "buatkan soal dari PDF". Pertanyaan cara menggunakan fitur atau pertanyaan kemampuan seperti "bagaimana cara membuat soal" dan "apakah AI bisa membuat soal" tidak otomatis membuat job.
- Batas pemrosesan satu sesi dinaikkan dari 22 menjadi 30 batch. Dengan ukuran normal 2 soal per batch, permintaan 50 soal dapat diproses sampai selesai dalam satu rangkaian; jika provider timeout, tombol Lanjutkan tetap melanjutkan dari jumlah yang sudah tersimpan.
- Endpoint `/chat` memiliki fallback server-side: jika deteksi browser tidak menangkap variasi kalimat, permintaan pembuatan soal tetap diarahkan ke generator yang sama, bukan ke model chat umum. Fallback juga memeriksa login dan PRO, lalu mengembalikan job ID untuk diteruskan oleh UI.
- Batas topik tidak menolak nama materi pelajaran saat pengguna memang meminta dibuatkan soal. Contoh topik seperti persamaan kuadrat, integral, dan materi sekolah lain dapat dipakai sebagai sumber soal.
- Verifikasi lokal: kedua file yang berubah (`src/components/Chatbot.tsx` dan `api/index.ts`) lolos pemeriksaan sintaks TypeScript. Tujuh skenario intent diuji: empat variasi permintaan soal, satu permintaan soal berbasis lampiran, satu pertanyaan cara, dan satu pertanyaan kemampuan. Lima permintaan pembuatan dikenali sebagai generate dan dua pertanyaan informasional tetap masuk chat biasa.
- Build produksi dan type-check penuh belum dapat dijalankan karena `node_modules` tidak tersedia, TypeScript global tidak menemukan `@types/node`, dan runtime saat ini Node.js 22 sedangkan proyek menggunakan Node.js 24.



## Generator, penilaian otomatis, dan katalog model (30 Oktober 2026)
- Generator soal menggunakan batch kecil (maksimal 2 soal per request), memeriksa kemiripan hanya untuk soal yang benar-benar duplikat, menerima beberapa bentuk struktur JSON dari model, dan mencoba pemulihan otomatis dengan Gemma 4 31B jika keluaran model pertama tidak valid. Batch yang sudah disimpan tidak dihapus saat percobaan berikutnya gagal.
- Jawaban pilihan ganda, pilihan ganda kompleks, benar/salah, menjodohkan, dan mengurutkan dinilai langsung berdasarkan kunci secara otomatis. Jawaban singkat, isian, numerik, dan uraian dinilai otomatis oleh Gemma 4 31B dalam batch kecil; guru dapat mengoreksi nilainya secara opsional.
- Perbandingan jawaban numerik menerima koma/titik desimal, nol di akhir angka, pecahan setara, persen, serta beberapa bentuk jawaban yang ditulis dengan garis miring. Misalnya `0,3/0,30` cocok dengan kunci `0,3`, `0,30`, atau `3/10`.
- Setelah murid mengumpulkan jawaban, halaman hasil menjalankan penilaian AI otomatis untuk soal terbuka. Status hasil tetap menunjukkan jawaban yang masih menunggu penilaian dan dapat dicoba ulang jika provider timeout.
- Katalog model PRO dibatasi menjadi 10 pilihan yang dikelompokkan: 3 pembaca gambar/dokumen, 4 pembuat soal, dan 3 tanya-jawab. Daftar katalog disajikan di samping tombol lampiran dalam satu baris komposer.
- Scrollbar percakapan disembunyikan secara visual namun area pesan tetap dapat digulir. Teks helper format/ukuran file tidak ditampilkan di samping tombol lampiran.
- Model penilai dikunci di server ke `gemma4:31b-cloud` agar pemilihan model percakapan tidak mengubah penilaian ujian.
