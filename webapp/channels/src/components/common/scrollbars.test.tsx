// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {fireEvent, render} from 'tests/react_testing_utils';

import Scrollbars from './scrollbars';

const originalGetComputedStyle = window.getComputedStyle;
beforeAll(() => {
    window.getComputedStyle = (elt: Element, pseudoElt?: string | null) => {
        if (pseudoElt) {
            // Return an empty CSSStyleDeclaration-like object for pseudo elements
            return {} as CSSStyleDeclaration;
        }
        return originalGetComputedStyle(elt);
    };
});

afterAll(() => {
    window.getComputedStyle = originalGetComputedStyle;
});

describe('Scrollbars', () => {
    test('should attach scroll handler to the correct element', () => {
        const onScroll = jest.fn();

        render(
            <Scrollbars onScroll={onScroll}>
                {'This is some content in a scrollable area'}
            </Scrollbars>,
        );

        // Simulate scrolling to verify the onScroll handler is attached correctly - fireEvent used because userEvent doesn't support scroll events
        fireEvent.scroll(document.querySelector('.simplebar-content-wrapper')!);

        expect(onScroll).toHaveBeenCalled();
    });

    test('should attach ref to the correct element', () => {
        let scrollElement;
        render(
            <Scrollbars
                ref={(element) => {
                    scrollElement = element;
                }}
            >
                <div/>
            </Scrollbars>,
        );

        expect(scrollElement).toBe(document.querySelector('.simplebar-content-wrapper'));
    });
});
