// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {FileTypes} from './constants';
import {getFileType, getSuggestionBoxAlgn} from './utils';

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

describe('Utils.getSuggestionBoxAlgn', () => {
    const originalCreateRange = document.createRange;
    const originalGetSelection = document.getSelection;
    const originalGetComputedStyle = window.getComputedStyle;

    beforeEach(() => {
        document.body.innerHTML = '';
        document.documentElement.scrollLeft = 0;
        document.documentElement.scrollTop = 0;

        document.createRange = jest.fn(() => ({
            setStart: jest.fn(),
            setEnd: jest.fn(),
            getClientRects: jest.fn(() => [{left: 200, top: 40}]),
        })) as unknown as typeof document.createRange;

        document.getSelection = jest.fn(() => ({
            removeAllRanges: jest.fn(),
            addRange: jest.fn(),
        })) as unknown as typeof document.getSelection;
    });

    afterEach(() => {
        document.body.innerHTML = '';
        document.createRange = originalCreateRange;
        document.getSelection = originalGetSelection;
        window.getComputedStyle = originalGetComputedStyle;
    });

    function createTextArea(clippingAncestorRight?: number) {
        const clippingAncestor = document.createElement('div');
        clippingAncestor.style.overflow = 'hidden';
        clippingAncestor.style.overflowX = 'hidden';
        clippingAncestor.style.overflowY = 'hidden';
        clippingAncestor.getBoundingClientRect = jest.fn(() => ({
            width: 385,
            right: clippingAncestorRight ?? 654,
        })) as unknown as typeof clippingAncestor.getBoundingClientRect;

        const container = document.createElement('div');
        container.getBoundingClientRect = jest.fn(() => ({
            width: 600,
            right: 900,
        })) as unknown as typeof container.getBoundingClientRect;

        const textArea = document.createElement('textarea');
        textArea.value = 'hello @';
        textArea.selectionStart = textArea.value.length;
        textArea.selectionEnd = textArea.value.length;
        textArea.style.lineHeight = '20px';
        textArea.getBoundingClientRect = jest.fn(() => ({
            left: 295,
            top: 100,
            width: 333,
            right: 628,
        })) as unknown as typeof textArea.getBoundingClientRect;

        Object.defineProperty(textArea, 'offsetWidth', {
            configurable: true,
            value: 333,
        });

        clippingAncestor.appendChild(container);
        container.appendChild(textArea);
        document.body.appendChild(clippingAncestor);

        return {textArea, clippingAncestor};
    }

    test('keeps the suggestion list inside the nearest clipping container', () => {
        Object.defineProperty(window, 'innerWidth', {configurable: true, value: 900});
        Object.defineProperty(window, 'innerHeight', {configurable: true, value: 900});

        const {textArea, clippingAncestor} = createTextArea(654);

        window.getComputedStyle = jest.fn((element: Element) => {
            if (element === clippingAncestor) {
                return {
                    overflow: 'hidden',
                    overflowX: 'hidden',
                    overflowY: 'hidden',
                } as CSSStyleDeclaration;
            }

            if (element === textArea) {
                return {
                    lineHeight: '20px',
                    overflow: 'visible',
                    overflowX: 'visible',
                    overflowY: 'visible',
                } as CSSStyleDeclaration;
            }

            return {
                lineHeight: '20px',
                overflow: 'visible',
                overflowX: 'visible',
                overflowY: 'visible',
            } as CSSStyleDeclaration;
        }) as typeof window.getComputedStyle;

        expect(getSuggestionBoxAlgn(textArea)).toMatchObject({
            pixelsToMoveX: 0,
            pixelsToMoveY: 40,
        });
    });

    test('uses the viewport width when no clipping ancestor constrains the textbox', () => {
        Object.defineProperty(window, 'innerWidth', {configurable: true, value: 900});
        Object.defineProperty(window, 'innerHeight', {configurable: true, value: 900});

        const textArea = document.createElement('textarea');
        textArea.value = 'hello @';
        textArea.selectionStart = textArea.value.length;
        textArea.selectionEnd = textArea.value.length;
        textArea.style.lineHeight = '20px';
        textArea.getBoundingClientRect = jest.fn(() => ({
            left: 295,
            top: 100,
            width: 333,
            right: 628,
        })) as unknown as typeof textArea.getBoundingClientRect;

        Object.defineProperty(textArea, 'offsetWidth', {
            configurable: true,
            value: 333,
        });

        document.body.appendChild(textArea);

        window.getComputedStyle = jest.fn(() => ({
            lineHeight: '20px',
            overflow: 'visible',
            overflowX: 'visible',
            overflowY: 'visible',
        }) as CSSStyleDeclaration) as typeof window.getComputedStyle;

        expect(getSuggestionBoxAlgn(textArea)).toMatchObject({
            pixelsToMoveX: 200,
            pixelsToMoveY: 40,
        });
    });
});
