// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, fireEvent} from '@testing-library/react';

import type {FileInfo} from '@mattermost/types/files';

import VideoPlayer from 'components/video_player/video_player';

// Mock useEncryptedFile hook
jest.mock('components/file_attachment/use_encrypted_file', () => ({
    useEncryptedFile: () => ({
        isEncrypted: false,
        fileUrl: null,
        status: 'idle',
        originalFileInfo: null,
    }),
}));

// Mock file_utils
jest.mock('mattermost-redux/utils/file_utils', () => ({
    getFileUrl: (fileId: string) => `/api/v4/files/${fileId}`,
    getFileDownloadUrl: (fileId: string) => `/api/v4/files/${fileId}?download=1`,
}));

// Mock FilePreviewModal
jest.mock('components/file_preview_modal', () => ({
    __esModule: true,
    default: () => <div data-testid='file-preview-modal'>Preview Modal</div>,
}));

describe('VideoPlayer spoiler functionality', () => {
    const mockOpenModal = jest.fn();

    const baseFileInfo: FileInfo = {
        id: 'video1',
        name: 'video.mp4',
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

    const baseProps = {
        fileInfo: baseFileInfo,
        postId: 'post123',
        defaultMaxHeight: 350,
        defaultMaxWidth: 480,
        actions: {
            openModal: mockOpenModal,
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should not show spoiler overlay when isSpoilered is false', () => {
        const {container} = render(
            <VideoPlayer {...baseProps} isSpoilered={false} />,
        );

        expect(container.querySelector('.spoiler-overlay')).not.toBeInTheDocument();
        expect(container.querySelector('.video-player-spoiler-wrapper--blurred')).not.toBeInTheDocument();
    });

    test('should not show spoiler overlay when isSpoilered is undefined', () => {
        const {container} = render(
            <VideoPlayer {...baseProps} />,
        );

        expect(container.querySelector('.spoiler-overlay')).not.toBeInTheDocument();
        expect(container.querySelector('.video-player-spoiler-wrapper--blurred')).not.toBeInTheDocument();
    });

    test('should show spoiler overlay and blur when isSpoilered is true', () => {
        const {container} = render(
            <VideoPlayer {...baseProps} isSpoilered={true} />,
        );

        expect(container.querySelector('.spoiler-overlay')).toBeInTheDocument();
        expect(container.querySelector('.spoiler-overlay__text')).toHaveTextContent('SPOILER');
        expect(container.querySelector('.video-player-spoiler-wrapper--blurred')).toBeInTheDocument();
    });

    test('should hide video controls when spoiler is active', () => {
        const {container} = render(
            <VideoPlayer {...baseProps} isSpoilered={true} />,
        );

        const video = container.querySelector('video');
        expect(video).not.toHaveAttribute('controls');
    });

    test('should show video controls when not spoilered', () => {
        const {container} = render(
            <VideoPlayer {...baseProps} isSpoilered={false} />,
        );

        const video = container.querySelector('video');
        expect(video).toHaveAttribute('controls');
    });

    test('should reveal video when spoiler wrapper is clicked', () => {
        const {container} = render(
            <VideoPlayer {...baseProps} isSpoilered={true} />,
        );

        const blurredWrapper = container.querySelector('.video-player-spoiler-wrapper--blurred');
        expect(blurredWrapper).toBeInTheDocument();
        fireEvent.click(blurredWrapper!);

        // After click, blur and overlay should be removed
        expect(container.querySelector('.video-player-spoiler-wrapper--blurred')).not.toBeInTheDocument();
        expect(container.querySelector('.spoiler-overlay')).not.toBeInTheDocument();
    });

    test('should show video controls after spoiler is revealed', () => {
        const {container} = render(
            <VideoPlayer {...baseProps} isSpoilered={true} />,
        );

        // Reveal the spoiler
        const blurredWrapper = container.querySelector('.video-player-spoiler-wrapper--blurred');
        fireEvent.click(blurredWrapper!);

        // Video should now have controls
        const video = container.querySelector('video');
        expect(video).toHaveAttribute('controls');
    });
});
