// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef} from 'react';

interface GifViewerProps {
    src: string;
    alt?: string;
    className?: string;
    onLoad?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
    onError?: () => void;
    onClick?: (event: React.MouseEvent<HTMLImageElement | HTMLDivElement>) => void;
    tabIndex?: number;
    style?: React.CSSProperties;
    onPlaybackChange?: (isPlaying: boolean, hasTimedOut: boolean) => void;
    autoplayEnabled?: boolean;
}

export interface GifViewerHandle {
    togglePlayback: () => void;
    isPlaying: boolean;
    hasTimedOut: boolean;
}

const GifViewer = forwardRef<GifViewerHandle, GifViewerProps>(({
    src,
    alt,
    className,
    onLoad,
    onError,
    onClick,
    tabIndex,
    style,
    onPlaybackChange,
    autoplayEnabled = true,
}, ref) => {
    const [isPlaying, setIsPlaying] = useState(autoplayEnabled);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [hasTimedOut, setHasTimedOut] = useState(false);
    const imageRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // GIF plays for 10 seconds before stopping
    const PLAYBACK_DURATION = 10000;

    const handleImageLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
        setHasLoaded(true);
        onLoad?.(event);

        // Capture the first frame to canvas for paused state
        if (imageRef.current && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                canvas.width = imageRef.current.naturalWidth;
                canvas.height = imageRef.current.naturalHeight;
                ctx.drawImage(imageRef.current, 0, 0);
            }
        }
    }, [onLoad]);

    // Set timer to stop GIF after 10 seconds (only if autoplay is enabled)
    useEffect(() => {
        if (!isPlaying || hasTimedOut || !autoplayEnabled) {
            return undefined;
        }

        if (hasLoaded) {
            timerRef.current = setTimeout(() => {
                setIsPlaying(false);
                setHasTimedOut(true);
            }, PLAYBACK_DURATION);
        }

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [isPlaying, hasLoaded, hasTimedOut, autoplayEnabled]);

    // Notify parent of playback state changes
    useEffect(() => {
        if (hasLoaded) {
            onPlaybackChange?.(isPlaying, hasTimedOut);
        }
    }, [isPlaying, hasTimedOut, hasLoaded, onPlaybackChange]);

    const togglePlayback = useCallback(() => {
        if (hasTimedOut) {
            // Reset and play from beginning
            setHasTimedOut(false);
            setIsPlaying(true);
        } else {
            setIsPlaying(!isPlaying);
        }
    }, [isPlaying, hasTimedOut]);

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
        togglePlayback,
        isPlaying,
        hasTimedOut,
    }), [togglePlayback, isPlaying, hasTimedOut]);

    const handleContainerClick = useCallback((event: React.MouseEvent<HTMLImageElement | HTMLDivElement | HTMLCanvasElement>) => {
        if (onClick) {
            onClick(event as React.MouseEvent<HTMLImageElement | HTMLDivElement>);
        }
    }, [onClick]);

    const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            togglePlayback();
        }
    }, [togglePlayback]);

    return (
        <div
            className={className}
            style={style}
        >
            <img
                ref={imageRef}
                src={src}
                alt={alt}
                onLoad={handleImageLoad}
                onError={onError}
                onClick={handleContainerClick}
                onKeyDown={handleKeyDown}
                tabIndex={isPlaying ? (tabIndex ?? 0) : -1}
                role={onClick ? undefined : 'button'}
                aria-label={onClick ? alt : `GIF image: ${alt || 'Untitled'}. Playing`}
                style={{
                    display: isPlaying ? 'block' : 'none',
                    width: '100%',
                    height: '100%',
                }}
            />
            <canvas
                ref={canvasRef}
                onClick={handleContainerClick}
                onKeyDown={handleKeyDown}
                tabIndex={!isPlaying && hasLoaded ? (tabIndex ?? 0) : -1}
                role='button'
                aria-label={`GIF image: ${alt || 'Untitled'}. Paused`}
                style={{
                    display: (!isPlaying && hasLoaded) ? 'block' : 'none',
                    width: '100%',
                    height: '100%',
                }}
            />
        </div>
    );
});

GifViewer.displayName = 'GifViewer';

export default GifViewer;
