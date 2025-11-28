// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {fireEvent, render} from 'tests/vitest_react_testing_utils';

import Scrollbars from './scrollbars';

describe('Scrollbars', () => {
    test('should attach scroll handler to the correct element', () => {
        const onScroll = vi.fn();

        render(
            <Scrollbars onScroll={onScroll}>
                {'This is some content in a scrollable area'}
            </Scrollbars>,
        );

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
