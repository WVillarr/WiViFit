import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { i18n, supportedLocales, translations } from '@/i18n';

const SRC_DIR = join(__dirname, '..');

test('translates the same key across supported locales', () => {
  i18n.locale = 'en';
  expect(i18n.t('common.welcome')).toBe('Welcome');

  i18n.locale = 'es';
  expect(i18n.t('common.welcome')).toBe('Bienvenido');
});

function leafKeys(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === 'object' && child !== null
      ? leafKeys(child, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

test('every locale defines the same keys', () => {
  const [reference, ...rest] = supportedLocales;
  const referenceKeys = leafKeys(translations[reference]).sort();
  for (const locale of rest) {
    expect({ locale, keys: leafKeys(translations[locale]).sort() }).toEqual({
      locale,
      keys: referenceKeys,
    });
  }
});

/**
 * A wrong key is invisible to TypeScript — `t()` takes a string — and only
 * surfaces as a literal `[missing "en.foo.bar" translation]` rendered in the
 * UI, on whatever screen state happens to reach it. Four freeform-workout
 * labels and the primary "log set" button all shipped that way, each looking
 * up a real string under the wrong namespace, so this walks the source and
 * fails the build instead of waiting for someone to open the right screen.
 *
 * Only literal `t('…')` calls are checkable; interpolated keys like
 * `t(`muscles.${target}`)` are skipped, since their value isn't known here.
 */
test('every literal t() key exists in all locales', () => {
  const known = new Set(supportedLocales.flatMap((locale) => leafKeys(translations[locale])));
  const unresolved: string[] = [];

  for (const file of sourceFiles(SRC_DIR)) {
    const source = readFileSync(file, 'utf8');
    for (const [, key] of source.matchAll(/\bt\(\s*'([^']+)'/g)) {
      if (key.includes('${') || known.has(key)) continue;
      unresolved.push(`${relative(SRC_DIR, file).split(sep).join('/')} → ${key}`);
    }
  }

  expect(unresolved).toEqual([]);
});
