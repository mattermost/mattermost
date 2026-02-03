// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function getBrowserInfo() {
    const userAgent = window.navigator.userAgent.toLowerCase();

    let browser = 'Unknown';
    let browserVersion = 'Unknown';

    // Check if it's Mattermost Desktop App first
    if (userAgent.includes('mattermost')) {
        browser = 'Mattermost Desktop App';
        const match = userAgent.match(/mattermost\/(\d+(\.\d+)*)/i);

        if (match && match[1]) {
            browserVersion = match[1];
        }
        return {browser, browserVersion};
    }

    // Simple browser detection - order matters!
    if (userAgent.includes('edge/')) {
        browser = 'Edge';
    } else if (userAgent.includes('edg/')) {
        browser = 'Edge Chromium';
    } else if (userAgent.includes('chrome/')) {
        if (userAgent.includes('opr/')) {
            browser = 'Opera';
        } else {
            browser = 'Chrome';
        }
    } else if (userAgent.includes('safari/') && userAgent.includes('version/')) {
        browser = 'Safari';
    } else if (userAgent.includes('firefox/')) {
        browser = 'Firefox';
    }

    // Get browser version
    let match;
    if (browser === 'Edge') {
        match = userAgent.match(/edge\/(\d+)/i);
    } else if (browser === 'Edge Chromium') {
        match = userAgent.match(/edg\/(\d+)/i);
    } else if (browser === 'Opera') {
        match = userAgent.match(/opr\/(\d+)/i);
    } else if (browser === 'Safari') {
        match = userAgent.match(/version\/(\d+)/i);
    } else {
        match = userAgent.match(/(firefox|chrome)\/(\d+)/i);
        if (match) {
            match[1] = match[2]; // Align with other matches where version is in group 1
        }
    }

    if (match && match[1]) {
        browserVersion = match[1];
    }

    return {browser, browserVersion};
}

export function getPlatformInfo() {
    // Casting to undefined in case it is deprecated in any browser
    const platform = window.navigator.platform as string | undefined;
    const userAgent = window.navigator.userAgent.toLowerCase();

    let platformName = 'Unknown';

    // First try using platform
    if (platform) {
        if (platform.toLowerCase().includes('win')) {
            platformName = 'Windows';
        } else if (platform.toLowerCase().includes('mac')) {
            platformName = 'MacOS';
        } else if (platform.toLowerCase().includes('linux')) {
            platformName = 'Linux';
        }
    }

    // Fallback to userAgent if platform didn't work
    if (platformName === 'Unknown') {
        if (userAgent.includes('windows')) {
            platformName = 'Windows';
        } else if (userAgent.includes('mac os x')) {
            platformName = 'MacOS';
        } else if (userAgent.includes('linux')) {
            platformName = 'Linux';
        }
    }

    return platformName;
}
