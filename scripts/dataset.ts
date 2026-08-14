import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const REPO_ROOT = path.resolve(__dirname, '..');
export const CACHE_DIR = path.join(REPO_ROOT, '.cache', 'exercises-dataset');
export const DATASET_BASE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main';

const LOCK_PATH = path.join(REPO_ROOT, 'data', 'dataset.lock.json');

export interface DatasetLanguageMap {
  [locale: string]: string;
}
export interface DatasetLanguageStepsMap {
  [locale: string]: string[];
}
export interface DatasetExercise {
  id: string;
  name: string;
  category: string;
  body_part: string;
  equipment: string;
  instructions: DatasetLanguageMap;
  instruction_steps: DatasetLanguageStepsMap;
  muscle_group: string;
  secondary_muscles: string[];
  target: string;
  media_id: string;
  image: string;
  gif_url: string;
  attribution: string;
  created_at: string;
}

interface DatasetLock {
  exercisesSha256: string;
  schemaSha256: string;
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf-8').digest('hex');
}

async function downloadText(url: string, cachePath: string, fresh: boolean): Promise<string> {
  if (!fresh && existsSync(cachePath)) {
    return readFileSync(cachePath, 'utf-8');
  }
  console.log(`Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  mkdirSync(path.dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, text, 'utf-8');
  return text;
}

/**
 * Content-hashes the dataset against data/dataset.lock.json, which is what
 * makes "re-running the pipeline from scratch reproduces the same
 * catalog.db" (build-catalog.ts's own docstring) actually checkable rather
 * than assumed: DATASET_BASE points at `main`, an unpinned branch HEAD, and
 * .cache/ is gitignored — without this, a build on a machine with an empty
 * cache silently gets whatever upstream currently has, which may no longer
 * match the committed assets/catalog.db.
 *
 * First run (no lock file yet) writes it. After that, a hash mismatch throws
 * unless `--accept-dataset-change` is passed, in which case the lock is
 * updated — the same "propose, then a human approves" shape as
 * data/overrides.json and data/name-overrides.json.
 */
function checkDatasetLock(schemaText: string, dataText: string): void {
  const hashes: DatasetLock = {
    schemaSha256: sha256(schemaText),
    exercisesSha256: sha256(dataText),
  };
  const acceptChange = process.argv.includes('--accept-dataset-change');

  if (!existsSync(LOCK_PATH)) {
    mkdirSync(path.dirname(LOCK_PATH), { recursive: true });
    writeFileSync(LOCK_PATH, JSON.stringify(hashes, null, 2) + '\n', 'utf-8');
    console.log(`Wrote ${LOCK_PATH}`);
    return;
  }

  const lock = JSON.parse(readFileSync(LOCK_PATH, 'utf-8')) as DatasetLock;
  const changed =
    lock.exercisesSha256 !== hashes.exercisesSha256 || lock.schemaSha256 !== hashes.schemaSha256;
  if (!changed) return;

  if (!acceptChange) {
    throw new Error(
      'The upstream exercises-dataset content no longer matches data/dataset.lock.json — ' +
        'a build right now would not reproduce the committed assets/catalog.db. ' +
        'If the upstream change is expected, re-run with --accept-dataset-change to update the lock.',
    );
  }
  writeFileSync(LOCK_PATH, JSON.stringify(hashes, null, 2) + '\n', 'utf-8');
  console.log(`Updated ${LOCK_PATH} (--accept-dataset-change)`);
}

export async function loadDataset(
  fresh: boolean,
): Promise<{ schema: unknown; exercises: DatasetExercise[] }> {
  const [schemaText, dataText] = await Promise.all([
    downloadText(
      `${DATASET_BASE}/data/exercises.schema.json`,
      path.join(CACHE_DIR, 'exercises.schema.json'),
      fresh,
    ),
    downloadText(
      `${DATASET_BASE}/data/exercises.json`,
      path.join(CACHE_DIR, 'exercises.json'),
      fresh,
    ),
  ]);
  checkDatasetLock(schemaText, dataText);
  return { schema: JSON.parse(schemaText), exercises: JSON.parse(dataText) };
}

export async function downloadBinary(url: string, destPath: string, fresh: boolean): Promise<void> {
  if (!fresh && existsSync(destPath)) return;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(path.dirname(destPath), { recursive: true });
  writeFileSync(destPath, buf);
}
