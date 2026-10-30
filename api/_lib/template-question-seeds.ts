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

// Setiap template bawaan memiliki sedikitnya 10 soal siap pakai.
// Lima soal tambahan ini melengkapi bank awal dan ikut masuk ke seed database.
const EXTRA_BANKS: Record<string, QuestionSeed[]> = {
  "matematika-sd-operasi-hitung": [
    mc("Hasil dari 36 ÷ 4 + 7 adalah ...", ["14", "16", "18", "20"], 1, "Kerjakan pembagian lebih dahulu: 36 ÷ 4 = 9, kemudian 9 + 7 = 16."),
    mc("KPK dari 4 dan 6 adalah ...", ["8", "10", "12", "24"], 2, "Kelipatan persekutuan terkecil 4 dan 6 adalah 12."),
    mc("Sebuah persegi panjang memiliki panjang 8 cm dan lebar 5 cm. Kelilingnya adalah ...", ["13 cm", "26 cm", "40 cm", "80 cm"], 1, "Keliling = 2 × (8 + 5) = 26 cm."),
    tf("Pecahan 1/2 senilai dengan 2/4.", true, "Kalikan pembilang dan penyebut 1/2 dengan 2 sehingga menjadi 2/4."),
    short("Sebuah persegi panjang memiliki panjang 7 cm dan lebar 4 cm. Berapa luasnya dalam cm²?", ["28", "28 cm2", "28 cm²"], "Luas = panjang × lebar = 7 × 4 = 28 cm²."),
  ],
  "matematika-kelas-7-bilangan": [
    mc("Nilai dari |−15| adalah ...", ["−15", "0", "15", "30"], 2, "Nilai mutlak adalah jarak dari nol sehingga |−15| = 15."),
    mc("Bentuk pecahan paling sederhana dari 0,25 adalah ...", ["1/2", "1/4", "2/5", "3/4"], 1, "0,25 = 25/100 = 1/4."),
    mc("Rasio 2 : 3 yang senilai adalah ...", ["4 : 9", "6 : 8", "8 : 12", "10 : 12"], 2, "Kalikan kedua bagian rasio 2 : 3 dengan 4 sehingga menjadi 8 : 12."),
    tf("Hasil perkalian dua bilangan negatif selalu positif.", true, "Dua tanda negatif pada perkalian menghasilkan nilai positif."),
    short("Tentukan FPB dari 24 dan 36.", ["12"], "Faktor persekutuan terbesar 24 dan 36 adalah 12."),
  ],
  "matematika-kelas-8-persamaan-linear": [
    mc("Jika x + 7 = 15, nilai x adalah ...", ["6", "7", "8", "9"], 2, "Kurangi kedua ruas dengan 7: x = 15 − 7 = 8."),
    mc("Penyelesaian dari 3x = 27 adalah ...", ["6", "8", "9", "12"], 2, "Bagi kedua ruas dengan 3 sehingga x = 9."),
    mc("Nilai x yang memenuhi 2x + 5 = 17 adalah ...", ["5", "6", "7", "8"], 1, "2x = 17 − 5 = 12, sehingga x = 6."),
    tf("Persamaan 4x + 2 = 18 memiliki penyelesaian x = 4.", true, "4x = 16 sehingga x = 4."),
    short("Jika 5x = 35, berapakah nilai x?", ["7"], "Kedua ruas dibagi 5, sehingga x = 7."),
  ],
  "matematika-sma-fungsi-kuadrat": [
    mc("Akar-akar persamaan x² − 5x + 6 = 0 adalah ...", ["1 dan 6", "2 dan 3", "−2 dan −3", "−1 dan −6"], 1, "Faktorkan menjadi (x − 2)(x − 3) = 0."),
    mc("Koordinat x titik puncak fungsi y = 2x² − 8x + 3 adalah ...", ["−2", "0", "2", "4"], 2, "x titik puncak = −b/(2a) = 8/4 = 2."),
    mc("Diskriminan persamaan x² + 4x + 4 = 0 adalah ...", ["−4", "0", "4", "16"], 1, "D = b² − 4ac = 16 − 16 = 0."),
    tf("Grafik fungsi y = x² terbuka ke arah atas.", true, "Koefisien x² positif, sehingga parabola terbuka ke atas."),
    short("Jika f(x) = x² − 2x + 1, berapa nilai f(3)?", ["4"], "f(3) = 9 − 6 + 1 = 4."),
  ],
  "bahasa-indonesia-teks-deskripsi": [
    mc("Tujuan utama teks deskripsi adalah ...", ["Menceritakan konflik tokoh", "Menggambarkan objek secara terperinci", "Membujuk pembaca membeli barang", "Menjelaskan langkah percobaan"], 1, "Teks deskripsi membantu pembaca membayangkan objek melalui rincian ciri dan kesan."),
    mc("Kalimat yang paling menunjukkan penggunaan indra penglihatan adalah ...", ["Aroma kopi tercium harum", "Permukaan batu terasa kasar", "Dinding kelas berwarna biru muda", "Suara bel terdengar nyaring"], 2, "Warna biru muda merupakan informasi yang ditangkap oleh indra penglihatan."),
    mc("Bagian yang biasanya diperkenalkan pada awal teks deskripsi adalah ...", ["Identifikasi objek", "Rangkaian konflik", "Koda cerita", "Daftar pustaka"], 0, "Identifikasi memperkenalkan objek yang akan dideskripsikan."),
    tf("Teks deskripsi dapat menggunakan kata sifat untuk memperjelas gambaran objek.", true, "Kata sifat seperti luas, bersih, terang, dan sejuk membantu menggambarkan objek."),
    short("Apa istilah untuk penggambaran objek dengan rincian yang melibatkan pancaindra?", ["deskripsi", "pendeskripsian"], "Deskripsi menyajikan ciri objek secara terperinci agar pembaca dapat membayangkannya."),
  ],
  "bahasa-indonesia-teks-eksplanasi": [
    mc("Struktur teks eksplanasi yang berisi urutan proses terjadinya fenomena disebut ...", ["Pernyataan umum", "Deretan penjelas", "Penutup surat", "Orientasi tokoh"], 1, "Deretan penjelas memaparkan proses dan hubungan sebab-akibat fenomena."),
    mc("Konjungsi yang menunjukkan hubungan sebab adalah ...", ["Kemudian", "Karena", "Sementara", "Akhirnya"], 1, "Kata karena menghubungkan suatu peristiwa dengan penyebabnya."),
    mc("Fenomena yang tepat dijelaskan menggunakan teks eksplanasi adalah ...", ["Cara memakai sepatu", "Proses terjadinya gempa bumi", "Percakapan dua sahabat", "Deskripsi ruang kelas"], 1, "Teks eksplanasi menjelaskan proses atau sebab terjadinya fenomena."),
    tf("Teks eksplanasi umumnya menyampaikan informasi berdasarkan fakta.", true, "Teks eksplanasi menjelaskan fenomena secara informatif dan faktual."),
    short("Apa pola hubungan yang menjelaskan penyebab dan akibat suatu peristiwa?", ["sebab akibat", "kausalitas", "hubungan sebab akibat"], "Hubungan kausalitas menjelaskan keterkaitan sebab dan akibat."),
  ],
  "bahasa-indonesia-sma-cerpen": [
    mc("Gagasan utama yang mendasari sebuah cerpen disebut ...", ["Tema", "Latar", "Sudut pandang", "Amanat"], 0, "Tema merupakan gagasan pokok yang menjadi dasar cerita."),
    mc("Keterangan tempat, waktu, dan suasana dalam cerita termasuk unsur ...", ["Alur", "Latar", "Tokoh", "Konflik"], 1, "Latar menjelaskan tempat, waktu, dan suasana berlangsungnya cerita."),
    mc("Pesan yang ingin disampaikan pengarang melalui cerita disebut ...", ["Dialog", "Amanat", "Eksposisi", "Klimaks"], 1, "Amanat adalah pesan atau nilai yang dapat dipetik dari cerita."),
    tf("Alur maju menyajikan peristiwa secara berurutan dari awal menuju akhir.", true, "Alur maju bergerak mengikuti urutan waktu ke depan."),
    short("Apa istilah untuk orang atau pelaku yang mengalami peristiwa dalam cerpen?", ["tokoh", "karakter"], "Tokoh adalah pelaku yang hadir dan menjalankan peristiwa dalam cerita."),
  ],
  "english-daily-expressions": [
    mc("The best response to “Good morning” is ...", ["Good morning", "Good night", "Goodbye", "See you yesterday"], 0, "“Good morning” is a polite greeting used in the morning."),
    mc("Which expression is used to ask for someone's condition?", ["Where are you from?", "How are you?", "What time is it?", "How old is your bag?"], 1, "“How are you?” asks about someone's condition or well-being."),
    mc("A polite way to ask someone to repeat a sentence is ...", ["Repeat now!", "Could you say that again, please?", "Be quiet!", "I do not care."], 1, "The expression uses could and please to make the request polite."),
    tf("“Thank you” is an expression used to show gratitude.", true, "“Thank you” expresses appreciation or gratitude."),
    short("Complete the expression: “Nice to ... you.”", ["meet"], "The common expression is “Nice to meet you.”"),
  ],
  "english-reading-comprehension": [
    mc("In the sentence “They leave home at 6:30 a.m.”, the word “They” refers to ...", ["Rina and her younger brother", "Rina's teachers", "The first lesson", "Their neighbors"], 0, "The previous sentence mentions Rina and her younger brother."),
    mc("Why does Rina like walking to school?", ["It is expensive", "It keeps her healthy", "She dislikes her brother", "The school is closed"], 1, "The passage directly states that walking keeps Rina healthy."),
    mc("The word “younger” is closest in meaning to ...", ["Older", "Smaller in age", "Taller", "Faster"], 1, "Younger describes someone who is less old."),
    tf("Rina and her brother arrive at school before the first lesson begins.", true, "The passage says they arrive before the first lesson begins."),
    short("What time do Rina and her brother leave home?", ["6:30 a.m.", "6:30 am", "six thirty a.m.", "6.30 am"], "The passage states that they leave home at 6:30 a.m."),
  ],
  "english-sma-grammar-writing": [
    mc("Choose the correct simple past form: “Yesterday, she ... to the library.”", ["go", "goes", "went", "going"], 2, "The past form of “go” is “went”."),
    mc("Which sentence uses the present perfect tense correctly?", ["He has finished his homework.", "He have finish his homework.", "He finishing homework.", "He has finish yesterday."], 0, "Present perfect uses has/have followed by the past participle."),
    mc("Choose the correct passive sentence for “The students clean the room.”", ["The room cleans the students.", "The room is cleaned by the students.", "The room cleaned by students is.", "The students are cleaned by the room."], 1, "Simple present passive uses am/is/are + past participle."),
    tf("A thesis statement presents the main idea or position of an essay.", true, "A thesis statement tells readers the central claim or focus of an essay."),
    short("Complete the conditional sentence: “If it rains, we ... stay at home.”", ["will"], "The first conditional commonly uses if + present simple, followed by will + base verb."),
  ],
  "ipa-kelas-7-klasifikasi": [
    mc("Organisme yang selnya tidak memiliki membran inti digolongkan sebagai ...", ["Eukariotik", "Prokariotik", "Multiseluler", "Autotrof"], 1, "Sel prokariotik tidak memiliki membran inti sejati."),
    mc("Kelompok hewan yang memiliki tulang belakang disebut ...", ["Invertebrata", "Vertebrata", "Mollusca", "Arthropoda"], 1, "Vertebrata adalah hewan yang mempunyai tulang belakang."),
    mc("Urutan takson dari tingkat umum ke khusus yang benar adalah ...", ["Spesies–genus–famili", "Kingdom–filum–kelas", "Genus–kingdom–spesies", "Famili–kingdom–kelas"], 1, "Urutan umum ke khusus dimulai dari kingdom, filum, kelas, ordo, famili, genus, spesies."),
    tf("Kunci determinasi dapat digunakan untuk membantu mengidentifikasi makhluk hidup.", true, "Kunci determinasi menggunakan pilihan ciri untuk mengenali organisme."),
    short("Apa istilah untuk organisme yang dapat membuat makanan sendiri?", ["autotrof", "organisme autotrof"], "Organisme autotrof dapat menyusun bahan organik sendiri, misalnya melalui fotosintesis."),
  ],
  "ipa-kelas-8-tekanan": [
    mc("Gaya 200 N bekerja pada bidang seluas 4 m². Tekanannya adalah ...", ["25 Pa", "50 Pa", "100 Pa", "800 Pa"], 1, "P = F/A = 200/4 = 50 Pa."),
    mc("Alat yang digunakan untuk mengukur tekanan udara adalah ...", ["Termometer", "Barometer", "Higrometer", "Dinamometer"], 1, "Barometer digunakan untuk mengukur tekanan udara."),
    mc("Tekanan hidrostatis pada kedalaman yang sama dalam zat cair sejenis adalah ...", ["Sama besar", "Selalu nol", "Ditentukan warna wadah", "Bergantung bentuk wadah saja"], 0, "Tekanan hidrostatis ditentukan oleh massa jenis, gravitasi, dan kedalaman."),
    tf("Bendungan dibuat lebih tebal pada bagian bawah karena tekanan air bertambah dengan kedalaman.", true, "Bagian bawah bendungan menerima tekanan hidrostatis yang lebih besar."),
    short("Jika gaya 90 N bekerja pada luas 3 m², berapa tekanannya dalam Pa?", ["30", "30 pa"], "P = F/A = 90/3 = 30 Pa."),
  ],
  "biologi-sma-ekosistem": [
    mc("Hubungan antara lebah yang memperoleh nektar dan bunga yang terbantu penyerbukannya disebut ...", ["Parasitisme", "Kompetisi", "Mutualisme", "Predasi"], 2, "Kedua organisme memperoleh keuntungan dalam hubungan mutualisme."),
    mc("Pada piramida energi, tingkat trofik dengan energi terbesar umumnya adalah ...", ["Konsumen puncak", "Konsumen sekunder", "Produsen", "Pengurai saja"], 2, "Produsen berada di dasar piramida dan memiliki energi awal terbesar."),
    mc("Jika populasi predator menurun drastis, populasi mangsa dapat ...", ["Selalu punah", "Meningkat karena tekanan predasi berkurang", "Tidak mungkin berubah", "Langsung menjadi produsen"], 1, "Penurunan predator dapat mengurangi pemangsaan sehingga populasi mangsa berpotensi meningkat."),
    tf("Materi dapat didaur ulang dalam ekosistem melalui peran pengurai.", true, "Pengurai mengembalikan unsur hara dari sisa organisme ke lingkungan."),
    short("Apa istilah untuk seluruh hubungan makan dan dimakan yang saling terhubung dalam ekosistem?", ["jaring jaring makanan", "jaring-jaring makanan"], "Jaring-jaring makanan terdiri atas beberapa rantai makanan yang saling berhubungan."),
  ],
  "fisika-sma-gerak-lurus": [
    mc("Sebuah mobil menempuh 90 km selama 3 jam. Kelajuan rata-ratanya adalah ...", ["20 km/jam", "30 km/jam", "45 km/jam", "60 km/jam"], 1, "Kelajuan rata-rata = 90 km ÷ 3 jam = 30 km/jam."),
    mc("Percepatan merupakan perubahan ... terhadap waktu.", ["Massa", "Kecepatan", "Jarak", "Gaya gesek"], 1, "Percepatan adalah perubahan kecepatan per satuan waktu."),
    mc("Benda mula-mula diam lalu mencapai 20 m/s dalam 5 s. Percepatannya adalah ...", ["2 m/s²", "4 m/s²", "5 m/s²", "10 m/s²"], 1, "a = (20 − 0)/5 = 4 m/s²."),
    tf("Jarak merupakan besaran skalar, sedangkan perpindahan merupakan besaran vektor.", true, "Jarak hanya memiliki besar, sedangkan perpindahan memiliki besar dan arah."),
    short("Benda bergerak dengan kecepatan tetap 8 m/s selama 6 sekon. Berapa jarak yang ditempuh dalam meter?", ["48", "48 m"], "s = v × t = 8 × 6 = 48 meter."),
  ],
  "kimia-sma-struktur-atom": [
    mc("Nomor massa suatu atom merupakan jumlah ...", ["Proton saja", "Elektron saja", "Proton dan neutron", "Neutron dan elektron"], 2, "Nomor massa (A) adalah jumlah proton dan neutron di inti atom."),
    mc("Atom-atom yang memiliki nomor atom sama tetapi nomor massa berbeda disebut ...", ["Ion", "Isotop", "Isobar", "Isoton"], 1, "Isotop memiliki jumlah proton sama dan jumlah neutron berbeda."),
    mc("Konfigurasi elektron sederhana atom natrium (nomor atom 11) adalah ...", ["2, 8, 1", "2, 7, 2", "2, 6, 3", "2, 8, 2"], 0, "Sebelas elektron mengisi kulit dengan susunan 2, 8, 1."),
    tf("Proton memiliki muatan listrik positif.", true, "Proton merupakan partikel subatom bermuatan positif."),
    short("Atom natrium-23 memiliki nomor atom 11. Berapa jumlah neutronnya?", ["12"], "Jumlah neutron = nomor massa − nomor atom = 23 − 11 = 12."),
  ],
  "ips-kelas-7-interaksi-sosial": [
    mc("Meniru gaya berpakaian tokoh yang dikagumi merupakan contoh faktor interaksi sosial berupa ...", ["Imitasi", "Konflik", "Kompetisi", "Akomodasi"], 0, "Imitasi adalah tindakan meniru sikap atau perilaku orang lain."),
    mc("Kerja sama warga membersihkan lingkungan termasuk proses sosial ...", ["Disosiatif", "Asosiatif", "Kontravensi", "Konflik"], 1, "Kerja sama merupakan bentuk proses sosial asosiatif."),
    mc("Usaha meredakan pertentangan agar hubungan kembali stabil disebut ...", ["Kompetisi", "Akomodasi", "Imitasi", "Persaingan"], 1, "Akomodasi merupakan proses penyesuaian untuk menyelesaikan pertentangan."),
    tf("Kontak sosial harus selalu terjadi melalui sentuhan fisik.", false, "Kontak sosial dapat terjadi secara langsung maupun tidak langsung melalui media."),
    short("Apa istilah untuk proses meniru perilaku atau penampilan orang lain?", ["imitasi"], "Imitasi adalah tindakan meniru perilaku, sikap, atau penampilan orang lain."),
  ],
  "sejarah-sma-pergerakan-nasional": [
    mc("Organisasi yang didirikan oleh Soekarno pada tahun 1927 adalah ...", ["Budi Utomo", "Partai Nasional Indonesia", "Indische Partij", "Perhimpunan Indonesia"], 1, "Partai Nasional Indonesia (PNI) didirikan pada 1927 dengan Soekarno sebagai salah satu tokoh utamanya."),
    mc("BPUPKI dibentuk pada masa pendudukan ...", ["Portugis", "Belanda", "Jepang", "Inggris"], 2, "BPUPKI dibentuk pada masa pendudukan Jepang untuk menyelidiki persiapan kemerdekaan."),
    mc("Tokoh yang dikenal sebagai pelopor pendidikan nasional melalui Taman Siswa adalah ...", ["Ki Hajar Dewantara", "Sutan Sjahrir", "Mohammad Hatta", "Tan Malaka"], 0, "Ki Hajar Dewantara mendirikan Perguruan Taman Siswa pada 1922."),
    tf("Sarekat Islam berkembang dari organisasi yang awalnya bernama Sarekat Dagang Islam.", true, "Sarekat Dagang Islam kemudian berkembang menjadi Sarekat Islam."),
    short("Pada tanggal berapa Proklamasi Kemerdekaan Indonesia dibacakan?", ["17 agustus 1945", "17-08-1945", "17/08/1945"], "Proklamasi Kemerdekaan Indonesia dibacakan pada 17 Agustus 1945."),
  ],
  "geografi-sma-atmosfer": [
    mc("Alat untuk mengukur kelembapan udara disebut ...", ["Barometer", "Higrometer", "Anemometer", "Seismograf"], 1, "Higrometer digunakan untuk mengukur kelembapan udara."),
    mc("Awan yang sering berkaitan dengan hujan lebat dan badai petir adalah ...", ["Cirrus", "Cumulonimbus", "Stratus tipis", "Altocumulus saja"], 1, "Awan cumulonimbus berkembang vertikal dan dapat menghasilkan hujan lebat serta petir."),
    mc("Perpindahan panas di atmosfer melalui gerakan massa udara disebut ...", ["Konduksi", "Konveksi", "Radiasi saja", "Sublimasi"], 1, "Konveksi memindahkan panas bersama gerakan fluida seperti udara."),
    tf("Angin bergerak dari daerah bertekanan tinggi menuju daerah bertekanan rendah.", true, "Perbedaan tekanan udara menjadi salah satu penyebab utama pergerakan angin."),
    short("Apa nama alat untuk mengukur kecepatan angin?", ["anemometer"], "Anemometer digunakan untuk mengukur kecepatan angin."),
  ],
  "ppkn-pancasila-norma": [
    mc("Lambang sila kelima Pancasila adalah ...", ["Bintang", "Rantai", "Padi dan kapas", "Pohon beringin"], 2, "Padi dan kapas melambangkan keadilan sosial bagi seluruh rakyat Indonesia."),
    mc("Norma yang dibuat oleh lembaga berwenang dan memiliki sanksi tegas disebut norma ...", ["Kesopanan", "Kesusilaan", "Hukum", "Kebiasaan"], 2, "Norma hukum ditetapkan oleh lembaga berwenang dan memiliki sanksi yang dapat dipaksakan."),
    mc("Mengutamakan kepentingan bersama melalui musyawarah mencerminkan sila ...", ["Pertama", "Kedua", "Keempat", "Kelima"], 2, "Sila keempat menekankan permusyawaratan dan perwakilan."),
    tf("Menghormati hak orang lain merupakan salah satu sikap yang mendukung keadilan sosial.", true, "Menghormati hak orang lain sejalan dengan nilai keadilan dan tanggung jawab sosial."),
    short("Apa lambang sila pertama Pancasila?", ["bintang"], "Sila pertama Pancasila dilambangkan dengan bintang."),
  ],
  "informatika-algoritma-dasar": [
    mc("Simbol oval pada flowchart umumnya menunjukkan ...", ["Proses", "Input/output", "Mulai atau selesai", "Keputusan"], 2, "Simbol terminator berbentuk oval menandai awal atau akhir alur."),
    mc("Simbol persegi panjang pada flowchart biasanya menunjukkan ...", ["Proses", "Keputusan", "Dokumen", "Konektor"], 0, "Persegi panjang menggambarkan langkah pemrosesan."),
    mc("Pseudocode digunakan untuk ...", ["Menggambar perangkat keras", "Menuliskan langkah algoritma dengan bahasa sederhana", "Mengganti sistem operasi", "Mengukur kecepatan internet"], 1, "Pseudocode menuliskan logika algoritma tanpa terikat sintaks bahasa pemrograman tertentu."),
    tf("Percabangan if dapat digunakan untuk menjalankan tindakan berdasarkan kondisi.", true, "Pernyataan if memilih tindakan ketika kondisi bernilai benar."),
    short("Apa istilah untuk representasi visual alur langkah suatu algoritma?", ["flowchart", "diagram alir"], "Flowchart atau diagram alir menampilkan langkah algoritma menggunakan simbol dan panah."),
  ],
  "informatika-sma-pemrograman": [
    mc("Dalam JavaScript, operator yang umum digunakan untuk membandingkan nilai sekaligus tipe data adalah ...", ["=", "==", "===", "+="], 2, "Operator === melakukan perbandingan ketat tanpa konversi tipe otomatis."),
    mc("Struktur data yang menyimpan beberapa nilai dalam satu variabel berurutan disebut ...", ["Array", "Boolean", "Komentar", "Operator"], 0, "Array menyimpan kumpulan elemen dalam satu struktur berindeks."),
    mc("Blok kode yang dapat dipanggil untuk menjalankan tugas tertentu disebut ...", ["Fungsi", "Konstanta", "Sintaks", "Literal"], 0, "Fungsi mengelompokkan instruksi agar dapat dipanggil saat diperlukan."),
    tf("Perulangan while memeriksa kondisi sebelum menjalankan setiap iterasi.", true, "Pada while, kondisi dievaluasi sebelum badan perulangan dijalankan."),
    short("Apa kata kunci JavaScript yang digunakan untuk mendeklarasikan variabel dengan nilai yang dapat berubah?", ["let"], "Kata kunci let digunakan untuk mendeklarasikan variabel yang dapat diisi ulang."),
  ],
  "ekonomi-sma-permintaan-penawaran": [
    mc("Perubahan jumlah barang yang diminta akibat perubahan harga barang itu sendiri disebut ...", ["Pergeseran kurva permintaan", "Gerakan sepanjang kurva permintaan", "Pergeseran kurva penawaran", "Keseimbangan baru tanpa sebab"], 1, "Perubahan harga barang itu sendiri menyebabkan gerakan sepanjang kurva permintaan."),
    mc("Faktor yang dapat meningkatkan penawaran adalah ...", ["Biaya produksi meningkat", "Teknologi produksi membaik", "Pajak produksi bertambah", "Jumlah produsen berkurang"], 1, "Teknologi yang lebih baik dapat membuat produksi lebih efisien dan meningkatkan penawaran."),
    mc("Keadaan ketika kebutuhan manusia lebih besar daripada alat pemuas yang tersedia disebut ...", ["Surplus", "Kelangkaan", "Keseimbangan", "Distribusi"], 1, "Kelangkaan terjadi karena sumber daya terbatas sementara kebutuhan tidak terbatas."),
    tf("Kurva permintaan barang normal umumnya memiliki kemiringan negatif.", true, "Dengan faktor lain tetap, kenaikan harga biasanya menurunkan jumlah yang diminta."),
    short("Apa istilah untuk harga ketika jumlah yang diminta sama dengan jumlah yang ditawarkan?", ["harga keseimbangan", "harga ekuilibrium", "keseimbangan pasar"], "Harga keseimbangan terjadi pada titik pertemuan permintaan dan penawaran."),
  ],
  "agama-akhlak-terpuji": [
    mc("Membantu teman yang mengalami kesulitan tanpa mengharapkan imbalan menunjukkan sikap ...", ["Tolong-menolong", "Sombong", "Iri hati", "Boros"], 0, "Tolong-menolong merupakan perilaku peduli terhadap kebutuhan orang lain."),
    mc("Sikap rendah hati dan tidak merasa lebih baik daripada orang lain disebut ...", ["Takabur", "Tawadhu", "Riya", "Hasad"], 1, "Tawadhu berarti rendah hati dan tidak menyombongkan diri."),
    mc("Ketika menghadapi kesulitan, tetap berusaha dan tidak mudah menyerah menunjukkan sikap ...", ["Putus asa", "Sabar", "Dengki", "Angkuh"], 1, "Sabar berarti tabah dan tetap berbuat baik ketika menghadapi ujian."),
    tf("Meminta maaf dan memperbaiki kesalahan merupakan bentuk tanggung jawab.", true, "Mengakui kesalahan dan memperbaikinya menunjukkan tanggung jawab atas tindakan."),
    short("Apa istilah untuk sikap rendah hati dalam akhlak terpuji?", ["tawadhu", "tawaduk"], "Tawadhu adalah sikap rendah hati dan tidak menyombongkan diri."),
  ],
  "smk-keselamatan-kerja": [
    mc("Alat pemadam api ringan dikenal dengan singkatan ...", ["APAR", "APD", "P3K", "SOP"], 0, "APAR adalah Alat Pemadam Api Ringan untuk penanganan awal kebakaran kecil."),
    mc("Saat alarm evakuasi berbunyi, pekerja harus ...", ["Menggunakan lift barang", "Menuju jalur evakuasi dengan tertib", "Kembali mengambil semua barang", "Bersembunyi di ruang terkunci"], 1, "Ikuti jalur evakuasi dan instruksi petugas tanpa berdesakan."),
    mc("Tujuan utama penerapan ergonomi di tempat kerja adalah ...", ["Mempercepat pekerjaan dengan cara apa pun", "Menyesuaikan pekerjaan dan alat dengan kemampuan manusia", "Menghilangkan seluruh waktu istirahat", "Mengurangi pencahayaan"], 1, "Ergonomi membantu mengurangi risiko cedera dan meningkatkan kenyamanan kerja."),
    tf("Mesin harus dimatikan dan diisolasi sumber energinya sebelum perawatan yang berisiko.", true, "Isolasi energi atau prosedur lockout/tagout mencegah mesin aktif secara tidak sengaja."),
    short("Apa kepanjangan APAR?", ["alat pemadam api ringan"], "APAR adalah singkatan dari Alat Pemadam Api Ringan."),
  ],
};

export function getBuiltinTemplateQuestions(slug: string): Question[] {
  const bank = [...(BANKS[slug] ?? []), ...(EXTRA_BANKS[slug] ?? [])];
  if (!bank.length) return [];
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
  multiple_choice: 6,
  true_false: 2,
  short_answer: 2,
};
