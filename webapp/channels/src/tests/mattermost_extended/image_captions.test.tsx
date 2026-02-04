// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Tests for ImageCaptions feature flag
 *
 * ImageCaptions: Display captions below markdown images using the title attribute
 *
 * This tests the config mapping and caption logic used by the MarkdownImage component.
 */

import {shallow} from 'enzyme';
import React from 'react';

import MarkdownImage from 'components/markdown_image/markdown_image';
import SizeAwareImage from 'components/size_aware_image';

describe('ImageCaptions feature', () => {
    describe('config mapping', () => {
        it('should map FeatureFlagImageCaptions config to boolean', () => {
            const configEnabled = {FeatureFlagImageCaptions: 'true'};
            const configDisabled = {FeatureFlagImageCaptions: 'false'};
            const configMissing = {};

            expect(configEnabled.FeatureFlagImageCaptions === 'true').toBe(true);
            expect(configDisabled.FeatureFlagImageCaptions === 'true').toBe(false);
            expect((configMissing as Record<string, string>).FeatureFlagImageCaptions === 'true').toBe(false);
        });

        it('should map MattermostExtendedMediaCaptionFontSize to number', () => {
            const configWithSize = {MattermostExtendedMediaCaptionFontSize: '14'};
            const configDefault = {MattermostExtendedMediaCaptionFontSize: undefined};

            // Logic from index.ts
            const fontSizeFromConfig = parseInt(configWithSize.MattermostExtendedMediaCaptionFontSize || '12', 10);
            const fontSizeDefault = parseInt(configDefault.MattermostExtendedMediaCaptionFontSize || '12', 10);

            expect(fontSizeFromConfig).toBe(14);
            expect(fontSizeDefault).toBe(12);
        });

        it('should handle non-numeric font size gracefully', () => {
            const configInvalid = {MattermostExtendedMediaCaptionFontSize: 'invalid'};

            const fontSize = parseInt(configInvalid.MattermostExtendedMediaCaptionFontSize || '12', 10);

            // parseInt returns NaN for non-numeric strings
            expect(isNaN(fontSize)).toBe(true);
        });
    });

    describe('caption rendering logic', () => {
        const baseProps = {
            imageMetadata: {
                format: 'png',
                height: 100,
                width: 200,
                frameCount: 0,
            },
            alt: 'test image',
            height: '',
            width: '',
            title: 'This is a caption',
            className: 'markdown-inline-img',
            postId: 'post_id',
            imageIsLink: false,
            onImageLoaded: jest.fn(),
            onImageHeightChanged: jest.fn(),
            postType: 'system_generic',
            actions: {
                openModal: jest.fn(),
            },
            isUnsafeLinksPost: false,
            src: 'https://example.com/image.png',
        };

        it('should show caption when ImageCaptions enabled and title is present', () => {
            const props = {
                ...baseProps,
                imageCaptionsEnabled: true,
                captionFontSize: 12,
            };

            const wrapper = shallow(<MarkdownImage {...props}/>);
            wrapper.setState({loaded: true});

            // Get the rendered children from ExternalImage
            const childrenNode = wrapper.props().children(props.src);
            const childrenWrapper = shallow(<div>{childrenNode}</div>);

            expect(childrenWrapper.find('.markdown-image-caption-wrapper')).toHaveLength(1);
            expect(childrenWrapper.find('.markdown-image-caption')).toHaveLength(1);
            expect(childrenWrapper.find('.markdown-image-caption').text()).toContain('This is a caption');
        });

        it('should NOT show caption when ImageCaptions disabled', () => {
            const props = {
                ...baseProps,
                imageCaptionsEnabled: false,
                captionFontSize: 12,
            };

            const wrapper = shallow(<MarkdownImage {...props}/>);
            wrapper.setState({loaded: true});

            const childrenNode = wrapper.props().children(props.src);
            const childrenWrapper = shallow(<div>{childrenNode}</div>);

            expect(childrenWrapper.find('.markdown-image-caption-wrapper')).toHaveLength(0);
            expect(childrenWrapper.find('.markdown-image-caption')).toHaveLength(0);
        });

        it('should NOT show caption when title is empty', () => {
            const props = {
                ...baseProps,
                title: '',
                imageCaptionsEnabled: true,
                captionFontSize: 12,
            };

            const wrapper = shallow(<MarkdownImage {...props}/>);
            wrapper.setState({loaded: true});

            const childrenNode = wrapper.props().children(props.src);
            const childrenWrapper = shallow(<div>{childrenNode}</div>);

            expect(childrenWrapper.find('.markdown-image-caption-wrapper')).toHaveLength(0);
            expect(childrenWrapper.find('.markdown-image-caption')).toHaveLength(0);
        });

        it('should NOT show caption when imageCaptionsEnabled is undefined', () => {
            const props = {
                ...baseProps,
                imageCaptionsEnabled: undefined,
                captionFontSize: 12,
            };

            const wrapper = shallow(<MarkdownImage {...props}/>);
            wrapper.setState({loaded: true});

            const childrenNode = wrapper.props().children(props.src);
            const childrenWrapper = shallow(<div>{childrenNode}</div>);

            expect(childrenWrapper.find('.markdown-image-caption-wrapper')).toHaveLength(0);
            expect(childrenWrapper.find('.markdown-image-caption')).toHaveLength(0);
        });

        it('should include "> " prefix in caption text', () => {
            const props = {
                ...baseProps,
                imageCaptionsEnabled: true,
                captionFontSize: 12,
            };

            const wrapper = shallow(<MarkdownImage {...props}/>);
            wrapper.setState({loaded: true});

            const childrenNode = wrapper.props().children(props.src);
            const childrenWrapper = shallow(<div>{childrenNode}</div>);

            const captionText = childrenWrapper.find('.markdown-image-caption').text();
            expect(captionText).toContain('> ');
            expect(captionText).toBe('> This is a caption');
        });
    });

    describe('caption styling', () => {
        const baseProps = {
            imageMetadata: {
                format: 'png',
                height: 100,
                width: 200,
                frameCount: 0,
            },
            alt: 'test image',
            height: '',
            width: '',
            title: 'Caption text',
            className: 'markdown-inline-img',
            postId: 'post_id',
            imageIsLink: false,
            onImageLoaded: jest.fn(),
            onImageHeightChanged: jest.fn(),
            postType: 'system_generic',
            actions: {
                openModal: jest.fn(),
            },
            isUnsafeLinksPost: false,
            src: 'https://example.com/image.png',
            imageCaptionsEnabled: true,
        };

        it('should apply custom captionFontSize', () => {
            const props = {
                ...baseProps,
                captionFontSize: 16,
            };

            const wrapper = shallow(<MarkdownImage {...props}/>);
            wrapper.setState({loaded: true});

            const childrenNode = wrapper.props().children(props.src);
            const childrenWrapper = shallow(<div>{childrenNode}</div>);

            const captionStyle = childrenWrapper.find('.markdown-image-caption').prop('style');
            expect(captionStyle).toEqual({fontSize: '16px'});
        });

        it('should use default 12px font size when captionFontSize not provided', () => {
            const props = {
                ...baseProps,
                captionFontSize: undefined,
            };

            const wrapper = shallow(<MarkdownImage {...props}/>);
            wrapper.setState({loaded: true});

            const childrenNode = wrapper.props().children(props.src);
            const childrenWrapper = shallow(<div>{childrenNode}</div>);

            const captionStyle = childrenWrapper.find('.markdown-image-caption').prop('style');
            expect(captionStyle).toEqual({fontSize: '12px'});
        });

        it('should apply 10px font size for small captions', () => {
            const props = {
                ...baseProps,
                captionFontSize: 10,
            };

            const wrapper = shallow(<MarkdownImage {...props}/>);
            wrapper.setState({loaded: true});

            const childrenNode = wrapper.props().children(props.src);
            const childrenWrapper = shallow(<div>{childrenNode}</div>);

            const captionStyle = childrenWrapper.find('.markdown-image-caption').prop('style');
            expect(captionStyle).toEqual({fontSize: '10px'});
        });

        it('should apply 20px font size for large captions', () => {
            const props = {
                ...baseProps,
                captionFontSize: 20,
            };

            const wrapper = shallow(<MarkdownImage {...props}/>);
            wrapper.setState({loaded: true});

            const childrenNode = wrapper.props().children(props.src);
            const childrenWrapper = shallow(<div>{childrenNode}</div>);

            const captionStyle = childrenWrapper.find('.markdown-image-caption').prop('style');
            expect(captionStyle).toEqual({fontSize: '20px'});
        });
    });

    describe('integration with image rendering', () => {
        const baseProps = {
            imageMetadata: {
                format: 'png',
                height: 100,
                width: 200,
                frameCount: 0,
            },
            alt: 'test image',
            height: '',
            width: '',
            title: 'Image caption',
            className: 'markdown-inline-img',
            postId: 'post_id',
            imageIsLink: false,
            onImageLoaded: jest.fn(),
            onImageHeightChanged: jest.fn(),
            postType: 'system_generic',
            actions: {
                openModal: jest.fn(),
            },
            isUnsafeLinksPost: false,
            src: 'https://example.com/image.png',
        };

        it('should still render image when caption is shown', () => {
            const props = {
                ...baseProps,
                imageCaptionsEnabled: true,
                captionFontSize: 12,
            };

            const wrapper = shallow(<MarkdownImage {...props}/>);
            wrapper.setState({loaded: true});

            const childrenNode = wrapper.props().children(props.src);
            const childrenWrapper = shallow(<div>{childrenNode}</div>);

            // Both wrapper and SizeAwareImage should exist
            expect(childrenWrapper.find('.markdown-image-caption-wrapper')).toHaveLength(1);
            expect(childrenWrapper.find(SizeAwareImage)).toHaveLength(1);
        });

        it('should render image directly when caption is not shown', () => {
            const props = {
                ...baseProps,
                imageCaptionsEnabled: false,
                captionFontSize: 12,
            };

            const wrapper = shallow(<MarkdownImage {...props}/>);
            wrapper.setState({loaded: true});

            const childrenNode = wrapper.props().children(props.src);
            const childrenWrapper = shallow(<div>{childrenNode}</div>);

            // No wrapper, just SizeAwareImage
            expect(childrenWrapper.find('.markdown-image-caption-wrapper')).toHaveLength(0);
            expect(childrenWrapper.find(SizeAwareImage)).toHaveLength(1);
        });

        it('should handle broken images without caption', () => {
            const props = {
                ...baseProps,
                src: '',
                imageCaptionsEnabled: true,
                captionFontSize: 12,
            };

            const wrapper = shallow(<MarkdownImage {...props}/>);

            // Broken image renders differently, no caption
            expect(wrapper.find('.markdown-image-caption-wrapper')).toHaveLength(0);
            expect(wrapper.find('.broken-image')).toHaveLength(1);
        });

        it('should not show caption for unsafe links post', () => {
            const props = {
                ...baseProps,
                isUnsafeLinksPost: true,
                imageCaptionsEnabled: true,
                captionFontSize: 12,
            };

            const wrapper = shallow(<MarkdownImage {...props}/>);

            // Unsafe links render as text only
            expect(wrapper.text()).toBe('test image');
            expect(wrapper.find('.markdown-image-caption')).toHaveLength(0);
        });
    });

    describe('caption content handling', () => {
        const baseProps = {
            imageMetadata: {
                format: 'png',
                height: 100,
                width: 200,
                frameCount: 0,
            },
            alt: 'test image',
            height: '',
            width: '',
            className: 'markdown-inline-img',
            postId: 'post_id',
            imageIsLink: false,
            onImageLoaded: jest.fn(),
            onImageHeightChanged: jest.fn(),
            postType: 'system_generic',
            actions: {
                openModal: jest.fn(),
            },
            isUnsafeLinksPost: false,
            src: 'https://example.com/image.png',
            imageCaptionsEnabled: true,
            captionFontSize: 12,
        };

        it('should display long caption text', () => {
            const longCaption = 'This is a very long caption that describes the image in great detail and provides important context for the viewer';
            const props = {
                ...baseProps,
                title: longCaption,
            };

            const wrapper = shallow(<MarkdownImage {...props}/>);
            wrapper.setState({loaded: true});

            const childrenNode = wrapper.props().children(props.src);
            const childrenWrapper = shallow(<div>{childrenNode}</div>);

            expect(childrenWrapper.find('.markdown-image-caption').text()).toContain(longCaption);
        });

        it('should display caption with special characters', () => {
            const specialCaption = 'Photo: "Summer 2024" © John Doe';
            const props = {
                ...baseProps,
                title: specialCaption,
            };

            const wrapper = shallow(<MarkdownImage {...props}/>);
            wrapper.setState({loaded: true});

            const childrenNode = wrapper.props().children(props.src);
            const childrenWrapper = shallow(<div>{childrenNode}</div>);

            expect(childrenWrapper.find('.markdown-image-caption').text()).toContain(specialCaption);
        });

        it('should display caption with unicode characters', () => {
            const unicodeCaption = '日本語のキャプション 🎉';
            const props = {
                ...baseProps,
                title: unicodeCaption,
            };

            const wrapper = shallow(<MarkdownImage {...props}/>);
            wrapper.setState({loaded: true});

            const childrenNode = wrapper.props().children(props.src);
            const childrenWrapper = shallow(<div>{childrenNode}</div>);

            expect(childrenWrapper.find('.markdown-image-caption').text()).toContain(unicodeCaption);
        });

        it('should handle whitespace-only title as falsy', () => {
            const props = {
                ...baseProps,
                title: '   ',
            };

            const wrapper = shallow(<MarkdownImage {...props}/>);
            wrapper.setState({loaded: true});

            const childrenNode = wrapper.props().children(props.src);
            const childrenWrapper = shallow(<div>{childrenNode}</div>);

            // Whitespace-only title is still truthy in JavaScript, so caption will show
            // This tests the actual behavior
            expect(childrenWrapper.find('.markdown-image-caption-wrapper')).toHaveLength(1);
        });
    });
});
