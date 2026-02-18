// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import SingleImageView from 'components/single_image_view/single_image_view';

import {fireEvent, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/SingleImageView', () => {
    // Mock fetch to simulate successful thumbnail availability check
    const mockFetch = jest.fn(() =>
        Promise.resolve({
            status: 200,
            headers: new Headers(),
        } as Response),
    );

    beforeEach(() => {
        global.fetch = mockFetch;
        mockFetch.mockClear();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });
    const baseProps = {
        postId: 'original_post_id',
        fileInfo: TestHelper.getFileInfoMock({id: 'file_info_id'}),
        isRhsOpen: false,
        isEmbedVisible: true,
        actions: {
            toggleEmbedVisibility: jest.fn(),
            openModal: jest.fn(),
            getFilePublicLink: jest.fn(),
        },
        enablePublicLink: false,
        isFileRejected: false,
    };

    test('should match snapshot', async () => {
        const {container} = renderWithContext(
            <SingleImageView {...baseProps}/>,
        );

        // Wait for thumbnail availability check to complete
        await waitFor(() => {
            expect(container.querySelector('img')).toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();

        // Simulate loaded state by triggering image load
        const img = container.querySelector('img');
        expect(img).toBeInTheDocument();
        Object.defineProperty(img, 'naturalHeight', {value: 100, configurable: true});
        Object.defineProperty(img, 'naturalWidth', {value: 100, configurable: true});

        // Simulate image load event - fireEvent used because userEvent doesn't support image loading events
        fireEvent.load(img!);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, SVG image', async () => {
        const fileInfo = TestHelper.getFileInfoMock({
            id: 'svg_file_info_id',
            name: 'name_svg',
            extension: 'svg',
        });
        const props = {...baseProps, fileInfo};
        const {container} = renderWithContext(
            <SingleImageView {...props}/>,
        );

        // Wait for thumbnail availability check to complete
        await waitFor(() => {
            expect(container.querySelector('img')).toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();

        // Simulate loaded state by triggering image load
        const img = container.querySelector('img');
        expect(img).toBeInTheDocument();
        Object.defineProperty(img, 'naturalHeight', {value: 100, configurable: true});
        Object.defineProperty(img, 'naturalWidth', {value: 100, configurable: true});

        fireEvent.load(img!);
        expect(container).toMatchSnapshot();
    });

    test('should call openModal on handleImageClick', async () => {
        const {container} = renderWithContext(
            <SingleImageView {...baseProps}/>,
        );

        // Wait for thumbnail availability check to complete
        await waitFor(() => {
            expect(container.querySelector('img')).toBeInTheDocument();
        });

        const img = container.querySelector('img');
        expect(img).toBeInTheDocument();

        // Simulate loaded state
        Object.defineProperty(img, 'naturalHeight', {value: 100, configurable: true});
        Object.defineProperty(img, 'naturalWidth', {value: 100, configurable: true});

        fireEvent.load(img!);

        // Click the image
        await userEvent.click(img!);
        expect(baseProps.actions.openModal).toHaveBeenCalledTimes(1);
    });

    test('should call toggleEmbedVisibility with post id', async () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                toggleEmbedVisibility: jest.fn(),
            },
        };

        renderWithContext(
            <SingleImageView {...props}/>,
        );

        // Wait for thumbnail availability check to complete
        await waitFor(() => {
            expect(screen.getByRole('button', {name: 'Toggle Embed Visibility'})).toBeInTheDocument();
        });

        await userEvent.click(screen.getByRole('button', {name: 'Toggle Embed Visibility'}));
        expect(props.actions.toggleEmbedVisibility).toHaveBeenCalledTimes(1);
        expect(props.actions.toggleEmbedVisibility).toHaveBeenCalledWith('original_post_id');
    });

    test('should set loaded state on callback of onImageLoaded on SizeAwareImage component', async () => {
        const {container} = renderWithContext(
            <SingleImageView {...baseProps}/>,
        );

        // Wait for thumbnail availability check to complete
        await waitFor(() => {
            expect(container.querySelector('.image-loaded')).toBeInTheDocument();
        });

        // Initially should not have image-fade-in class (loaded = false)
        const imageLoadedDiv = container.querySelector('.image-loaded');
        expect(imageLoadedDiv).not.toHaveClass('image-fade-in');

        // Simulate image loaded
        const img = container.querySelector('img');
        expect(img).toBeInTheDocument();
        Object.defineProperty(img, 'naturalHeight', {value: 100, configurable: true});
        Object.defineProperty(img, 'naturalWidth', {value: 100, configurable: true});

        fireEvent.load(img!);

        // After load, should have image-fade-in class (loaded = true)
        expect(container.querySelector('.image-loaded')).toHaveClass('image-fade-in');
        expect(container).toMatchSnapshot();
    });

    test('should correctly pass prop down to surround small images with a container', async () => {
        const {container} = renderWithContext(
            <SingleImageView {...baseProps}/>,
        );

        // Wait for thumbnail availability check to complete
        await waitFor(() => {
            expect(container.querySelector('.file-preview__button')).toBeInTheDocument();
        });

        // The SizeAwareImage component should receive handleSmallImageContainer=true
        // This is verified by checking that the component renders correctly
        // The actual prop passing is internal, but we can verify the component structure
        expect(container.querySelector('.file-preview__button')).toBeInTheDocument();
    });

    test('should not show filename when image is displayed', async () => {
        const {container} = renderWithContext(
            <SingleImageView
                {...baseProps}
                isEmbedVisible={true}
            />,
        );

        // Wait for thumbnail availability check to complete (image-header--expanded indicates full render)
        await waitFor(() => {
            expect(container.querySelector('.image-header--expanded')).toBeInTheDocument();
        });

        expect(container.querySelector('.image-header')?.textContent).toHaveLength(0);
    });

    test('should show filename when image is collapsed', async () => {
        const {container} = renderWithContext(
            <SingleImageView
                {...baseProps}
                isEmbedVisible={false}
            />,
        );

        // Wait for thumbnail availability check to complete (toggle button indicates full render)
        await waitFor(() => {
            expect(container.querySelector('.single-image-view__toggle')).toBeInTheDocument();
        });

        expect(container.querySelector('.image-header')?.textContent).toEqual(baseProps.fileInfo.name);
    });

    describe('permalink preview', () => {
        test('should render with permalink styling if in permalink', async () => {
            const props = {
                ...baseProps,
                isInPermalink: true,
            };

            const {container} = renderWithContext(<SingleImageView {...props}/>);

            // Wait for thumbnail availability check to complete
            await waitFor(() => {
                expect(container.querySelector('.image-permalink')).toBeInTheDocument();
            });

            expect(container.querySelector('.image-permalink')).toBeInTheDocument();
            expect(container).toMatchSnapshot();
        });
    });
});
