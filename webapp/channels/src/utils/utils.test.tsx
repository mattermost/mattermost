// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type React from 'react';

import {FileTypes} from './constants';
import {getFileType, getSuggestionBoxAlgn, makeIsEligibleForClick} from './utils';

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
        expect(getFileType('PHOTO.PNG')).toBe(FileTypes.IMAGE);
    });

    test('should identify other file types correctly', () => {
        expect(getFileType('doc')).toBe(FileTypes.WORD);
        expect(getFileType('pdf')).toBe(FileTypes.PDF);
        expect(getFileType('mp3')).toBe(FileTypes.AUDIO);
        expect(getFileType('mp4')).toBe(FileTypes.VIDEO);
        expect(getFileType('js')).toBe(FileTypes.CODE);
        expect(getFileType('txt')).toBe(FileTypes.TEXT);
    });

    test('should only treat proxy image URLs with a url parameter as images', () => {
        expect(getFileType('/api/v4/image')).toBe(FileTypes.OTHER);
        expect(getFileType('/api/v4/image?url=')).toBe(FileTypes.IMAGE);
        expect(getFileType('/api/v4/image?param=value')).toBe(FileTypes.OTHER);
    });

    test('should not treat path-like filenames with query strings or hashes as direct extensions', () => {
        expect(getFileType('path/to/image.jpg?x=1')).toBe(FileTypes.OTHER);
        expect(getFileType('path/to/image.jpg#fragment')).toBe(FileTypes.OTHER);
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
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;

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
        Object.defineProperty(window, 'innerWidth', {configurable: true, value: originalInnerWidth});
        Object.defineProperty(window, 'innerHeight', {configurable: true, value: originalInnerHeight});
    });

    test('returns zero offsets for invalid input', () => {
        expect(getSuggestionBoxAlgn(null as any)).toEqual({
            pixelsToMoveX: 0,
            pixelsToMoveY: 0,
        });
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

    function mockComputedStyle(overrides = new Map<Element, Partial<CSSStyleDeclaration>>()) {
        window.getComputedStyle = jest.fn((element: Element) => ({
            lineHeight: '20px',
            overflow: 'visible',
            overflowX: 'visible',
            overflowY: 'visible',
            ...overrides.get(element),
        } as CSSStyleDeclaration)) as typeof window.getComputedStyle;
    }

    test('keeps the suggestion list inside the nearest clipping container', () => {
        Object.defineProperty(window, 'innerWidth', {configurable: true, value: 900});
        Object.defineProperty(window, 'innerHeight', {configurable: true, value: 900});

        const {textArea, clippingAncestor} = createTextArea(654);
        mockComputedStyle(new Map([[clippingAncestor, {
            overflow: 'hidden',
            overflowX: 'hidden',
            overflowY: 'hidden',
        }]]));

        expect(getSuggestionBoxAlgn(textArea)).toMatchObject({
            pixelsToMoveX: 0,
            pixelsToMoveY: 40,
        });
    });

    test('treats an equal-width clipping ancestor as a valid horizontal boundary', () => {
        Object.defineProperty(window, 'innerWidth', {configurable: true, value: 900});
        Object.defineProperty(window, 'innerHeight', {configurable: true, value: 900});

        const {textArea, clippingAncestor} = createTextArea(654);
        clippingAncestor.getBoundingClientRect = jest.fn(() => ({
            width: 333,
            right: 654,
        })) as unknown as typeof clippingAncestor.getBoundingClientRect;

        mockComputedStyle(new Map([[clippingAncestor, {
            overflow: 'hidden',
            overflowX: 'hidden',
            overflowY: 'hidden',
        }]]));

        expect(getSuggestionBoxAlgn(textArea)).toMatchObject({
            pixelsToMoveX: 0,
            pixelsToMoveY: 40,
        });
    });

    test('skips narrow clipping ancestors and uses the next valid boundary', () => {
        Object.defineProperty(window, 'innerWidth', {configurable: true, value: 900});
        Object.defineProperty(window, 'innerHeight', {configurable: true, value: 900});

        const outerAncestor = document.createElement('div');
        outerAncestor.getBoundingClientRect = jest.fn(() => ({
            width: 900,
            right: 900,
        })) as unknown as typeof outerAncestor.getBoundingClientRect;

        const innerAncestor = document.createElement('div');
        innerAncestor.getBoundingClientRect = jest.fn(() => ({
            width: 320,
            right: 620,
        })) as unknown as typeof innerAncestor.getBoundingClientRect;

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

        outerAncestor.appendChild(innerAncestor);
        innerAncestor.appendChild(textArea);
        document.body.appendChild(outerAncestor);

        mockComputedStyle(new Map([
            [innerAncestor, {
                overflow: 'hidden',
                overflowX: 'hidden',
                overflowY: 'hidden',
            }],
            [outerAncestor, {
                overflow: 'hidden',
                overflowX: 'hidden',
                overflowY: 'hidden',
            }],
        ]));

        expect(getSuggestionBoxAlgn(textArea)).toMatchObject({
            pixelsToMoveX: 200,
            pixelsToMoveY: 40,
        });
    });

    test('treats overflowX clipping as a horizontal boundary even when overflow remains visible', () => {
        Object.defineProperty(window, 'innerWidth', {configurable: true, value: 900});
        Object.defineProperty(window, 'innerHeight', {configurable: true, value: 900});

        const {textArea, clippingAncestor} = createTextArea(654);
        mockComputedStyle(new Map([[clippingAncestor, {
            overflow: 'visible',
            overflowX: 'hidden',
            overflowY: 'visible',
        }]]));

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
        mockComputedStyle();

        expect(getSuggestionBoxAlgn(textArea)).toMatchObject({
            pixelsToMoveX: 200,
            pixelsToMoveY: 40,
        });
    });

    test('aligns with the textbox when requested', () => {
        Object.defineProperty(window, 'innerWidth', {configurable: true, value: 900});
        Object.defineProperty(window, 'innerHeight', {configurable: true, value: 900});

        const {textArea} = createTextArea(900);
        mockComputedStyle();

        expect(getSuggestionBoxAlgn(textArea, 39, true)).toMatchObject({
            pixelsToMoveX: 0,
            pixelsToMoveY: 40,
            lineHeight: 20,
            placementShift: false,
        });
    });

    test('applies trigger offset and placement shift when the viewport is short', () => {
        Object.defineProperty(window, 'innerWidth', {configurable: true, value: 900});
        Object.defineProperty(window, 'innerHeight', {configurable: true, value: 120});

        const textArea = document.createElement('textarea');
        textArea.value = 'hello ~';
        textArea.selectionStart = textArea.value.length;
        textArea.selectionEnd = textArea.value.length;
        textArea.style.lineHeight = '24px';
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
        mockComputedStyle(new Map([[textArea, {lineHeight: '24px'}]]));

        expect(getSuggestionBoxAlgn(textArea, 39)).toMatchObject({
            pixelsToMoveX: 161,
            pixelsToMoveY: 40,
            lineHeight: 24,
            placementShift: true,
        });
    });
});

describe('Utils.makeIsEligibleForClick', () => {
    const isEligibleForClick = makeIsEligibleForClick('.select-suggestion-container, .post-attachment-dropdown, .mm-blocks-select');

    test('returns false when clicking inside an autocomplete selector container', () => {
        const post = document.createElement('div');
        const select = document.createElement('div');
        const inputWrapper = document.createElement('div');
        const input = document.createElement('input');

        select.className = 'select-suggestion-container';
        post.appendChild(select);
        select.appendChild(inputWrapper);
        inputWrapper.appendChild(input);
        document.body.appendChild(post);

        const event = {
            currentTarget: post,
            target: inputWrapper,
        } as unknown as React.MouseEvent;

        expect(isEligibleForClick(event)).toBe(false);

        document.body.removeChild(post);
    });
});
