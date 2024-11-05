// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/*
Example User Agents
--------------------

Chrome:
    Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36

Firefox:
    Mozilla/5.0 (Windows NT 10.0; WOW64; rv:47.0) Gecko/20100101 Firefox/47.0

IE11:
    Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko

Edge:
    Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2486.0 Safari/537.36 Edge/13.10586

ChromeOS Chromebook:
    Mozilla/5.0 (X11; CrOS x86_64 8172.45.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.64 Safari/537.36

Desktop App:
    Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Mattermost/1.2.1 Chrome/49.0.2623.75 Electron/0.37.8 Safari/537.36
    Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2486.0 Safari/537.36 Edge/13.10586
    Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_0) AppleWebKit/537.36 (KHTML, like Gecko) Mattermost/3.4.1 Chrome/53.0.2785.113 Electron/1.4.2 Safari/537.36
    Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Mattermost/3.4.1 Chrome/51.0.2704.106 Electron/1.2.8 Safari/537.36

Android Chrome:
    Mozilla/5.0 (Linux; Android 4.0.4; Galaxy Nexus Build/IMM76B) AppleWebKit/535.19 (KHTML, like Gecko) Chrome/18.0.1025.133 Mobile Safari/535.19

Android Firefox:
    Mozilla/5.0 (Android; U; Android; pl; rv:1.9.2.8) Gecko/20100202 Firefox/3.5.8
    Mozilla/5.0 (Android 7.0; Mobile; rv:54.0) Gecko/54.0 Firefox/54.0
    Mozilla/5.0 (Android 7.0; Mobile; rv:57.0) Gecko/57.0 Firefox/57.0

Android App:
    Mozilla/5.0 (Linux; U; Android 4.1.1; en-gb; Build/KLP) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Safari/534.30
    Mozilla/5.0 (Linux; Android 4.4; Nexus 5 Build/_BuildID_) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/30.0.0.0 Mobile Safari/537.36
    Mozilla/5.0 (Linux; Android 5.1.1; Nexus 5 Build/LMY48B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/43.0.2357.65 Mobile Safari/537.36

iOS Safari:
    Mozilla/5.0 (iPhone; U; CPU like Mac OS X; en) AppleWebKit/420+ (KHTML, like Gecko) Version/3.0 Mobile/1A543 Safari/419.3

iOS Android:
    Mozilla/5.0 (iPhone; U; CPU iPhone OS 5_1_1 like Mac OS X; en) AppleWebKit/534.46.0 (KHTML, like Gecko) CriOS/19.0.1084.60 Mobile/9B206 Safari/7534.48.3

iOS App:
    Mozilla/5.0 (iPhone; CPU iPhone OS 9_3_2 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Mobile/13F69
*/

const userAgent = () => window.navigator.userAgent;

export function isChrome(): boolean {
    return userAgent().indexOf('Chrome') > -1 && userAgent().indexOf('Edge') === -1;
}

export function isSafari(): boolean {
    return userAgent().indexOf('Safari') !== -1 && userAgent().indexOf('Chrome') === -1;
}

export function isIosSafari(): boolean {
    return (userAgent().indexOf('iPhone') !== -1 || userAgent().indexOf('iPad') !== -1) && userAgent().indexOf('Safari') !== -1 && userAgent().indexOf('CriOS') === -1;
}

export function isIosChrome(): boolean {
    return userAgent().indexOf('CriOS') !== -1;
}

export function isIosFirefox(): boolean {
    return userAgent().indexOf('FxiOS') !== -1;
}

export function isIosWeb(): boolean {
    return isIosSafari() || isIosChrome();
}

export function isIos(): boolean {
    return userAgent().indexOf('iPhone') !== -1 || userAgent().indexOf('iPad') !== -1;
}

export function isAndroid(): boolean {
    return userAgent().indexOf('Android') !== -1;
}

export function isAndroidChrome(): boolean {
    return userAgent().indexOf('Android') !== -1 && userAgent().indexOf('Chrome') !== -1 && userAgent().indexOf('Version') === -1;
}

export function isAndroidFirefox(): boolean {
    return userAgent().indexOf('Android') !== -1 && userAgent().indexOf('Firefox') !== -1;
}

export function isAndroidWeb(): boolean {
    return isAndroidChrome() || isAndroidFirefox();
}

export function isIosClassic(): boolean {
    return isMobileApp() && isIos();
}

// Returns true if and only if the user is using a Mattermost mobile app. This will return false if the user is using the
// web browser on a mobile device.
export function isMobileApp(): boolean {
    return isMobile() && !isIosWeb() && !isAndroidWeb();
}

// Returns true if and only if the user is using Mattermost from either the mobile app or the web browser on a mobile device.
export function isMobile(): boolean {
    return isIos() || isAndroid();
}

export function isFirefox(): boolean {
    return userAgent().indexOf('Firefox') !== -1;
}

export function isChromebook(): boolean {
    return userAgent().indexOf('CrOS') !== -1;
}

export function isInternetExplorer(): boolean {
    return userAgent().indexOf('Trident') !== -1;
}

export function isEdge(): boolean {
    return userAgent().indexOf('Edge') !== -1;
}

export function isChromiumEdge(): boolean {
    return userAgent().indexOf('Edg') !== -1 && userAgent().indexOf('Edge') === -1;
}

export function isDesktopApp(): boolean {
    return userAgent().indexOf('Mattermost') !== -1 && userAgent().indexOf('Electron') !== -1;
}

export function isWindowsApp(): boolean {
    return isDesktopApp() && isWindows();
}

export function isMacApp(): boolean {
    return isDesktopApp() && isMac();
}

export function isWindows(): boolean {
    return userAgent().indexOf('Windows') !== -1;
}

export function isMac(): boolean {
    return userAgent().indexOf('Macintosh') !== -1;
}

export function isLinux(): boolean {
    return navigator.platform.toUpperCase().indexOf('LINUX') >= 0;
}

export function isWindows7(): boolean {
    const appVersion = navigator.appVersion;

    if (!appVersion) {
        return false;
    }

    return (/\bWindows NT 6\.1\b/).test(appVersion);
}

export function getDesktopVersion(): string {
    // use if the value window.desktop.version is not set yet
    const regex = /Mattermost\/(\d+\.\d+\.\d+)/gm;
    const match = regex.exec(window.navigator.appVersion)?.[1] || '';
    return match;
}
