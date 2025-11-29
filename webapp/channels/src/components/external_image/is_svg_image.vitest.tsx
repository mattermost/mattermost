// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isSVGImage} from './is_svg_image';

describe('ExternalIImage isSVGImage', () => {
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
            const {imageMetadata, src} = testCase;

            expect(isSVGImage(imageMetadata, src)).toBe(testCase.expected);
        });
    }
});
