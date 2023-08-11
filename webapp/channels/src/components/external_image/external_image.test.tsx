// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import {Client4} from 'mattermost-redux/client';

import ExternalImage from './external_image';

describe('ExternalImage', () => {
    const baseProps = {
        children: jest.fn((src) => <img src={src}/>),
        enableSVGs: true,
        imageMetadata: {
            format: 'png',
            frameCount: 20,
            height: 300,
            width: 200,
        },
        hasImageProxy: false,
        src: 'https://example.com/image.png',
    };

    test('should render an image', () => {
        const wrapper = shallow<ExternalImage>(<ExternalImage {...baseProps}/>);

        expect(baseProps.children).toHaveBeenCalledWith(baseProps.src);
        expect(wrapper.find('img').exists()).toBe(true);
    });

    test('should render an image without image metadata', () => {
        const props = {
            ...baseProps,
            imageMetadata: undefined,
        };

        const wrapper = shallow<ExternalImage>(<ExternalImage {...props}/>);

        expect(baseProps.children).toHaveBeenCalledWith(baseProps.src);
        expect(wrapper.find('img').exists()).toBe(true);
    });

    test('should render an SVG when enabled', () => {
        const props = {
            ...baseProps,
            imageMetadata: {
                format: 'svg',
                frameCount: 20,
                height: 0,
                width: 0,
            },
            src: 'https://example.com/logo.svg',
        };

        const wrapper = shallow<ExternalImage>(<ExternalImage {...props}/>);

        expect(props.children).toHaveBeenCalledWith(props.src);
        expect(wrapper.find('img').exists()).toBe(true);
    });

    test('should not render an SVG when disabled', () => {
        const props = {
            ...baseProps,
            enableSVGs: false,
            imageMetadata: {
                format: 'svg',
                frameCount: 20,
                height: 0,
                width: 0,
            },
            src: 'https://example.com/logo.svg',
        };

        const wrapper = shallow<ExternalImage>(<ExternalImage {...props}/>);

        expect(props.children).toHaveBeenCalledWith('');
        expect(wrapper.find('img').exists()).toBe(true);
    });

    test('should pass src through the image proxy when enabled', () => {
        const props = {
            ...baseProps,
            hasImageProxy: true,
        };

        const wrapper = shallow<ExternalImage>(<ExternalImage {...props}/>);

        expect(props.children).toHaveBeenCalledWith(Client4.getBaseRoute() + '/image?url=' + encodeURIComponent(props.src));
        expect(wrapper.find('img').exists()).toBe(true);
    });

    describe('isSVGImage', () => {
        for (const testCase of [
            {
                name: 'no metadata, no extension',
                src: 'https://example.com/image.png',
                imageMetadata: undefined,
                expected: false,
            },
            {
                name: 'no metadata, svg extension',
                src: 'https://example.com/image.svg',
                imageMetadata: undefined,
                expected: true,
            },
            {
                name: 'no metadata, svg extension with query parameter',
                src: 'https://example.com/image.svg?a=1',
                imageMetadata: undefined,
                expected: true,
            },
            {
                name: 'no metadata, svg extension with hash',
                src: 'https://example.com/image.svg#abc',
                imageMetadata: undefined,
                expected: true,
            },
            {
                name: 'no metadata, proxied image',
                src: 'https://mattermost.example.com/api/v4/image?url=' + encodeURIComponent('https://example.com/image.png'),
                imageMetadata: undefined,
                expected: false,
            },
            {
                name: 'no metadata, proxied svg image',
                src: 'https://mattermost.example.com/api/v4/image?url=' + encodeURIComponent('https://example.com/image.svg'),
                imageMetadata: undefined,
                expected: true,
            },
            {
                name: 'with metadata, not an SVG',
                src: 'https://example.com/image.png',
                imageMetadata: {
                    format: 'png',
                    frameCount: 40,
                    width: 100,
                    height: 200,
                },
                expected: false,
            },
            {
                name: 'with metadata, SVG',
                src: 'https://example.com/image.svg',
                imageMetadata: {
                    format: 'svg',
                    frameCount: 30,
                    width: 10,
                    height: 20,
                },
                expected: true,
            },
        ]) {
            test(testCase.name, () => {
                const props = {
                    ...baseProps,
                    src: testCase.src,
                    imageMetadata: testCase.imageMetadata,
                };

                const wrapper = shallow<ExternalImage>(<ExternalImage {...props}/>);

                expect(wrapper.instance().isSVGImage()).toBe(testCase.expected);
            });
        }
    });
});

