import type { Question } from "./exams.js";

type MultipleChoiceSeed = {
  format: "multiple_choice";
  text: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  story?: string;
};
type TrueFalseSeed = {
  format: "true_false";
  text: string;
  correctIndex: 0 | 1;
  explanation: string;
  story?: string;
};
type ShortAnswerSeed = {
  format: "short_answer";
  text: string;
  acceptedAnswers: [string, ...string[]];
  explanation: string;
  story?: string;
};
type QuestionSeed = MultipleChoiceSeed | TrueFalseSeed | ShortAnswerSeed;

const mc = (text: string, options: [string, string, string, string], correctIndex: number, explanation: string, story?: string): MultipleChoiceSeed => ({ format: "multiple_choice", text, options, correctIndex, explanation, story });
const tf = (text: string, isTrue: boolean, explanation: string, story?: string): TrueFalseSeed => ({ format: "true_false", text, correctIndex: isTrue ? 0 : 1, explanation, story });
const short = (text: string, acceptedAnswers: [string, ...string[]], explanation: string, story?: string): ShortAnswerSeed => ({ format: "short_answer", text, acceptedAnswers, explanation, story });

const DESCRIPTION_TEXT = "Perpustakaan sekolah terletak di sisi timur halaman. Ruangannya bersih dan terang karena memiliki empat jendela besar. Rak-rak buku tersusun rapi berdasarkan jenis bacaan. Di sudut ruangan terdapat dua meja baca dan enam kursi.";
const EXPLANATION_TEXT = "Hujan terjadi melalui siklus air. Panas matahari menguapkan air dari laut, sungai, dan permukaan tanah. Uap air naik lalu mendingin dan mengalami kondensasi sehingga membentuk awan. Ketika titik-titik air di awan semakin berat, air jatuh ke bumi sebagai hujan.";
const SHORT_STORY = "Pada sore hari, Dira menemukan dompet di dekat gerbang sekolah. Ia tidak mengambil uang di dalamnya. Dira menyerahkan dompet itu kepada guru piket agar pemiliknya dapat ditemukan. Tidak lama kemudian, seorang siswa datang dan mengakui bahwa dompet tersebut miliknya.";
const ENGLISH_READING = "Rina lives near her school. Every morning, she walks to school with her younger brother. They leave home at 6:30 a.m. and arrive before the first lesson begins. Rina likes walking because it keeps her healthy.";
const CERITA_PENDEK = "Pagi itu, Lani melihat tanaman di depan kelas mulai layu. Ia mengajak teman-temannya menyiram tanaman tersebut secara bergiliran. Beberapa hari kemudian, daun-daun kembali segar. Lani tersenyum karena kerja sama kecil mereka membawa hasil.";

const BANKS: Record<string, QuestionSeed[]> = {
  "matematika-sd-operasi-hitung": [
    mc("Hasil dari 245 + 178 adalah ...", ["413", "423", "433", "443"], 1, "245 + 178 = 423."),
    mc("Hasil dari 600 − 275 adalah ...", ["315", "325", "335", "345"], 1, "600 − 275 = 325."),
    mc("Ibu membeli 6 kantong apel. Setiap kantong berisi 8 apel. Berapa jumlah seluruh apel?", ["42 apel", "46 apel", "48 apel", "56 apel"], 2, "6 × 8 = 48 apel."),
    tf("Dalam operasi hitung 8 + 3 × 2, perkalian dikerjakan sebelum penjumlahan.", true, "Perkalian dan pembagian dikerjakan lebih dahulu daripada penjumlahan dan pengurangan."),
    short("Ada 4 kotak pensil. Setiap kotak berisi 12 pensil. Berapa jumlah seluruh pensil?", ["48", "48 pensil"], "4 × 12 = 48 pensil."),
  ],
  "matematika-kelas-7-bilangan": [
    mc("Hasil dari −8 + 13 adalah ...", ["−21", "−5", "5", "21"], 2, "−8 + 13 = 5."),
    mc("Hasil dari 3/4 + 1/2 adalah ...", ["1/4", "5/4", "3/8", "2/6"], 1, "1/2 = 2/4, sehingga 3/4 + 2/4 = 5/4."),
    mc("Nilai dari 2³ + 4 adalah ...", ["10", "12", "16", "20"], 1, "2³ = 8, kemudian 8 + 4 = 12."),
    tf("Nilai mutlak dari −9 adalah −9.", false, "Nilai mutlak menyatakan jarak dari nol, sehingga |−9| = 9."),
    short("Sederhanakan perbandingan 12 : 18.", ["2:3", "2 : 3", "2 banding 3"], "Kedua bilangan dibagi FPB-nya, yaitu 6. Hasilnya 2 : 3."),
  ],
  "matematika-kelas-8-persamaan-linear": [
    mc("Jika 3x + 5 = 20, nilai x adalah ...", ["3", "4", "5", "6"], 2, "3x = 15, sehingga x = 5."),
    mc("Penyelesaian dari 2(x − 3) = 10 adalah ...", ["5", "6", "8", "10"], 2, "2x − 6 = 10, maka 2x = 16 dan x = 8."),
    mc("Nilai x yang memenuhi 5x − 2 = 3x + 8 adalah ...", ["3", "4", "5", "6"], 2, "2x = 10, sehingga x = 5."),
    tf("Persamaan x + 4 = 10 memiliki penyelesaian x = 6.", true, "Dengan mengurangi kedua ruas sebesar 4, diperoleh x = 6."),
    short("Jika y = 2x + 3 dan x = 4, berapakah nilai y?", ["11"], "y = 2(4) + 3 = 11."),
  ],
  "matematika-sma-fungsi-kuadrat": [
    mc("Akar-akar persamaan x² − 5x + 6 = 0 adalah ...", ["1 dan 6", "2 dan 3", "−2 dan −3", "−1 dan −6"], 1, "x² − 5x + 6 = (x − 2)(x − 3), sehingga akarnya 2 dan 3."),
    mc("Titik puncak fungsi y = x² − 4x + 3 memiliki absis ...", ["−4", "−2", "2", "4"], 2, "Absis titik puncak adalah −b/(2a) = 4/2 = 2."),
    mc("Diskriminan persamaan x² + 2x + 5 = 0 adalah ...", ["−16", "−4", "4", "16"], 0, "D = b² − 4ac = 4 − 20 = −16."),
    tf("Grafik y = 2x² + 3x − 1 terbuka ke atas.", true, "Koefisien x² positif, sehingga parabola terbuka ke atas."),
    short("Tentukan absis titik puncak fungsi y = 2x² − 12x + 1.", ["3"], "x puncak = −b/(2a) = 12/4 = 3."),
  ],
  "bahasa-indonesia-teks-deskripsi": [
    mc("Apa objek yang dideskripsikan dalam bacaan?", ["Halaman sekolah", "Perpustakaan sekolah", "Ruang guru", "Kantin sekolah"], 1, "Bacaan menggambarkan letak, keadaan, dan isi perpustakaan sekolah.", DESCRIPTION_TEXT),
    mc("Di sisi manakah perpustakaan berada?", ["Barat halaman", "Utara halaman", "Timur halaman", "Selatan halaman"], 2, "Kalimat pertama menyebutkan perpustakaan berada di sisi timur halaman.", DESCRIPTION_TEXT),
    mc("Berapa jendela besar yang dimiliki ruangan tersebut?", ["Dua", "Tiga", "Empat", "Enam"], 2, "Bacaan menyebutkan terdapat empat jendela besar.", DESCRIPTION_TEXT),
    tf("Rak buku disusun berdasarkan jenis bacaan.", true, "Informasi tersebut terdapat pada kalimat ketiga bacaan.", DESCRIPTION_TEXT),
    short("Berapa kursi yang terdapat di sudut ruangan?", ["6", "enam", "6 kursi", "enam kursi"], "Di sudut ruangan terdapat enam kursi.", DESCRIPTION_TEXT),
  ],
  "bahasa-indonesia-teks-eksplanasi": [
    mc("Apa topik utama bacaan tersebut?", ["Proses terjadinya hujan", "Manfaat air laut", "Jenis-jenis awan", "Perubahan musim"], 0, "Bacaan menjelaskan tahapan siklus air hingga hujan turun.", EXPLANATION_TEXT),
    mc("Proses apa yang terjadi ketika air berubah menjadi uap karena panas matahari?", ["Kondensasi", "Evaporasi", "Presipitasi", "Infiltrasi"], 1, "Evaporasi adalah proses penguapan air akibat panas.", EXPLANATION_TEXT),
    mc("Apa yang terbentuk ketika uap air mendingin dan mengalami kondensasi?", ["Angin", "Pelangi", "Awan", "Embun beku"], 2, "Kondensasi uap air membentuk awan.", EXPLANATION_TEXT),
    tf("Hujan turun ketika titik-titik air di awan semakin berat.", true, "Titik air yang membesar dan berat akhirnya jatuh sebagai presipitasi.", EXPLANATION_TEXT),
    short("Apa istilah proses perubahan uap air menjadi titik-titik air?", ["kondensasi", "pengembunan"], "Kondensasi adalah perubahan uap air menjadi air dalam bentuk titik-titik kecil.", EXPLANATION_TEXT),
  ],
  "bahasa-indonesia-sma-cerpen": [
    mc("Siapa tokoh utama dalam kutipan cerita?", ["Dira", "Guru piket", "Seorang siswa", "Penjaga sekolah"], 0, "Dira menjadi tokoh yang mengalami peristiwa utama dalam kutipan.", SHORT_STORY),
    mc("Di mana Dira menemukan dompet?", ["Di dalam kelas", "Di dekat gerbang sekolah", "Di perpustakaan", "Di kantin"], 1, "Dompet ditemukan di dekat gerbang sekolah.", SHORT_STORY),
    mc("Bagaimana watak Dira berdasarkan tindakannya?", ["Ceroboh", "Jujur dan bertanggung jawab", "Pemarah", "Tidak peduli"], 1, "Dira tidak mengambil uang dan menyerahkan dompet kepada guru.", SHORT_STORY),
    tf("Amanat kutipan tersebut adalah barang temuan sebaiknya dikembalikan kepada pemiliknya.", true, "Tindakan Dira menunjukkan pentingnya kejujuran dan tanggung jawab.", SHORT_STORY),
    short("Kepada siapa Dira menyerahkan dompet yang ditemukan?", ["guru piket", "guru"], "Dira menyerahkan dompet kepada guru piket.", SHORT_STORY),
  ],
  "english-daily-expressions": [
    mc("You meet your teacher at 7 a.m. What is the most appropriate greeting?", ["Good night", "Good morning", "Good evening", "Goodbye"], 1, "Use 'Good morning' in the morning."),
    mc("Which expression is used to introduce yourself?", ["My name is Andi.", "See you later.", "You are welcome.", "I'm sorry."], 0, "'My name is ...' is a common way to introduce yourself."),
    mc("Your friend says 'Thank you'. You should reply ...", ["I'm fine", "Good morning", "You're welcome", "Excuse me"], 2, "'You're welcome' is a polite response to 'Thank you'."),
    tf("The expression 'How are you?' is used to ask about someone's condition.", true, "'How are you?' asks how a person is feeling."),
    short("Complete the expression: 'Nice to ____ you.'", ["meet"], "The common expression is 'Nice to meet you'."),
  ],
  "english-reading-comprehension": [
    mc("How does Rina go to school?", ["By bus", "By bicycle", "On foot", "By train"], 2, "The passage says that Rina walks to school.", ENGLISH_READING),
    mc("Who walks to school with Rina?", ["Her sister", "Her younger brother", "Her mother", "Her friend"], 1, "Rina walks with her younger brother.", ENGLISH_READING),
    mc("What time do they leave home?", ["6:00 a.m.", "6:15 a.m.", "6:30 a.m.", "7:00 a.m."], 2, "They leave home at 6:30 a.m.", ENGLISH_READING),
    tf("Rina likes walking because it keeps her healthy.", true, "This reason is stated in the last sentence.", ENGLISH_READING),
    short("Where does Rina live in relation to her school?", ["near her school", "near school"], "The first sentence says Rina lives near her school.", ENGLISH_READING),
  ],
  "english-sma-grammar-writing": [
    mc("Choose the correct sentence in the simple past tense.", ["She go to school yesterday.", "She goes to school yesterday.", "She went to school yesterday.", "She going to school yesterday."], 2, "The past form of 'go' is 'went'."),
    mc("Choose the correct conjunction: 'I stayed at home ____ it was raining.'", ["because", "although", "but", "or"], 0, "'Because' introduces the reason for staying at home."),
    mc("Which sentence is written in the present perfect tense?", ["They have finished their work.", "They finish their work.", "They finished their work yesterday.", "They are finishing their work."], 0, "Present perfect uses have/has + past participle."),
    tf("The subject 'She' takes 'has' in the present perfect tense.", true, "Use 'has' with he, she, and it."),
    short("Change the verb 'write' into its past participle form.", ["written"], "The past participle of 'write' is 'written'."),
  ],
  "ipa-kelas-7-klasifikasi": [
    mc("Kelompok makhluk hidup yang dapat membuat makanan sendiri melalui fotosintesis adalah ...", ["Konsumen", "Produsen", "Pengurai", "Parasit"], 1, "Tumbuhan hijau berperan sebagai produsen karena dapat membuat makanan sendiri."),
    mc("Manakah contoh hewan vertebrata?", ["Cacing tanah", "Ubur-ubur", "Ikan lele", "Siput"], 2, "Ikan lele memiliki tulang belakang sehingga termasuk vertebrata."),
    mc("Tujuan utama klasifikasi makhluk hidup adalah ...", ["Mengubah habitat", "Mempermudah pengenalan dan pembelajaran", "Mengurangi jumlah spesies", "Membuat spesies baru"], 1, "Klasifikasi mengelompokkan organisme berdasarkan persamaan dan perbedaan cirinya."),
    tf("Jamur termasuk kelompok tumbuhan karena memiliki klorofil.", false, "Jamur tidak memiliki klorofil dan ditempatkan pada kingdom Fungi."),
    short("Apa istilah untuk hewan yang tidak memiliki tulang belakang?", ["invertebrata", "avertebrata"], "Invertebrata adalah hewan yang tidak mempunyai tulang belakang."),
  ],
  "ipa-kelas-8-tekanan": [
    mc("Tekanan pada benda padat dirumuskan sebagai ...", ["P = F × A", "P = F/A", "P = A/F", "P = m × g × A"], 1, "Tekanan adalah gaya tekan dibagi luas bidang tekan."),
    mc("Gaya 100 N bekerja pada luas 2 m². Besar tekanannya adalah ...", ["20 Pa", "50 Pa", "100 Pa", "200 Pa"], 1, "P = F/A = 100/2 = 50 Pa."),
    mc("Tekanan hidrostatis semakin besar apabila ...", ["Kedalaman bertambah", "Warna air berubah", "Wadah melebar", "Air didiamkan"], 0, "Tekanan hidrostatis sebanding dengan kedalaman zat cair."),
    tf("Semakin kecil luas bidang tekan dengan gaya yang sama, semakin besar tekanannya.", true, "Karena P = F/A, luas yang lebih kecil menghasilkan tekanan lebih besar."),
    short("Sebuah gaya 60 N bekerja pada luas 3 m². Berapa tekanannya dalam Pa?", ["20", "20 pa"], "P = 60/3 = 20 Pa."),
  ],
  "biologi-sma-ekosistem": [
    mc("Organisme yang berperan sebagai produsen dalam ekosistem darat adalah ...", ["Elang", "Rumput", "Jamur", "Ular"], 1, "Rumput dapat berfotosintesis dan menghasilkan bahan organik."),
    mc("Urutan rantai makanan yang benar adalah ...", ["Elang → rumput → belalang", "Rumput → belalang → katak", "Katak → rumput → ular", "Belalang → ular → rumput"], 1, "Energi mengalir dari produsen ke konsumen tingkat pertama lalu konsumen berikutnya."),
    mc("Organisme yang menguraikan sisa makhluk hidup disebut ...", ["Produsen", "Konsumen primer", "Dekomposer", "Predator puncak"], 2, "Dekomposer seperti bakteri dan jamur menguraikan bahan organik."),
    tf("Energi dalam ekosistem mengalir satu arah melalui tingkat trofik.", true, "Energi berpindah antartingkat trofik dan sebagian dilepaskan sebagai panas."),
    short("Apa istilah untuk tempat hidup alami suatu organisme?", ["habitat"], "Habitat adalah tempat organisme hidup dan memenuhi kebutuhannya."),
  ],
  "fisika-sma-gerak-lurus": [
    mc("Sebuah benda menempuh jarak 120 meter dalam 10 sekon. Kelajuannya adalah ...", ["10 m/s", "12 m/s", "20 m/s", "120 m/s"], 1, "Kelajuan = jarak/waktu = 120/10 = 12 m/s."),
    mc("Pada gerak lurus beraturan (GLB), kecepatan benda ...", ["Selalu bertambah", "Selalu berkurang", "Tetap", "Selalu nol"], 2, "GLB memiliki kecepatan konstan dan percepatan nol."),
    mc("Satuan SI untuk percepatan adalah ...", ["m/s", "m/s²", "km/jam", "Newton"], 1, "Percepatan merupakan perubahan kecepatan per waktu, dengan satuan m/s²."),
    tf("Pada GLBB dipercepat, besar kecepatan bertambah secara teratur untuk percepatan konstan.", true, "Percepatan konstan menyebabkan perubahan kecepatan yang sama pada selang waktu yang sama."),
    short("Benda berubah kecepatan dari 4 m/s menjadi 16 m/s selama 3 sekon. Berapa percepatannya dalam m/s²?", ["4"], "a = (16 − 4)/3 = 4 m/s²."),
  ],
  "kimia-sma-struktur-atom": [
    mc("Partikel subatom yang bermuatan negatif adalah ...", ["Proton", "Neutron", "Elektron", "Nukleon"], 2, "Elektron memiliki muatan listrik negatif."),
    mc("Nomor atom suatu unsur menunjukkan jumlah ...", ["Neutron", "Proton", "Proton dan neutron", "Kulit elektron"], 1, "Nomor atom sama dengan jumlah proton dalam inti atom."),
    mc("Atom netral memiliki 11 proton. Jumlah elektronnya adalah ...", ["9", "10", "11", "12"], 2, "Pada atom netral, jumlah proton sama dengan jumlah elektron."),
    tf("Isotop adalah atom-atom dari unsur yang sama dengan jumlah neutron berbeda.", true, "Isotop memiliki nomor atom sama, tetapi nomor massa berbeda."),
    short("Partikel apakah yang tidak memiliki muatan listrik?", ["neutron"], "Neutron merupakan partikel subatom yang bersifat netral."),
  ],
  "ips-kelas-7-interaksi-sosial": [
    mc("Syarat utama terjadinya interaksi sosial adalah ...", ["Kontak sosial dan komunikasi", "Persaingan dan konflik", "Kesamaan pekerjaan", "Tempat tinggal yang sama"], 0, "Interaksi sosial memerlukan kontak sosial dan komunikasi."),
    mc("Contoh interaksi sosial asosiatif adalah ...", ["Tawuran antarkelompok", "Kerja bakti warga", "Persaingan tidak sehat", "Pertengkaran teman"], 1, "Kerja bakti mencerminkan kerja sama untuk mencapai tujuan bersama."),
    mc("Kegiatan tawar-menawar antara penjual dan pembeli termasuk bentuk ...", ["Interaksi sosial", "Isolasi sosial", "Mobilitas geografis", "Sosialisasi primer saja"], 0, "Penjual dan pembeli saling berkomunikasi dan memengaruhi tindakan."),
    tf("Komunikasi dapat terjadi secara langsung maupun melalui media.", true, "Komunikasi dapat dilakukan dengan tatap muka atau menggunakan media komunikasi."),
    short("Apa istilah untuk proses saling memengaruhi antara individu atau kelompok?", ["interaksi sosial", "interaksi"], "Interaksi sosial adalah hubungan timbal balik yang saling memengaruhi."),
  ],
  "sejarah-sma-pergerakan-nasional": [
    mc("Organisasi Budi Utomo berdiri pada tanggal ...", ["20 Mei 1908", "28 Oktober 1928", "17 Agustus 1945", "1 Juni 1945"], 0, "Budi Utomo berdiri pada 20 Mei 1908, yang diperingati sebagai Hari Kebangkitan Nasional."),
    mc("Kongres Pemuda II pada 1928 menghasilkan ...", ["Piagam Jakarta", "Sumpah Pemuda", "Proklamasi Kemerdekaan", "Dekrit Presiden"], 1, "Kongres Pemuda II melahirkan ikrar Sumpah Pemuda pada 28 Oktober 1928."),
    mc("Tokoh yang dikenal sebagai salah satu pendiri Indische Partij adalah ...", ["Ki Hajar Dewantara", "Sultan Agung", "Pattimura", "Tuanku Imam Bonjol"], 0, "Ki Hajar Dewantara bersama Douwes Dekker dan dr. Cipto Mangunkusumo dikenal sebagai Tiga Serangkai."),
    tf("Sumpah Pemuda menegaskan satu tanah air, satu bangsa, dan satu bahasa persatuan.", true, "Tiga ikrar tersebut menjadi inti Sumpah Pemuda."),
    short("Kapan Sumpah Pemuda diikrarkan? (format tanggal-bulan-tahun)", ["28 oktober 1928", "28-10-1928", "28/10/1928"], "Sumpah Pemuda diikrarkan pada 28 Oktober 1928."),
  ],
  "geografi-sma-atmosfer": [
    mc("Lapisan atmosfer tempat sebagian besar gejala cuaca terjadi adalah ...", ["Stratosfer", "Troposfer", "Mesosfer", "Termosfer"], 1, "Sebagian besar awan, hujan, dan perubahan cuaca terjadi di troposfer."),
    mc("Lapisan ozon yang menyerap sebagian besar radiasi ultraviolet berada di ...", ["Troposfer", "Stratosfer", "Mesosfer", "Eksosfer"], 1, "Lapisan ozon utama berada di stratosfer."),
    mc("Ilmu yang mempelajari cuaca dan proses atmosfer jangka pendek disebut ...", ["Geologi", "Meteorologi", "Oceanografi", "Kartografi"], 1, "Meteorologi mempelajari atmosfer dan fenomena cuaca."),
    tf("Iklim menggambarkan pola rata-rata cuaca dalam jangka waktu panjang.", true, "Iklim merangkum pola cuaca dalam periode panjang pada suatu wilayah."),
    short("Apa nama alat untuk mengukur tekanan udara?", ["barometer"], "Barometer digunakan untuk mengukur tekanan udara."),
  ],
  "ppkn-pancasila-norma": [
    mc("Lambang sila ketiga Pancasila adalah ...", ["Bintang", "Rantai", "Pohon beringin", "Kepala banteng"], 2, "Pohon beringin melambangkan sila Persatuan Indonesia."),
    mc("Contoh penerapan sila kedua Pancasila adalah ...", ["Memaksakan pendapat", "Menghormati martabat setiap orang", "Memilih teman berdasarkan kekayaan", "Mengabaikan orang yang membutuhkan"], 1, "Sila kedua menekankan nilai kemanusiaan yang adil dan beradab."),
    mc("Norma yang bersumber dari hati nurani manusia disebut norma ...", ["Hukum", "Kesopanan", "Kesusilaan", "Adat"], 2, "Norma kesusilaan berasal dari hati nurani tentang baik dan buruk."),
    tf("Musyawarah untuk mencapai mufakat merupakan salah satu penerapan sila keempat.", true, "Sila keempat menekankan kerakyatan, permusyawaratan, dan perwakilan."),
    short("Apa bunyi sila ketiga Pancasila?", ["persatuan indonesia"], "Bunyi sila ketiga adalah Persatuan Indonesia."),
  ],
  "informatika-algoritma-dasar": [
    mc("Urutan instruksi yang logis dan terbatas untuk menyelesaikan masalah disebut ...", ["Algoritma", "Monitor", "Jaringan", "Variabel"], 0, "Algoritma adalah langkah-langkah logis dan terurut untuk menyelesaikan masalah."),
    mc("Simbol flowchart berbentuk belah ketupat biasanya digunakan untuk ...", ["Mulai atau selesai", "Proses", "Keputusan atau percabangan", "Input/output"], 2, "Belah ketupat menandakan keputusan berdasarkan kondisi."),
    mc("Dalam algoritma, perintah yang dijalankan berulang selama kondisi terpenuhi disebut ...", ["Percabangan", "Perulangan", "Deklarasi", "Kompilasi"], 1, "Perulangan menjalankan satu atau beberapa instruksi berulang kali."),
    tf("Algoritma yang baik harus memiliki langkah yang jelas dan tidak ambigu.", true, "Setiap langkah algoritma perlu jelas agar dapat dilaksanakan dengan benar."),
    short("Apa istilah untuk mencari dan memperbaiki kesalahan pada program?", ["debugging", "debug"], "Debugging adalah proses menemukan dan memperbaiki kesalahan program."),
  ],
  "informatika-sma-pemrograman": [
    mc("Tempat untuk menyimpan nilai yang dapat berubah selama program berjalan disebut ...", ["Konstanta", "Variabel", "Komentar", "Operator"], 1, "Variabel menyimpan data yang nilainya dapat berubah."),
    mc("Tipe data yang tepat untuk nilai true atau false adalah ...", ["String", "Integer", "Boolean", "Float"], 2, "Boolean menyimpan salah satu dari dua nilai: true atau false."),
    mc("Struktur kontrol yang memilih tindakan berdasarkan suatu kondisi adalah ...", ["Perulangan", "Percabangan", "Deklarasi", "Input"], 1, "Percabangan seperti if/else memilih jalur berdasarkan kondisi."),
    tf("Perulangan for umumnya digunakan ketika jumlah iterasi atau rentang pengulangan diketahui.", true, "Perulangan for cocok untuk mengiterasi rentang atau koleksi dengan jumlah yang terukur."),
    short("Apa keluaran ekspresi 7 % 3 pada operator modulo?", ["1"], "Modulo menghasilkan sisa pembagian. Sisa 7 dibagi 3 adalah 1."),
  ],
  "ekonomi-sma-permintaan-penawaran": [
    mc("Menurut hukum permintaan, jika harga barang naik dan faktor lain tetap, jumlah yang diminta cenderung ...", ["Naik", "Turun", "Tetap selalu", "Menjadi nol"], 1, "Hukum permintaan menyatakan harga dan jumlah yang diminta berhubungan terbalik."),
    mc("Faktor yang dapat menggeser kurva penawaran ke kanan adalah ...", ["Biaya produksi naik", "Teknologi produksi membaik", "Pajak produksi naik", "Jumlah produsen turun"], 1, "Teknologi yang lebih baik dapat menurunkan biaya dan meningkatkan penawaran."),
    mc("Harga keseimbangan terjadi ketika ...", ["Permintaan lebih besar dari penawaran", "Penawaran lebih besar dari permintaan", "Jumlah diminta sama dengan jumlah ditawarkan", "Harga ditetapkan selalu nol"], 2, "Keseimbangan pasar terjadi saat kuantitas yang diminta sama dengan yang ditawarkan."),
    tf("Pendapatan konsumen dapat memengaruhi permintaan terhadap barang normal.", true, "Untuk barang normal, kenaikan pendapatan umumnya meningkatkan permintaan."),
    short("Jika Qd = 40 − 2P dan harga P = 10, berapa jumlah yang diminta?", ["20"], "Qd = 40 − 2(10) = 20."),
  ],
  "agama-akhlak-terpuji": [
    mc("Sikap berkata dan bertindak sesuai kenyataan disebut ...", ["Amanah", "Jujur", "Sombong", "Iri"], 1, "Jujur berarti menyampaikan dan melakukan sesuatu sesuai kenyataan."),
    mc("Menjaga titipan agar tetap aman merupakan contoh perilaku ...", ["Amanah", "Riya", "Dengki", "Boros"], 0, "Amanah berarti dapat dipercaya dalam menjaga tanggung jawab atau titipan."),
    mc("Ketika melakukan kesalahan kepada teman, tindakan yang tepat adalah ...", ["Menyalahkan orang lain", "Meminta maaf dan memperbaiki kesalahan", "Berpura-pura tidak tahu", "Mengulangi perbuatan"], 1, "Mengakui kesalahan dan meminta maaf menunjukkan tanggung jawab dan rendah hati."),
    tf("Menghargai perbedaan pendapat dapat membantu menjaga kerukunan.", true, "Saling menghargai membuat hubungan sosial lebih baik."),
    short("Apa istilah untuk sikap dapat dipercaya dalam menjalankan tanggung jawab?", ["amanah"], "Amanah adalah sikap dapat dipercaya dalam menjalankan tanggung jawab."),
  ],
  "smk-keselamatan-kerja": [
    mc("Kepanjangan APD dalam keselamatan kerja adalah ...", ["Alat Pelindung Diri", "Alat Pengukur Daya", "Area Pemeriksaan Darurat", "Akses Pengaman Digital"], 0, "APD adalah Alat Pelindung Diri yang digunakan untuk mengurangi risiko kerja."),
    mc("Sebelum menggunakan mesin, pekerja sebaiknya ...", ["Langsung menyalakan mesin", "Memeriksa kondisi dan memahami prosedur", "Melepas pelindung mesin", "Mengabaikan instruksi"], 1, "Pemeriksaan awal dan pemahaman prosedur membantu mencegah kecelakaan."),
    mc("Jika menemukan kabel listrik terkelupas, tindakan paling aman adalah ...", ["Menyentuh untuk memeriksa", "Menyiram dengan air", "Menjauhkan orang dan melapor kepada petugas", "Menutupnya dengan kertas"], 2, "Jangan menyentuh kabel rusak; amankan area dan laporkan kepada petugas berwenang."),
    tf("Area kerja yang bersih dan rapi dapat membantu mengurangi risiko tersandung dan kecelakaan.", true, "Kerapian mengurangi bahaya akibat barang berserakan dan jalur terhalang."),
    short("Apa kepanjangan K3 dalam lingkungan kerja?", ["keselamatan dan kesehatan kerja"], "K3 adalah Keselamatan dan Kesehatan Kerja."),
  ],
};

export function getBuiltinTemplateQuestions(slug: string): Question[] {
  const bank = BANKS[slug];
  if (!bank) return [];
  return bank.map((seed, index) => ({
    id: `builtin-${slug.slice(0, 17)}-${index + 1}`,
    kind: seed.format,
    format: seed.format,
    text: seed.text,
    story: seed.story ?? "",
    image: null,
    options: seed.format === "multiple_choice" ? [...seed.options] : seed.format === "true_false" ? ["Benar", "Salah"] : [],
    correctIndex: seed.format === "multiple_choice" || seed.format === "true_false" ? seed.correctIndex : 0,
    correctIndices: [],
    acceptedAnswers: seed.format === "short_answer" ? [...seed.acceptedAnswers] : [],
    explanation: seed.explanation,
    matchPairs: [],
    orderItems: [],
    correctOrder: [],
    rubric: "",
    points: 1,
  }));
}

export const BUILTIN_QUESTION_DISTRIBUTION = {
  multiple_choice: 3,
  true_false: 1,
  short_answer: 1,
};
