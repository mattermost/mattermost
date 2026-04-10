// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function isInternetExplorer(): boolean {
    return window.navigator.userAgent.indexOf('Trident') !== -1;
}
