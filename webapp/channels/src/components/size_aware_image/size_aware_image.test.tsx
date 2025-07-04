// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';

import SizeAwareImage, {SizeAwareImage as SizeAwareImageComponent} from './size_aware_image';

import {shallowWithIntl, mountWithIntl} from '../../tests/helpers/intl-test-helper';
import mockStore from '../../tests/test_store';
import {TestHelper} from '../../utils/test_helper';
import LoadingImagePreview from '../loading_image_preview';

// Constants from the component
const MIN_CONTAINER_SIZE = 50;
const MIN_IMAGE_SIZE_FOR_INTERNAL_BUTTONS = 100;

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

    const store = mockStore({
        entities: {
            general: {
                config: {},
            },
            users: {
                currentUserId: 'currentUserId',
            },
        },
    });

    test('should render an svg when first mounted with dimensions and img display set to none', () => {
        const wrapper = mountWithIntl(<Provider store={store}><SizeAwareImage {...baseProps}/></Provider>);

        const viewBox = wrapper.find(SizeAwareImageComponent).find('.image-loading__container').children().filter('svg').prop('viewBox');
        expect(viewBox).toEqual('0 0 300 200');
        const style = wrapper.find('.file-preview__button').prop('style');
        expect(style).toHaveProperty('display', 'none');
    });

    test('img should have inherited class name from prop', () => {
        const wrapper = mountWithIntl(<Provider store={store}><SizeAwareImage {...{...baseProps, className: 'imgClass'}}/></Provider>);

        const className = wrapper.find('img').prop('className');
        expect(className).toEqual('imgClass');
    });

    test('should render a placeholder and has loader when showLoader is true', () => {
        const props = {
            ...baseProps,
            showLoader: true,
        };

        const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);
        expect(wrapper.find(LoadingImagePreview).exists()).toEqual(true);
        expect(wrapper).toMatchSnapshot();
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

        const wrapper = mountWithIntl(<Provider store={store}><SizeAwareImage {...props}/></Provider>);

        wrapper.find(SizeAwareImageComponent).setState({loaded: false, error: false});

        const src = wrapper.find('.image-loading__container img').prop('src');
        expect(src).toEqual('data:mime_type;base64,mini_preview');
    });

    test('should have display set to flex in loaded state', () => {
        const wrapper = mountWithIntl(<Provider store={store}><SizeAwareImage {...baseProps}/></Provider>);
        wrapper.find(SizeAwareImageComponent).setState({loaded: true, error: false});

        const style = wrapper.find('.file-preview__button').prop('style');
        expect(style).toHaveProperty('display', 'flex');
    });

    test('should render the actual image when first mounted without dimensions', () => {
        const props = {...baseProps};
        Reflect.deleteProperty(props, 'dimensions');

        const wrapper = mountWithIntl(<Provider store={store}><SizeAwareImage {...props}/></Provider>);

        wrapper.find(SizeAwareImageComponent).setState({error: false});

        const src = wrapper.find('img').prop('src');
        expect(src).toEqual(baseProps.src);
    });

    test('should set loaded state when img loads and call onImageLoaded prop', () => {
        const height = 123;
        const width = 1234;

        const wrapper = shallowWithIntl(<SizeAwareImage {...baseProps}/>);

        wrapper.find('img')?.prop('onLoad')?.({target: {naturalHeight: height, naturalWidth: width}} as unknown as React.SyntheticEvent<HTMLImageElement>);
        expect(wrapper.state('loaded')).toBe(true);
        expect(baseProps.onImageLoaded).toHaveBeenCalledWith({height, width});
    });

    test('should call onImageLoadFail when image load fails and should have svg', () => {
        const wrapper = mountWithIntl(<Provider store={store}><SizeAwareImage {...baseProps}/></Provider>);
        const errorEvent = {
            target: {},
            currentTarget: {},
            preventDefault: () => { },
            stopPropagation: () => { },
        } as React.SyntheticEvent<HTMLImageElement>;
        wrapper.find(SizeAwareImageComponent).find('img').prop('onError')?.(errorEvent);

        expect(wrapper.find(SizeAwareImageComponent).state('error')).toBe(true);
        expect(wrapper.find(SizeAwareImageComponent).find('svg').exists()).toEqual(true);
        expect(wrapper.find(SizeAwareImageComponent).find(LoadingImagePreview).exists()).toEqual(false);
    });

    test('should match snapshot when handleSmallImageContainer prop is passed', () => {
        const props = {
            ...baseProps,
            handleSmallImageContainer: true,
        };

        const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should surround the image with container div if the image is small', () => {
        const props = {
            ...baseProps,
            handleSmallImageContainer: true,
        };

        const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);

        wrapper.instance().setState({isSmallImage: true});

        expect(wrapper.find('div.small-image__container').exists()).toEqual(true);
        expect(wrapper.find('div.small-image__container').prop('style')).toEqual(
            expect.objectContaining({
                minWidth: MIN_CONTAINER_SIZE,
                minHeight: MIN_CONTAINER_SIZE,
            }),
        );
    });

    test('should properly set img style when it is small', () => {
        const props = {
            ...baseProps,
            handleSmallImageContainer: true,
        };

        const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);

        wrapper.instance().setState({isSmallImage: true, imageWidth: 24});

        expect(wrapper.find('img').prop('className')).toBe(`${props.className} small-image--inside-container`);
        expect(wrapper.find('img').prop('style')).toEqual({});
    });

    test('should load download and copy link buttons when an image is mounted', () => {
        const fileURL = 'https://example.com/image.png';
        const props = {
            ...baseProps,
            fileURL,
        };
        const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should load download hyperlink with href set to fileURL', () => {
        const fileURL = 'https://example.com/image.png';
        const props = {
            ...baseProps,
            fileURL,
            dimensions: undefined,
        };
        const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);

        const imageUtilityButtons = wrapper.find('injectIntl(ImageUtilityButtons)');
        expect(imageUtilityButtons).toHaveLength(1);
        expect(imageUtilityButtons.prop('fileURL')).toBe(fileURL);
        expect(imageUtilityButtons.prop('src')).toBe(props.src);
        expect(imageUtilityButtons.prop('isInternalImage')).toBe(true);
    });

    test('clicking the copy button sets state.linkCopyInProgress to true', () => {
        const fileURL = 'https://example.com/image.png';
        const props = {
            ...baseProps,
            fileURL,
            dimensions: undefined,
        };

        const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);
        expect(wrapper.state('linkCopyInProgress')).toBe(false);

        const imageUtilityButtons = wrapper.find('injectIntl(ImageUtilityButtons)');
        expect(imageUtilityButtons).toHaveLength(1);

        const onCopyLink = imageUtilityButtons.prop('onCopyLink') as () => void;
        onCopyLink();
        expect(wrapper.state('linkCopyInProgress')).toBe(true);
    });

    test('does not render copy button if enablePublicLink is false', () => {
        const props = {
            ...baseProps,
            enablePublicLink: false,
            dimensions: undefined,
        };

        const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);

        const imageUtilityButtons = wrapper.find('injectIntl(ImageUtilityButtons)');
        expect(imageUtilityButtons).toHaveLength(1);
        expect(imageUtilityButtons.prop('enablePublicLink')).toBe(false);
        expect(imageUtilityButtons.prop('isInternalImage')).toBe(true);

        const enablePublicLink = imageUtilityButtons.prop('enablePublicLink') as boolean;
        const isInternalImage = imageUtilityButtons.prop('isInternalImage') as boolean;
        const shouldShowCopyLink = enablePublicLink || !isInternalImage;
        expect(shouldShowCopyLink).toBe(false);
    });

    test('should respect custom smallImageThreshold prop', () => {
        const props = {
            ...baseProps,
            smallImageThreshold: 100,
            handleSmallImageContainer: true,
        };

        const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);
        const instance = wrapper.instance() as SizeAwareImageComponent;

        expect(instance.isSmallImage(80, 200)).toBe(true);
        expect(instance.isSmallImage(200, 80)).toBe(true);
        expect(instance.isSmallImage(120, 120)).toBe(false);
    });

    test('should respect custom minContainerSize prop', () => {
        const props = {
            ...baseProps,
            minContainerSize: 80,
            handleSmallImageContainer: true,
        };

        const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);
        const instance = wrapper.instance() as SizeAwareImageComponent;

        expect(instance.getContainerSize()).toBe(80);

        wrapper.instance().setState({isSmallImage: true});

        expect(wrapper.find('div.small-image__container').prop('style')).toEqual(
            expect.objectContaining({
                minWidth: 80,
                minHeight: 80,
            }),
        );
    });

    test('should not render utility buttons for external small images', () => {
        const props = {
            ...baseProps,
            fileInfo: undefined,
            enablePublicLink: true,
        };

        const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);

        wrapper.setState({loaded: true, isSmallImage: true});

        const filePreviewButton = wrapper.find('.file-preview__button');
        const utilityButtons = filePreviewButton.find('.image-preview-utility-buttons-container');

        expect(utilityButtons).toHaveLength(0);
    });

    test('should pass correct props for small images with small width', () => {
        const props = {
            ...baseProps,
            handleSmallImageContainer: true,
            dimensions: undefined,
        };

        const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);

        wrapper.setState({
            loaded: true,
            isSmallImage: true,
            imageWidth: 80,
        });

        const imageUtilityButtons = wrapper.find('injectIntl(ImageUtilityButtons)');
        expect(imageUtilityButtons).toHaveLength(1);
        expect(imageUtilityButtons.prop('isSmallImage')).toBe(true);
        expect(imageUtilityButtons.prop('imageWidth')).toBe(80);
        expect(imageUtilityButtons.prop('handleSmallImageContainer')).toBe(true);

        const isSmallImage = imageUtilityButtons.prop('isSmallImage') as boolean;
        const imageWidth = imageUtilityButtons.prop('imageWidth') as number;
        const handleSmallImageContainer = imageUtilityButtons.prop('handleSmallImageContainer') as boolean;

        expect(handleSmallImageContainer && isSmallImage).toBe(true);
        expect(imageWidth < MIN_IMAGE_SIZE_FOR_INTERNAL_BUTTONS).toBe(true);
    });

    test('should render figure element with correct styles for small images', () => {
        const props = {
            ...baseProps,
            handleSmallImageContainer: true,
        };

        const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);

        wrapper.setState({isSmallImage: true});

        const figure = wrapper.find('figure.image-loaded-container');
        expect(figure.exists()).toBe(true);
        expect(figure.prop('style')).toBeUndefined();
        expect(figure.hasClass('image-loaded-container')).toBe(true);
    });

    test('should set correct image style for SVG files', () => {
        const props = {
            ...baseProps,
            fileInfo: TestHelper.getFileInfoMock({
                name: 'test.svg',
                extension: 'svg',
            }),
        };

        const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);

        const img = wrapper.find('img');
        expect(img.prop('style')).toEqual(
            expect.objectContaining({
                width: '100%',
                height: 'auto',
            }),
        );
        expect(img.prop('style')).not.toHaveProperty('objectFit');
    });
});
