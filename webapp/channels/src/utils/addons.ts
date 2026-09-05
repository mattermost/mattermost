// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ClientLicense} from '@mattermost/types/config';

/**
 * Maps a plugin id to the add-on entitlement its license must grant before the
 * server will activate it. Plugins absent from this map are not add-ons.
 *
 * This mirrors model.PluginAddOnRequirements in
 * server/public/model/plugin_constants.go and must be kept in sync with it.
 * The server-side map is authoritative: it gates activation, while this one only
 * gates what the System Console offers.
 */
export const pluginAddOnRequirements: Record<string, string> = {
    crossguard: 'crossguard',
};

/**
 * Returns the add-on a plugin requires, or undefined if it is not an add-on.
 */
export function getRequiredAddOn(pluginId: string): string | undefined {
    return pluginAddOnRequirements[pluginId];
}

/**
 * Reports whether the license grants the named add-on.
 *
 * Add-ons arrive from the server as a comma-separated list, because ClientLicense
 * is Record<string, string>. Split rather than substring match, so that an add-on
 * named 'crossguard' is not satisfied by 'crossguard-premium'.
 *
 * Comparison is case-insensitive to match License.HasAddOn on the server, which
 * uses strings.EqualFold. Without this the server could activate an add-on granted
 * as 'CrossGuard' while the System Console reported it as unlicensed.
 */
export function licenseHasAddOn(license: ClientLicense | undefined, addOn: string): boolean {
    if (license?.IsLicensed !== 'true') {
        return false;
    }

    const target = addOn.toLowerCase();
    return (license.AddOns ?? '').split(',').some((granted) => granted.toLowerCase() === target);
}

/**
 * Reports whether a plugin is a licensed add-on that the current license does not
 * grant. False for plugins that are not add-ons.
 */
export function isUnlicensedAddOn(pluginId: string, license: ClientLicense | undefined): boolean {
    const addOn = getRequiredAddOn(pluginId);
    if (!addOn) {
        return false;
    }

    return !licenseHasAddOn(license, addOn);
}
