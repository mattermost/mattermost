// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ClientLicense} from '@mattermost/types/config';

// Mirrors pluginAddOnRequirements in server/public/model/plugin_constants.go,
// which is authoritative and gates activation; this only gates what the console
// offers. Nothing enforces that the two agree.
export const pluginAddOnRequirements: Record<string, string> = {
    crossguard: 'crossguard',
};

// hasOwn, because 'constructor' and 'toString' are valid plugin ids and would
// otherwise resolve to an inherited value.
export function getRequiredAddOn(pluginId: string): string | undefined {
    const key = pluginId.toLowerCase();
    return Object.hasOwn(pluginAddOnRequirements, key) ? pluginAddOnRequirements[key] : undefined;
}

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
export function isUnlicensedAddOn(pluginId: string, license: ClientLicense | undefined): boolean {
    const addOn = getRequiredAddOn(pluginId);
    if (!addOn) {
        return false;
    }

    if (!isLicenseLoaded(license)) {
        return false;
    }

    return !licenseHasAddOn(license, addOn);
}
