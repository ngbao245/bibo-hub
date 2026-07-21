// ============================================================
// push-artifacts.ts — Push SQL migrations from backup/ into artifacts table
// ============================================================
// Usage:
//   tsx --env-file=.env.migration.local scripts/push-artifacts.ts
//
// Reads all .sql files from backup/supabase/migrations/
// and INSERTs them into the artifacts table on Core Supabase project.
// Skips if already exists (ON CONFLICT DO NOTHING via unique constraint).
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';

// ─── Config ─────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_AUTH_URL ?? process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_AUTH_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}

console.log(`Connecting to: ${SUPABASE_URL}`);
console.log(`Using key: ${SUPABASE_KEY.slice(0, 20)}...`);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Paths ──────────────────────────────────────────────────

const MIGRATIONS_DIR = join(import.meta.dirname ?? __dirname, '..', 'backup', 'supabase', 'migrations');

// ─── Mapping: which datasource does each migration belong to ─

// Most migrations are for the "core" project.
// Override specific files to other datasources if needed.
const DATASOURCE_OVERRIDES: Record<string, string> = {
  // Example: '20260701000000_books_schema.sql': 'library',
};

function getDatasourceCode(filename: string): string {
  return DATASOURCE_OVERRIDES[filename] ?? 'core';
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  console.log(`Reading migrations from: ${MIGRATIONS_DIR}`);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files`);

  let inserted = 0;
  let skipped = 0;

  for (const file of files) {
    const filePath = join(MIGRATIONS_DIR, file);
    const content = readFileSync(filePath, 'utf-8');
    // Strip timestamp prefix: "20260714000000_service_registry" → "service_registry"
    const rawName = basename(file, '.sql');
    const name = rawName.replace(/^\d+_/, '');
    const datasourceCode = getDatasourceCode(file);
    const contentHash = createHash('sha256').update(content).digest('hex');

    const { error } = await supabase.from('artifacts').insert({
      datasource_code: datasourceCode,
      kind: 'migration',
      name,
      path: `migrations/${file}`,
      version: 1,
      content,
      content_hash: contentHash,
      metadata_json: { order: files.indexOf(file) + 1 },
      status: 'latest',
      created_by: 'push-artifacts-script',
    });

    if (error) {
      if (error.code === '23505') {
        // Unique violation = already exists
        skipped++;
        console.log(`  [skip] ${name} (already exists)`);
      } else {
        console.error(`  [error] ${name}: ${error.message} (code: ${error.code})`);
      }
    } else {
      inserted++;
      console.log(`  [ok] ${name} → ${datasourceCode}`);
    }
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} skipped`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});