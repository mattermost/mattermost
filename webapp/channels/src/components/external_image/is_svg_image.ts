// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PostImage} from '@mattermost/types/posts';

const isSVGFormat = (format: string) => {
    const normalized = format.toLowerCase();

    return normalized === 'svg' || normalized === 'svg+xml' || normalized === 'image/svg+xml';
};

const getPathname = (url: URL) => url.pathname.toLowerCase();

const isSVGPath = (pathname: string) => pathname.endsWith('.svg');

// Matches the image proxy endpoint used by getImageSrc (Client4 image API route).
// Only URLs served through this endpoint carry the real target in a `url` query parameter.
const isImageProxyPath = (pathname: string) => pathname === '/api/v4/image';

const getProxyTarget = (url: URL) => {
    if (!isImageProxyPath(getPathname(url))) {
        return null;
    }

    const target = url.searchParams.get('url');
    if (!target) {
        return null;
    }

    try {
        return new URL(target, 'http://localhost');
    } catch {
        return null;
    }
};

const getPathnameFromSrc = (src: string) => {
    try {
        const url = new URL(src, 'http://localhost');

        if (isSVGPath(getPathname(url))) {
            return true;
        }

        const proxyTarget = getProxyTarget(url);
        return proxyTarget ? isSVGPath(getPathname(proxyTarget)) : false;
    } catch {
        const path = src.split('?')[0].split('#')[0].toLowerCase();
        return isSVGPath(path);
    }
};

export const isSVGImage = (imageMetadata: PostImage | undefined, src: string) => {
    if (imageMetadata && imageMetadata.format) {
        if (isSVGFormat(imageMetadata.format)) {
            return true;
        }
    }

    if (!src) {
        return false;
    }

    if (src.toLowerCase().startsWith('data:image/svg+xml')) {
        return true;
    }

    return getPathnameFromSrc(src);
};
