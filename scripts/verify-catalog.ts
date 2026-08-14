/**
 * Reproducibility check for the Fase 1 acceptance criterion "re-running the
 * pipeline from scratch reproduces the same catalog.db".
 *
 * Builds to a scratch path (never touching the committed asset) and compares
 * the result against assets/catalog.db by content — row counts and a hash
 * over every table — rather than raw bytes. Byte-identity is a stronger
 * claim than the criterion needs and breaks on things that don't matter: a
 * better-sqlite3 upgrade changes the SQLite library version stamped in the
 * file header even when every row is identical.
 *
 * Usage:
 *   npx tsx scripts/verify-catalog.ts
 */
import Database from 'better-sqlite3';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { REPO_ROOT } from './dataset';

function contentHash(db: Database.Database): string {
  const tables = (
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string }[]
  ).map((t) => t.name);

  const parts: string[] = [];
  for (const table of tables) {
    const cols = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[])
      .map((c) => c.name)
      .sort();
    const rows = db.prepare(`SELECT ${cols.join(', ')} FROM ${table} ORDER BY ${cols[0]}`).all();
    parts.push(`${table}:${JSON.stringify(rows)}`);
  }
  return parts.join('\n');
}

async function main() {
  const scratchDir = mkdtempSync(path.join(tmpdir(), 'wivifit-catalog-'));
  const scratchDb = path.join(scratchDir, 'catalog.db');

  try {
    console.log('Building scratch catalog...');
    execFileSync('npx', ['tsx', 'scripts/build-catalog.ts', '--out', scratchDb], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      // npx resolves to npx.cmd on Windows — execFileSync needs the shell to
      // find it rather than exec'ing "npx" as a literal binary name.
      shell: true,
    });

    const committedPath = path.join(REPO_ROOT, 'assets', 'catalog.db');
    const committed = new Database(committedPath, { readonly: true });
    const scratch = new Database(scratchDb, { readonly: true });

    const committedHash = contentHash(committed);
    const scratchHash = contentHash(scratch);
    committed.close();
    scratch.close();

    if (committedHash !== scratchHash) {
      console.error(
        'assets/catalog.db does NOT match what the pipeline produces right now.\n' +
          'Either the committed file is stale (run npm run build:catalog and commit the result), ' +
          'or something changed non-deterministically.',
      );
      process.exit(1);
    }
    console.log('assets/catalog.db matches a from-scratch rebuild.');
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
