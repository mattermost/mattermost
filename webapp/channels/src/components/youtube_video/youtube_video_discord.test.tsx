// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {IntlProvider} from 'react-intl';

import YoutubeVideoDiscord from './youtube_video_discord';

// Mock the youtube utils
jest.mock('utils/youtube', () => ({
    getVideoId: (link: string) => {
        const match = link.match(/[?&]v=([^&]+)/) || link.match(/youtu\.be\/([^?]+)/);
        return match ? match[1] : 'unknown';
    },
    handleYoutubeTime: (link: string) => {
        const match = link.match(/[?&]t=(\d+)/);
        return match ? `&start=${match[1]}` : '';
    },
}));

// Mock ExternalImage
jest.mock('components/external_image', () => ({
    __esModule: true,
    default: ({src, children}: {src: string; children: (src: string) => React.ReactNode}) => (
        <>{children(src)}</>
    ),
}));

// Mock ExternalLink
jest.mock('components/external_link', () => ({
    __esModule: true,
    default: ({href, children, className}: {href: string; children: React.ReactNode; className: string}) => (
        <a href={href} className={className} data-testid='external-link'>
            {children}
        </a>
    ),
}));

const renderWithIntl = (component: React.ReactElement) => {
    return render(
        <IntlProvider locale='en' messages={{}}>
            {component}
        </IntlProvider>,
    );
};

describe('YoutubeVideoDiscord', () => {
    const defaultProps = {
        postId: 'post123',
        link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    };

    test('renders Discord-style card', () => {
        const {container} = renderWithIntl(<YoutubeVideoDiscord {...defaultProps} />);

        expect(container.querySelector('.YoutubeVideoDiscord')).toBeInTheDocument();
        expect(container.querySelector('.YoutubeVideoDiscord__content')).toBeInTheDocument();
    });

    test('shows YouTube source label', () => {
        renderWithIntl(<YoutubeVideoDiscord {...defaultProps} />);

        expect(screen.getByText('YouTube')).toBeInTheDocument();
    });

    test('displays video title from metadata', () => {
        const metadata = {title: 'Rick Astley - Never Gonna Give You Up'};
        renderWithIntl(<YoutubeVideoDiscord {...defaultProps} metadata={metadata} />);

        expect(screen.getByText('Rick Astley - Never Gonna Give You Up')).toBeInTheDocument();
    });

    test('displays default title when no metadata', () => {
        renderWithIntl(<YoutubeVideoDiscord {...defaultProps} />);

        expect(screen.getByText('YouTube Video')).toBeInTheDocument();
    });

    test('loads maxresdefault thumbnail initially', () => {
        renderWithIntl(<YoutubeVideoDiscord {...defaultProps} />);

        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('src', 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
    });

    test('falls back to hqdefault on image error', () => {
        renderWithIntl(<YoutubeVideoDiscord {...defaultProps} />);

        const img = screen.getByRole('img');
        fireEvent.error(img);

        expect(img).toHaveAttribute('src', 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    });

    test('shows thumbnail initially (not playing)', () => {
        const {container} = renderWithIntl(<YoutubeVideoDiscord {...defaultProps} />);

        expect(container.querySelector('.YoutubeVideoDiscord__thumbnail')).toBeInTheDocument();
        expect(container.querySelector('iframe')).not.toBeInTheDocument();
    });

    test('click shows embedded player', () => {
        const {container} = renderWithIntl(<YoutubeVideoDiscord {...defaultProps} />);

        const thumbnail = container.querySelector('.YoutubeVideoDiscord__thumbnail');
        fireEvent.click(thumbnail!);

        expect(container.querySelector('iframe')).toBeInTheDocument();
        expect(container.querySelector('.YoutubeVideoDiscord__thumbnail')).not.toBeInTheDocument();
    });

    test('Enter key triggers play', () => {
        const {container} = renderWithIntl(<YoutubeVideoDiscord {...defaultProps} />);

        const thumbnail = container.querySelector('.YoutubeVideoDiscord__thumbnail');
        fireEvent.keyDown(thumbnail!, {key: 'Enter'});

        expect(container.querySelector('iframe')).toBeInTheDocument();
    });

    test('Space key triggers play', () => {
        const {container} = renderWithIntl(<YoutubeVideoDiscord {...defaultProps} />);

        const thumbnail = container.querySelector('.YoutubeVideoDiscord__thumbnail');
        fireEvent.keyDown(thumbnail!, {key: ' '});

        expect(container.querySelector('iframe')).toBeInTheDocument();
    });

    test('iframe has correct src with autoplay', () => {
        const {container} = renderWithIntl(<YoutubeVideoDiscord {...defaultProps} />);

        const thumbnail = container.querySelector('.YoutubeVideoDiscord__thumbnail');
        fireEvent.click(thumbnail!);

        const iframe = container.querySelector('iframe');
        expect(iframe).toHaveAttribute('src', expect.stringContaining('youtube.com/embed/dQw4w9WgXcQ'));
        expect(iframe).toHaveAttribute('src', expect.stringContaining('autoplay=1'));
    });

    test('iframe has allowFullScreen', () => {
        const {container} = renderWithIntl(<YoutubeVideoDiscord {...defaultProps} />);

        const thumbnail = container.querySelector('.YoutubeVideoDiscord__thumbnail');
        fireEvent.click(thumbnail!);

        const iframe = container.querySelector('iframe');
        expect(iframe).toHaveAttribute('allowFullScreen');
    });

    test('handles youtu.be short URLs', () => {
        const props = {
            ...defaultProps,
            link: 'https://youtu.be/dQw4w9WgXcQ',
        };
        renderWithIntl(<YoutubeVideoDiscord {...props} />);

        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('src', expect.stringContaining('dQw4w9WgXcQ'));
    });

    test('includes timestamp in embed URL', () => {
        const props = {
            ...defaultProps,
            link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42',
        };
        const {container} = renderWithIntl(<YoutubeVideoDiscord {...props} />);

        const thumbnail = container.querySelector('.YoutubeVideoDiscord__thumbnail');
        fireEvent.click(thumbnail!);

        const iframe = container.querySelector('iframe');
        expect(iframe).toHaveAttribute('src', expect.stringContaining('start=42'));
    });

    test('title link goes to YouTube', () => {
        const metadata = {title: 'Test Video'};
        renderWithIntl(<YoutubeVideoDiscord {...defaultProps} metadata={metadata} />);

        const link = screen.getByTestId('external-link');
        expect(link).toHaveAttribute('href', defaultProps.link);
    });

    test('thumbnail button has correct aria-label', () => {
        const metadata = {title: 'My Video Title'};
        const {container} = renderWithIntl(<YoutubeVideoDiscord {...defaultProps} metadata={metadata} />);

        const thumbnail = container.querySelector('.YoutubeVideoDiscord__thumbnail');
        expect(thumbnail).toHaveAttribute('aria-label', expect.stringContaining('My Video Title'));
    });

    test('thumbnail is keyboard accessible', () => {
        const {container} = renderWithIntl(<YoutubeVideoDiscord {...defaultProps} />);

        const thumbnail = container.querySelector('.YoutubeVideoDiscord__thumbnail');
        expect(thumbnail).toHaveAttribute('tabIndex', '0');
        expect(thumbnail).toHaveAttribute('role', 'button');
    });

    test('shows play button overlay on thumbnail', () => {
        const {container} = renderWithIntl(<YoutubeVideoDiscord {...defaultProps} />);

        expect(container.querySelector('.YoutubeVideoDiscord__play-button')).toBeInTheDocument();
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    test('play button has aria-hidden for decorative purpose', () => {
        const {container} = renderWithIntl(<YoutubeVideoDiscord {...defaultProps} />);

        const playButton = container.querySelector('.YoutubeVideoDiscord__play-button');
        expect(playButton).toHaveAttribute('aria-hidden', 'true');
    });

    test('applies referrer policy when enabled', () => {
        const props = {
            ...defaultProps,
            youtubeReferrerPolicy: true,
        };
        const {container} = renderWithIntl(<YoutubeVideoDiscord {...props} />);

        const thumbnail = container.querySelector('.YoutubeVideoDiscord__thumbnail');
        fireEvent.click(thumbnail!);

        const iframe = container.querySelector('iframe');
        expect(iframe).toHaveAttribute('referrerPolicy', 'origin');
    });

    test('iframe has security sandbox attribute', () => {
        const {container} = renderWithIntl(<YoutubeVideoDiscord {...defaultProps} />);

        const thumbnail = container.querySelector('.YoutubeVideoDiscord__thumbnail');
        fireEvent.click(thumbnail!);

        const iframe = container.querySelector('iframe');
        expect(iframe).toHaveAttribute('sandbox', expect.stringContaining('allow-scripts'));
        expect(iframe).toHaveAttribute('sandbox', expect.stringContaining('allow-same-origin'));
    });
});
