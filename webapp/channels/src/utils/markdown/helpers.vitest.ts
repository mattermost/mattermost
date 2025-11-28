// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {parseImageDimensions} from './helpers';

describe('parseImageDimensions', () => {
    test('should return the original href when no dimensions are provided', () => {
        expect(parseImageDimensions('https://example.com')).toEqual({href: 'https://example.com', height: '', width: ''});
        expect(parseImageDimensions('https://example.com/something.png')).toEqual({href: 'https://example.com/something.png', height: '', width: ''});
        expect(parseImageDimensions('https://example.com/%20%20')).toEqual({href: 'https://example.com/%20%20', height: '', width: ''});
    });

    test('should return full dimensions when provided', () => {
        expect(parseImageDimensions('https://example.com/image.png =50x80')).toEqual({href: 'https://example.com/image.png', height: '80', width: '50'});
    });

    test('should return auto height when not provided', () => {
        expect(parseImageDimensions('https://example.com/image.png =50')).toEqual({href: 'https://example.com/image.png', height: 'auto', width: '50'});
    });

    test('should return auto width when not provided', () => {
        expect(parseImageDimensions('https://example.com/image.png =x60')).toEqual({href: 'https://example.com/image.png', height: '60', width: 'auto'});
    });

    test('should return the original href when invalid dimensions are provided', () => {
        expect(parseImageDimensions('https://example.com =')).toEqual({href: 'https://example.com =', height: '', width: ''});
        expect(parseImageDimensions('https://example.com =x')).toEqual({href: 'https://example.com =x', height: '', width: ''});
        expect(parseImageDimensions('https://example.com=400x500')).toEqual({href: 'https://example.com=400x500', height: '', width: ''});
    });
});
