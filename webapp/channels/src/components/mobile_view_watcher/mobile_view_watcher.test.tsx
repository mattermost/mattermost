// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render} from '@testing-library/react';
import React from 'react';

import matchMedia from 'tests/helpers/match_media.mock';
import Constants, {WindowSizes} from 'utils/constants';

import MobileViewWatcher from './mobile_view_watcher';

describe('window.matchMedia', () => {
    const baseProps = {
        emitBrowserWindowResized: jest.fn(),
    };

    afterEach(() => {
        matchMedia.clear();
    });

    test('should update redux when the desktop media query matches', () => {
        render(<MobileViewWatcher {...baseProps}/>);

        expect(baseProps.emitBrowserWindowResized).toBeCalledTimes(0);

        matchMedia.useMediaQuery(`(min-width: ${Constants.DESKTOP_SCREEN_WIDTH + 1}px)`);

        expect(baseProps.emitBrowserWindowResized).toBeCalledTimes(1);

        expect(baseProps.emitBrowserWindowResized.mock.calls[0][0]).toBe(WindowSizes.DESKTOP_VIEW);
    });

    test('should update redux when the small desktop media query matches', () => {
        render(<MobileViewWatcher {...baseProps}/>);

        expect(baseProps.emitBrowserWindowResized).toBeCalledTimes(0);

        matchMedia.useMediaQuery(`(min-width: ${Constants.TABLET_SCREEN_WIDTH + 1}px) and (max-width: ${Constants.DESKTOP_SCREEN_WIDTH}px)`);

        expect(baseProps.emitBrowserWindowResized).toBeCalledTimes(1);

        expect(baseProps.emitBrowserWindowResized.mock.calls[0][0]).toBe(WindowSizes.SMALL_DESKTOP_VIEW);
    });

    test('should update redux when the tablet media query matches', () => {
        render(<MobileViewWatcher {...baseProps}/>);

        expect(baseProps.emitBrowserWindowResized).toBeCalledTimes(0);

        matchMedia.useMediaQuery(`(min-width: ${Constants.MOBILE_SCREEN_WIDTH + 1}px) and (max-width: ${Constants.TABLET_SCREEN_WIDTH}px)`);

        expect(baseProps.emitBrowserWindowResized).toBeCalledTimes(1);

        expect(baseProps.emitBrowserWindowResized.mock.calls[0][0]).toBe(WindowSizes.TABLET_VIEW);
    });

    test('should update redux when the mobile media query matches', () => {
        render(<MobileViewWatcher {...baseProps}/>);

        expect(baseProps.emitBrowserWindowResized).toBeCalledTimes(0);

        matchMedia.useMediaQuery(`(max-width: ${Constants.MOBILE_SCREEN_WIDTH}px)`);

        expect(baseProps.emitBrowserWindowResized).toBeCalledTimes(1);

        expect(baseProps.emitBrowserWindowResized.mock.calls[0][0]).toBe(WindowSizes.MOBILE_VIEW);
    });
});
