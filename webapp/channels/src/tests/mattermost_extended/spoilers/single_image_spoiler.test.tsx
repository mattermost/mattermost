// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';

import SingleImageView from 'components/single_image_view/single_image_view';

import {TestHelper} from 'utils/test_helper';

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
    getFilePreviewUrl: (fileId: string) => `/api/v4/files/${fileId}/preview`,
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
        onClick?: (e: React.MouseEvent) => void;
        onImageLoaded?: () => void;
        src: string;
        className?: string;
    }) => (
        <img
            data-testid='size-aware-image'
            src={src}
            className={className || ''}
            onClick={onClick}
            onLoad={onImageLoaded}
        />
    ),
}));

describe('SingleImageView spoiler functionality', () => {
    const baseProps = {
        postId: 'post_id',
        fileInfo: TestHelper.getFileInfoMock({id: 'file_info_id', has_preview_image: true}),
        isRhsOpen: false,
        isEmbedVisible: true,
        actions: {
            toggleEmbedVisibility: jest.fn(),
            openModal: jest.fn(),
            getFilePublicLink: jest.fn(),
        },
        enablePublicLink: false,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should not show spoiler overlay when isSpoilered is false', () => {
        const {container} = render(
            <SingleImageView {...baseProps} isSpoilered={false}/>,
        );

        expect(container.querySelector('.spoiler-overlay')).not.toBeInTheDocument();
        expect(container.querySelector('.single-image-spoiler-wrapper--blurred')).not.toBeInTheDocument();
    });

    test('should not show spoiler overlay when isSpoilered is undefined', () => {
        const {container} = render(
            <SingleImageView {...baseProps}/>,
        );

        expect(container.querySelector('.spoiler-overlay')).not.toBeInTheDocument();
        expect(container.querySelector('.single-image-spoiler-wrapper--blurred')).not.toBeInTheDocument();
    });

    test('should show spoiler overlay and blur when isSpoilered is true', () => {
        const {container} = render(
            <SingleImageView {...baseProps} isSpoilered={true}/>,
        );

        expect(container.querySelector('.spoiler-overlay')).toBeInTheDocument();
        expect(container.querySelector('.spoiler-overlay__text')).toHaveTextContent('SPOILER');
        expect(container.querySelector('.single-image-spoiler-wrapper--blurred')).toBeInTheDocument();
    });

    test('should not allow image click when spoiler overlay is shown', () => {
        render(
            <SingleImageView {...baseProps} isSpoilered={true}/>,
        );

        // SizeAwareImage should not have an onClick when spoilered
        const image = screen.getByTestId('size-aware-image');
        fireEvent.click(image);

        expect(baseProps.actions.openModal).not.toHaveBeenCalled();
    });

    test('should reveal image when spoiler overlay is clicked', () => {
        const {container} = render(
            <SingleImageView {...baseProps} isSpoilered={true}/>,
        );

        const wrapper = container.querySelector('.single-image-spoiler-wrapper--blurred');
        expect(wrapper).toBeInTheDocument();
        fireEvent.click(wrapper!);

        // After click, blur and overlay should be removed
        expect(container.querySelector('.single-image-spoiler-wrapper--blurred')).not.toBeInTheDocument();
        expect(container.querySelector('.spoiler-overlay')).not.toBeInTheDocument();
    });

    test('should allow image click after spoiler is revealed', () => {
        const {container} = render(
            <SingleImageView {...baseProps} isSpoilered={true}/>,
        );

        // Reveal the spoiler first
        const wrapper = container.querySelector('.single-image-spoiler-wrapper--blurred');
        fireEvent.click(wrapper!);

        // Now clicking the image should open modal
        const image = screen.getByTestId('size-aware-image');
        fireEvent.click(image);

        expect(baseProps.actions.openModal).toHaveBeenCalledTimes(1);
    });
});
