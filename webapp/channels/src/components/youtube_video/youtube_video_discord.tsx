// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback} from 'react';
import {useIntl} from 'react-intl';

import type {OpenGraphMetadata} from '@mattermost/types/posts';

import ExternalImage from 'components/external_image';
import ExternalLink from 'components/external_link';

import {getVideoId, handleYoutubeTime} from 'utils/youtube';

import './youtube_video_discord.scss';

type Props = {
    postId: string;
    link: string;
    metadata?: OpenGraphMetadata;
    youtubeReferrerPolicy?: boolean;
}

function getMaxResUrl(link: string) {
    const videoId = getVideoId(link);
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

function getHQUrl(link: string) {
    const videoId = getVideoId(link);
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export default function YoutubeVideoDiscord({link, metadata, youtubeReferrerPolicy}: Props) {
    const {formatMessage} = useIntl();
    const [playing, setPlaying] = useState(false);
    const [useMaxResThumbnail, setUseMaxResThumbnail] = useState(true);

    const videoId = getVideoId(link);
    const videoTitle = metadata?.title || formatMessage({id: 'youtube_video.unknown_title', defaultMessage: 'YouTube Video'});
    const time = handleYoutubeTime(link);
    const thumbnailUrl = useMaxResThumbnail ? getMaxResUrl(link) : getHQUrl(link);

    const handlePlay = useCallback(() => {
        setPlaying(true);
    }, []);

    const handleImageError = useCallback(() => {
        setUseMaxResThumbnail(false);
    }, []);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handlePlay();
        }
    }, [handlePlay]);

    return (
        <div className='YoutubeVideoDiscord'>
            <div className='YoutubeVideoDiscord__content'>
                <div className='YoutubeVideoDiscord__header'>
                    <span className='YoutubeVideoDiscord__source'>{'YouTube'}</span>
                </div>
                <ExternalLink
                    className='YoutubeVideoDiscord__title'
                    href={link}
                    location='youtube_video_discord'
                >
                    {videoTitle}
                </ExternalLink>
                <div className='YoutubeVideoDiscord__media'>
                    {playing ? (
                        <div className='YoutubeVideoDiscord__player'>
                            <iframe
                                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&fs=1&enablejsapi=1${time}`}
                                title={videoTitle}
                                width='100%'
                                height='100%'
                                frameBorder='0'
                                allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                                allowFullScreen={true}
                                referrerPolicy={youtubeReferrerPolicy ? 'origin' : undefined}
                                sandbox='allow-scripts allow-same-origin allow-popups allow-presentation'
                            />
                        </div>
                    ) : (
                        <div
                            className='YoutubeVideoDiscord__thumbnail'
                            onClick={handlePlay}
                            onKeyDown={handleKeyDown}
                            role='button'
                            tabIndex={0}
                            aria-label={formatMessage({
                                id: 'youtube_video.play.aria_label',
                                defaultMessage: 'Play {videoTitle} on YouTube',
                            }, {videoTitle})}
                        >
                            <ExternalImage src={thumbnailUrl}>
                                {(src) => (
                                    <img
                                        src={src}
                                        alt={formatMessage({
                                            id: 'youtube_video.thumbnail.alt_text',
                                            defaultMessage: 'Thumbnail for {videoTitle} on YouTube',
                                        }, {videoTitle})}
                                        onError={handleImageError}
                                    />
                                )}
                            </ExternalImage>
                            <div
                                className='YoutubeVideoDiscord__play-button'
                                aria-hidden='true'
                            >
                                <svg
                                    width='68'
                                    height='48'
                                    viewBox='0 0 68 48'
                                >
                                    <path
                                        className='YoutubeVideoDiscord__play-bg'
                                        d='M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z'
                                    />
                                    <path
                                        className='YoutubeVideoDiscord__play-icon'
                                        d='M 45,24 27,14 27,34'
                                    />
                                </svg>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
