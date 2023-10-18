// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PostImage} from '@mattermost/types/posts';

export const isSVGImage = (imageMetadata: PostImage | undefined, src: string) => {
    if (!imageMetadata) {
        // Just check if the string contains an svg extension instead of if it ends with one because it avoids
        // having to deal with query strings and proxied image URLs
        return src.indexOf('.svg') !== -1;
    }
    return imageMetadata.format === 'svg';
};
