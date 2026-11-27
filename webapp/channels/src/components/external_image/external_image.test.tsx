// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Client4} from 'mattermost-redux/client';

import {render} from 'tests/react_testing_utils';

import ExternalImage from './external_image';

describe('ExternalImage', () => {
    // Real callers treat an empty src as "don't render the image", as does this mock
    const baseProps = {
        children: jest.fn((src) => (src ? <img src={src}/> : <span/>)),
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
        const {container} = render(<ExternalImage {...baseProps}/>);

        expect(baseProps.children).toHaveBeenCalledWith(baseProps.src);
        expect(container.querySelector('img')).toBeInTheDocument();
    });

    test('should render an image without image metadata', () => {
        const props = {
            ...baseProps,
            imageMetadata: undefined,
        };

        const {container} = render(<ExternalImage {...props}/>);

        expect(baseProps.children).toHaveBeenCalledWith(baseProps.src);
        expect(container.querySelector('img')).toBeInTheDocument();
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

        const {container} = render(<ExternalImage {...props}/>);

        expect(props.children).toHaveBeenCalledWith(props.src);
        expect(container.querySelector('img')).toBeInTheDocument();
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

        const {container} = render(<ExternalImage {...props}/>);

        expect(props.children).toHaveBeenCalledWith('');
        expect(container.querySelector('img')).not.toBeInTheDocument();
    });

    test('should pass src through the image proxy when enabled', () => {
        const props = {
            ...baseProps,
            hasImageProxy: true,
        };

        const {container} = render(<ExternalImage {...props}/>);

        expect(props.children).toHaveBeenCalledWith(Client4.getBaseRoute() + '/image?url=' + encodeURIComponent(props.src));
        expect(container.querySelector('img')).toBeInTheDocument();
    });

    test('should block external and proxy URLs when blockExternalImages is true', () => {
        const externalChildren = jest.fn(() => <span data-testid='blocked'/>);
        render(
            <ExternalImage
                {...baseProps}
                blockExternalImages={true}
                siteURL='https://chat.example.com'
                src='https://external.example/a.png'
            >
                {externalChildren}
            </ExternalImage>,
        );
        expect(externalChildren).toHaveBeenCalledWith('', 'external');

        const proxyChildren = jest.fn(() => <span data-testid='blocked-proxy'/>);
        render(
            <ExternalImage
                {...baseProps}
                blockExternalImages={true}
                siteURL='https://chat.example.com'
                src='/api/v4/image?url=https%3A%2F%2Fexternal.example%2Fa.png'
            >
                {proxyChildren}
            </ExternalImage>,
        );
        expect(proxyChildren).toHaveBeenCalledWith('', 'external');

        const internalChildren = jest.fn((src) => <img src={src}/>);
        render(
            <ExternalImage
                {...baseProps}
                blockExternalImages={true}
                siteURL='https://chat.example.com'
                src='https://chat.example.com/api/v4/files/1/preview'
            >
                {internalChildren}
            </ExternalImage>,
        );
        expect(internalChildren).toHaveBeenCalledWith('https://chat.example.com/api/v4/files/1/preview');
    });
});
