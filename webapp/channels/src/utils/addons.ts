// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ClientLicense} from '@mattermost/types/config';

// Comma-separated because ClientLicense is Record<string, string>. Split rather
// than substring match, so 'crossguard' is not satisfied by 'crossguard-premium'.
export function licenseHasAddOn(license: ClientLicense | undefined, addOn: string): boolean {
    if (license?.IsLicensed !== 'true') {
        return false;
    }

    const target = addOn.toLowerCase();
    return (license.AddOns ?? '').split(',').some((granted) => granted.toLowerCase() === target);
}

// The license starts as {} and loads asynchronously. GetClientLicense always sets
// IsLicensed, so its presence is what distinguishes loaded from empty.
function isLicenseLoaded(license: ClientLicense | undefined): boolean {
    return license?.IsLicensed !== undefined;
}

// False while the license is still loading, otherwise a licensed admin deep-linking
// to the page gets a flash of "your license does not include it".
export function isUnlicensedAddOn(requiredAddOn: string | undefined, license: ClientLicense | undefined): boolean {
    if (!requiredAddOn) {
        return false;
    }

    if (!isLicenseLoaded(license)) {
        return false;
    }

    return !licenseHasAddOn(license, requiredAddOn);
}
