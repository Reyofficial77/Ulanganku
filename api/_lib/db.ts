import { BUILTIN_TEMPLATES } from "./template-seeds.js";
import { neon } from "@neondatabase/serverless";

type Row = Record<string, any>;

let client: ReturnType<typeof neon> | null = null;
let ready: Promise<void> | null = null;

function getClient() {
  if (client) return client;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL belum diatur di environment variables.");
  client = neon(url);
  return client;
}

/** Jalankan query dengan placeholder $1, $2, ... */
export async function q<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema();
  return (await getClient().query(text, params)) as unknown as T[];
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    picture TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS exams (
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
  )`,
  `CREATE INDEX IF NOT EXISTS exams_owner_idx ON exams (owner_id, updated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS submissions (
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
  )`,
  `ALTER TABLE exams ADD COLUMN IF NOT EXISTS allow_retake BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE exams ADD COLUMN IF NOT EXISTS max_attempts INT NOT NULL DEFAULT 0`,
  `ALTER TABLE submissions ADD COLUMN IF NOT EXISTS attempt INT NOT NULL DEFAULT 1`,
  `ALTER TABLE submissions ADD COLUMN IF NOT EXISTS grades JSONB NOT NULL DEFAULT '{}'::jsonb`,
  `ALTER TABLE submissions ADD COLUMN IF NOT EXISTS pending INT NOT NULL DEFAULT 0`,
  `ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_exam_id_device_id_key`,
  `CREATE UNIQUE INDEX IF NOT EXISTS submissions_attempt_idx ON submissions (exam_id, device_id, attempt)`,
  `CREATE TABLE IF NOT EXISTS login_codes (
    code_hash TEXT PRIMARY KEY,
    nonce_hash TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS submissions_exam_idx ON submissions (exam_id, last_activity DESC)`,
  `CREATE TABLE IF NOT EXISTS images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mime TEXT NOT NULL,
    data TEXT NOT NULL,
    size INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS images_owner_idx ON images (owner_id)`,
  `CREATE TABLE IF NOT EXISTS pro_access (
    email TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    expires_on DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS pro_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_method TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS pro_orders_user_idx ON pro_orders (user_id, status, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS pro_trials (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    device_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS pro_branding (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    accent TEXT,
    school_name TEXT NOT NULL DEFAULT '',
    logo_url TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE exams ADD COLUMN IF NOT EXISTS banner_url TEXT`,
  `ALTER TABLE exams ADD COLUMN IF NOT EXISTS instructions TEXT NOT NULL DEFAULT ''`,
  `CREATE TABLE IF NOT EXISTS templates (
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
  )`,
  `CREATE INDEX IF NOT EXISTS templates_owner_idx ON templates (owner_id, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS templates_public_idx ON templates (subject, grade_level, status, visibility)`,
  `CREATE TABLE IF NOT EXISTS ai_generation_jobs (
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
  )`,
  `CREATE INDEX IF NOT EXISTS ai_generation_owner_idx ON ai_generation_jobs (owner_id, created_at DESC)`,
];

// Naikkan angka ini setiap kali SCHEMA di atas berubah.
const SCHEMA_VERSION = 8;

async function schemaIsCurrent(c: ReturnType<typeof neon>) {
  try {
    const rows = (await c.query("SELECT version FROM schema_meta WHERE id = 1", [])) as unknown as Row[];
    return Boolean(rows[0] && Number(rows[0].version) >= SCHEMA_VERSION);
  } catch {
    return false; // schema_meta belum ada
  }
}

async function migrate(c: ReturnType<typeof neon>) {
  for (const statement of SCHEMA) await c.query(statement, []);
  // Seed semua template dalam satu statement agar cold-start migrasi tidak menjalankan puluhan request DB.
  const seedRows = BUILTIN_TEMPLATES.map((item) => ({
    name: item.name, slug: item.slug, description: item.description, subject: item.subject,
    grade_level: item.gradeLevel, category: item.category, question_config: item.questionConfig,
    question_count: item.questionCount, duration_min: item.durationMin, difficulty: item.difficulty,
    instructions: item.instructions,
  }));
  await c.query(
    `INSERT INTO templates
      (owner_id, name, slug, description, subject, grade_level, category, question_config, question_count, duration_min, difficulty, instructions, reusable_questions, visibility, status, is_builtin)
     SELECT NULL, seed.name, seed.slug, seed.description, seed.subject, seed.grade_level, seed.category, seed.question_config,
       seed.question_count, seed.duration_min, seed.difficulty, seed.instructions, '[]'::jsonb, 'public', 'published', true
     FROM jsonb_to_recordset($1::jsonb) AS seed(
       name text, slug text, description text, subject text, grade_level text, category text, question_config jsonb,
       question_count integer, duration_min integer, difficulty text, instructions text
     )
     ON CONFLICT (slug) DO NOTHING`,
    [JSON.stringify(seedRows)],
  );
  await c.query("CREATE TABLE IF NOT EXISTS schema_meta (id INT PRIMARY KEY, version INT NOT NULL)", []);
  await c.query(
    "INSERT INTO schema_meta (id, version) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version",
    [SCHEMA_VERSION],
  );
}

export function ensureSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const c = getClient();
      // Jalur cepat (hampir selalu): cukup 1 query untuk memastikan skema sudah terbaru.
      if (await schemaIsCurrent(c)) return;
      // Pada database baru, beberapa request pertama bisa menjalankan migrasi bersamaan dan
      // saling bentrok (CREATE TABLE IF NOT EXISTS tidak sepenuhnya aman dari race). Coba ulang
      // beberapa kali; percobaan berikutnya biasanya sudah mendapati skema selesai dibuat.
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await migrate(c);
          return;
        } catch (error) {
          lastError = error;
          await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
          if (await schemaIsCurrent(c)) return;
        }
      }
      throw lastError;
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}
