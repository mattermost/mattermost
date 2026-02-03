// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useRef, useState} from 'react';
import classNames from 'classnames';

import './video_link_embed.scss';

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v', '.ogv'];

export interface Props {
    href: string;
    maxHeight?: number;
}

export function isVideoUrl(url: string): boolean {
    try {
        // Parse URL to extract pathname without query string
        const urlObj = new URL(url);
        const pathLower = urlObj.pathname.toLowerCase();
        return VIDEO_EXTENSIONS.some((ext) => pathLower.endsWith(ext));
    } catch {
        // If URL parsing fails, fall back to simple check
        const urlLower = url.toLowerCase();
        // Remove query string if present
        const pathPart = urlLower.split('?')[0];
        return VIDEO_EXTENSIONS.some((ext) => pathPart.endsWith(ext));
    }
}

export function isVideoLinkText(text: string): boolean {
    // Check if the link text is just "Video" (with optional prefix like emoji)
    // Since we already validate the URL is a video, we can be lenient here
    const trimmed = text.trim().toLowerCase();

    // Match if text ends with "video" and is short (to avoid matching sentences)
    return trimmed.endsWith('video') && trimmed.length <= 20;
}

export default function VideoLinkEmbed(props: Props) {
    const {href, maxHeight = 350} = props;
    const videoRef = useRef<HTMLVideoElement>(null);
    const [hasError, setHasError] = useState(false);

    const handleError = useCallback(() => {
        setHasError(true);
    }, []);

    const handleDownload = useCallback(() => {
        window.open(href, '_blank');
    }, [href]);

    // Extract filename from URL
    const filename = href.split('/').pop()?.split('?')[0] || 'video';

    if (hasError) {
        return (
            <span className='video-link-embed-container'>
                <span className='video-link-embed-error'>
                    <span className='video-link-embed-error__text'>{'Unable to load video'}</span>
                    <button
                        className='video-link-embed-error__download'
                        onClick={handleDownload}
                    >
                        {'Download'}
                    </button>
                </span>
            </span>
        );
    }

    const videoStyle: React.CSSProperties = {
        maxHeight: `${maxHeight}px`,
        maxWidth: '100%',
    };

    return (
        <span className='video-link-embed-container'>
            <video
                ref={videoRef}
                className='video-link-embed'
                controls={true}
                preload='metadata'
                style={videoStyle}
                onError={handleError}
            >
                <source
                    src={href}
                    type='video/mp4'
                />
                <a
                    href={href}
                    download={filename}
                >
                    {`Download ${filename}`}
                </a>
            </video>
        </span>
    );
}
