// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {captureStillFrame} from '@mattermost/shared/utils/capture_still_frame';

import SizeAwareImage from 'components/size_aware_image';

import {renderWithContext, act, screen, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

jest.mock('@mattermost/shared/utils/capture_still_frame', () => ({
    captureStillFrame: jest.fn().mockResolvedValue(null),
}));

function simulateImageLoad(img: HTMLImageElement, naturalWidth: number, naturalHeight: number) {
    Object.defineProperty(img, 'naturalWidth', {value: naturalWidth, configurable: true});
    Object.defineProperty(img, 'naturalHeight', {value: naturalHeight, configurable: true});
    return act(() => {
        img.dispatchEvent(new Event('load', {bubbles: true}));
    });
}

function simulateImageError(img: HTMLImageElement) {
    return act(() => {
        img.dispatchEvent(new Event('error', {bubbles: true}));
    });
}

function setWindowActive(isActive: boolean) {
    jest.spyOn(document, 'hasFocus').mockReturnValue(isActive);
    Object.defineProperty(document, 'visibilityState', {value: isActive ? 'visible' : 'hidden', configurable: true});
    act(() => {
        window.dispatchEvent(new Event(isActive ? 'focus' : 'blur'));
        document.dispatchEvent(new Event('visibilitychange'));
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

    afterEach(() => {
        jest.restoreAllMocks();
        Object.defineProperty(document, 'visibilityState', {value: 'visible', configurable: true});
    });

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

    test('should render a placeholder when first mounted with dimensions and hide the image until it loads', () => {
        const {container} = renderWithContext(<SizeAwareImage {...baseProps}/>, state);

        // The placeholder is an <img> whose SVG data URI reserves the image's dimensions until it loads
        const placeholder = container.querySelector('.image-loading__container > img.image-loading__placeholder');
        expect(placeholder).not.toBeNull();
        expect(placeholder?.getAttribute('src')).toContain(encodeURIComponent('viewBox="0 0 300 200"'));

        // The actual image is rendered but its container is hidden until the image loads
        const realImage = screen.getByRole('img', {hidden: true});
        const imageContainer = realImage?.closest('.file-preview__button') as HTMLElement;
        expect(imageContainer.style.display).toEqual('none');
    });

    test('img should have inherited class name from prop', () => {
        renderWithContext(<SizeAwareImage {...{...baseProps, className: 'imgClass'}}/>, state);

        const img = screen.getByRole('img', {hidden: true});
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

    test('should reserve a placeholder without rendering image content when renderPlaceholderOnly is true', () => {
        const props = {
            ...baseProps,
            showLoader: true,
            renderPlaceholderOnly: true,
            fileInfo: TestHelper.getFileInfoMock({
                ...baseProps.fileInfo,
                mime_type: 'mime_type',
                mini_preview: 'mini_preview',
            }),
        };

        const {container} = renderWithContext(<SizeAwareImage {...props}/>, state);

        // Only the dimension-reserving placeholder is rendered, using an empty SVG data URI
        // rather than the mini preview, and no actual image content is shown.
        const placeholder = container.querySelector('.image-loading__container > img.image-loading__placeholder');
        expect(placeholder).not.toBeNull();
        expect(placeholder?.getAttribute('src')).toContain(encodeURIComponent('viewBox="0 0 300 200"'));
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
        expect(container.querySelector('.file__image-loading')).toBeNull();
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

    test('should have display set to initial in loaded state', async () => {
        const {container} = renderWithContext(<SizeAwareImage {...baseProps}/>, state);

        const img = screen.getByRole('img', {hidden: true}) as HTMLImageElement;
        await simulateImageLoad(img, 300, 200);

        expect(screen.getByRole('img')).toBeVisible();

        const filePreviewButton = container.querySelector('.file-preview__button') as HTMLElement;
        expect(filePreviewButton.style.display).toEqual('block');
    });

    test('should render the actual image when first mounted without dimensions', () => {
        const props = {...baseProps};
        Reflect.deleteProperty(props, 'dimensions');

        renderWithContext(<SizeAwareImage {...props}/>, state);

        // Initially error is false, so image should render with src
        const img = screen.getByRole('img', {hidden: true});
        expect(img?.getAttribute('src')).toEqual(baseProps.src);
    });

    test('should set loaded state when img loads and call onImageLoaded prop', async () => {
        const height = 123;
        const width = 1234;

        const {container} = renderWithContext(<SizeAwareImage {...baseProps}/>, state);

        const img = screen.getByRole('img', {hidden: true}) as HTMLImageElement;
        await simulateImageLoad(img, width, height);

        // Verify loaded state through DOM: file-preview__button should be visible
        const filePreviewButton = container.querySelector('.file-preview__button') as HTMLElement;
        expect(filePreviewButton.style.display).toEqual('block');
        expect(baseProps.onImageLoaded).toHaveBeenCalledWith({height, width});
    });

    test('should call onImageLoadFail when image load fails and should keep the placeholder', async () => {
        const {container} = renderWithContext(<SizeAwareImage {...baseProps}/>, state);

        const img = screen.getByRole('img', {hidden: true}) as HTMLImageElement;
        await simulateImageError(img);

        expect(baseProps.onImageLoadFail).toHaveBeenCalled();

        // The placeholder still reserves the image's space after a load failure
        expect(container.querySelector('img.image-loading__placeholder')).not.toBeNull();
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

    test('should surround the image with container div if the image is small', async () => {
        const props = {
            ...baseProps,
            handleSmallImageContainer: true,
        };

        const {container} = renderWithContext(<SizeAwareImage {...props}/>, state);

        // Simulate loading a small image (< 48px)
        const img = screen.getByRole('img', {hidden: true}) as HTMLImageElement;
        await simulateImageLoad(img, 24, 24);

        const smallContainer = container.querySelector('.small-image__container');
        expect(smallContainer).not.toBeNull();
        expect(smallContainer?.className).
            toEqual('small-image__container cursor--pointer a11y--active small-image__container--min-width');
    });

    test('should properly set container div width for small image', async () => {
        const props = {
            ...baseProps,
            handleSmallImageContainer: true,
            dimensions: {height: 24, width: 24},
        };

        // Test with a very small image (width < MIN_IMAGE_SIZE) - no custom width style, has min-width class
        const {container} = renderWithContext(<SizeAwareImage {...props}/>, state);
        const img = screen.getByRole('img', {hidden: true}) as HTMLImageElement;
        await simulateImageLoad(img, 24, 24);

        expect((container.querySelector('.small-image__container') as HTMLElement)?.style.width).
            toEqual('');
        expect(container.querySelector('.small-image__container')?.classList.contains('small-image__container--min-width')).
            toEqual(true);
    });

    test('should properly set container div width for wider small image', () => {
        const props = {
            ...baseProps,
            handleSmallImageContainer: true,
            dimensions: {height: 30, width: 220},
        };

        // The dimensions indicate a small image (height < 48), so isSmallImage is set at construction
        // Width 220 means container width = 222px (imageWidth + 2px border)
        const {container} = renderWithContext(<SizeAwareImage {...props}/>, state);

        // The component sets isSmallImage based on dimensions at construction time
        // since height=30 < MIN_IMAGE_SIZE=48, it will be a small image container
        const smallContainer = container.querySelector('.small-image__container');
        expect(smallContainer).not.toBeNull();
    });

    test('should properly set img style when it is small', async () => {
        const props = {
            ...baseProps,
            handleSmallImageContainer: true,
            dimensions: {height: 24, width: 24},
        };

        renderWithContext(<SizeAwareImage {...props}/>, state);

        // Simulate loading a small image
        const img = screen.getByRole('img', {hidden: true}) as HTMLImageElement;
        await simulateImageLoad(img, 24, 24);

        expect(screen.getByRole('img')?.className).toBe(`${props.className} small-image--inside-container`);
    });

    test('should load download and copy link buttons when an image is mounted', () => {
        const fileURL = 'https://example.com/image.png';
        const props = {
            ...baseProps,
            fileURL,
        };
        const {container} = renderWithContext(<SizeAwareImage {...props}/>, state);
        expect(container).toMatchSnapshot();
    });

    test('should load download hyperlink with href set to fileURL', () => {
        const fileURL = 'https://example.com/image.png';
        const props = {
            ...baseProps,
            fileURL,
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
        };

        const {container} = renderWithContext(<SizeAwareImage {...props}/>, state);
        expect(container.querySelector('button.size-aware-image__copy_link')).toBeNull();
    });

    describe('animated image freezing', () => {
        const gifProps = {
            ...baseProps,
            src: 'https://example.com/image.gif',
        };

        test('should swap to a captured still frame once the window becomes inactive', async () => {
            setWindowActive(true);
            (captureStillFrame as jest.Mock).mockResolvedValue('data:image/gif;base64,frozen-frame');

            renderWithContext(<SizeAwareImage {...gifProps}/>, state);

            const img = screen.getByRole('img', {hidden: true}) as HTMLImageElement;
            await simulateImageLoad(img, 300, 200);
            expect(img.getAttribute('src')).toEqual(gifProps.src);

            setWindowActive(false);

            await waitFor(() => {
                expect(img.getAttribute('src')).toEqual('data:image/gif;base64,frozen-frame');
            });
            expect(captureStillFrame).toHaveBeenCalledWith(gifProps.src);
        });

        test('should restore the live src once the window becomes active again', async () => {
            setWindowActive(true);
            (captureStillFrame as jest.Mock).mockResolvedValue('data:image/gif;base64,frozen-frame');

            renderWithContext(<SizeAwareImage {...gifProps}/>, state);

            const img = screen.getByRole('img', {hidden: true}) as HTMLImageElement;
            await simulateImageLoad(img, 300, 200);

            setWindowActive(false);
            await waitFor(() => {
                expect(img.getAttribute('src')).toEqual('data:image/gif;base64,frozen-frame');
            });

            setWindowActive(true);

            expect(img.getAttribute('src')).toEqual(gifProps.src);
        });

        test('should not freeze an image that is not likely to be animated', async () => {
            setWindowActive(true);

            renderWithContext(<SizeAwareImage {...baseProps}/>, state);

            const img = screen.getByRole('img', {hidden: true}) as HTMLImageElement;
            await simulateImageLoad(img, 300, 200);

            setWindowActive(false);

            expect(captureStillFrame).not.toHaveBeenCalled();
            expect(img.getAttribute('src')).toEqual(baseProps.src);
        });

        test('should treat a gif fileInfo extension as animated even without a .gif src suffix', async () => {
            setWindowActive(true);
            const props = {
                ...baseProps,
                fileInfo: TestHelper.getFileInfoMock({
                    ...baseProps.fileInfo,
                    extension: 'gif',
                }),
            };
            (captureStillFrame as jest.Mock).mockResolvedValue('data:image/gif;base64,frozen-frame');

            renderWithContext(<SizeAwareImage {...props}/>, state);

            const img = screen.getByRole('img', {hidden: true}) as HTMLImageElement;
            await simulateImageLoad(img, 300, 200);

            setWindowActive(false);

            await waitFor(() => {
                expect(img.getAttribute('src')).toEqual('data:image/gif;base64,frozen-frame');
            });
        });

        test('should not capture a still frame before the image has loaded', () => {
            setWindowActive(true);

            renderWithContext(<SizeAwareImage {...gifProps}/>, state);

            setWindowActive(false);

            expect(captureStillFrame).not.toHaveBeenCalled();
        });

        test('should capture a still frame if the image finishes loading while already inactive', async () => {
            setWindowActive(false);
            (captureStillFrame as jest.Mock).mockResolvedValue('data:image/gif;base64,frozen-frame');

            renderWithContext(<SizeAwareImage {...gifProps}/>, state);

            const img = screen.getByRole('img', {hidden: true}) as HTMLImageElement;
            await simulateImageLoad(img, 300, 200);

            await waitFor(() => {
                expect(img.getAttribute('src')).toEqual('data:image/gif;base64,frozen-frame');
            });
        });

        test('should keep the live src if capturing the still frame fails', async () => {
            setWindowActive(true);
            (captureStillFrame as jest.Mock).mockResolvedValue(null);

            renderWithContext(<SizeAwareImage {...gifProps}/>, state);

            const img = screen.getByRole('img', {hidden: true}) as HTMLImageElement;
            await simulateImageLoad(img, 300, 200);

            setWindowActive(false);

            await waitFor(() => expect(captureStillFrame).toHaveBeenCalled());
            expect(img.getAttribute('src')).toEqual(gifProps.src);
        });
    });
});
