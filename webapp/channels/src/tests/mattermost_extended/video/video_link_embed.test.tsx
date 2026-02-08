// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';

import VideoLinkEmbed, {isVideoUrl, isVideoLinkText} from 'components/video_link_embed/video_link_embed';

describe('VideoLinkEmbed utilities', () => {
    describe('isVideoUrl', () => {
        test('detects .mp4 URLs', () => {
            expect(isVideoUrl('https://example.com/video.mp4')).toBe(true);
            expect(isVideoUrl('https://example.com/path/to/video.mp4')).toBe(true);
            expect(isVideoUrl('http://localhost/video.MP4')).toBe(true);
        });

        test('detects .webm URLs', () => {
            expect(isVideoUrl('https://example.com/video.webm')).toBe(true);
        });

        test('detects .mov URLs', () => {
            expect(isVideoUrl('https://example.com/video.mov')).toBe(true);
        });

        test('detects .avi URLs', () => {
            expect(isVideoUrl('https://example.com/video.avi')).toBe(true);
        });

        test('detects .mkv URLs', () => {
            expect(isVideoUrl('https://example.com/video.mkv')).toBe(true);
        });

        test('detects .m4v URLs', () => {
            expect(isVideoUrl('https://example.com/video.m4v')).toBe(true);
        });

        test('detects .ogv URLs', () => {
            expect(isVideoUrl('https://example.com/video.ogv')).toBe(true);
        });

        test('handles URLs with query strings', () => {
            expect(isVideoUrl('https://example.com/video.mp4?token=abc123')).toBe(true);
            expect(isVideoUrl('https://example.com/video.mp4?a=1&b=2')).toBe(true);
        });

        test('returns false for non-video URLs', () => {
            expect(isVideoUrl('https://example.com/image.jpg')).toBe(false);
            expect(isVideoUrl('https://example.com/document.pdf')).toBe(false);
            expect(isVideoUrl('https://example.com/page.html')).toBe(false);
            expect(isVideoUrl('https://example.com/')).toBe(false);
        });

        test('handles URLs with fragments', () => {
            expect(isVideoUrl('https://example.com/video.mp4#section')).toBe(true);
        });

        test('handles malformed URLs gracefully', () => {
            expect(isVideoUrl('not-a-url')).toBe(false);
            expect(isVideoUrl('')).toBe(false);
            expect(isVideoUrl('video.mp4')).toBe(true); // fallback check works
        });
    });

    describe('isVideoLinkText', () => {
        test('detects "Video" link text', () => {
            expect(isVideoLinkText('Video')).toBe(true);
            expect(isVideoLinkText('video')).toBe(true);
            expect(isVideoLinkText('VIDEO')).toBe(true);
        });

        test('detects "Video" with emoji prefix', () => {
            expect(isVideoLinkText('▶️Video')).toBe(true);
            expect(isVideoLinkText('🎬 Video')).toBe(true);
            expect(isVideoLinkText('📹Video')).toBe(true);
        });

        test('handles whitespace', () => {
            expect(isVideoLinkText('  Video  ')).toBe(true);
            expect(isVideoLinkText('My Video')).toBe(true);
        });

        test('rejects long text even if ending in video', () => {
            expect(isVideoLinkText('This is a very long sentence about video')).toBe(false);
        });

        test('rejects non-video text', () => {
            expect(isVideoLinkText('Click here')).toBe(false);
            expect(isVideoLinkText('Download')).toBe(false);
            expect(isVideoLinkText('')).toBe(false);
        });
    });
});

describe('VideoLinkEmbed component', () => {
    const defaultProps = {
        href: 'https://example.com/video.mp4',
    };

    test('renders video element with controls', () => {
        render(<VideoLinkEmbed {...defaultProps} />);

        const video = document.querySelector('video');
        expect(video).toBeInTheDocument();
        expect(video).toHaveAttribute('controls');
    });

    test('sets video source from href', () => {
        render(<VideoLinkEmbed {...defaultProps} />);

        const source = document.querySelector('source');
        expect(source).toHaveAttribute('src', 'https://example.com/video.mp4');
    });

    test('respects maxHeight prop', () => {
        render(<VideoLinkEmbed {...defaultProps} maxHeight={200} />);

        const video = document.querySelector('video');
        expect(video).toHaveStyle({maxHeight: '200px'});
    });

    test('uses default maxHeight when not provided', () => {
        render(<VideoLinkEmbed {...defaultProps} />);

        const video = document.querySelector('video');
        expect(video).toHaveStyle({maxHeight: '350px'});
    });

    test('shows error state on video load failure', () => {
        render(<VideoLinkEmbed {...defaultProps} />);

        const video = document.querySelector('video');
        fireEvent.error(video!);

        expect(screen.getByText('Unable to load video')).toBeInTheDocument();
        expect(screen.getByText('Download')).toBeInTheDocument();
    });

    test('download button opens URL in new tab', () => {
        const mockOpen = jest.spyOn(window, 'open').mockImplementation();

        render(<VideoLinkEmbed {...defaultProps} />);

        // Trigger error state to show download button
        const video = document.querySelector('video');
        fireEvent.error(video!);

        const downloadButton = screen.getByText('Download');
        fireEvent.click(downloadButton);

        expect(mockOpen).toHaveBeenCalledWith('https://example.com/video.mp4', '_blank');

        mockOpen.mockRestore();
    });

    test('renders fallback download link in video element', () => {
        render(<VideoLinkEmbed href='https://example.com/path/myvideo.mp4' />);

        // The fallback link should contain the filename
        expect(screen.getByText('Download myvideo.mp4')).toBeInTheDocument();
    });

    test('extracts filename from URL for fallback link', () => {
        render(<VideoLinkEmbed href='https://example.com/uploads/clip.webm' />);

        expect(screen.getByText('Download clip.webm')).toBeInTheDocument();
    });

    test('handles URL with query string for filename', () => {
        render(<VideoLinkEmbed href='https://example.com/video.mp4?token=abc' />);

        // Should extract just video.mp4, not video.mp4?token=abc
        expect(screen.getByText('Download video.mp4')).toBeInTheDocument();
    });

    test('sets preload to metadata', () => {
        render(<VideoLinkEmbed {...defaultProps} />);

        const video = document.querySelector('video');
        expect(video).toHaveAttribute('preload', 'metadata');
    });

    test('has correct container class', () => {
        const {container} = render(<VideoLinkEmbed {...defaultProps} />);

        expect(container.querySelector('.video-link-embed-container')).toBeInTheDocument();
    });

    test('video has correct class', () => {
        render(<VideoLinkEmbed {...defaultProps} />);

        const video = document.querySelector('video');
        expect(video).toHaveClass('video-link-embed');
    });
});
