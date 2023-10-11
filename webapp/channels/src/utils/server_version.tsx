// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Boolean function to check if a server version is greater than another.
 *
 * currentVersion: The server version being checked
 * compareVersion: The version to compare the former version against
 *
 * eg.  currentVersion = 4.16.0, compareVersion = 4.17.0 returns false
 *      currentVersion = 4.16.1, compareVersion = 4.16.1 returns true
 */
export function isServerVersionGreaterThanOrEqualTo(currentVersion: string, compareVersion: string): boolean {
    if (currentVersion === compareVersion) {
        return true;
    }

    // We only care about the numbers
    const currentVersionNumber = (currentVersion || '').split('.').filter((x) => (/^[0-9]+$/).exec(x) !== null);
    const compareVersionNumber = (compareVersion || '').split('.').filter((x) => (/^[0-9]+$/).exec(x) !== null);

    for (let i = 0; i < Math.max(currentVersionNumber.length, compareVersionNumber.length); i++) {
        const currentVersion = parseInt(currentVersionNumber[i], 10) || 0;
        const compareVersion = parseInt(compareVersionNumber[i], 10) || 0;
        if (currentVersion > compareVersion) {
            return true;
        }

        if (currentVersion < compareVersion) {
            return false;
        }
    }

    // If all components are equal, then return true
    return true;
}
