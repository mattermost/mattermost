// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';

import type {FileInfo} from '@mattermost/types/files';

import MultiImageView from './multi_image_view';

// Mock the file utils
jest.mock('mattermost-redux/utils/file_utils', () => ({
    getFileUrl: (fileId: string) => `/api/v4/files/${fileId}`,
    getFilePreviewUrl: (fileId: string) => `/api/v4/files/${fileId}/preview`,
}));

// Mock the FilePreviewModal
jest.mock('components/file_preview_modal', () => ({
    __esModule: true,
    default: () => <div data-testid='file-preview-modal'>Preview Modal</div>,
}));

// Mock SizeAwareImage to simplify testing
jest.mock('components/size_aware_image', () => ({
    __esModule: true,
    default: ({onClick, onImageLoaded, src, className, maxHeight, maxWidth}: {
        onClick: () => void;
        onImageLoaded: () => void;
        src: string;
        className: string;
        maxHeight?: number;
        maxWidth?: number;
    }) => (
        <img
            data-testid='size-aware-image'
            src={src}
            className={className}
            onClick={onClick}
            onLoad={onImageLoaded}
            data-maxheight={maxHeight}
            data-maxwidth={maxWidth}
        />
    ),
}));

describe('MultiImageView', () => {
    const mockOpenModal = jest.fn();

    const createFileInfo = (id: string, name: string, overrides?: Partial<FileInfo>): FileInfo => ({
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
        ...overrides,
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

    test('renders multiple images', () => {
        render(<MultiImageView {...baseProps} />);

        const images = screen.getAllByTestId('size-aware-image');
        expect(images).toHaveLength(2);
    });

    test('returns null when fileInfos is empty', () => {
        const {container} = render(<MultiImageView {...baseProps} fileInfos={[]} />);
        expect(container.firstChild).toBeNull();
    });

    test('returns null when fileInfos is undefined', () => {
        const {container} = render(
            <MultiImageView {...baseProps} fileInfos={undefined as unknown as FileInfo[]} />,
        );
        expect(container.firstChild).toBeNull();
    });

    test('renders container with correct class', () => {
        render(<MultiImageView {...baseProps} />);

        const container = screen.getByTestId('multiImageView');
        expect(container).toHaveClass('multi-image-view');
    });

    test('applies compact-display class when compactDisplay is true', () => {
        render(<MultiImageView {...baseProps} compactDisplay={true} />);

        const container = screen.getByTestId('multiImageView');
        expect(container).toHaveClass('compact-display');
    });

    test('does not apply compact-display class by default', () => {
        render(<MultiImageView {...baseProps} />);

        const container = screen.getByTestId('multiImageView');
        expect(container).not.toHaveClass('compact-display');
    });

    test('applies is-permalink class when isInPermalink is true', () => {
        render(<MultiImageView {...baseProps} isInPermalink={true} />);

        const container = screen.getByTestId('multiImageView');
        expect(container).toHaveClass('is-permalink');
    });

    test('uses preview URL when has_preview_image is true', () => {
        render(<MultiImageView {...baseProps} />);

        const images = screen.getAllByTestId('size-aware-image');
        expect(images[0]).toHaveAttribute('src', '/api/v4/files/file1/preview');
    });

    test('uses file URL when has_preview_image is false', () => {
        const propsWithNoPreview = {
            ...baseProps,
            fileInfos: [createFileInfo('file1', 'image1.png', {has_preview_image: false})],
        };

        render(<MultiImageView {...propsWithNoPreview} />);

        const image = screen.getByTestId('size-aware-image');
        expect(image).toHaveAttribute('src', '/api/v4/files/file1');
    });

    test('opens modal with correct props when image is clicked', () => {
        render(<MultiImageView {...baseProps} />);

        const images = screen.getAllByTestId('size-aware-image');
        fireEvent.click(images[0]);

        expect(mockOpenModal).toHaveBeenCalledWith({
            modalId: expect.any(String),
            dialogType: expect.any(Function),
            dialogProps: {
                fileInfos: baseProps.fileInfos,
                postId: 'post123',
                startIndex: 0,
            },
        });
    });

    test('opens modal with correct startIndex for second image', () => {
        render(<MultiImageView {...baseProps} />);

        const images = screen.getAllByTestId('size-aware-image');
        fireEvent.click(images[1]);

        expect(mockOpenModal).toHaveBeenCalledWith(
            expect.objectContaining({
                dialogProps: expect.objectContaining({
                    startIndex: 1,
                }),
            }),
        );
    });

    test('passes maxHeight when ImageSmaller is enabled', () => {
        const propsWithMax = {
            ...baseProps,
            maxImageHeight: 400,
        };

        render(<MultiImageView {...propsWithMax} />);

        const image = screen.getAllByTestId('size-aware-image')[0];
        expect(image).toHaveAttribute('data-maxheight', '400');
    });

    test('passes maxWidth when ImageSmaller is enabled', () => {
        const propsWithMax = {
            ...baseProps,
            maxImageWidth: 500,
        };

        render(<MultiImageView {...propsWithMax} />);

        const image = screen.getAllByTestId('size-aware-image')[0];
        expect(image).toHaveAttribute('data-maxwidth', '500');
    });

    test('does not pass maxHeight when value is 0', () => {
        render(<MultiImageView {...baseProps} />);

        const image = screen.getAllByTestId('size-aware-image')[0];
        expect(image).not.toHaveAttribute('data-maxheight');
    });

    test('does not pass maxWidth when value is 0', () => {
        render(<MultiImageView {...baseProps} />);

        const image = screen.getAllByTestId('size-aware-image')[0];
        expect(image).not.toHaveAttribute('data-maxwidth');
    });

    test('skips archived files', () => {
        const propsWithArchived = {
            ...baseProps,
            fileInfos: [
                createFileInfo('file1', 'image1.png'),
                createFileInfo('file2', 'image2.png', {archived: true}),
                createFileInfo('file3', 'image3.png'),
            ],
        };

        render(<MultiImageView {...propsWithArchived} />);

        const images = screen.getAllByTestId('size-aware-image');
        expect(images).toHaveLength(2);
    });

    test('skips null entries in fileInfos', () => {
        const propsWithNull = {
            ...baseProps,
            fileInfos: [
                createFileInfo('file1', 'image1.png'),
                null as unknown as FileInfo,
                createFileInfo('file3', 'image3.png'),
            ],
        };

        render(<MultiImageView {...propsWithNull} />);

        const images = screen.getAllByTestId('size-aware-image');
        expect(images).toHaveLength(2);
    });

    test('handles files without dimensions', () => {
        const propsNoDims = {
            ...baseProps,
            fileInfos: [createFileInfo('file1', 'image1.png', {width: 0, height: 0})],
        };

        render(<MultiImageView {...propsNoDims} />);

        const image = screen.getByTestId('size-aware-image');
        expect(image).toBeInTheDocument();
    });

    test('adds loaded class after image loads', () => {
        render(<MultiImageView {...baseProps} />);

        const images = screen.getAllByTestId('size-aware-image');
        fireEvent.load(images[0]);

        // Find the wrapper div for the first image
        const container = screen.getByTestId('multiImageView');
        const imageItems = container.querySelectorAll('.multi-image-view__item');
        expect(imageItems[0]).toHaveClass('multi-image-view__item--loaded');
    });

    test('each image has correct wrapper class', () => {
        render(<MultiImageView {...baseProps} />);

        const container = screen.getByTestId('multiImageView');
        const imageItems = container.querySelectorAll('.multi-image-view__item');
        expect(imageItems).toHaveLength(2);
    });

    test('applies both compact-display and is-permalink classes', () => {
        render(<MultiImageView {...baseProps} compactDisplay={true} isInPermalink={true} />);

        const container = screen.getByTestId('multiImageView');
        expect(container).toHaveClass('compact-display');
        expect(container).toHaveClass('is-permalink');
    });

    test('handles single image', () => {
        const propsSingle = {
            ...baseProps,
            fileInfos: [createFileInfo('file1', 'single.png')],
        };

        render(<MultiImageView {...propsSingle} />);

        const images = screen.getAllByTestId('size-aware-image');
        expect(images).toHaveLength(1);
    });

    test('handles many images', () => {
        const manyFileInfos = Array.from({length: 10}, (_, i) =>
            createFileInfo(`file${i}`, `image${i}.png`),
        );

        const propsMany = {
            ...baseProps,
            fileInfos: manyFileInfos,
        };

        render(<MultiImageView {...propsMany} />);

        const images = screen.getAllByTestId('size-aware-image');
        expect(images).toHaveLength(10);
    });

    test('images apply compact-display class', () => {
        render(<MultiImageView {...baseProps} compactDisplay={true} />);

        const images = screen.getAllByTestId('size-aware-image');
        expect(images[0]).toHaveClass('compact-display');
    });

    test('images apply is-permalink class', () => {
        render(<MultiImageView {...baseProps} isInPermalink={true} />);

        const images = screen.getAllByTestId('size-aware-image');
        expect(images[0]).toHaveClass('is-permalink');
    });
});
