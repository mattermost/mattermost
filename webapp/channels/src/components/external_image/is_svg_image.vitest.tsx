// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {describe, test, expect} from 'vitest';

import {isSVGImage} from './is_svg_image';

describe('ExternalIImage isSVGImage', () => {
    test('no metadata, no extension', () => {
        expect(isSVGImage(undefined, 'https://example.com/image.png')).toBe(false);
    });

    test('no metadata, svg extension', () => {
        expect(isSVGImage(undefined, 'https://example.com/image.svg')).toBe(true);
    });

    test('no metadata, svg extension with query parameter', () => {
        expect(isSVGImage(undefined, 'https://example.com/image.svg?a=1')).toBe(true);
    });

    test('no metadata, svg extension with hash', () => {
        expect(isSVGImage(undefined, 'https://example.com/image.svg#abc')).toBe(true);
    });

    test('no metadata, proxied image', () => {
        const src = 'https://mattermost.example.com/api/v4/image?url=' + encodeURIComponent('https://example.com/image.png');
        expect(isSVGImage(undefined, src)).toBe(false);
    });

    test('no metadata, proxied svg image', () => {
        const src = 'https://mattermost.example.com/api/v4/image?url=' + encodeURIComponent('https://example.com/image.svg');
        expect(isSVGImage(undefined, src)).toBe(true);
    });

    test('with metadata, not an SVG', () => {
        const imageMetadata = {
            format: 'png',
            frameCount: 40,
            width: 100,
            height: 200,
        };
        expect(isSVGImage(imageMetadata, 'https://example.com/image.png')).toBe(false);
    });

    test('with metadata, SVG', () => {
        const imageMetadata = {
            format: 'svg',
            frameCount: 30,
            width: 10,
            height: 20,
        };
        expect(isSVGImage(imageMetadata, 'https://example.com/image.svg')).toBe(true);
    });
});
