// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import React from 'react';

import PreviewModalContent from './preview_modal_content';
import type {PreviewModalContentData} from './preview_modal_content_data';

// Mock the MattermostLogo component
jest.mock('components/widgets/icons/mattermost_logo', () => ({
    __esModule: true,
    default: ({className}: {className: string}) => (
        <span
            className={className}
            data-testid='mattermost-logo'
        />
    ),
}));

describe('PreviewModalContent', () => {
    const baseContent: PreviewModalContentData = {
        title: 'Test Title',
        subtitle: 'Test subtitle with <strong>bold text</strong>',
        skuLabel: 'Test sku label',
        videoUrl: 'https://www.youtube.com/watch?v=E3EGLxgNxNA',
        useCase: 'missionops',
    };

    it('should render title and subtitle', () => {
        render(<PreviewModalContent content={baseContent}/>);

        expect(screen.getByText('Test Title')).toBeInTheDocument();
        expect(screen.getByText(/Test subtitle with/)).toBeInTheDocument();

        // Check that HTML is rendered
        const subtitle = screen.getByText(/Test subtitle with/);
        expect(subtitle.innerHTML).toContain('<strong>bold text</strong>');
    });

    it('should render SKU label with logo when provided', () => {
        const content = {
            ...baseContent,
            skuLabel: 'ENTERPRISE',
        };

        render(<PreviewModalContent content={content}/>);

        expect(screen.getByText('ENTERPRISE')).toBeInTheDocument();
        expect(screen.getByTestId('mattermost-logo')).toBeInTheDocument();
    });

    it('should not render SKU label when not provided', () => {
        const contentWithoutSku = {
            ...baseContent,
            skuLabel: '',
        };

        render(<PreviewModalContent content={contentWithoutSku}/>);

        expect(screen.queryByText('ENTERPRISE')).not.toBeInTheDocument();
        expect(screen.queryByTestId('mattermost-logo')).not.toBeInTheDocument();
    });

    it('should render video when videoUrl is provided with .mp4 extension', () => {
        const content = {
            ...baseContent,
            videoUrl: 'https://example.com/video.mp4',
        };

        render(<PreviewModalContent content={content}/>);

        const video = screen.getByTestId('video-element') as HTMLVideoElement;
        expect(video).toBeInTheDocument();
        expect(video.src).toBe('https://example.com/video.mp4');

        // Just check that it's a video element
        expect(video.tagName).toBe('VIDEO');
    });

    it('should render video when videoUrl is provided with .webm extension', () => {
        const content = {
            ...baseContent,
            videoUrl: 'test-video.webm',
        };

        render(<PreviewModalContent content={content}/>);

        expect(screen.getByTestId('video-element')).toBeInTheDocument();
        expect(screen.getByTestId('video-element')).toHaveAttribute('src', 'test-video.webm');
    });

    it('should render image when videoUrl is provided with image extension', () => {
        const content = {
            ...baseContent,
            videoUrl: 'https://example.com/image.png',
        };

        render(<PreviewModalContent content={content}/>);

        const image = screen.getByRole('img') as HTMLImageElement;
        expect(image).toBeInTheDocument();
        expect(image.src).toBe('https://example.com/image.png');
        expect(image.alt).toBe('Test Title');
    });

    it('should not render video container when videoUrl is not provided', () => {
        render(<PreviewModalContent content={baseContent}/>);

        expect(screen.queryByRole('video')).not.toBeInTheDocument();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('should render YouTube iframe when YouTube URL is provided', () => {
        const content = {
            ...baseContent,
            videoUrl: 'https://www.youtube.com/watch?v=Zpyy2FqGotM',
        };

        render(<PreviewModalContent content={content}/>);

        const iframe = screen.getByTestId('youtube-embed');
        expect(iframe).toBeInTheDocument();
        expect(iframe).toHaveAttribute('src', expect.stringContaining('https://www.youtube-nocookie.com/embed/Zpyy2FqGotM'));
        expect(iframe).toHaveAttribute('src', expect.stringContaining('modestbranding=1'));
        expect(iframe).toHaveAttribute('src', expect.stringContaining('rel=0'));
        expect(iframe).toHaveAttribute('title', 'Test Title');
    });

    it('should render YouTube iframe when youtu.be URL is provided', () => {
        const content = {
            ...baseContent,
            videoUrl: 'https://youtu.be/Zpyy2FqGotM',
        };

        render(<PreviewModalContent content={content}/>);

        const iframe = screen.getByTestId('youtube-embed');
        expect(iframe).toBeInTheDocument();
        expect(iframe).toHaveAttribute('src', expect.stringContaining('https://www.youtube-nocookie.com/embed/Zpyy2FqGotM'));
        expect(iframe).toHaveAttribute('src', expect.stringContaining('modestbranding=1'));
    });

    it('should render YouTube iframe when embed URL is provided', () => {
        const content = {
            ...baseContent,
            videoUrl: 'https://www.youtube.com/embed/Zpyy2FqGotM',
        };

        render(<PreviewModalContent content={content}/>);

        const iframe = screen.getByTestId('youtube-embed');
        expect(iframe).toBeInTheDocument();
        expect(iframe).toHaveAttribute('src', expect.stringContaining('https://www.youtube-nocookie.com/embed/Zpyy2FqGotM'));
        expect(iframe).toHaveAttribute('src', expect.stringContaining('playsinline=1'));
    });

    it('should render video when videoUrl is provided with .mov extension', () => {
        const content = {
            ...baseContent,
            videoUrl: 'test-video.mov',
        };

        render(<PreviewModalContent content={content}/>);

        expect(screen.getByTestId('video-element')).toBeInTheDocument();
        expect(screen.getByTestId('video-element')).toHaveAttribute('src', 'test-video.mov');
    });
});
