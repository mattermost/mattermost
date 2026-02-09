// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';

import type {FileInfo} from '@mattermost/types/files';

import VideoPlayer from 'components/video_player/video_player';

// Mock the file utils
jest.mock('mattermost-redux/utils/file_utils', () => ({
    getFileUrl: (fileId: string) => `/api/v4/files/${fileId}`,
    getFileDownloadUrl: (fileId: string) => `/api/v4/files/${fileId}?download=1`,
}));

// Mock the FilePreviewModal
jest.mock('components/file_preview_modal', () => ({
    __esModule: true,
    default: () => <div data-testid='file-preview-modal'>Preview Modal</div>,
}));

// Mock useEncryptedFile hook (uses useSelector/useDispatch which require Redux Provider)
jest.mock('components/file_attachment/use_encrypted_file', () => ({
    useEncryptedFile: () => ({
        isEncrypted: false,
        fileUrl: undefined,
        thumbnailUrl: undefined,
        status: undefined,
        error: undefined,
        originalFileInfo: undefined,
        decrypt: jest.fn(),
    }),
    useIsFileEncrypted: () => false,
}));

describe('VideoPlayer', () => {
    const mockOpenModal = jest.fn();

    const baseFileInfo: FileInfo = {
        id: 'file123',
        name: 'test-video.mp4',
        mime_type: 'video/mp4',
        extension: 'mp4',
        size: 1024000,
        width: 1920,
        height: 1080,
        has_preview_image: false,
        user_id: 'user1',
        channel_id: 'channel1',
        create_at: Date.now(),
        update_at: Date.now(),
        delete_at: 0,
        post_id: 'post123',
    } as FileInfo;

    const defaultProps = {
        fileInfo: baseFileInfo,
        postId: 'post123',
        index: 0,
        defaultMaxHeight: 350,
        defaultMaxWidth: 480,
        actions: {
            openModal: mockOpenModal,
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders video element with controls', () => {
        render(<VideoPlayer {...defaultProps} />);

        const video = document.querySelector('video');
        expect(video).toBeInTheDocument();
        expect(video).toHaveAttribute('controls');
    });

    test('sets video source from fileInfo', () => {
        render(<VideoPlayer {...defaultProps} />);

        const source = document.querySelector('source');
        expect(source).toHaveAttribute('src', '/api/v4/files/file123');
        expect(source).toHaveAttribute('type', 'video/mp4');
    });

    test('displays filename caption', () => {
        render(<VideoPlayer {...defaultProps} />);

        expect(screen.getByText('test-video.mp4')).toBeInTheDocument();
    });

    test('respects maxHeight prop', () => {
        render(<VideoPlayer {...defaultProps} maxHeight={200} />);

        const video = document.querySelector('video');
        expect(video).toHaveStyle({maxHeight: '200px'});
    });

    test('respects maxWidth prop for container', () => {
        const {container} = render(<VideoPlayer {...defaultProps} maxWidth={600} />);

        const videoContainer = container.querySelector('.video-player-container');
        expect(videoContainer).toHaveStyle({maxWidth: '600px'});
    });

    test('uses default maxHeight when prop not provided', () => {
        render(<VideoPlayer {...defaultProps} />);

        const video = document.querySelector('video');
        expect(video).toHaveStyle({maxHeight: '350px'});
    });

    test('calculates aspect ratio from file dimensions', () => {
        render(<VideoPlayer {...defaultProps} />);

        const video = document.querySelector('video');
        // 1920/1080 ≈ 1.78
        const style = video?.style;
        expect(style?.aspectRatio).toContain('1.77'); // Close to 16:9
    });

    test('opens preview modal on double-click', () => {
        render(<VideoPlayer {...defaultProps} />);

        const video = document.querySelector('video');
        fireEvent.doubleClick(video!);

        expect(mockOpenModal).toHaveBeenCalledWith({
            modalId: expect.any(String),
            dialogType: expect.any(Function),
            dialogProps: {
                fileInfos: [baseFileInfo],
                postId: 'post123',
                startIndex: 0,
            },
        });
    });

    test('click stops propagation (for native controls)', () => {
        render(<VideoPlayer {...defaultProps} />);

        const video = document.querySelector('video');
        const stopPropagation = jest.fn();
        fireEvent.click(video!, {stopPropagation});

        // Click handler is called but modal should NOT open
        expect(mockOpenModal).not.toHaveBeenCalled();
    });

    test('shows error state on video load failure', () => {
        render(<VideoPlayer {...defaultProps} />);

        const video = document.querySelector('video');
        fireEvent.error(video!);

        expect(screen.getByText('Unable to load video')).toBeInTheDocument();
        expect(screen.getByText('Download')).toBeInTheDocument();
    });

    test('download button opens download URL in new tab', () => {
        const mockOpen = jest.spyOn(window, 'open').mockImplementation();

        render(<VideoPlayer {...defaultProps} />);

        // Trigger error state to show download button
        const video = document.querySelector('video');
        fireEvent.error(video!);

        const downloadButton = screen.getByText('Download');
        fireEvent.click(downloadButton);

        expect(mockOpen).toHaveBeenCalledWith('/api/v4/files/file123?download=1', '_blank');

        mockOpen.mockRestore();
    });

    test('returns null when no fileInfo provided', () => {
        const propsWithoutFile = {
            ...defaultProps,
            fileInfo: undefined as unknown as FileInfo,
        };

        const {container} = render(<VideoPlayer {...propsWithoutFile} />);
        expect(container.firstChild).toBeNull();
    });

    test('handles missing mime_type with default', () => {
        const fileInfoNoMime: FileInfo = {
            ...baseFileInfo,
            mime_type: '',
        };

        render(<VideoPlayer {...defaultProps} fileInfo={fileInfoNoMime} />);

        const source = document.querySelector('source');
        expect(source).toHaveAttribute('type', 'video/mp4');
    });

    test('handles missing name with default', () => {
        const fileInfoNoName: FileInfo = {
            ...baseFileInfo,
            name: '',
        };

        render(<VideoPlayer {...defaultProps} fileInfo={fileInfoNoName} />);

        expect(screen.getByText('video')).toBeInTheDocument();
    });

    test('handles file without dimensions', () => {
        const fileInfoNoDims: FileInfo = {
            ...baseFileInfo,
            width: 0,
            height: 0,
        };

        render(<VideoPlayer {...defaultProps} fileInfo={fileInfoNoDims} />);

        const video = document.querySelector('video');
        // Should not have aspectRatio set when dimensions are missing
        expect(video?.style?.aspectRatio).toBeFalsy();
    });

    test('applies compact display class when enabled', () => {
        const {container} = render(<VideoPlayer {...defaultProps} compactDisplay={true} />);

        const videoContainer = container.querySelector('.video-player-container');
        expect(videoContainer).toHaveClass('compact-display');
    });

    test('does not apply compact display class by default', () => {
        const {container} = render(<VideoPlayer {...defaultProps} />);

        const videoContainer = container.querySelector('.video-player-container');
        expect(videoContainer).not.toHaveClass('compact-display');
    });

    test('renders fallback download link in video element', () => {
        render(<VideoPlayer {...defaultProps} />);

        expect(screen.getByText('Download test-video.mp4')).toBeInTheDocument();
    });

    test('sets preload to metadata', () => {
        render(<VideoPlayer {...defaultProps} />);

        const video = document.querySelector('video');
        expect(video).toHaveAttribute('preload', 'metadata');
    });

    test('has correct container class', () => {
        const {container} = render(<VideoPlayer {...defaultProps} />);

        expect(container.querySelector('.video-player-container')).toBeInTheDocument();
    });

    test('video has correct class', () => {
        render(<VideoPlayer {...defaultProps} />);

        const video = document.querySelector('video');
        expect(video).toHaveClass('video-player');
    });

    test('error state still shows filename caption', () => {
        render(<VideoPlayer {...defaultProps} />);

        const video = document.querySelector('video');
        fireEvent.error(video!);

        // Filename caption should still be visible in error state
        expect(screen.getByText('test-video.mp4')).toBeInTheDocument();
    });
});
