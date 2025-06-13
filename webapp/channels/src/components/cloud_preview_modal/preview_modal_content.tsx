// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import MattermostLogo from 'components/widgets/icons/mattermost_logo';

import type {PreviewModalContentData} from './preview_modal_content_data';

import './preview_modal_content.scss';

interface Props {
    content: PreviewModalContentData;
}

// Helper function to extract YouTube video ID from various YouTube URL formats
const getYouTubeVideoId = (url: string): string | null => {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/v\/([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
};

const PreviewModalContent: React.FC<Props> = ({content}) => {
    const renderVideoContent = () => {
        if (!content.videoUrl) {
            return null;
        }

        const youtubeVideoId = getYouTubeVideoId(content.videoUrl);

        if (youtubeVideoId) {
            // Create a more integrated YouTube embed with minimal branding
            const embedUrl = new URL(`https://www.youtube-nocookie.com/embed/${youtubeVideoId}`);
            embedUrl.searchParams.set('modestbranding', '1'); // Reduce YouTube branding
            embedUrl.searchParams.set('rel', '0'); // Don't show related videos from other channels
            embedUrl.searchParams.set('iv_load_policy', '3'); // Hide annotations
            embedUrl.searchParams.set('cc_load_policy', '0'); // Don't show captions by default
            embedUrl.searchParams.set('playsinline', '1'); // Play inline on mobile
            embedUrl.searchParams.set('widget_referrer', typeof window === 'undefined' ? 'https://mattermost.com' : window.location.origin); // Set referrer for analytics
            embedUrl.searchParams.set('controls', '0');

            // Render YouTube embed
            return (
                <iframe
                    src={embedUrl.toString()}
                    title={content.title}
                    width='100%'
                    height='100%'
                    frameBorder='0'
                    allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                    allowFullScreen={true}
                    data-testid='youtube-embed'
                />
            );
        }

        // Handle direct video files
        if (content.videoUrl.endsWith('.mp4') || content.videoUrl.endsWith('.webm') || content.videoUrl.endsWith('.mov')) {
            return (
                <video
                    src={content.videoUrl}
                    controls={true}
                    loop={true}
                    data-testid='video-element'
                >
                    <track kind='captions'/>
                </video>
            );
        }

        // Handle images
        if (content.videoUrl.endsWith('.jpg') || content.videoUrl.endsWith('.jpeg') || content.videoUrl.endsWith('.png') || content.videoUrl.endsWith('.gif') || content.videoUrl.endsWith('.webp')) {
            return (
                <img
                    src={content.videoUrl}
                    alt={content.title}
                />
            );
        }

        // Fallback for other URLs - treat as image
        return (
            <img
                src={content.videoUrl}
                alt={content.title}
            />
        );
    };

    return (
        <div className='preview-modal-content'>
            {content.skuLabel && (
                <div className='preview-modal-content__sku-label'>
                    <MattermostLogo className='preview-modal-content__sku-label-logo'/>
                    <span>{content.skuLabel}</span>
                </div>
            )}
            <h2 className='preview-modal-content__title'>{content.title}</h2>
            <div
                className='preview-modal-content__subtitle'
                dangerouslySetInnerHTML={{__html: content.subtitle}}
            />
            {content.videoUrl && (
                <div className='preview-modal-content__video-container'>
                    {renderVideoContent()}
                </div>
            )}
        </div>
    );
};

export default PreviewModalContent;
