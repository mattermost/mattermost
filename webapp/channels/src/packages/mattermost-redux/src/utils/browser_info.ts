// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function getBrowserInfo() {
    const userAgent = window.navigator.userAgent;

    let browser = 'Unknown';
    let browserVersion = 'Unknown';

    // Simple browser detection
    if (userAgent.includes('Firefox')) {
        browser = 'Firefox';
    } else if (userAgent.includes('Chrome')) {
        browser = 'Chrome';
    } else if (userAgent.includes('Safari')) {
        browser = 'Safari';
    } else if (userAgent.includes('Edge')) {
        browser = 'Edge';
    }

    // Get browser version
    const match = userAgent.match(/(firefox|chrome|safari|edge(?=\/))\/?\s*(\d+)/i);
    if (match) {
        browserVersion = match[2];
    }

    return {browser, browserVersion};
}

export function getPlatformInfo() {
    // Casting to undefined in case it is deprecated in any browser
    const platform = window.navigator.platform as string | undefined;

    let platformName = 'Unknown';
    if (platform?.toLowerCase().includes('win')) {
        platformName = 'Windows';
    } else if (platform?.toLowerCase().includes('mac')) {
        platformName = 'MacOS';
    } else if (platform?.toLowerCase().includes('linux')) {
        platformName = 'Linux';
    }

    return platformName;
}
