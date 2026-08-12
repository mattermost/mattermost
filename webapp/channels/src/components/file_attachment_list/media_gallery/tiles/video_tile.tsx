// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import type {CSSProperties} from 'react';
import {useIntl} from 'react-intl';

import {PlayIcon} from '@mattermost/compass-icons/components';
import type {FileInfo} from '@mattermost/types/files';

import {getFileUrl} from 'mattermost-redux/utils/file_utils';

import TileUtilityButtons from './tile_utility_buttons';

type Props = {
    fileInfo: FileInfo;
    index: number;
    total: number;
    width: number;
    height: number;
    enablePublicLink: boolean;
    onClick: (index: number) => void;
};

const POSTER_SEEK_SECONDS = 0.1;

type CachedPoster = {poster: string | null; duration: number | null; failed: boolean};

const posterCache = new Map<string, CachedPoster>();

function useFirstFramePoster(fileId: string, src: string, enabled: boolean): CachedPoster {
    const [state, setState] = useState<CachedPoster>(() => posterCache.get(fileId) ?? {poster: null, duration: null, failed: false});

    useEffect(() => {
        if (!enabled) {
            return undefined;
        }
        const cached = posterCache.get(fileId);
        if (cached && (cached.poster || cached.failed)) {
            setState(cached);
            return undefined;
        }

        let cancelled = false;
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        video.src = src;

        const cleanup = () => {
            video.removeAttribute('src');
            video.load();
        };

        const finish = (next: CachedPoster) => {
            posterCache.set(fileId, next);
            if (!cancelled) {
                setState(next);
            }
        };

        const onLoadedMetadata = () => {
            const duration = Number.isFinite(video.duration) ? video.duration : null;
            try {
                video.currentTime = Math.min(POSTER_SEEK_SECONDS, video.duration || POSTER_SEEK_SECONDS);
                setState((prev) => ({...prev, duration}));
            } catch {
                finish({poster: null, duration, failed: true});
                cleanup();
            }
        };

        const onSeeked = () => {
            if (cancelled) {
                return;
            }
            const duration = Number.isFinite(video.duration) ? video.duration : null;
            try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx || !canvas.width || !canvas.height) {
                    finish({poster: null, duration, failed: true});
                    return;
                }
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                finish({poster: canvas.toDataURL('image/jpeg', 0.7), duration, failed: false});
            } catch {
                finish({poster: null, duration, failed: true});
            } finally {
                cleanup();
            }
        };

        const onError = () => {
            finish({poster: null, duration: null, failed: true});
            cleanup();
        };

        video.addEventListener('loadedmetadata', onLoadedMetadata, {once: true});
        video.addEventListener('seeked', onSeeked, {once: true});
        video.addEventListener('error', onError, {once: true});

        return () => {
            cancelled = true;
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('seeked', onSeeked);
            video.removeEventListener('error', onError);
            cleanup();
        };
    }, [enabled, fileId, src]);

    return state;
}

function useInViewport<T extends Element>(ref: React.RefObject<T>): boolean {
    const [inView, setInView] = useState(false);

    useEffect(() => {
        if (inView || !ref.current || typeof IntersectionObserver === 'undefined') {
            if (typeof IntersectionObserver === 'undefined') {
                setInView(true);
            }
            return undefined;
        }
        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    setInView(true);
                    observer.disconnect();
                    return;
                }
            }
        }, {rootMargin: '200px'});
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, [inView, ref]);

    return inView;
}

function formatDuration(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return '';
    }
    const total = Math.round(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

const VideoTile = ({fileInfo, index, total, width, height, enablePublicLink, onClick}: Props) => {
    const {formatMessage} = useIntl();
    const fileUrl = getFileUrl(fileInfo.id);
    const tileRef = useRef<HTMLDivElement>(null);
    const inView = useInViewport(tileRef);

    const {poster, failed, duration} = useFirstFramePoster(fileInfo.id, fileUrl, inView);

    const handleActivate = useCallback(() => {
        onClick(index);
    }, [onClick, index]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleActivate();
        }
    }, [handleActivate]);

    const label = formatMessage(
        {id: 'media_gallery.video_label', defaultMessage: 'Video {current} of {total}: {name}. Press Enter or Space to play.'},
        {current: index + 1, total, name: fileInfo.name || ''},
    );

    const tileStyle: CSSProperties = {
        width: `${width}px`,
        height: `${height}px`,
        flex: `0 0 ${width}px`,
    };

    const mediaStyle: CSSProperties = {};
    if (fileInfo.width && fileInfo.height) {
        mediaStyle.maxWidth = `${fileInfo.width}px`;
        mediaStyle.maxHeight = `${fileInfo.height}px`;
    }

    const showPlaceholder = !poster;
    const showPlaceholderIcon = failed;

    return (
        <div
            ref={tileRef}
            className='MediaGallery__tile'
            role='button'
            tabIndex={0}
            aria-label={label}
            data-testid='media-gallery-tile'
            data-file-name={fileInfo.name || ''}
            style={tileStyle}
            onClick={handleActivate}
            onKeyDown={handleKeyDown}
        >
            {poster && (
                <img
                    src={poster}
                    alt=''
                    aria-hidden={true}
                    style={mediaStyle}
                />
            )}
            {showPlaceholder && (
                <div className='MediaGallery__tile__video_placeholder'>
                    {showPlaceholderIcon && <PlayIcon size={32}/>}
                </div>
            )}

            <span
                className='MediaGallery__tile__play_indicator'
                aria-hidden={true}
            >
                <PlayIcon size={24}/>
            </span>

            {duration !== null && (
                <span className='MediaGallery__tile__duration'>
                    {formatDuration(duration)}
                </span>
            )}

            <TileUtilityButtons
                fileInfo={fileInfo}
                enablePublicLink={enablePublicLink}
            />
        </div>
    );
};

export default VideoTile;
