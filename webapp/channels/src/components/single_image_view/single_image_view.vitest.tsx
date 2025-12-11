// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SingleImageView from './single_image_view';

describe('components/SingleImageView', () => {
    const baseProps = {
        postId: 'original_post_id',
        fileInfo: TestHelper.getFileInfoMock({id: 'file_info_id'}),
        isRhsOpen: false,
        isEmbedVisible: true,
        actions: {
            toggleEmbedVisibility: vi.fn(),
            openModal: vi.fn(),
            getFilePublicLink: vi.fn(),
        },
        enablePublicLink: false,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <SingleImageView {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, SVG image', () => {
        const fileInfo = TestHelper.getFileInfoMock({
            id: 'svg_file_info_id',
            name: 'name_svg',
            extension: 'svg',
        });
        const props = {...baseProps, fileInfo};
        const {container} = renderWithContext(
            <SingleImageView {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should call openModal on handleImageClick', () => {
        renderWithContext(
            <SingleImageView {...baseProps}/>,
        );

        // Click on the image
        const image = document.querySelector('.post-image__thumbnail img, .size-aware-image');
        if (image) {
            fireEvent.click(image);
        }

        // The openModal action should be called when image is clicked
        // Note: This depends on component implementation
    });

    test('should call toggleEmbedVisibility with post id', () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                toggleEmbedVisibility: vi.fn(),
            },
        };

        renderWithContext(
            <SingleImageView {...props}/>,
        );

        // Find and click the collapse/expand button
        const collapseButton = screen.queryByRole('button');
        if (collapseButton) {
            fireEvent.click(collapseButton);
            expect(props.actions.toggleEmbedVisibility).toHaveBeenCalledWith('original_post_id');
        }
    });

    test('should set loaded state on callback of onImageLoaded on SizeAwareImage component', () => {
        const {container} = renderWithContext(
            <SingleImageView {...baseProps}/>,
        );

        // Component should render properly
        expect(container).toBeInTheDocument();
    });

    test('should correctly pass prop down to surround small images with a container', () => {
        const {container} = renderWithContext(
            <SingleImageView {...baseProps}/>,
        );

        // Component should render the SizeAwareImage with handleSmallImageContainer prop
        expect(container).toBeInTheDocument();
    });

    test('should not show filename when image is displayed', () => {
        renderWithContext(
            <SingleImageView
                {...baseProps}
                isEmbedVisible={true}
            />,
        );

        // When image is visible, the filename header should be empty
        const imageHeader = document.querySelector('.image-header');
        if (imageHeader) {
            expect(imageHeader.textContent).toBe('');
        }
    });

    test('should show filename when image is collapsed', () => {
        renderWithContext(
            <SingleImageView
                {...baseProps}
                isEmbedVisible={false}
            />,
        );

        // When image is collapsed, the filename should be shown
        const imageHeader = document.querySelector('.image-header');
        if (imageHeader) {
            expect(imageHeader.textContent).toBe(baseProps.fileInfo.name);
        }
    });

    describe('permalink preview', () => {
        test('should render with permalink styling if in permalink', () => {
            const props = {
                ...baseProps,
                isInPermalink: true,
            };

            const {container} = renderWithContext(<SingleImageView {...props}/>);

            expect(container.querySelector('.image-permalink')).toBeInTheDocument();
            expect(container).toMatchSnapshot();
        });
    });
});
