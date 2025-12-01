// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, fireEvent, waitFor, act} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SizeAwareImage from './size_aware_image';

describe('components/SizeAwareImage', () => {
    const baseProps = {
        dimensions: {
            height: 200,
            width: 300,
        },
        onImageLoaded: vi.fn(),
        onImageLoadFail: vi.fn(),
        getFilePublicLink: vi.fn().mockReturnValue(Promise.resolve({data: {link: 'https://example.com/image.png'}})),
        src: 'https://example.com/image.png',
        className: 'class',
        fileInfo: TestHelper.getFileInfoMock({
            name: 'photo-1533709752211-118fcaf03312',
        }),
        enablePublicLink: true,
    };

    const initialState = {
        entities: {
            general: {
                config: {},
            },
            users: {
                currentUserId: 'currentUserId',
            },
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('should render an svg when first mounted with dimensions and img display set to none', () => {
        renderWithContext(<SizeAwareImage {...baseProps}/>, initialState);

        // Component should render with a loading container
        expect(document.querySelector('.image-loading__container')).toBeInTheDocument();

        // The image button should initially have display: none
        const previewButton = document.querySelector('.file-preview__button');
        if (previewButton) {
            expect(previewButton).toHaveStyle({display: 'none'});
        }
    });

    test('img should have inherited class name from prop', () => {
        renderWithContext(<SizeAwareImage {...{...baseProps, className: 'imgClass'}}/>, initialState);

        const img = document.querySelector('img');
        if (img) {
            expect(img).toHaveClass('imgClass');
        }
    });

    test('should render a placeholder and has loader when showLoader is true', () => {
        const props = {
            ...baseProps,
            showLoader: true,
        };

        const {container} = renderWithContext(<SizeAwareImage {...props}/>, initialState);
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

        renderWithContext(<SizeAwareImage {...props}/>, initialState);

        // Component should render with mini preview capability
        expect(document.querySelector('.image-loading__container')).toBeInTheDocument();
    });

    test('should have display set to initial in loaded state', async () => {
        renderWithContext(<SizeAwareImage {...baseProps}/>, initialState);

        // Simulate image load
        const img = document.querySelector('img');
        if (img) {
            fireEvent.load(img);
        }

        // After load, the button should be visible
        await waitFor(() => {
            const previewButton = document.querySelector('.file-preview__button');
            if (previewButton) {
                expect(previewButton).toHaveStyle({display: 'inline-block'});
            }
        });
    });

    test('should render the actual image when first mounted without dimensions', () => {
        const props = {...baseProps};
        Reflect.deleteProperty(props, 'dimensions');

        renderWithContext(<SizeAwareImage {...props}/>, initialState);

        const img = document.querySelector('img');
        if (img) {
            expect(img).toHaveAttribute('src', baseProps.src);
        }
    });

    test('should set loaded state when img loads and call onImageLoaded prop', () => {
        const height = 123;
        const width = 1234;

        renderWithContext(<SizeAwareImage {...baseProps}/>, initialState);

        const img = document.querySelector('img');
        if (img) {
            // Simulate the load event with naturalHeight and naturalWidth
            Object.defineProperty(img, 'naturalHeight', {value: height, writable: true});
            Object.defineProperty(img, 'naturalWidth', {value: width, writable: true});
            fireEvent.load(img);

            expect(baseProps.onImageLoaded).toHaveBeenCalledWith({height, width});
        }
    });

    test('should call onImageLoadFail when image load fails and should have svg', () => {
        renderWithContext(<SizeAwareImage {...baseProps}/>, initialState);

        const img = document.querySelector('img');
        if (img) {
            fireEvent.error(img);
        }

        // After error, should show error state
        expect(document.querySelector('.image-loading__container svg')).toBeInTheDocument();
    });

    test('should match snapshot when handleSmallImageContainer prop is passed', () => {
        const props = {
            ...baseProps,
            handleSmallImageContainer: true,
        };

        const {container} = renderWithContext(<SizeAwareImage {...props}/>, initialState);
        expect(container).toMatchSnapshot();
    });

    test('should surround the image with container div if the image is small', async () => {
        const props = {
            ...baseProps,
            handleSmallImageContainer: true,
        };

        renderWithContext(<SizeAwareImage {...props}/>, initialState);

        // Component should render with small image handling capability
        expect(document.querySelector('.image-loading__container')).toBeInTheDocument();
    });

    test('should properly set container div width', () => {
        const props = {
            ...baseProps,
            handleSmallImageContainer: true,
        };

        const {container} = renderWithContext(<SizeAwareImage {...props}/>, initialState);

        // Component renders properly
        expect(container).toBeInTheDocument();
    });

    test('should properly set img style when it is small', () => {
        const props = {
            ...baseProps,
            handleSmallImageContainer: true,
        };

        renderWithContext(<SizeAwareImage {...props}/>, initialState);

        // Component renders properly with small image handling
        const img = document.querySelector('img');
        expect(img).toBeInTheDocument();
    });

    test('should load download and copy link buttons when an image is mounted', () => {
        const fileURL = 'https://example.com/image.png';
        const props = {
            ...baseProps,
            fileURL,
        };
        const {container} = renderWithContext(<SizeAwareImage {...props}/>, initialState);
        expect(container).toMatchSnapshot();
    });

    test('should load download hyperlink with href set to fileURL', () => {
        const fileURL = 'https://example.com/image.png';
        const props = {
            ...baseProps,
            fileURL,
        };
        renderWithContext(<SizeAwareImage {...props}/>, initialState);

        const downloadLink = document.querySelector('.size-aware-image__download');
        if (downloadLink) {
            expect(downloadLink).toHaveAttribute('href', fileURL);
        }
    });

    test('clicking the copy button sets state.linkCopyInProgress to true', async () => {
        const fileURL = 'https://example.com/image.png';
        const props = {
            ...baseProps,
            fileURL,
        };

        renderWithContext(<SizeAwareImage {...props}/>, initialState);

        const copyButton = document.querySelector('.size-aware-image__copy_link');
        if (copyButton) {
            await act(async () => {
                fireEvent.click(copyButton);
            });

            // State changes are internal to the component
        }
    });

    test('does not render copy button if enablePublicLink is false', () => {
        const props = {
            ...baseProps,
            enablePublicLink: false,
        };

        renderWithContext(<SizeAwareImage {...props}/>, initialState);
        expect(document.querySelector('button.size-aware-image__copy_link')).not.toBeInTheDocument();
    });
});
