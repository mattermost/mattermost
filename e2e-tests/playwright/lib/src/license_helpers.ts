// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * License helpers for E2E tests.
 * Logic mirrors server (model/license.go) and webapp (licensedForFeature, license_utils).
 */

export type ClientLicense = Record<string, string>;

/**
 * Returns true if the server has a license that includes autotranslation (Entry or Advanced).
 * Use with test.skip(!hasAutotranslationLicense(license.SkuShortName), '...') in autotranslation specs.
 */
export function hasAutotranslationLicense(skuShortName: string): boolean {
    return skuShortName === 'entry' || skuShortName === 'advanced';
}

/**
 * Returns true if the server has a license that includes Shared Channels.
 * The client receives SharedChannels === 'true' when the server's HasSharedChannels() is true
 * (see server/public/model/license.go and server/channels/utils/license.go).
 * Use with test.skip(!hasSharedChannelsLicense(license), '...') in shared channel specs.
 */
export function hasSharedChannelsLicense(license: ClientLicense | null | undefined): boolean {
    return license?.SharedChannels === 'true';
}

/**
 * Returns true if the server has a license that includes Custom Permission Schemes
 * (required to create/patch/delete permission schemes and assign custom roles via API,
 * e.g. shared_channel_manager or roles in a custom team scheme).
 * The client receives CustomPermissionsSchemes === 'true' when the feature is enabled
 * (see server/public/model/license.go and server/channels/utils/license.go).
 */
export function hasCustomPermissionsSchemesLicense(license: ClientLicense | null | undefined): boolean {
    return license?.CustomPermissionsSchemes === 'true';
}

/**
 * Mirrors webapp `getLicenseTier` (utils/constants) for client `SkuShortName` values.
 */
export function licenseTier(skuShortName: string): number {
    switch (skuShortName) {
        case 'professional':
            return 10;
        case 'enterprise':
            return 20;
        case 'entry':
        case 'advanced':
            return 30;
        default:
            return 0;
    }
}
