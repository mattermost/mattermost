// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import {Client4} from 'mattermost-redux/client';

import ExternalImage from './external_image';

describe('ExternalImage', () => {
    const baseProps = {
        children: vi.fn((src) => (
            <img
                src={src}
                alt='test'
            />
        )),
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
        render(<ExternalImage {...baseProps}/>);

        expect(baseProps.children).toHaveBeenCalledWith(baseProps.src);
        expect(screen.getByRole('img')).toBeInTheDocument();
    });

    test('should render an image without image metadata', () => {
        const props = {
            ...baseProps,
            imageMetadata: undefined,
        };

        render(<ExternalImage {...props}/>);

        expect(baseProps.children).toHaveBeenCalledWith(baseProps.src);
        expect(screen.getByRole('img')).toBeInTheDocument();
    });

    test('should render an SVG when enabled', () => {
        const childFn = vi.fn((src) => (
            <img
                src={src}
                alt='test'
            />
        ));
        const props = {
            ...baseProps,
            children: childFn,
            imageMetadata: {
                format: 'svg',
                frameCount: 20,
                height: 0,
                width: 0,
            },
            src: 'https://example.com/logo.svg',
        };

        render(<ExternalImage {...props}/>);

        expect(childFn).toHaveBeenCalledWith(props.src);
        expect(screen.getByRole('img')).toBeInTheDocument();
    });

    test('should not render an SVG when disabled', () => {
        const childFn = vi.fn((src) => (
            <img
                src={src}
                alt='test'
            />
        ));
        const props = {
            ...baseProps,
            children: childFn,
            enableSVGs: false,
            imageMetadata: {
                format: 'svg',
                frameCount: 20,
                height: 0,
                width: 0,
            },
            src: 'https://example.com/logo.svg',
        };

        render(<ExternalImage {...props}/>);

        expect(childFn).toHaveBeenCalledWith('');
        expect(screen.getByRole('img')).toBeInTheDocument();
    });

    test('should pass src through the image proxy when enabled', () => {
        const childFn = vi.fn((src) => (
            <img
                src={src}
                alt='test'
            />
        ));
        const props = {
            ...baseProps,
            children: childFn,
            hasImageProxy: true,
        };

        render(<ExternalImage {...props}/>);

        expect(childFn).toHaveBeenCalledWith(Client4.getBaseRoute() + '/image?url=' + encodeURIComponent(props.src));
        expect(screen.getByRole('img')).toBeInTheDocument();
    });
});
