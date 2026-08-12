import { Image } from 'expo-image';
import { useCallback, useEffect, useRef } from 'react';
import type { ViewToken } from 'react-native';

import { mediaProvider } from './index';

/**
 * Caches the GIF for whatever rows are actually on screen, so opening a card
 * you scrolled past a moment ago works with the screen still offline — the
 * gym-basement premise (see AGENTS.md plan) applies to browsing, not just the
 * one exercise you tap.
 *
 * Deliberately scoped to *visible* rows rather than the whole result set: GIFs
 * run to tens of MB across the catalog (Fase 1 Bloque E), and prefetching
 * every search hit would spend a user's data plan on exercises they never
 * open. `expo-image`'s disk cache already makes this a no-op for rows
 * prefetched once — re-scrolling past them doesn't re-fetch.
 */
export function useGifPrefetch<T extends { id: string }>(gifPathFor: (item: T) => string) {
  const requested = useRef(new Set<string>());
  // FlatList reads `onViewableItemsChanged` once, in VirtualizedList's
  // constructor, and never again — a callback whose identity changes every
  // render (as a plain closure over `gifPathFor` would) silently stops being
  // the one that's actually called. Routing through a ref keeps the exported
  // callback's identity fixed for the component's lifetime while still
  // calling whatever `gifPathFor` the latest render passed in.
  const gifPathForRef = useRef(gifPathFor);
  useEffect(() => {
    gifPathForRef.current = gifPathFor;
  }, [gifPathFor]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken<T>[] }) => {
    for (const token of viewableItems) {
      const item = token.item;
      if (!item || requested.current.has(item.id)) continue;
      requested.current.add(item.id);
      Image.prefetch(mediaProvider.getGifUri(gifPathForRef.current(item)), 'disk').catch(() => {
        // Offline or the host is unreachable — the placeholder thumbnail
        // still renders, so a failed prefetch just means no head start.
      });
    }
  }, []);

  return { onViewableItemsChanged };
}
