// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {WindowSizes} from 'utils/constants';

import type {GlobalState} from 'types/store';

export function getIsDesktopView(state: GlobalState): boolean {
    const windowSize = state.views.browser.windowSize;
    return windowSize === WindowSizes.DESKTOP_VIEW;
}

export function getIsSmallDesktopView(state: GlobalState): boolean {
    const windowSize = state.views.browser.windowSize;
    return windowSize === WindowSizes.SMALL_DESKTOP_VIEW;
}

export function getIsTabletView(state: GlobalState): boolean {
    const windowSize = state.views.browser.windowSize;
    return windowSize === WindowSizes.TABLET_VIEW;
}

export function getIsMobileView(state: GlobalState): boolean {
    const windowSize = state.views.browser.windowSize;
    return windowSize === WindowSizes.MOBILE_VIEW;
}
