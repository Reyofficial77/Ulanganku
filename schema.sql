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
