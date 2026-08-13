import type { ImageSourcePropType } from 'react-native';

/**
 * Every exercise media asset the app displays goes through this interface —
 * no screen ever imports thumbnailsMap or builds a GIF URL directly.
 *
 * Why: the 1,324 exercise images/GIFs are © Gym visual, redistributed in the
 * hasaneyldrm/exercises-dataset repo under terms that require our own
 * license before shipping to production (see that repo's NOTICE.md). Until
 * that license — or a replacement set of licensed/original media — is in
 * place, `devMediaProvider` is the only implementation: thumbnails are
 * bundled from the dataset repo's snapshot and GIFs are hot-linked from
 * `raw.githubusercontent.com` (not redistributed by us, just displayed from
 * the original permitted location, which is fine for development but not a
 * substitute for a real CDN in production).
 *
 * Swapping to licensed media in Fase 8 means writing a new implementation of
 * this interface and changing the one export in `index.ts` — no screen
 * changes required.
 */
export interface MediaProvider {
  /** Bundled, offline-available 180x180 thumbnail for an exercise. */
  getThumbnail(exerciseId: string): ImageSourcePropType;
  /**
   * Network URI for the animated demonstration GIF. Requires connectivity.
   * Takes `mediaId` rather than a precomputed path: every catalog GIF path is
   * exactly `videos/{exerciseId}-{mediaId}.gif`, so catalog.db stores the id
   * and lets the provider derive the path — one less column to carry through
   * every list query and search index.
   */
  getGifUri(exerciseId: string, mediaId: string): string;
  /**
   * Attribution line for the current media source. A single provider-wide
   * string rather than a per-exercise column: every row in the dataset
   * carries the identical "© Gym visual" credit, so storing it per row was
   * 1,324 copies of one sentence. Swapping providers in Fase 8 swaps the
   * credit with it.
   */
  readonly attribution: string;
}
