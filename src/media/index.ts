import { devMediaProvider } from './dev-media-provider';
import type { MediaProvider } from './media-provider';

export type { MediaProvider } from './media-provider';

/** The single swap point once licensed media is available — see media-provider.ts. */
export const mediaProvider: MediaProvider = devMediaProvider;
