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

-- Upgrade: petunjuk pengerjaan, template guru, dan job generasi AI berbasis batch.
ALTER TABLE exams ADD COLUMN IF NOT EXISTS instructions TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL,
    grade_level TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'ulangan',
    question_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    question_count INT NOT NULL DEFAULT 10 CHECK (question_count BETWEEN 1 AND 200),
    duration_min INT NOT NULL DEFAULT 45 CHECK (duration_min BETWEEN 1 AND 600),
    difficulty TEXT NOT NULL DEFAULT 'Menengah',
    instructions TEXT NOT NULL DEFAULT '',
    reusable_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    is_builtin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS templates_owner_idx ON templates (owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS templates_public_idx ON templates (subject, grade_level, status, visibility);

CREATE TABLE IF NOT EXISTS ai_generation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    target_count INT NOT NULL CHECK (target_count BETWEEN 1 AND 200),
    generated_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    model TEXT NOT NULL,
    instructions TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT 'Ulangan dari AI',
    class_name TEXT NOT NULL DEFAULT '',
    duration_min INT NOT NULL DEFAULT 45,
    exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'complete', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_generation_owner_idx ON ai_generation_jobs (owner_id, created_at DESC);

-- API akan mengisi template bawaan (24 template) dan mengelola schema_meta otomatis.
