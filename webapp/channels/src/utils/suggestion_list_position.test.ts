// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getSuggestionListPosition} from './suggestion_list_position';

describe('getSuggestionListPosition', () => {
    const originalInnerHeight = window.innerHeight;

    afterEach(() => {
        Object.defineProperty(window, 'innerHeight', {configurable: true, value: originalInnerHeight});
    });

    function mockViewportHeight(height: number) {
        Object.defineProperty(window, 'innerHeight', {configurable: true, value: height});
    }

    function mockInput(top: number, bottom: number) {
        return {
            getBoundingClientRect: () => ({
                top,
                bottom,
                left: 0,
                right: 0,
                width: 0,
                height: bottom - top,
                x: 0,
                y: top,
                toJSON: () => ({}),
            }),
        } as HTMLElement;
    }

    test('opens downward when there is more space below', () => {
        mockViewportHeight(800);
        expect(getSuggestionListPosition(mockInput(40, 80))).toBe('bottom');
    });

    test('opens upward when there is more space above', () => {
        mockViewportHeight(800);
        expect(getSuggestionListPosition(mockInput(600, 640))).toBe('top');
    });

    test('prefers top when space above and below is equal', () => {
        mockViewportHeight(800);
        expect(getSuggestionListPosition(mockInput(380, 420))).toBe('top');
    });

    test('defaults to top when input has no bounding rect', () => {
        expect(getSuggestionListPosition({} as HTMLElement)).toBe('top');
    });
});
