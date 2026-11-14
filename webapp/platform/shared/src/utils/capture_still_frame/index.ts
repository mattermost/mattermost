// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Loads the image at the given URL off-DOM and draws its current frame onto a canvas, returning
// a static data URL for that frame. Used to freeze animated GIFs/APNGs/WebPs (which browsers
// cannot otherwise pause) while the app window isn't focused or visible.
//
// Resolves to null if the image fails to load, or if it's cross-origin without CORS headers
// (which taints the canvas and blocks reading its contents) — callers should fall back to the
// live URL in that case rather than treat it as an error.
export function captureStillFrame(url: string): Promise<string | null> {
    return new Promise((resolve) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';

        image.onload = () => {
            const width = image.naturalWidth;
            const height = image.naturalHeight;
            if (!width || !height) {
                resolve(null);
                return;
            }

            try {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const context = canvas.getContext('2d');
                if (!context) {
                    resolve(null);
                    return;
                }

                context.drawImage(image, 0, 0);
                resolve(canvas.toDataURL());
            } catch {
                resolve(null);
            }
        };

        image.onerror = () => resolve(null);

        image.src = url;
    });
}
