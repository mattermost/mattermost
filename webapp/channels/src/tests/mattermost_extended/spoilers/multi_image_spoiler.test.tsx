// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';

import type {FileInfo} from '@mattermost/types/files';

import MultiImageView from 'components/multi_image_view/multi_image_view';

// Mock file_utils
jest.mock('mattermost-redux/utils/file_utils', () => ({
    getFileUrl: (fileId: string) => `/api/v4/files/${fileId}`,
    getFilePreviewUrl: (fileId: string) => `/api/v4/files/${fileId}/preview`,
}));

// Mock useEncryptedFile hook
jest.mock('components/file_attachment/use_encrypted_file', () => ({
    useEncryptedFile: () => ({
        isEncrypted: false,
        fileUrl: null,
        status: 'idle',
        originalFileInfo: null,
    }),
}));

// Mock isEncryptedFile
jest.mock('utils/encryption/file', () => ({
    isEncryptedFile: () => false,
}));

// Mock FilePreviewModal
jest.mock('components/file_preview_modal', () => ({
    __esModule: true,
    default: () => <div data-testid='file-preview-modal'>Preview Modal</div>,
}));

// Mock SizeAwareImage
jest.mock('components/size_aware_image', () => ({
    __esModule: true,
    default: ({onClick, onImageLoaded, src, className}: {
        onClick?: () => void;
        onImageLoaded?: () => void;
        src: string;
        className: string;
    }) => (
        <img
            data-testid='size-aware-image'
            src={src}
            className={className}
            onClick={onClick}
            onLoad={onImageLoaded}
        />
    ),
}));

describe('MultiImageView spoiler functionality', () => {
    const mockOpenModal = jest.fn();

    const createFileInfo = (id: string, name: string): FileInfo => ({
        id,
        name,
        mime_type: 'image/png',
        extension: 'png',
        size: 1024,
        width: 800,
        height: 600,
        has_preview_image: true,
        user_id: 'user1',
        channel_id: 'channel1',
        create_at: Date.now(),
        update_at: Date.now(),
        delete_at: 0,
        post_id: 'post123',
    } as FileInfo);

    const baseProps = {
        fileInfos: [
            createFileInfo('file1', 'image1.png'),
            createFileInfo('file2', 'image2.png'),
        ],
        postId: 'post123',
        maxImageHeight: 0,
        maxImageWidth: 0,
        actions: {
            openModal: mockOpenModal,
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should not show spoiler overlay when spoilerFileIds is not provided', () => {
        const {container} = render(<MultiImageView {...baseProps} />);

        expect(container.querySelector('.spoiler-overlay')).not.toBeInTheDocument();
        expect(container.querySelector('.multi-image-spoiler-wrapper--blurred')).not.toBeInTheDocument();
    });

    test('should not show spoiler overlay when spoilerFileIds is empty', () => {
        const {container} = render(<MultiImageView {...baseProps} spoilerFileIds={[]} />);

        expect(container.querySelector('.spoiler-overlay')).not.toBeInTheDocument();
        expect(container.querySelector('.multi-image-spoiler-wrapper--blurred')).not.toBeInTheDocument();
    });

    test('should show spoiler overlay only for spoilered files', () => {
        const {container} = render(
            <MultiImageView {...baseProps} spoilerFileIds={['file1']} />,
        );

        // First image should be spoilered
        const wrappers = container.querySelectorAll('.multi-image-spoiler-wrapper');
        expect(wrappers[0]).toHaveClass('multi-image-spoiler-wrapper--blurred');

        // Second image should not be spoilered
        expect(wrappers[1]).not.toHaveClass('multi-image-spoiler-wrapper--blurred');

        // Only one overlay
        const overlays = container.querySelectorAll('.spoiler-overlay');
        expect(overlays).toHaveLength(1);
        expect(overlays[0].querySelector('.spoiler-overlay__text')).toHaveTextContent('SPOILER');
    });

    test('should show spoiler overlay for all files when all are spoilered', () => {
        const {container} = render(
            <MultiImageView {...baseProps} spoilerFileIds={['file1', 'file2']} />,
        );

        const blurred = container.querySelectorAll('.multi-image-spoiler-wrapper--blurred');
        expect(blurred).toHaveLength(2);

        const overlays = container.querySelectorAll('.spoiler-overlay');
        expect(overlays).toHaveLength(2);
    });

    test('should not open modal when clicking spoilered image', () => {
        render(
            <MultiImageView {...baseProps} spoilerFileIds={['file1']} />,
        );

        const images = screen.getAllByTestId('size-aware-image');
        fireEvent.click(images[0]);

        expect(mockOpenModal).not.toHaveBeenCalled();
    });

    test('should still allow clicking unspoilered images', () => {
        render(
            <MultiImageView {...baseProps} spoilerFileIds={['file1']} />,
        );

        // Second image (not spoilered) should be clickable
        const images = screen.getAllByTestId('size-aware-image');
        fireEvent.click(images[1]);

        expect(mockOpenModal).toHaveBeenCalledTimes(1);
    });

    test('should reveal image when spoiler wrapper is clicked', () => {
        const {container} = render(
            <MultiImageView {...baseProps} spoilerFileIds={['file1']} />,
        );

        const blurredWrapper = container.querySelector('.multi-image-spoiler-wrapper--blurred');
        expect(blurredWrapper).toBeInTheDocument();
        fireEvent.click(blurredWrapper!);

        // After clicking, blur and overlay should be removed
        expect(container.querySelector('.multi-image-spoiler-wrapper--blurred')).not.toBeInTheDocument();
        expect(container.querySelector('.spoiler-overlay')).not.toBeInTheDocument();
    });

    test('should allow image click after spoiler is revealed', () => {
        const {container} = render(
            <MultiImageView {...baseProps} spoilerFileIds={['file1']} />,
        );

        // Reveal the spoiler
        const blurredWrapper = container.querySelector('.multi-image-spoiler-wrapper--blurred');
        fireEvent.click(blurredWrapper!);

        // Now clicking the image should open modal
        const images = screen.getAllByTestId('size-aware-image');
        fireEvent.click(images[0]);

        expect(mockOpenModal).toHaveBeenCalledTimes(1);
    });
});
