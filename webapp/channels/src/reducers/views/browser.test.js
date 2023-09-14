// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import browserReducer from 'reducers/views/browser';

import {ActionTypes, WindowSizes} from 'utils/constants';

describe('Reducers.Browser', () => {
    const initialState = {
        focused: true,
        windowSize: WindowSizes.DESKTOP_VIEW,
    };

    test('Initial state', () => {
        const nextState = browserReducer(
            {
                focused: true,
                windowSize: WindowSizes.DESKTOP_VIEW,
            },
            {},
        );

        expect(nextState).toEqual(initialState);
    });

    test(`should lose focus on ${ActionTypes.BROWSER_CHANGE_FOCUS}`, () => {
        const nextState = browserReducer(
            {
                focused: true,
                windowSize: WindowSizes.DESKTOP_VIEW,
            },
            {
                type: ActionTypes.BROWSER_CHANGE_FOCUS,
                focus: false,
            },
        );

        expect(nextState).toEqual({
            ...initialState,
            focused: false,
        });
    });

    test(`should gain focus on ${ActionTypes.BROWSER_CHANGE_FOCUS}`, () => {
        const nextState = browserReducer(
            {
                focused: false,
                windowSize: WindowSizes.DESKTOP_VIEW,
            },
            {
                type: ActionTypes.BROWSER_CHANGE_FOCUS,
                focus: true,
            },
        );

        expect(nextState).toEqual({
            ...initialState,
            focused: true,
        });
    });

    test(`should reflect window resize update on ${ActionTypes.BROWSER_WINDOW_RESIZED}`, () => {
        const nextState = browserReducer(
            {
                focused: true,
                windowSize: WindowSizes.DESKTOP_VIEW,
            },
            {
                type: ActionTypes.BROWSER_WINDOW_RESIZED,
                data: WindowSizes.MOBILE_VIEW,
            },
        );

        expect(nextState).toEqual({
            ...initialState,
            windowSize: WindowSizes.MOBILE_VIEW,
        });
    });
});
