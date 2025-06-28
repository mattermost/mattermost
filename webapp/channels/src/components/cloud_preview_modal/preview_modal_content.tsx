// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useState} from 'react';
import {useIntl} from 'react-intl';

import MattermostLogo from 'components/widgets/icons/mattermost_logo';

import type {PreviewModalContentData} from './preview_modal_content_data';

import './preview_modal_content.scss';

interface Props {
    content: PreviewModalContentData;
}

const PreviewModalContent: React.FC<Props> = ({content}) => {
    const intl = useIntl();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [showControls, setShowControls] = useState(false);

    const handlePlay = () => {
        setIsPlaying(true);
        videoRef.current?.play();
    };

    const handleVideoClick = () => {
        if (!isPlaying) {
            handlePlay();
        }
    };

    const handleVideoPause = () => {
        setIsPlaying(false);
    };

    const renderVideoContent = () => {
        if (!content.videoUrl) {
            return null;
        }

        // Handle direct video files
        if (content.videoUrl.endsWith('.mp4') || content.videoUrl.endsWith('.webm') || content.videoUrl.endsWith('.mov')) {
            return (
                <div
                    className='custom-video-wrapper'
                    onMouseEnter={() => isPlaying && setShowControls(true)}
                    onMouseLeave={() => setShowControls(false)}
                >
                    <video
                        ref={videoRef}
                        src={content.videoUrl}
                        poster={content.videoPoster}
                        controls={isPlaying && showControls}
                        loop={true}
                        data-testid='video-element'
                        onClick={handleVideoClick}
                        onPause={handleVideoPause}
                        onPlay={() => setIsPlaying(true)}
                    >
                        <track kind='captions'/>
                    </video>
                    {!isPlaying && (
                        <button
                            className='custom-play-button'
                            onClick={handlePlay}
                            aria-label={intl.formatMessage({
                                id: 'cloud_preview_modal.play_video',
                                defaultMessage: 'Play video',
                            })}
                        >
                            <svg
                                width='48'
                                height='48'
                                viewBox='0 0 48 48'
                                fill='none'
                            >
                                <circle
                                    cx='24'
                                    cy='24'
                                    r='24'
                                    fill='rgba(255,255,255,0.9)'
                                />
                                <polygon
                                    points='20,16 34,24 20,32'
                                    fill='#1e3a8a'
                                />
                            </svg>
                        </button>
                    )}
                </div>
            );
        }

        // Handle images
        if (content.videoUrl.endsWith('.jpg') || content.videoUrl.endsWith('.jpeg') || content.videoUrl.endsWith('.png') || content.videoUrl.endsWith('.gif') || content.videoUrl.endsWith('.webp')) {
            return (
                <img
                    src={content.videoUrl}
                    alt={intl.formatMessage(content.title)}
                />
            );
        }

        // Fallback for other URLs - treat as image
        return (
            <img
                src={content.videoUrl}
                alt={intl.formatMessage(content.title)}
            />
        );
    };

    return (
        <div className='preview-modal-content'>
            {content.skuLabel && content.skuLabel.defaultMessage && (
                <div className='preview-modal-content__sku-label'>
                    <MattermostLogo className='preview-modal-content__sku-label-logo'/>
                    <span>{intl.formatMessage(content.skuLabel)}</span>
                </div>
            )}
            <h2 className='preview-modal-content__title'>{intl.formatMessage(content.title)}</h2>
            <div className='preview-modal-content__subtitle'>
                {intl.formatMessage(content.subtitle)}
            </div>
            {content.videoUrl && (
                <div className='preview-modal-content__media-container'>
                    {renderVideoContent()}
                </div>
            )}
        </div>
    );
};

export default PreviewModalContent;
