// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {fireEvent, render} from 'tests/react_testing_utils';

import Scrollbars from './scrollbars';

describe('Scrollbars', () => {
    test('should attach scroll handler to the correct element', () => {
        const onScroll = jest.fn();

        render(
            <Scrollbars onScroll={onScroll}>
                {'This is some content in a scrollable area'}
            </Scrollbars>,
        );

        // Ideally, we'd actually scroll the content of the element, but jsdom doesn't implement scroll events
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
