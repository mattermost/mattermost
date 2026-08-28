// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useRef, useState} from 'react';

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

function computeIsWindowActive(): boolean {
    if (typeof document === 'undefined') {
        return true;
    }
    return document.hasFocus() && document.visibilityState === 'visible';
}

// Tracks whether the window is both focused and visible. Used to pause animated content (GIFs,
// animated emoji) that would otherwise keep decoding and repainting in the background, wasting CPU.
export function useIsWindowActive(): boolean {
    const [isActive, setIsActive] = useState(computeIsWindowActive);

    useEffect(() => {
        const updateIsActive = () => setIsActive(computeIsWindowActive());

        window.addEventListener('focus', updateIsActive);
        window.addEventListener('blur', updateIsActive);
        document.addEventListener('visibilitychange', updateIsActive);

        return () => {
            window.removeEventListener('focus', updateIsActive);
            window.removeEventListener('blur', updateIsActive);
            document.removeEventListener('visibilitychange', updateIsActive);
        };
    }, []);

    return isActive;
}

// Returns the URL to render for a potentially-animated image: the live URL while the window is
// focused and visible, or a captured still frame once the window goes inactive. The still frame
// is only captured the first time it's needed for a given URL, and is cached for as long as the
// URL doesn't change.
export function useFreezableImageUrl(imageUrl: string | undefined): string | undefined {
    const isWindowActive = useIsWindowActive();

    const [stillFrameUrl, setStillFrameUrl] = useState<string | null>(null);
    const capturedForUrl = useRef<string | null>(null);

    useEffect(() => {
        setStillFrameUrl(null);
        capturedForUrl.current = null;
    }, [imageUrl]);

    useEffect(() => {
        if (isWindowActive || !imageUrl || capturedForUrl.current === imageUrl) {
            return undefined;
        }

        capturedForUrl.current = imageUrl;

        let cancelled = false;
        captureStillFrame(imageUrl).then((dataUrl) => {
            if (!cancelled && dataUrl) {
                setStillFrameUrl(dataUrl);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [isWindowActive, imageUrl]);

    if (!imageUrl) {
        return imageUrl;
    }

    return (!isWindowActive && stillFrameUrl) ? stillFrameUrl : imageUrl;
}
