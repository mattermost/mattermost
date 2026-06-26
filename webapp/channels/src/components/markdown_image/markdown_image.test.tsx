// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {fireEvent, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import Constants from 'utils/constants';

import MarkdownImage from './markdown_image';

describe('components/MarkdownImage', () => {
    const baseProps = {
        imageMetadata: {
            format: 'png',
            height: 90,
            width: 1041,
            frameCount: 0,
        },
        alt: 'test image',
        height: '',
        width: '',
        title: 'test title',
        className: 'markdown-inline-img',
        postId: 'post_id',
        imageIsLink: false,
        onImageLoaded: jest.fn(),
        onImageHeightChanged: jest.fn(),
        postType: 'system_generic',
        actions: {
            openModal: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const props = {...baseProps, src: '/images/logo.png'};
        const {container} = renderWithContext(
            <MarkdownImage {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for broken link', () => {
        const props = {
            ...baseProps,
            imageMetadata: {
                format: 'png',
                height: 10,
                width: 10,
                frameCount: 0,
            },
            src: 'brokenLink',
        };
        const {container} = renderWithContext(
            <MarkdownImage {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should handle load failure properly', () => {
        const props = {
            ...baseProps,
            imageMetadata: {
                format: 'png',
                height: 10,
                width: 10,
                frameCount: 0,
            },
            src: 'brokenLink',
        };
        const {container} = renderWithContext(
            <MarkdownImage {...props}/>,
        );

        const img = container.querySelector('img');
        expect(img).toBeInTheDocument();
        expect(img).not.toHaveClass('broken-image');

        // Simulate image error event - fireEvent used because userEvent doesn't support image loading events
        fireEvent.error(img!);

        // After load failure, image should have broken-image class
        expect(container.querySelector('img')).toHaveClass('broken-image');
    });

    test('should reset loadFailed state after image source is updated', () => {
        const props = {
            ...baseProps,
            imageMetadata: {
                format: 'png',
                height: 10,
                width: 10,
                frameCount: 0,
            },
            src: 'brokenLink',
        };
        const {container, rerender} = renderWithContext(
            <MarkdownImage {...props}/>,
        );

        const img = container.querySelector('img');

        fireEvent.error(img!);
        expect(container.querySelector('img')).toHaveClass('broken-image');

        // Update with new source
        const nextProps = {...baseProps, src: 'https://example.com/image.png'};
        rerender(<MarkdownImage {...nextProps}/>);

        // After source update, broken-image class should be removed
        expect(container.querySelector('img')).not.toHaveClass('broken-image');
    });

    test('should render a link if the source is unsafe', () => {
        const props = {...baseProps, src: ''};
        const {container} = renderWithContext(
            <MarkdownImage {...props}/>,
        );
        const img = container.querySelector('img');
        expect(img).toHaveAttribute('alt', props.alt);
        expect(img).toHaveClass('broken-image');
        expect(container).toMatchSnapshot();
    });

    test('should handle not loaded state properly', () => {
        const props = {...baseProps, src: 'https://example.com/image.png'};
        const {container} = renderWithContext(
            <MarkdownImage {...props}/>,
        );

        // Initially image should have loading class
        const img = container.querySelector('img');
        expect(img).toHaveClass('markdown-inline-img--loading');
    });

    test('should handle not loaded state properly in case of a header change system message', () => {
        const props = {...baseProps, src: 'https://example.com/image.png', postType: 'system_header_change'};
        const {container} = renderWithContext(
            <MarkdownImage {...props}/>,
        );

        // For header change system message, should have scaled-down-loading class
        const img = container.querySelector('img');
        expect(img).toHaveClass('markdown-inline-img--scaled-down-loading');
    });

    test('should set loaded state when img loads and call onImageLoaded prop', () => {
        const props = {...baseProps, src: 'https://example.com/image.png'};
        const {container} = renderWithContext(
            <MarkdownImage {...props}/>,
        );

        const img = container.querySelector('img');

        // Initially should have loading class
        expect(img).toHaveClass('markdown-inline-img--loading');

        // Mock naturalHeight/naturalWidth for SizeAwareImage's onImageLoaded callback
        Object.defineProperty(img, 'naturalHeight', {value: 90, configurable: true});
        Object.defineProperty(img, 'naturalWidth', {value: 1041, configurable: true});

        // Simulate image load event - fireEvent used because userEvent doesn't support image loading events
        fireEvent.load(img!);

        // After load, should not have loading class and onImageLoaded should be called
        expect(img).not.toHaveClass('markdown-inline-img--loading');
        expect(props.onImageLoaded).toHaveBeenCalledTimes(1);
        expect(props.onImageLoaded).toHaveBeenCalledWith({height: 90, width: 1041});
    });

    it('should match snapshot for SizeAwareImage dimensions', () => {
        const props = {
            ...baseProps,
            imageMetadata: {format: 'jpg', frameCount: 0, width: 100, height: 90},
            src: 'path/image',
        };
        const {container} = renderWithContext(
            <MarkdownImage {...props}/>,
        );

        const img = container.querySelector('img');

        // Mock naturalHeight/naturalWidth for SizeAwareImage's onImageLoaded callback
        Object.defineProperty(img, 'naturalHeight', {value: 90, configurable: true});
        Object.defineProperty(img, 'naturalWidth', {value: 100, configurable: true});

        fireEvent.load(img!);

        expect(container).toMatchSnapshot();
    });

    test('should render an image with preview modal if the source is safe', () => {
        const props = {...baseProps, src: 'https://example.com/image.png'};
        const {container} = renderWithContext(
            <MarkdownImage {...props}/>,
        );

        const img = container.querySelector('img');

        // Mock naturalHeight/naturalWidth for SizeAwareImage's onImageLoaded callback
        Object.defineProperty(img, 'naturalHeight', {value: 90, configurable: true});
        Object.defineProperty(img, 'naturalWidth', {value: 1041, configurable: true});

        fireEvent.load(img!);

        // After load, should have hover and cursor classes for clickable preview
        expect(img).toHaveClass('markdown-inline-img--hover');
        expect(img).toHaveClass('cursor--pointer');
        expect(img).toHaveClass('a11y--active');
        expect(container).toMatchSnapshot();
    });

    test('should render an image with no preview if the source is safe and the image is a link', () => {
        const props = {...baseProps, src: 'https://example.com/image.png', imageIsLink: true};
        const {container} = renderWithContext(
            <MarkdownImage {...props}/>,
        );

        const img = container.querySelector('img');

        // Mock naturalHeight/naturalWidth for SizeAwareImage's onImageLoaded callback
        Object.defineProperty(img, 'naturalHeight', {value: 90, configurable: true});
        Object.defineProperty(img, 'naturalWidth', {value: 1041, configurable: true});

        fireEvent.load(img!);

        // When imageIsLink, should have no-border class and not cursor--pointer
        expect(img).toHaveClass('markdown-inline-img--hover');
        expect(img).toHaveClass('markdown-inline-img--no-border');
        expect(img).not.toHaveClass('cursor--pointer');
        expect(container).toMatchSnapshot();
    });

    test('should call openModal when showModal is called', async () => {
        const props = {...baseProps, src: 'https://example.com/image.png'};
        const {container} = renderWithContext(
            <MarkdownImage {...props}/>,
        );

        const img = container.querySelector('img');

        // Mock naturalHeight/naturalWidth for SizeAwareImage's onImageLoaded callback
        Object.defineProperty(img, 'naturalHeight', {value: 90, configurable: true});
        Object.defineProperty(img, 'naturalWidth', {value: 1041, configurable: true});

        fireEvent.load(img!);

        // Click the image to trigger showModal
        await userEvent.click(img!);

        expect(props.actions.openModal).toHaveBeenCalledTimes(1);
    });

    test('should properly scale down the image in case of a header change system message', () => {
        const props = {...baseProps, src: 'https://example.com/image.png', postType: 'system_header_change'};
        const {container} = renderWithContext(
            <MarkdownImage {...props}/>,
        );

        const img = container.querySelector('img');

        // Mock naturalHeight/naturalWidth for SizeAwareImage's onImageLoaded callback
        Object.defineProperty(img, 'naturalHeight', {value: 90, configurable: true});
        Object.defineProperty(img, 'naturalWidth', {value: 1041, configurable: true});

        fireEvent.load(img!);

        // After load, should have scaled-down class
        expect(img).toHaveClass('markdown-inline-img--scaled-down');
        expect(img).not.toHaveClass('markdown-inline-img--scaled-down-loading');
    });

    test('should render image with title, height, width', () => {
        const props = {
            ...baseProps,
            alt: 'test image',
            title: 'test title',
            className: 'markdown-inline-img',
            postId: 'post_id',
            src: 'https://example.com/image.png',
            imageIsLink: false,
            height: '76',
            width: '50',
        };

        const {container} = renderWithContext(
            <MarkdownImage {...props}/>,
        );

        const img = container.querySelector('img');

        // Mock naturalHeight/naturalWidth for SizeAwareImage's onImageLoaded callback
        Object.defineProperty(img, 'naturalHeight', {value: 76, configurable: true});
        Object.defineProperty(img, 'naturalWidth', {value: 50, configurable: true});

        fireEvent.load(img!);

        expect(img).toHaveAttribute('width', '50');
        expect(img).toHaveAttribute('height', '76');
        expect(img).toHaveAttribute('title', 'test title');
    });

    test(`should render image with MarkdownImageExpand if it is taller than ${Constants.EXPANDABLE_INLINE_IMAGE_MIN_HEIGHT}px`, () => {
        const props = {
            ...baseProps,
            alt: 'test image',
            title: 'test title',
            className: 'markdown-inline-img',
            postId: 'post_id',
            src: 'https://example.com/image.png',
            imageIsLink: false,
            height: '250',
            width: '50',
        };

        const {container} = renderWithContext(
            <MarkdownImage {...props}/>,
        );

        const img = container.querySelector('img');

        // Mock naturalHeight/naturalWidth for SizeAwareImage's onImageLoaded callback
        Object.defineProperty(img, 'naturalHeight', {value: 250, configurable: true});
        Object.defineProperty(img, 'naturalWidth', {value: 50, configurable: true});

        fireEvent.load(img!);

        expect(container).toMatchSnapshot();
    });

    test('should provide image src as an alt text for MarkdownImageExpand if image has no own alt text', () => {
        const props = {
            ...baseProps,
            alt: '',
            title: 'test title',
            className: 'markdown-inline-img',
            postId: 'post_id',
            src: 'https://example.com/image.png',
            imageIsLink: false,
            height: '250',
            width: '50',
        };

        const {container} = renderWithContext(
            <MarkdownImage {...props}/>,
        );

        const img = container.querySelector('img');

        // Mock naturalHeight/naturalWidth for SizeAwareImage's onImageLoaded callback
        Object.defineProperty(img, 'naturalHeight', {value: 250, configurable: true});
        Object.defineProperty(img, 'naturalWidth', {value: 50, configurable: true});

        fireEvent.load(img!);

        expect(container).toMatchSnapshot();
    });

    test('should render a alt text if the link is unsafe', () => {
        const props = {...baseProps, isUnsafeLinksPost: true};
        renderWithContext(
            <MarkdownImage {...props}/>,
        );
        expect(screen.getByText(props.alt)).toBeInTheDocument();
    });
});
