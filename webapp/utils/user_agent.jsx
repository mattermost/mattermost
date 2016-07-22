// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

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

Desktop App:
    Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Mattermost/1.2.1 Chrome/49.0.2623.75 Electron/0.37.8 Safari/537.36
    Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2486.0 Safari/537.36 Edge/13.10586

Android Chrome:
    Mozilla/5.0 (Linux; Android 4.0.4; Galaxy Nexus Build/IMM76B) AppleWebKit/535.19 (KHTML, like Gecko) Chrome/18.0.1025.133 Mobile Safari/535.19

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

const userAgent = window.navigator.userAgent;

export function isChrome() {
    return userAgent.indexOf('Chrome') > -1;
}

export function isSafari() {
    return userAgent.indexOf('Safari') !== -1 && userAgent.indexOf('Chrome') === -1;
}

export function isIosSafari() {
    return userAgent.indexOf('iPhone') !== -1 && userAgent.indexOf('Safari') !== -1 && navigator.userAgent.indexOf('CriOS') === -1;
}

export function isIosChrome() {
    return userAgent.indexOf('CriOS') !== -1;
}

export function isMobileApp() {
    return userAgent.indexOf('iPhone') !== -1 && userAgent.indexOf('Safari') === -1 && userAgent.indexOf('CriOS') === -1;
}

export function isFirefox() {
    return userAgent.indexOf('Firefox') !== -1;
}

export function isInternetExplorer() {
    return userAgent.indexOf('Trident') !== -1;
}

export function isEdge() {
    return userAgent.indexOf('Edge') !== -1;
}