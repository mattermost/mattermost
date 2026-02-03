// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as UserAgent from 'utils/user_agent';

export type PlatformLabel = ReturnType<typeof getPlatformLabel>;
export type UserAgentLabel = ReturnType<typeof getUserAgentLabel>;

export function getPlatformLabel() {
    if (UserAgent.isIos()) {
        return 'ios';
    } else if (UserAgent.isAndroid()) {
        return 'android';
    } else if (UserAgent.isLinux()) {
        return 'linux';
    } else if (UserAgent.isMac()) {
        return 'macos';
    } else if (UserAgent.isWindows()) {
        return 'windows';
    }

    return 'other';
}

export function getUserAgentLabel() {
    if (UserAgent.isDesktopApp()) {
        return 'desktop';
    } else if (UserAgent.isFirefox() || UserAgent.isIosFirefox()) {
        return 'firefox';
    } else if (UserAgent.isChromiumEdge()) {
        return 'edge';
    } else if (UserAgent.isChrome() || UserAgent.isIosChrome()) {
        return 'chrome';
    } else if (UserAgent.isSafari()) {
        return 'safari';
    }

    return 'other';
}

export function getDesktopAppVersionLabel(appVersion?: string | null, prereleaseVersion?: string) {
    return prereleaseVersion?.split('.')[0] ?? appVersion ?? 'unknown';
}
