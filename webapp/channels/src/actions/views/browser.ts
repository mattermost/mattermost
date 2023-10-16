// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GenericAction} from 'mattermost-redux/types/actions';

import {Constants, ActionTypes, WindowSizes} from 'utils/constants';

export function emitBrowserWindowResized(windowSize?: string): GenericAction {
    let newWindowSize = windowSize;
    if (!windowSize) {
        const width = window.innerWidth;

        switch (true) {
        case width > Constants.TABLET_SCREEN_WIDTH && width <= Constants.DESKTOP_SCREEN_WIDTH: {
            newWindowSize = WindowSizes.SMALL_DESKTOP_VIEW;
            break;
        }
        case width > Constants.MOBILE_SCREEN_WIDTH && width <= Constants.TABLET_SCREEN_WIDTH: {
            newWindowSize = WindowSizes.TABLET_VIEW;
            break;
        }
        case width <= Constants.MOBILE_SCREEN_WIDTH: {
            newWindowSize = WindowSizes.MOBILE_VIEW;
            break;
        }
        default: {
            newWindowSize = WindowSizes.DESKTOP_VIEW; // width > Constants.DESKTOP_SCREEN_WIDTH
        }
        }
    }
    return {
        type: ActionTypes.BROWSER_WINDOW_RESIZED,
        data: newWindowSize,
    };
}
