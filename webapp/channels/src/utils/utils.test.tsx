// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {FileTypes} from './constants';
import {getFileType, getSuggestionBoxHorizontalOffset, getSuggestionBoxRightBoundary} from './utils';

describe('Utils.getFileType', () => {
    test('should identify image files by extension', () => {
        expect(getFileType('jpg')).toBe(FileTypes.IMAGE);
        expect(getFileType('png')).toBe(FileTypes.IMAGE);
        expect(getFileType('gif')).toBe(FileTypes.IMAGE);
        expect(getFileType('bmp')).toBe(FileTypes.IMAGE);
        expect(getFileType('tiff')).toBe(FileTypes.IMAGE);
    });

    test('should identify image files from URLs with extensions', () => {
        expect(getFileType('https://example.com/image.jpg')).toBe(FileTypes.IMAGE);
        expect(getFileType('https://example.com/path/to/image.png')).toBe(FileTypes.IMAGE);
        expect(getFileType('https://example.com/image.gif?query=param')).toBe(FileTypes.IMAGE);
        expect(getFileType('http://example.com/image.bmp#fragment')).toBe(FileTypes.IMAGE);
    });

    test('should identify image files from URLs without extensions', () => {
        // Test URLs with /api/v4/image and ?url= parameter
        expect(getFileType('/api/v4/image?url=https://example.com/image-without-extension')).toBe(FileTypes.IMAGE);
        expect(getFileType('https://mattermost.com/api/v4/image?url=https://example.com/another-image')).toBe(FileTypes.IMAGE);

        // Test URLs with /api/v4/image and &url= parameter (in case it's not the first parameter)
        expect(getFileType('/api/v4/image?param=value&url=https://example.com/image')).toBe(FileTypes.IMAGE);
        expect(getFileType('https://mattermost.com/api/v4/image?param=value&url=https://example.com/image')).toBe(FileTypes.IMAGE);
    });

    test('should identify image files from proxied URLs', () => {
        expect(getFileType('/api/v4/image?url=https://example.com/image.jpg')).toBe(FileTypes.IMAGE);
        expect(getFileType('https://mattermost.com/api/v4/image?url=https://example.com/image.png')).toBe(FileTypes.IMAGE);
    });

    test('should handle invalid image URLs gracefully', () => {
        // These are not valid URLs but should still be processed correctly
        expect(getFileType('path/to/image.jpg')).toBe(FileTypes.IMAGE);
        expect(getFileType('image.png')).toBe(FileTypes.IMAGE);
    });

    test('should identify other file types correctly', () => {
        expect(getFileType('doc')).toBe(FileTypes.WORD);
        expect(getFileType('pdf')).toBe(FileTypes.PDF);
        expect(getFileType('mp3')).toBe(FileTypes.AUDIO);
        expect(getFileType('mp4')).toBe(FileTypes.VIDEO);
        expect(getFileType('js')).toBe(FileTypes.CODE);
        expect(getFileType('txt')).toBe(FileTypes.TEXT);
    });

    test('should not classify PSD files as images (MM-67077)', () => {
        // PSD preview support was removed due to memory vulnerability in oov/psd package
        expect(getFileType('psd')).toBe(FileTypes.OTHER);
    });

    test('should handle null or undefined input', () => {
        expect(getFileType(null as any)).toBe(FileTypes.OTHER);
        expect(getFileType(undefined as any)).toBe(FileTypes.OTHER);
        expect(getFileType('')).toBe(FileTypes.OTHER);
    });
});

describe('Utils.getSuggestionBoxHorizontalOffset', () => {
    test('should shift the suggestion box left when it would overflow the textbox', () => {
        expect(getSuggestionBoxHorizontalOffset(
            360,
            39,
            470,
            496,
            1100,
            295,
        )).toBe(-26);
    });

    test('should clamp the suggestion box to the left edge of the viewport', () => {
        expect(getSuggestionBoxHorizontalOffset(
            20,
            400,
            874,
            496,
            1100,
            295,
        )).toBe(-295);
    });

    test('should clamp the suggestion box to the visible viewport width', () => {
        expect(getSuggestionBoxHorizontalOffset(
            470,
            39,
            874,
            496,
            1100,
            295,
        )).toBe(309);
    });

    test('should clamp the suggestion box to the visible space before the RHS', () => {
        expect(getSuggestionBoxHorizontalOffset(
            470,
            39,
            874,
            496,
            695,
            295,
        )).toBe(-96);
    });

    test('should align to the textbox when requested', () => {
        expect(getSuggestionBoxHorizontalOffset(
            470,
            39,
            874,
            496,
            1100,
            295,
            true,
        )).toBe(0);
    });
});

describe('Utils.getSuggestionBoxRightBoundary', () => {
    const originalGetElementById = document.getElementById;

    afterEach(() => {
        document.getElementById = originalGetElementById.bind(document);
    });

    test('should use the viewport width when the RHS is absent', () => {
        document.getElementById = jest.fn().mockReturnValue(null);

        expect(getSuggestionBoxRightBoundary(document.createElement('textarea'), 1100)).toBe(1100);
    });

    test('should use the RHS left edge when the textbox is outside the RHS', () => {
        const textArea = document.createElement('textarea');
        const sidebarRight = {
            contains: jest.fn().mockReturnValue(false),
            getBoundingClientRect: jest.fn().mockReturnValue({left: 695}),
        };
        document.getElementById = jest.fn().mockReturnValue(sidebarRight as unknown as HTMLElement);

        expect(getSuggestionBoxRightBoundary(textArea, 1100)).toBe(695);
    });

    test('should ignore the RHS boundary for textboxes rendered inside the RHS', () => {
        const textArea = document.createElement('textarea');
        const sidebarRight = {
            contains: jest.fn().mockReturnValue(true),
            getBoundingClientRect: jest.fn().mockReturnValue({left: 695}),
        };
        document.getElementById = jest.fn().mockReturnValue(sidebarRight as unknown as HTMLElement);

        expect(getSuggestionBoxRightBoundary(textArea, 1100)).toBe(1100);
    });

    test('should use the viewport width when the RHS is offscreen', () => {
        const textArea = document.createElement('textarea');
        const sidebarRight = {
            contains: jest.fn().mockReturnValue(false),
            getBoundingClientRect: jest.fn().mockReturnValue({left: 1400}),
        };
        document.getElementById = jest.fn().mockReturnValue(sidebarRight as unknown as HTMLElement);

        expect(getSuggestionBoxRightBoundary(textArea, 1100)).toBe(1100);
    });
});
