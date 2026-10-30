import { BUILTIN_QUESTION_DISTRIBUTION, getBuiltinTemplateQuestions } from "./template-question-seeds.js";
import type { Question } from "./exams.js";

export type BuiltinTemplateSeed = {
  name: string;
  slug: string;
  description: string;
  subject: string;
  gradeLevel: string;
  category: string;
  questionConfig: { distribution: Record<string, number>; questionTypes: string[] };
  questionCount: number;
  durationMin: number;
  difficulty: string;
  instructions: string;
  reusableQuestions: Question[];
};

const seed = (
  name: string,
  slug: string,
  subject: string,
  gradeLevel: string,
  category: string,
  questionCount: number,
  durationMin: number,
  difficulty: string,
  _distribution: Record<string, number>,
  description: string,
  instructions = "Baca setiap soal dengan teliti. Periksa kembali jawaban sebelum dikumpulkan.",
): BuiltinTemplateSeed => ({
  name, slug, subject, gradeLevel, category, durationMin, difficulty, description,
  questionCount: getBuiltinTemplateQuestions(slug).length || questionCount,
  questionConfig: {
    distribution: BUILTIN_QUESTION_DISTRIBUTION,
    questionTypes: Object.keys(BUILTIN_QUESTION_DISTRIBUTION),
  },
  instructions,
  reusableQuestions: getBuiltinTemplateQuestions(slug),
});

export const BUILTIN_TEMPLATES: BuiltinTemplateSeed[] = [
  seed("Matematika SD — Operasi Hitung", "matematika-sd-operasi-hitung", "Matematika", "Kelas 4–6 SD", "Latihan harian", 15, 35, "Mudah–menengah", { multiple_choice: 10, short_answer: 5 }, "Latihan operasi hitung bilangan, urutan operasi, dan soal cerita sederhana."),
  seed("Matematika Kelas 7 — Bilangan", "matematika-kelas-7-bilangan", "Matematika", "Kelas 7 SMP", "Ulangan bab", 20, 45, "Menengah", { multiple_choice: 12, short_answer: 5, essay: 3 }, "Bilangan bulat, pecahan, rasio, dan penerapan dalam konteks sehari-hari."),
  seed("Matematika Kelas 8 — Persamaan Linear", "matematika-kelas-8-persamaan-linear", "Matematika", "Kelas 8 SMP", "Ulangan bab", 20, 50, "Menengah", { multiple_choice: 12, short_answer: 5, essay: 3 }, "Persamaan linear satu variabel, pemodelan, dan penyelesaian masalah."),
  seed("Matematika SMA — Fungsi Kuadrat", "matematika-sma-fungsi-kuadrat", "Matematika", "Kelas 10 SMA", "Ulangan bab", 20, 60, "Menengah–sulit", { multiple_choice: 12, short_answer: 4, essay: 4 }, "Grafik fungsi kuadrat, akar, titik puncak, dan interpretasi masalah."),
  seed("Bahasa Indonesia — Teks Deskripsi", "bahasa-indonesia-teks-deskripsi", "Bahasa Indonesia", "Kelas 7 SMP", "Literasi", 15, 35, "Mudah–menengah", { multiple_choice: 8, true_false: 3, short_answer: 4 }, "Mengukur pemahaman struktur, ciri kebahasaan, dan informasi dalam teks deskripsi."),
  seed("Bahasa Indonesia — Teks Eksplanasi", "bahasa-indonesia-teks-eksplanasi", "Bahasa Indonesia", "Kelas 8 SMP", "Literasi", 20, 45, "Menengah", { multiple_choice: 10, short_answer: 6, essay: 4 }, "Memahami sebab-akibat, struktur, dan ringkasan teks eksplanasi."),
  seed("Bahasa Indonesia SMA — Analisis Cerpen", "bahasa-indonesia-sma-cerpen", "Bahasa Indonesia", "Kelas 10–12 SMA", "Analisis teks", 15, 45, "Menengah–sulit", { multiple_choice: 7, short_answer: 4, essay: 4 }, "Menganalisis tokoh, alur, latar, sudut pandang, dan amanat cerpen."),
  seed("English — Daily Expressions", "english-daily-expressions", "Bahasa Inggris", "Kelas 7 SMP", "Vocabulary", 15, 30, "Mudah", { multiple_choice: 10, fill_blank: 5 }, "Practice greetings, introductions, classroom language, and common expressions."),
  seed("English — Reading Comprehension", "english-reading-comprehension", "Bahasa Inggris", "Kelas 8–9 SMP", "Reading", 15, 40, "Menengah", { multiple_choice: 8, true_false: 3, short_answer: 4 }, "Questions based on short factual and narrative passages."),
  seed("English SMA — Grammar & Writing", "english-sma-grammar-writing", "Bahasa Inggris", "Kelas 10–12 SMA", "Grammar", 20, 50, "Menengah–sulit", { multiple_choice: 10, fill_blank: 5, essay: 5 }, "Review tenses, clauses, vocabulary in context, and short written responses."),
  seed("IPA Kelas 7 — Klasifikasi Makhluk Hidup", "ipa-kelas-7-klasifikasi", "IPA", "Kelas 7 SMP", "Ulangan bab", 20, 45, "Menengah", { multiple_choice: 12, true_false: 4, short_answer: 4 }, "Mengelompokkan makhluk hidup dan memahami ciri-ciri klasifikasi."),
  seed("IPA Kelas 8 — Tekanan", "ipa-kelas-8-tekanan", "IPA", "Kelas 8 SMP", "Ulangan bab", 20, 50, "Menengah", { multiple_choice: 10, numeric: 5, essay: 5 }, "Tekanan zat padat, cair, gas, serta penerapan rumus pada masalah kontekstual."),
  seed("Biologi SMA — Ekosistem", "biologi-sma-ekosistem", "Biologi", "Kelas 10 SMA", "Ulangan bab", 20, 50, "Menengah", { multiple_choice: 10, multiple_select: 3, short_answer: 4, essay: 3 }, "Komponen ekosistem, aliran energi, rantai makanan, dan keseimbangan lingkungan."),
  seed("Fisika SMA — Gerak Lurus", "fisika-sma-gerak-lurus", "Fisika", "Kelas 10 SMA", "Latihan hitungan", 15, 50, "Menengah–sulit", { multiple_choice: 7, numeric: 5, essay: 3 }, "GLB, GLBB, grafik gerak, serta analisis besaran dan satuan."),
  seed("Kimia SMA — Struktur Atom", "kimia-sma-struktur-atom", "Kimia", "Kelas 10 SMA", "Ulangan bab", 20, 45, "Menengah", { multiple_choice: 12, true_false: 3, short_answer: 5 }, "Partikel subatom, nomor atom, nomor massa, isotop, dan konfigurasi elektron dasar."),
  seed("IPS Kelas 7 — Interaksi Sosial", "ips-kelas-7-interaksi-sosial", "IPS", "Kelas 7 SMP", "Ulangan bab", 15, 35, "Mudah–menengah", { multiple_choice: 8, true_false: 3, short_answer: 4 }, "Bentuk interaksi sosial, syarat, faktor pendorong, dan contoh di masyarakat."),
  seed("Sejarah SMA — Pergerakan Nasional", "sejarah-sma-pergerakan-nasional", "Sejarah", "Kelas 11 SMA", "Ulangan bab", 20, 50, "Menengah", { multiple_choice: 10, true_false: 4, essay: 6 }, "Organisasi pergerakan, tokoh, konteks sejarah, dan dampaknya."),
  seed("Geografi SMA — Dinamika Atmosfer", "geografi-sma-atmosfer", "Geografi", "Kelas 10 SMA", "Ulangan bab", 20, 45, "Menengah", { multiple_choice: 10, multiple_select: 4, short_answer: 6 }, "Lapisan atmosfer, cuaca, iklim, dan faktor yang memengaruhinya."),
  seed("PPKn — Pancasila dan Norma", "ppkn-pancasila-norma", "PPKn", "Kelas 7 SMP", "Ulangan bab", 15, 35, "Mudah–menengah", { multiple_choice: 8, true_false: 4, short_answer: 3 }, "Nilai Pancasila, norma sosial, dan penerapannya dalam kehidupan sehari-hari."),
  seed("Informatika — Algoritma Dasar", "informatika-algoritma-dasar", "Informatika", "Kelas 8 SMP", "Praktik konsep", 15, 40, "Menengah", { multiple_choice: 7, ordering: 3, short_answer: 5 }, "Urutan instruksi, percabangan sederhana, pengenalan pola, dan debugging dasar."),
  seed("Informatika SMA — Dasar Pemrograman", "informatika-sma-pemrograman", "Informatika", "Kelas 10 SMA", "Praktik konsep", 20, 50, "Menengah–sulit", { multiple_choice: 8, fill_blank: 4, ordering: 3, essay: 5 }, "Variabel, tipe data, kondisi, perulangan, dan analisis algoritma."),
  seed("Ekonomi SMA — Permintaan & Penawaran", "ekonomi-sma-permintaan-penawaran", "Ekonomi", "Kelas 10 SMA", "Ulangan bab", 20, 45, "Menengah", { multiple_choice: 10, numeric: 4, short_answer: 3, essay: 3 }, "Hukum permintaan dan penawaran, kurva, keseimbangan pasar, dan faktor pergeseran."),
  seed("Pendidikan Agama — Akhlak Terpuji", "agama-akhlak-terpuji", "Pendidikan Agama", "Kelas 7–9 SMP", "Refleksi dan pemahaman", 15, 35, "Mudah–menengah", { multiple_choice: 8, true_false: 3, essay: 4 }, "Pemahaman nilai akhlak terpuji dan penerapannya dalam keseharian; sesuaikan materi dengan kurikulum sekolah."),
  seed("SMK — Keselamatan Kerja", "smk-keselamatan-kerja", "Projek/Kejuruan", "SMK", "Kompetensi kejuruan", 20, 45, "Menengah", { multiple_choice: 10, true_false: 4, short_answer: 6 }, "Mengenali bahaya, APD, prosedur kerja aman, dan respons awal pada situasi berisiko."),
];
