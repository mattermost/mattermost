// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import LocalizationStore from 'stores/localization_store.jsx';

const LICENSE_EXPIRY_NOTIFICATION = 1000 * 60 * 60 * 24 * 60; // 60 days
const LICENSE_GRACE_PERIOD = 1000 * 60 * 60 * 24 * 15; // 15 days

export function isLicenseExpiring() {
    if (window.mm_license.IsLicensed !== 'true') {
        return false;
    }

    const timeDiff = parseInt(global.window.mm_license.ExpiresAt, 10) - Date.now();
    return timeDiff <= LICENSE_EXPIRY_NOTIFICATION;
}

export function isLicenseExpired() {
    if (window.mm_license.IsLicensed !== 'true') {
        return false;
    }

    const timeDiff = parseInt(global.window.mm_license.ExpiresAt, 10) - Date.now();
    return timeDiff < 0;
}

export function isLicensePastGracePeriod() {
    if (window.mm_license.IsLicensed !== 'true') {
        return false;
    }

    const timeDiff = Date.now() - parseInt(global.window.mm_license.ExpiresAt, 10);
    return timeDiff > LICENSE_GRACE_PERIOD;
}

export function displayExpiryDate() {
    const date = new Date(parseInt(global.window.mm_license.ExpiresAt, 10));
    return date.toLocaleString(LocalizationStore.getLocale(), {year: 'numeric', month: 'long', day: 'numeric'});
}
