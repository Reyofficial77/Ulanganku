import { sql } from '@vercel/postgres';
export async function ensureDb(){await sql`CREATE TABLE IF NOT EXISTS exams (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL, duration INTEGER NOT NULL DEFAULT 45, questions JSONB NOT NULL DEFAULT '[]', owner_email TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;}
