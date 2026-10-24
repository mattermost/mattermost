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

    test('should stop a press on the scrollbar track from reaching drag and drop sensors', () => {
        render(
            <Scrollbars>
                <div/>
            </Scrollbars>,
        );

        const track = document.querySelector<HTMLElement>('.simplebar-track.simplebar-vertical')!;
        track.style.visibility = 'visible';
        track.getBoundingClientRect = () => ({x: 229, y: 0, left: 229, right: 240, top: 0, bottom: 400, width: 11, height: 400, toJSON: () => ''});

        const onTrack = new MouseEvent('mousedown', {bubbles: true, cancelable: true, clientX: 235, clientY: 100});
        window.dispatchEvent(onTrack);
        expect(onTrack.defaultPrevented).toBe(true);

        const besideTrack = new MouseEvent('mousedown', {bubbles: true, cancelable: true, clientX: 200, clientY: 100});
        window.dispatchEvent(besideTrack);
        expect(besideTrack.defaultPrevented).toBe(false);
    });

    test('should not stop a press where the track is hidden because the content fits', () => {
        render(
            <Scrollbars>
                <div/>
            </Scrollbars>,
        );

        const track = document.querySelector<HTMLElement>('.simplebar-track.simplebar-vertical')!;
        track.style.visibility = 'hidden';
        track.getBoundingClientRect = () => ({x: 229, y: 0, left: 229, right: 240, top: 0, bottom: 400, width: 11, height: 400, toJSON: () => ''});

        const onTrack = new MouseEvent('mousedown', {bubbles: true, cancelable: true, clientX: 235, clientY: 100});
        window.dispatchEvent(onTrack);

        expect(onTrack.defaultPrevented).toBe(false);
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
