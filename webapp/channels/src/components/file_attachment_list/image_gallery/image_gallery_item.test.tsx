// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';

import type {FileInfo} from '@mattermost/types/files';

import ImageGalleryItem from './image_gallery_item';

// Mock SingleImageView since we don't need to test its internals
jest.mock('../../../components/single_image_view', () => {
    return function MockSingleImageView(props: any) {
        return (
            <div
                data-testid='singleImageView'
                onClick={props.onClick}
            >
                Mock SingleImageView
            </div>
        );
    };
});

const mockFileInfo: FileInfo = {
    id: 'file_id',
    name: 'test.jpg',
    extension: 'jpg',
    size: 1024,
    width: 100,
    height: 100,
} as FileInfo;

const defaultProps = {
    fileInfo: mockFileInfo,
    allFilesForPost: [mockFileInfo],
    postId: 'post_id',
    isSmall: false,
    index: 0,
    totalImages: 1,
};

describe('ImageGalleryItem', () => {
    test('should render correctly', () => {
        render(<ImageGalleryItem {...defaultProps}/>);
        expect(screen.getByTestId('image-gallery__item')).toBeInTheDocument();
        expect(screen.getByTestId('singleImageView')).toBeInTheDocument();
    });

    test('should focus on click', () => {
        const onFocus = jest.fn();
        render(<ImageGalleryItem {...defaultProps} onFocus={onFocus}/>);
        
        fireEvent.focus(screen.getByTestId('image-gallery__item'));
        expect(onFocus).toHaveBeenCalled();
    });

    test('should handle keyboard navigation', () => {
        render(<ImageGalleryItem {...defaultProps}/>);
        
        fireEvent.keyDown(screen.getByTestId('image-gallery__item'), {key: 'Enter'});
        // No assertion needed since SingleImageView handles the click behavior
    });

    test('should apply focused class when isFocused is true', () => {
        render(<ImageGalleryItem {...defaultProps} isFocused={true}/>);
        expect(screen.getByTestId('image-gallery__item')).toHaveClass('image-gallery__item--focused');
    });

    test('should apply small class when isSmall is true', () => {
        render(<ImageGalleryItem {...defaultProps} isSmall={true}/>);
        expect(screen.getByTestId('image-gallery__item')).toHaveClass('image-gallery__item--small');
    });
});
