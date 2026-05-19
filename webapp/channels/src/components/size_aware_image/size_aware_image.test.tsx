// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, act} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SizeAwareImage from './size_aware_image';

function simulateImageLoad(img: HTMLImageElement, naturalWidth: number, naturalHeight: number) {
    Object.defineProperty(img, 'naturalWidth', {value: naturalWidth, configurable: true});
    Object.defineProperty(img, 'naturalHeight', {value: naturalHeight, configurable: true});
    act(() => {
        img.dispatchEvent(new Event('load', {bubbles: true}));
    });
}

function simulateImageError(img: HTMLImageElement) {
    act(() => {
        img.dispatchEvent(new Event('error', {bubbles: true}));
    });
}

describe('components/SizeAwareImage', () => {
    const baseProps = {
        dimensions: {
            height: 200,
            width: 300,
        },
        onImageLoaded: jest.fn(),
        onImageLoadFail: jest.fn(),
        getFilePublicLink: jest.fn().mockReturnValue(Promise.resolve({data: {link: 'https://example.com/image.png'}})),
        src: 'https://example.com/image.png',
        className: 'class',
        fileInfo: TestHelper.getFileInfoMock({
            name: 'photo-1533709752211-118fcaf03312',
        }),
        enablePublicLink: true,
    };

    const state = {
        entities: {
            general: {
                config: {},
            },
            users: {
                currentUserId: 'currentUserId',
            },
        },
    };

    test('should render an svg when first mounted with dimensions and img display set to none', () => {
        const {container} = renderWithContext(<SizeAwareImage {...baseProps}/>, state);

        const svgElement = container.querySelector('.image-loading__container > svg');
        expect(svgElement).not.toBeNull();
        expect(svgElement?.getAttribute('viewBox')).toEqual('0 0 300 200');
        const filePreviewButton = container.querySelector('.file-preview__button') as HTMLElement;
        expect(filePreviewButton.style.display).toEqual('none');
    });

    test('img should have inherited class name from prop', () => {
        const {container} = renderWithContext(<SizeAwareImage {...{...baseProps, className: 'imgClass'}}/>, state);

        const img = container.querySelector('img');
        expect(img?.className).toEqual('imgClass');
    });

    test('should render a placeholder and has loader when showLoader is true', () => {
        const props = {
            ...baseProps,
            showLoader: true,
        };

        const {container} = renderWithContext(<SizeAwareImage {...props}/>, state);
        expect(container.querySelector('.file__image-loading')).not.toBeNull();
        expect(container).toMatchSnapshot();
    });

    test('should render a mini preview when showLoader is true and preview is set', () => {
        const props = {
            ...baseProps,
            fileInfo: TestHelper.getFileInfoMock({
                ...baseProps.fileInfo,
                mime_type: 'mime_type',
                mini_preview: 'mini_preview',
            }),
        };

        // The component initially has loaded=false and error=false, so mini preview should show
        const {container} = renderWithContext(<SizeAwareImage {...props}/>, state);

        const miniPreviewImg = container.querySelector('.image-loading__container img');
        expect(miniPreviewImg?.getAttribute('src')).toEqual('data:mime_type;base64,mini_preview');
    });

    test('should have display set to flex in loaded state', () => {
        const {container} = renderWithContext(<SizeAwareImage {...baseProps}/>, state);

        const img = container.querySelector('img')!;
        simulateImageLoad(img, 300, 200);

        const filePreviewButton = container.querySelector('.file-preview__button') as HTMLElement;
        expect(filePreviewButton.style.display).toEqual('flex');
    });

    test('should render the actual image when first mounted without dimensions', () => {
        const props = {...baseProps};
        Reflect.deleteProperty(props, 'dimensions');

        const {container} = renderWithContext(<SizeAwareImage {...props}/>, state);

        // Initially error is false, so image should render with src
        const img = container.querySelector('img');
        expect(img?.getAttribute('src')).toEqual(baseProps.src);
    });

    test('should set loaded state when img loads and call onImageLoaded prop', () => {
        const height = 123;
        const width = 1234;

        const {container} = renderWithContext(<SizeAwareImage {...baseProps}/>, state);

        const img = container.querySelector('img')!;
        simulateImageLoad(img, width, height);

        // Verify loaded state through DOM: file-preview__button should be visible
        const filePreviewButton = container.querySelector('.file-preview__button') as HTMLElement;
        expect(filePreviewButton.style.display).toEqual('flex');
        expect(baseProps.onImageLoaded).toHaveBeenCalledWith({height, width});
    });

    test('should call onImageLoadFail when image load fails and should have svg', () => {
        const {container} = renderWithContext(<SizeAwareImage {...baseProps}/>, state);

        const img = container.querySelector('img')!;
        simulateImageError(img);

        expect(baseProps.onImageLoadFail).toHaveBeenCalled();
        expect(container.querySelector('svg')).not.toBeNull();
        expect(container.querySelector('.loading-image__preview')).toBeNull();
    });

    test('should match snapshot when handleSmallImageContainer prop is passed', () => {
        const props = {
            ...baseProps,
            handleSmallImageContainer: true,
        };

        const {container} = renderWithContext(<SizeAwareImage {...props}/>, state);
        expect(container).toMatchSnapshot();
    });

    test('should surround the image with container div if the image is small', () => {
        const props = {
            ...baseProps,
            handleSmallImageContainer: true,
        };

        const {container} = renderWithContext(<SizeAwareImage {...props}/>, state);

        // Simulate loading a small image (below the default 216px threshold)
        const img = container.querySelector('img')!;
        simulateImageLoad(img, 24, 24);

        const smallContainer = container.querySelector('div.small-image__container') as HTMLElement;
        expect(smallContainer).not.toBeNull();
        expect(smallContainer.style.minWidth).toEqual('50px');
        expect(smallContainer.style.minHeight).toEqual('50px');
    });

    test('should properly set img class when handleSmallImageContainer is true and image is small', () => {
        const props = {
            ...baseProps,
            handleSmallImageContainer: true,
            dimensions: {height: 24, width: 24},
        };

        const {container} = renderWithContext(<SizeAwareImage {...props}/>, state);

        // Simulate loading a small image
        const img = container.querySelector('img')!;
        simulateImageLoad(img, 24, 24);

        expect(container.querySelector('img')?.className).toBe(`${props.className} small-image--inside-container`);
    });

    test('should render small-image container for image below the small-image threshold', () => {
        const props = {
            ...baseProps,
            handleSmallImageContainer: true,
            dimensions: {height: 30, width: 220},
        };

        // Default smallImageThreshold is 216; height=30 is below that, so the small container should render
        const {container} = renderWithContext(<SizeAwareImage {...props}/>, state);

        const smallContainer = container.querySelector('div.small-image__container');
        expect(smallContainer).not.toBeNull();
    });

    test('should load download and copy link buttons when an image is mounted', () => {
        const fileURL = 'https://example.com/image.png';
        const props = {
            ...baseProps,
            fileURL,
            dimensions: undefined,
        };
        const {container} = renderWithContext(<SizeAwareImage {...props}/>, state);
        expect(container).toMatchSnapshot();
    });

    test('should load download hyperlink with href set to fileURL', () => {
        const fileURL = 'https://example.com/image.png';
        const props = {
            ...baseProps,
            fileURL,
            dimensions: undefined,
        };
        const {container} = renderWithContext(<SizeAwareImage {...props}/>, state);
        expect(container.querySelector('.size-aware-image__download')?.getAttribute('href')).toBe(fileURL);
    });

    test('clicking the copy button calls getFilePublicLink', () => {
        const fileURL = 'https://example.com/image.png';
        const getFilePublicLink = jest.fn().mockReturnValue(Promise.resolve({data: {link: 'https://example.com/image.png'}}));
        const props = {
            ...baseProps,
            fileURL,
            dimensions: undefined,
            getFilePublicLink,
        };

        const {container} = renderWithContext(<SizeAwareImage {...props}/>, state);

        const copyButton = container.querySelector('.size-aware-image__copy_link')!;
        act(() => {
            copyButton.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        });
        expect(getFilePublicLink).toHaveBeenCalled();
    });

    test('does not render copy button if enablePublicLink is false', () => {
        const props = {
            ...baseProps,
            enablePublicLink: false,
            dimensions: undefined,
        };

        const {container} = renderWithContext(<SizeAwareImage {...props}/>, state);
        expect(container.querySelector('button.size-aware-image__copy_link')).toBeNull();
    });

    test('should respect custom smallImageThreshold prop', () => {
        const props = {
            ...baseProps,
            smallImageThreshold: 100,
            handleSmallImageContainer: true,
            dimensions: {height: 120, width: 120},
        };

        // 120 >= custom threshold of 100, so the image should NOT be wrapped in small-image__container
        const {container} = renderWithContext(<SizeAwareImage {...props}/>, state);
        const img = container.querySelector('img')!;
        simulateImageLoad(img, 120, 120);

        expect(container.querySelector('div.small-image__container')).toBeNull();
    });

    test('should respect custom minContainerSize prop', () => {
        const props = {
            ...baseProps,
            minContainerSize: 80,
            handleSmallImageContainer: true,
            dimensions: {height: 24, width: 24},
        };

        const {container} = renderWithContext(<SizeAwareImage {...props}/>, state);
        const smallContainer = container.querySelector('div.small-image__container') as HTMLElement;
        expect(smallContainer).not.toBeNull();
        expect(smallContainer.style.minWidth).toEqual('80px');
        expect(smallContainer.style.minHeight).toEqual('80px');
    });

    test('should not render utility buttons for external small images', () => {
        const props = {
            ...baseProps,
            fileInfo: undefined,
            enablePublicLink: true,
            dimensions: undefined,
            handleSmallImageContainer: true,
        };

        const {container} = renderWithContext(<SizeAwareImage {...props}/>, state);
        const img = container.querySelector('img')!;
        simulateImageLoad(img, 24, 24);

        expect(container.querySelector('.image-preview-utility-buttons-container')).toBeNull();
    });

    test('should set correct image style for SVG files', () => {
        const props = {
            ...baseProps,
            dimensions: undefined,
            fileInfo: TestHelper.getFileInfoMock({
                name: 'test.svg',
                extension: 'svg',
            }),
        };

        const {container} = renderWithContext(<SizeAwareImage {...props}/>, state);
        const img = container.querySelector('img') as HTMLImageElement;
        expect(img.style.width).toEqual('100%');
        expect(img.style.height).toEqual('auto');
    });
});
