import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const REPO_ROOT = path.resolve(__dirname, '..');
export const CACHE_DIR = path.join(REPO_ROOT, '.cache', 'exercises-dataset');
export const DATASET_BASE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main';

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
