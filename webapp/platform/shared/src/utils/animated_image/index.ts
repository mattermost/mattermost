// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useRef, useState} from 'react';

import {captureStillFrame} from '../capture_still_frame';

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
