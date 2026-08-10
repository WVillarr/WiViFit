import type { ImageSourcePropType } from 'react-native';

import type { MediaProvider } from './media-provider';
import { thumbnailsMap } from './thumbnails-map';

const GIF_BASE = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main';

const FALLBACK_THUMBNAIL: ImageSourcePropType = require('../../assets/images/icon.png');

export const devMediaProvider: MediaProvider = {
  getThumbnail(exerciseId: string) {
    return thumbnailsMap[exerciseId] ?? FALLBACK_THUMBNAIL;
  },
  getGifUri(gifPath: string) {
    return `${GIF_BASE}/${gifPath}`;
  },
};
