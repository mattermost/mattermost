// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as shared from '@mattermost/shared/utils/user_agent';

export const isChrome = shared.isChrome;
export const isSafari = shared.isSafari;
export const isIosChrome = shared.isIosChrome;
export const isIosFirefox = shared.isIosFirefox;
export const isIos = shared.isIos;
export const isAndroid = shared.isAndroid;
export const isMobile = shared.isMobile;
export const isFirefox = shared.isFirefox;
export const isChromebook = shared.isChromebook;
export const isChromiumEdge = shared.isEdge;
export const isDesktopApp = shared.isDesktopApp;
export const isMacApp = shared.isMacApp;
export const isWindows = shared.isWindows;
export const isMac = shared.isMac;
export const isLinux = shared.isLinux;
export const getDesktopVersion = shared.getDesktopVersion;
export const isM365Mobile = shared.isM365Mobile;

export function isInternetExplorer(): boolean {
    return window.navigator.userAgent.indexOf('Trident') !== -1;
}

export function isEdge(): boolean {
    return window.navigator.userAgent.indexOf('Edge') !== -1;
}
