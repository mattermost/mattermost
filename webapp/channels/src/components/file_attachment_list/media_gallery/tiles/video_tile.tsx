// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
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

// Generate the poster client-side to avoid a server-side ffmpeg dependency.
function useFirstFramePoster(src: string): {poster: string | null; failed: boolean; duration: number | null} {
    const [poster, setPoster] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);
    const [duration, setDuration] = useState<number | null>(null);

    useEffect(() => {
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

        const onLoadedMetadata = () => {
            if (Number.isFinite(video.duration)) {
                setDuration(video.duration);
            }
            try {
                video.currentTime = Math.min(POSTER_SEEK_SECONDS, video.duration || POSTER_SEEK_SECONDS);
            } catch {
                setFailed(true);
                cleanup();
            }
        };

        const onSeeked = () => {
            if (cancelled) {
                return;
            }
            try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx || !canvas.width || !canvas.height) {
                    setFailed(true);
                    return;
                }
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                setPoster(canvas.toDataURL('image/jpeg', 0.7));
            } catch {
                setFailed(true);
            } finally {
                cleanup();
            }
        };

        const onError = () => {
            setFailed(true);
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
    }, [src]);

    return {poster, failed, duration};
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
    const {poster, failed, duration} = useFirstFramePoster(fileUrl);

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

    return (
        <div
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
            {!poster && (
                <div className='MediaGallery__tile__video_placeholder'>
                    {failed && <PlayIcon size={32}/>}
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
