-- Opsional: semua tabel dibuat/dimigrasi otomatis oleh API saat request pertama.
-- File ini hanya dokumentasi / untuk dijalankan manual di Neon SQL Editor.
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    picture TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    class_name TEXT NOT NULL DEFAULT '',
    duration_min INT NOT NULL DEFAULT 45,
    shuffle BOOLEAN NOT NULL DEFAULT false,
    show_score BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'draft',
    slug TEXT UNIQUE,
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ
  );
CREATE INDEX IF NOT EXISTS exams_owner_idx ON exams (owner_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    device_id TEXT NOT NULL,
    ip_masked TEXT,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    score NUMERIC,
    correct INT,
    total INT,
    status TEXT NOT NULL DEFAULT 'working',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    submitted_at TIMESTAMPTZ,
    last_activity TIMESTAMPTZ NOT NULL DEFAULT now()
  );
ALTER TABLE exams ADD COLUMN IF NOT EXISTS allow_retake BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS max_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS attempt INT NOT NULL DEFAULT 1;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS grades JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS pending INT NOT NULL DEFAULT 0;
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_exam_id_device_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS submissions_attempt_idx ON submissions (exam_id, device_id, attempt);
CREATE INDEX IF NOT EXISTS submissions_exam_idx ON submissions (exam_id, last_activity DESC);
CREATE TABLE IF NOT EXISTS images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mime TEXT NOT NULL,
    data TEXT NOT NULL,
    size INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
CREATE INDEX IF NOT EXISTS images_owner_idx ON images (owner_id);

-- PRO: whitelist akses fitur PRO, diisi oleh admin (ulanganku-admin.vercel.app).
-- Dibuat juga otomatis oleh API saat request pertama.
CREATE TABLE IF NOT EXISTS pro_access (
    email TEXT PRIMARY KEY,                -- disimpan lowercase
    name TEXT NOT NULL DEFAULT '',
    expires_on DATE NOT NULL,              -- tanggal terakhir akses PRO masih aktif
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PRO: pesanan upgrade dan riwayat promo uji coba.
CREATE TABLE IF NOT EXISTS pro_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',   -- pending | waiting_payment | done | cancelled
    payment_method TEXT,                       -- DANA | GoPay
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pro_orders_user_idx ON pro_orders (user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS pro_trials (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    device_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PRO: tampilan ulangan (warna aksen, nama & logo sekolah) dan banner per ulangan.
CREATE TABLE IF NOT EXISTS pro_branding (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    accent TEXT,                              -- contoh #1b78c8
    school_name TEXT NOT NULL DEFAULT '',
    logo_url TEXT,                            -- /api/img/<id>
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE exams ADD COLUMN IF NOT EXISTS banner_url TEXT;
-- Template system
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT UNIQUE,
    description TEXT,
    subject TEXT NOT NULL,
    grade TEXT NOT NULL,
    category TEXT NOT NULL,
    default_question_types JSONB NOT NULL DEFAULT '{}'::jsonb,
    default_question_count INT NOT NULL DEFAULT 10,
    default_duration INT NOT NULL DEFAULT 45,
    difficulty TEXT NOT NULL DEFAULT 'sedang',
    instructions TEXT,
    visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private')),
    status TEXT NOT NULL CHECK (status IN ('draft', 'published')) DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS templates_owner_idx ON templates (owner_id);
CREATE INDEX IF NOT EXISTS templates_slug_idx ON templates (slug);
CREATE INDEX IF NOT EXISTS templates_visibility_idx ON templates (visibility);
-- Insert 20 built-in templates
INSERT INTO templates (id, owner_id, title, slug, description, subject, grade, category, default_question_types, default_question_count, default_duration, difficulty, instructions, visibility, status) VALUES
('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'Matematika Kelas 7 - Bangun Datar', 'matematika-kelas-7-bangun-datar', 'Template ulangan matematika untuk bangun datar luas dan keliling', 'Matematika', '7', 'Matematika', '{\"multiple_choice\": 10, \"short_answer\": 5}', 15, 40, 'sedang', 'Buat soal yang menghitung luas dan keliling persegi, persegi panjang, segitiga, dan lingkaran.', 'public', 'published'),
('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'IPA Kelas 8 - Sistem Pernapasan', 'ipa-kelas-8-sistem-pernapasan', 'Template ulangan IPA tentang sistem pernapasan manusia', 'IPA', '8', 'IPA', '{\"multiple_choice\": 12, \"true_false\": 6, \"short_answer\": 2}', 20, 45, 'sedang', 'Buat soal tentang organ pernapasan, proses inhalasi dan ekhalasi, dan gangguan pernapasan.', 'public', 'published'),
('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'Bahasa Indonesia Kelas 9 - Puisi', 'bahasa-indonesia-kelas-9-puisi', 'Template ulangan Bahasa Indonesia tentang puisi dan sastra', 'Bahasa Indonesia', '9', 'Bahasa', '{\"multiple_choice\": 8, \"essay\": 4}', 12, 50, 'sedang', 'Analisis unsur intrinsik dan extrinsik puisi, serta makna sosialnya.', 'public', 'published'),
('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'Sejarah Kelas 10 - Proklamasi Kemerdekaan', 'sejarah-kelas-10-proklamasi', 'Template ulangan sejarah tentang proklamasi kemerdekaan RI', 'Sejarah', '10', 'Sejarah', '{\"multiple_choice\": 10, \"short_answer\": 5, \"essay\": 3}', 18, 50, 'sulit', 'Termasuk lantasan sejarah, teks proklamasi, dan dampaknya bagi bangsa.', 'public', 'published'),
('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'Matematika Kelas 8 - Persamaan Linear', 'matematika-kelas-8-persamaan-linear', 'Template ulangan matematika persamaan linear satu variabel', 'Matematika', '8', 'Matematika', '{\"multiple_choice\": 15, \"short_answer\": 5}', 20, 40, 'sedang', 'Mencakup penyelesaian persamaan linear, grafik, dan aplikasi dalam masalah kehidupan sehari-hari.', 'public', 'published'),
('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'Fisika Kelas 11 - Gerak Lurus Beraturan', 'fisika-kelas-11-gerak-lurus-beraturan', 'Template ulangan fisika tentang gerak lurus beraturan', 'Fisika', '11', 'Fisika', '{\"multiple_choice\": 10, \"short_answer\": 8, \"numerical_answer\": 2}', 20, 45, 'sedang', 'Gunakan rumus v = s/t, dan konversi satuan. Berikan konteks soal berupa perjalanan kendaraan.', 'public', 'published'),
('77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000', 'Kimia Kelas 10 - Tabel Periodik', 'kimia-kelas-10-tabel-periodik', 'Template ulangan kimia عن الجدول الدوري ومجموعات العناصر', 'كيمياء', '10', 'كيمياء', '{\"multiple_choice\": 12, \"true_false\": 6, \"short_answer\": 2}', 20, 40, 'sedang', 'تحديد المجموعات والفترات والخصائص الكيميائية الأساسية للعناصر المحددة.', 'public', 'published'),
('88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000', 'Biologi Kelas 9 - Sistema Pencernaan', 'biologi-kelas-9-sistema-pencernaan', 'Plantilla de examen de biología sobre el sistema digestivo humano', 'Biología', '9', 'Biología', '{\"multiple_choice\": 10, \"short_answer\": 6, \"essay\": 4}', 20, 50, 'sedang', 'Incluye órganos digestivos, enzimas y procesos metabólicos de carbohidratos, proteínas y lípidos.', 'public', 'published'),
('99999999-9999-9999-9999-999999999999', '00000000-0000-0000-0000-000000000000', 'Geografi Kelas 8 - Litosfer', 'geografi-kelas-8-litosfer', 'Plantilla de examen de geografía sobre la litosfera y los accidentes geográficos de Indonesia', 'Geografía', '8', 'Geografía', '{\"multiple_choice\": 10, \"short_answer\": 5, \"essay\": 3}', 18, 45, 'sedang', 'Incluye diversas formas de tierra, mar y fósiles como evidencia de cambios en la litosfera.', 'public', 'published'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'PKN Kelas 7 - Pancasila', 'pkn-kelas-7-pancasila', 'Plantilla de examen de Educación para la Ciudadanía sobre los valores de Pancasila', 'PKN', '7', 'PKN', '{\"multiple_choice\": 15, \"true_false\": 5}', 20, 35, 'mudah', 'Aplicar los valores de Pancasila en la vida cotidiana como ciudadano y miembro del estado.', 'public', 'published'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'Bahasa Inggris Kelas 8 - Simple Present Tense', 'bahasa-inggris-kelas-8-simple-present', 'Plantilla de examen de inglés sobre el presente simple', 'Inglés', '8', 'Inglés', '{\"multiple_choice\": 10, \"short_answer\": 8, \"essay\": 2}', 20, 40, 'sedang', 'Incluye formas positivas, negativas e interrogativas. Proporcionar contexto de actividades diarias.', 'public', 'published'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', 'Teknik Komputer Kelas 10 - Algoritma y Programación', 'teknik-komputer-kelas-10-algoritmo', 'Plantilla de examen de informática sobre algoritmos básicos y programación', 'Informática', '10', 'Informática', '{\"multiple_choice\": 12, \"short_answer\": 6, \"essay\": 2}', 20, 50, 'sedang', 'Algoritmos de secuencia, selección e iteración, y su aplicación en lenguajes de programación simples.', 'public', 'published'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000000', 'Ekonomi Kelas 11 - Permukaan dan Penawaran', 'ekonomi-kelas-11-permukaan-penawaran', 'Plantilla de examen de economía sobre la ley de oferta y demanda', 'Economía', '11', 'Economía', '{\"multiple_choice\": 10, \"short_answer\": 8, \"essay\": 2}', 20, 45, 'sedang', 'Gráficos de oferta y demanda, equilibrio de mercado y factores que influyen en ellos.', 'public', 'published'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000000', 'Sosiologi Kelas 10 - Struktur Sosial', 'sosiologi-kelas-10-struktur-sosial', 'Plantilla de examen de sociología sobre estructura social e instituciones', 'Sociología', '10', 'Sociología', '{\"multiple_choice\": 10, \"short_answer\": 6, \"essay\": 4}', 20, 50, 'sedang', 'Incluye estructura social, roles sociales e interacción entre individuos.', 'public', 'published'),
('ffffffff-ffff-ffff-ffff-ffffffffffff', '00000000-0000-0000-0000-000000000000', 'Matematika Kelas 6 - Pecahan', 'matematika-kelas-6-pecahan', 'Plantilla de examen de matemáticas para operaciones básicas con fracciones', 'Matemáticas', '6', 'Matemáticas', '{\"multiple_choice\": 12, \"short_answer\": 8}', 20, 35, 'mudah', 'Suma, resta, multiplicación y división de fracciones con números enteros y otras fracciones.', 'public', 'published'),
('10101010-1010-1010-1010-101010101010', '00000000-0000-0000-0000-000000000000', 'Matematika Kelas 5 - Volume Balok', 'matematika-kelas-5-volume-balok', 'Plantilla de examen de matemáticas sobre el volumen de prismas rectangulares y cubos', 'Matemáticas', '5', 'Matemáticas', '{\"multiple_choice\": 10, \"short_answer\": 5}', 15, 30, 'mudah', 'Calcular el volumen de prismas rectangulares y cubos, así como convertir unidades de cm³ a litros.', 'public', 'published'),
('20202020-2020-2020-2020-202020202020', '00000000-0000-0000-0000-000000000000', 'Matematika Kelas 9 - Persamaan Kuadrat', 'matematika-kelas-9-persamaan-kuadrat', 'Plantilla de examen de matemáticas sobre ecuaciones cuadráticas y factorización', 'Matemáticas', '9', 'Matemáticas', '{\"multiple_choice\": 12, \"short_answer\": 6}', 18, 40, 'sedang', 'Resolver ecuaciones cuadráticas mediante factorización, completar el cuadrado y la fórmula cuadrática.', 'public', 'published'),
('30303030-3030-3030-3030-303030303030', '00000000-0000-0000-0000-000000000000', 'Matematika Kelas 10 - Trigonometri Dasar', 'matematika-kelas-10-trigonometri-dasar', 'Plantilla de examen de matemáticas sobre seno, coseno y tangente en triángulos rectángulos', 'Matemáticas', '10', 'Matemáticas', '{\"multiple_choice\": 10, \"short_answer\": 8}', 18, 40, 'sedang', 'Utilizar las razones trigonométricas para encontrar la longitud de los lados y el tamaño de los ángulos en triángulos rectángulos.', 'public', 'published'),
('40404040-4040-4040-4040-404040404040', '00000000-0000-0000-0000-000000000000', 'Matematika Kelas 11 - Turunan Fungsi Aljabar', 'matematika-kelas-11-turunan-fungsi', 'Plantilla de examen de matemáticas sobre la derivada de funciones algebraicas básicas', 'Matemáticas', '11', 'Matemáticas', '{\"multiple_choice\": 12, \"short_answer\": 6}', 18, 40, 'sedang', 'Derivada de funciones polinómicas, racionales y radicales utilizando las reglas básicas de diferenciación.', 'public', 'published'),
('50505050-5050-5050-5050-505050505050', '00000000-0000-0000-0000-000000000000', 'Matematika Kelas 12 - Integral Tak Tentu', 'matematika-kelas-12-integral-tak-tentu', 'Plantilla de examen de matemáticas sobre la integral indefinida de funciones algebraicas', 'Matemáticas', '12', 'Matemáticas', '{\"multiple_choice\": 10, \"short_answer\": 8}', 18, 40, 'sedang', 'Integral de funciones polinómicas, racionales y radicales utilizando técnicas de sustitución e integración por partes.', 'public', 'published')
ON CONFLICT (id) DO NOTHING;
