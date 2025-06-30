// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, fireEvent} from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';

import {TestHelper} from 'utils/test_helper';

import ImageGalleryItem from './image_gallery_item';

jest.mock('components/single_image_view', () => (props: any) => (
    <div
        data-testid='singleImageView'
        onClick={props.handleImageClick}
    >
        {props.fileInfo.name}
    </div>
));

jest.mock('components/file_attachment_list/image_gallery/image_gallery', () => ({
    GALLERY_CONFIG: {
        SMALL_IMAGE_THRESHOLD: 216,
    },
}));

const mockFileInfos = [
    TestHelper.getFileInfoMock({
        id: 'img1',
        name: 'image1.png',
        extension: 'png',
        width: 100,
        height: 100,
    }),
];

const defaultProps = {
    fileInfo: mockFileInfos[0],
    allFilesForPost: mockFileInfos,
    postId: 'post1',
    handleImageClick: jest.fn(),
    isSmall: false,
    itemStyle: {},
    index: 0,
    totalImages: 1,
};

describe('ImageGalleryItem', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders correctly and matches snapshot', () => {
        const {container} = render(<ImageGalleryItem {...defaultProps}/>);
        expect(container.firstChild).toMatchSnapshot();
    });

    it('calls handleImageClick on click', () => {
        render(<ImageGalleryItem {...defaultProps}/>);
        fireEvent.click(screen.getByTestId('singleImageView'));
        expect(defaultProps.handleImageClick).toHaveBeenCalled();
    });

    it('calls handleImageClick on Enter key press', () => {
        render(<ImageGalleryItem {...defaultProps}/>);
        fireEvent.keyDown(screen.getByRole('listitem'), {key: 'Enter'});
        expect(defaultProps.handleImageClick).toHaveBeenCalled();
    });

    it('calls handleImageClick on Space key press', () => {
        render(<ImageGalleryItem {...defaultProps}/>);
        fireEvent.keyDown(screen.getByRole('listitem'), {key: ' '});
        expect(defaultProps.handleImageClick).toHaveBeenCalled();
    });

    it('does not call handleImageClick on other key presses', () => {
        render(<ImageGalleryItem {...defaultProps}/>);
        fireEvent.keyDown(screen.getByRole('listitem'), {key: 'A'});
        expect(defaultProps.handleImageClick).not.toHaveBeenCalled();
    });
});
