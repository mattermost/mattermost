// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';

import GifViewer from 'components/gif_viewer';
import LoadingImagePreview from 'components/loading_image_preview';

import {shallowWithIntl, mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';
import {TestHelper} from 'utils/test_helper';

import SizeAwareImage, {SizeAwareImage as SizeAwareImageComponent} from './size_aware_image';

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

        // since download and copy icons use svgs now, attachment svg should be searched as a direct child of image-loading__container
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

    test('should have display set to initial in loaded state', () => {
        const wrapper = mountWithIntl(<Provider store={store}><SizeAwareImage {...baseProps}/></Provider>);
        wrapper.find(SizeAwareImageComponent).setState({loaded: true, error: false});

        const style = wrapper.find('.file-preview__button').prop('style');
        expect(style).toHaveProperty('display', 'inline-block');
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
        expect(wrapper.find('div.small-image__container').prop('className')).
            toEqual('small-image__container cursor--pointer a11y--active small-image__container--min-width');
    });

    test('should properly set container div width', () => {
        const props = {
            ...baseProps,
            handleSmallImageContainer: true,
        };

        const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);

        wrapper.instance().setState({isSmallImage: true, imageWidth: 220});
        expect(wrapper.find('div.small-image__container').prop('style')).
            toHaveProperty('width', 222);

        wrapper.instance().setState({isSmallImage: true, imageWidth: 24});
        expect(wrapper.find('div.small-image__container').prop('style')).
            toEqual({});
        expect(wrapper.find('div.small-image__container').hasClass('small-image__container--min-width')).
            toEqual(true);
    });

    test('should properly set img style when it is small', () => {
        const props = {
            ...baseProps,
            handleSmallImageContainer: true,
        };

        const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);

        wrapper.instance().setState({isSmallImage: true, imageWidth: 24});

        expect(wrapper.find('img').prop('className')).toBe(`${props.className} small-image--inside-container`);
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
        };
        const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);
        expect(wrapper.find('.size-aware-image__download').prop('href')).toBe(fileURL);
    });

    test('clicking the copy button sets state.linkCopyInProgress to true', () => {
        const fileURL = 'https://example.com/image.png';
        const props = {
            ...baseProps,
            fileURL,
        };

        const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);
        expect(wrapper.state('linkCopyInProgress')).toBe(false);
        wrapper.find('.size-aware-image__copy_link').first().simulate('click');
        expect(wrapper.state('linkCopyInProgress')).toBe(true);
    });

    test('does not render copy button if enablePublicLink is false', () => {
        const props = {
            ...baseProps,
            enablePublicLink: false,
        };

        const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);
        expect(wrapper.find('button.size-aware-image__copy_link').exists()).toEqual(false);
    });

    describe('GIF handling', () => {
        test('should render GifViewer component for GIF files', () => {
            const props = {
                ...baseProps,
                src: 'https://example.com/animated.gif',
                fileInfo: TestHelper.getFileInfoMock({
                    name: 'animated.gif',
                    extension: 'gif',
                }),
            };

            const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);
            expect(wrapper.find(GifViewer).exists()).toBe(true);
            expect(wrapper.find('img').exists()).toBe(false);
        });

        test('should pass correct props to GifViewer', () => {
            const props = {
                ...baseProps,
                src: 'https://example.com/animated.gif',
                fileInfo: TestHelper.getFileInfoMock({
                    name: 'animated.gif',
                    extension: 'gif',
                }),
                className: 'custom-class',
            };

            const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);
            const gifViewer = wrapper.find(GifViewer);

            expect(gifViewer.prop('src')).toBe(props.src);
            expect(gifViewer.prop('alt')).toContain('file thumbnail');
            expect(gifViewer.prop('className')).toContain('custom-class');
            expect(typeof gifViewer.prop('onLoad')).toBe('function');
            expect(typeof gifViewer.prop('onError')).toBe('function');
        });

        test('should render regular img for non-GIF images', () => {
            const props = {
                ...baseProps,
                src: 'https://example.com/image.png',
                fileInfo: TestHelper.getFileInfoMock({
                    name: 'image.png',
                    extension: 'png',
                }),
            };

            const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);
            expect(wrapper.find(GifViewer).exists()).toBe(false);
            expect(wrapper.find('img').exists()).toBe(true);
        });

        test('should handle GIF with onClick prop', () => {
            const onClick = jest.fn();
            const props = {
                ...baseProps,
                src: 'https://example.com/animated.gif',
                fileInfo: TestHelper.getFileInfoMock({
                    name: 'animated.gif',
                    extension: 'gif',
                }),
                onClick,
            };

            const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);
            const gifViewer = wrapper.find(GifViewer);

            // When onClick is provided, GifViewer receives the handleImageClick wrapper
            expect(gifViewer.prop('onClick')).toBeDefined();
            expect(typeof gifViewer.prop('onClick')).toBe('function');
        });

        test('should handle GIF files without fileInfo', () => {
            const props = {
                ...baseProps,
                src: 'https://example.com/animated.gif',
                fileInfo: undefined,
            };

            const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);

            // Should now detect GIF from URL when fileInfo is not available
            expect(wrapper.find(GifViewer).exists()).toBe(true);
        });

        test('should handle small GIF images with container', () => {
            const props = {
                ...baseProps,
                src: 'https://example.com/small.gif',
                fileInfo: TestHelper.getFileInfoMock({
                    name: 'small.gif',
                    extension: 'gif',
                }),
                handleSmallImageContainer: true,
            };

            const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);
            wrapper.setState({isSmallImage: true});

            const gifViewer = wrapper.find(GifViewer);
            expect(gifViewer.prop('className')).toContain('small-image--inside-container');
        });

        test('should show GIF indicator when GIF is paused', () => {
            const props = {
                ...baseProps,
                src: 'https://example.com/animated.gif',
                fileInfo: TestHelper.getFileInfoMock({
                    name: 'animated.gif',
                    extension: 'gif',
                }),
            };

            const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);
            wrapper.setState({
                loaded: true,
                gifIsPlaying: false,
                gifHasTimedOut: false,
            });

            const gifIndicator = wrapper.find('.gif-indicator');
            expect(gifIndicator.exists()).toBe(true);
            expect(gifIndicator.text()).toBe('GIF');
        });

        test('should not show GIF indicator when GIF is playing', () => {
            const props = {
                ...baseProps,
                src: 'https://example.com/animated.gif',
                fileInfo: TestHelper.getFileInfoMock({
                    name: 'animated.gif',
                    extension: 'gif',
                }),
            };

            const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);
            wrapper.setState({
                loaded: true,
                gifIsPlaying: true,
                gifHasTimedOut: false,
            });

            const gifIndicator = wrapper.find('.gif-indicator');
            expect(gifIndicator.exists()).toBe(false);
        });

        test('should not show GIF indicator when image is not loaded', () => {
            const props = {
                ...baseProps,
                src: 'https://example.com/animated.gif',
                fileInfo: TestHelper.getFileInfoMock({
                    name: 'animated.gif',
                    extension: 'gif',
                }),
            };

            const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);
            wrapper.setState({
                loaded: false,
                gifIsPlaying: false,
                gifHasTimedOut: false,
            });

            const gifIndicator = wrapper.find('.gif-indicator');
            expect(gifIndicator.exists()).toBe(false);
        });

        test('should show GIF indicator for small images when paused', () => {
            const props = {
                ...baseProps,
                src: 'https://example.com/small.gif',
                fileInfo: TestHelper.getFileInfoMock({
                    name: 'small.gif',
                    extension: 'gif',
                }),
                handleSmallImageContainer: true,
            };

            const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);
            wrapper.setState({
                loaded: true,
                isSmallImage: true,
                gifIsPlaying: false,
                gifHasTimedOut: true,
            });

            const gifIndicator = wrapper.find('.gif-indicator');
            expect(gifIndicator.exists()).toBe(true);
            expect(gifIndicator.text()).toBe('GIF');
        });

        test('should detect GIF from URL when fileInfo is not provided', () => {
            const props = {
                ...baseProps,
                src: 'https://media.giphy.com/media/example/giphy.gif',
                fileInfo: undefined,
            };

            const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);
            expect(wrapper.find(GifViewer).exists()).toBe(true);
        });

        test('should detect GIF from URL with query parameters', () => {
            const props = {
                ...baseProps,
                src: 'https://example.com/animated.gif?param=value&other=123',
                fileInfo: undefined,
            };

            const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);
            expect(wrapper.find(GifViewer).exists()).toBe(true);
        });

        test('should detect GIF case-insensitively from URL', () => {
            const props = {
                ...baseProps,
                src: 'https://example.com/animated.GIF',
                fileInfo: undefined,
            };

            const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);
            expect(wrapper.find(GifViewer).exists()).toBe(true);
        });

        test('should not detect non-GIF images from URL', () => {
            const props = {
                ...baseProps,
                src: 'https://example.com/image.png',
                fileInfo: undefined,
            };

            const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);
            expect(wrapper.find(GifViewer).exists()).toBe(false);
            expect(wrapper.find('img').exists()).toBe(true);
        });

        test('should prefer fileInfo extension over URL extension', () => {
            const props = {
                ...baseProps,
                src: 'https://example.com/image.png', // URL says PNG
                fileInfo: TestHelper.getFileInfoMock({
                    name: 'animated.gif',
                    extension: 'gif', // FileInfo says GIF
                }),
            };

            const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);

            // Should trust fileInfo and render as GIF
            expect(wrapper.find(GifViewer).exists()).toBe(true);
        });

        test('should pass gifAutoplayEnabled prop to GifViewer', () => {
            const props = {
                ...baseProps,
                src: 'https://example.com/animated.gif',
                fileInfo: TestHelper.getFileInfoMock({
                    name: 'animated.gif',
                    extension: 'gif',
                }),
                gifAutoplayEnabled: false,
            };

            const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);
            const gifViewer = wrapper.find(GifViewer);

            expect(gifViewer.prop('autoplayEnabled')).toBe(false);
        });

        test('should default to autoplay enabled when gifAutoplayEnabled prop not provided', () => {
            const props = {
                ...baseProps,
                src: 'https://example.com/animated.gif',
                fileInfo: TestHelper.getFileInfoMock({
                    name: 'animated.gif',
                    extension: 'gif',
                }),
            };

            const wrapper = shallowWithIntl(<SizeAwareImage {...props}/>);
            const gifViewer = wrapper.find(GifViewer);

            expect(gifViewer.prop('autoplayEnabled')).toBeUndefined();
        });
    });
});
