/**
 * Normalizes free-text dataset vocabulary (e.g. "lower arms", "body weight")
 * into stable machine keys (e.g. "lower_arms", "body_weight") so the app can
 * key translations/lookups off them instead of raw dataset strings.
 */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
