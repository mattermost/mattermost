// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, render} from '@testing-library/react';
import React from 'react';

import Scrollbar from './scrollbar';

describe('Scrollbar', () => {
    test('should attach scroll handler to the correct element', () => {
        const onScroll = jest.fn();

        render(
            <Scrollbar onScroll={onScroll}>
                {'This is some content in a scrollable area'}
            </Scrollbar>,
        );

        // Ideally, we'd actually scroll the content of the element, but jsdom doesn't implement scroll events
        fireEvent.scroll(document.querySelector('.simplebar-content-wrapper')!);

        expect(onScroll).toHaveBeenCalled();
    });

    test('should attach ref to the correct element', () => {
        let scrollElement;
        render(
            <Scrollbar
                ref={(element) => {
                    scrollElement = element;
                }}
            >
                <div/>
            </Scrollbar>,
        );

        expect(scrollElement).toBe(document.querySelector('.simplebar-content-wrapper'));
    });
});
