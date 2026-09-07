// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ClientLicense} from '@mattermost/types/config';

/**
 * Maps a plugin id to the add-on entitlement its license must grant before the
 * server will activate it. Plugins absent from this map are not add-ons.
 *
 * This mirrors the registry behind model.PluginRequiredAddOn in
 * server/public/model/plugin_constants.go and must be kept in sync with it.
 * The server-side registry is authoritative: it gates activation, while this one
 * only gates what the System Console offers.
 */
export const pluginAddOnRequirements: Record<string, string> = {
    crossguard: 'crossguard',
};

/**
 * Returns the add-on a plugin requires, or undefined if it is not an add-on.
 *
 * Keys are lower case and the plugin id is normalized before lookup, mirroring
 * model.PluginRequiredAddOn on the server, since IsValidPluginId permits mixed
 * case. Object.hasOwn guards against ids that collide with Object.prototype
 * members ('constructor', 'toString'), which are also valid plugin ids and would
 * otherwise resolve to an inherited value.
 */
export function getRequiredAddOn(pluginId: string): string | undefined {
    const key = pluginId.toLowerCase();
    return Object.hasOwn(pluginAddOnRequirements, key) ? pluginAddOnRequirements[key] : undefined;
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
 * Reports whether the client license has been fetched yet. It starts as {} and is
 * populated asynchronously, and GetClientLicense always sets IsLicensed (to
 * 'false' when there is no license), so its presence is the discriminator.
 */
function isLicenseLoaded(license: ClientLicense | undefined): boolean {
    return license?.IsLicensed !== undefined;
}

/**
 * Reports whether a plugin is a licensed add-on that the current license does not
 * grant. False for plugins that are not add-ons.
 *
 * Also false while the license is still loading. Treating that window as
 * unlicensed would flash "your license does not include it" at a licensed admin
 * who deep-links to the plugin's settings page, before flipping to the toggle.
 */
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
