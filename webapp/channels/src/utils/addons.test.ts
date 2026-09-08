// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ClientLicense} from '@mattermost/types/config';

import {getRequiredAddOn, isUnlicensedAddOn, licenseHasAddOn, pluginAddOnRequirements} from './addons';

const licensed = (addOns?: string): ClientLicense => (addOns === undefined ? {IsLicensed: 'true'} : {IsLicensed: 'true', AddOns: addOns});

describe('utils/addons', () => {
    describe('getRequiredAddOn', () => {
        test('should return the add-on for a registered plugin', () => {
            expect(getRequiredAddOn('crossguard')).toEqual('crossguard');
        });

        test('should return undefined for a plugin that is not an add-on', () => {
            expect(getRequiredAddOn('playbooks')).toBeUndefined();
            expect(getRequiredAddOn('')).toBeUndefined();
        });

        test('should match the plugin id case-insensitively', () => {
            expect(getRequiredAddOn('CrossGuard')).toEqual('crossguard');
            expect(getRequiredAddOn('CROSSGUARD')).toEqual('crossguard');
        });

        test('should not resolve ids that collide with Object.prototype members', () => {
            // 'constructor', 'toString' and 'valueOf' are all valid plugin ids.
            expect(getRequiredAddOn('constructor')).toBeUndefined();
            expect(getRequiredAddOn('toString')).toBeUndefined();
            expect(getRequiredAddOn('valueOf')).toBeUndefined();
            expect(getRequiredAddOn('hasOwnProperty')).toBeUndefined();
        });
    });

    describe('licenseHasAddOn', () => {
        test('should return false when unlicensed', () => {
            expect(licenseHasAddOn(undefined, 'crossguard')).toBe(false);
            expect(licenseHasAddOn({IsLicensed: 'false', AddOns: 'crossguard'}, 'crossguard')).toBe(false);
        });

        test('should return false when the license grants no add-ons', () => {
            expect(licenseHasAddOn(licensed(), 'crossguard')).toBe(false);
            expect(licenseHasAddOn(licensed(''), 'crossguard')).toBe(false);
        });

        test('should return true when the add-on is granted', () => {
            expect(licenseHasAddOn(licensed('crossguard'), 'crossguard')).toBe(true);
            expect(licenseHasAddOn(licensed('other,crossguard'), 'crossguard')).toBe(true);
        });

        test('should not match on a substring', () => {
            expect(licenseHasAddOn(licensed('crossguard-premium'), 'crossguard')).toBe(false);
            expect(licenseHasAddOn(licensed('cross'), 'crossguard')).toBe(false);
        });

        test('should match case-insensitively, as License.HasAddOn does on the server', () => {
            expect(licenseHasAddOn(licensed('CrossGuard'), 'crossguard')).toBe(true);
            expect(licenseHasAddOn(licensed('CROSSGUARD'), 'crossguard')).toBe(true);
            expect(licenseHasAddOn(licensed('other,CrossGuard'), 'crossguard')).toBe(true);
            expect(licenseHasAddOn(licensed('crossguard'), 'CrossGuard')).toBe(true);
        });
    });

    describe('isUnlicensedAddOn', () => {
        test('should return false for plugins that are not add-ons, regardless of license', () => {
            expect(isUnlicensedAddOn('playbooks', undefined)).toBe(false);
            expect(isUnlicensedAddOn('playbooks', licensed('crossguard'))).toBe(false);
        });

        test('should not crash or misreport on Object.prototype-colliding ids', () => {
            expect(isUnlicensedAddOn('constructor', undefined)).toBe(false);
            expect(isUnlicensedAddOn('toString', licensed('crossguard'))).toBe(false);
        });

        test('should treat a mixed-case add-on id as an add-on', () => {
            expect(isUnlicensedAddOn('CrossGuard', licensed())).toBe(true);
            expect(isUnlicensedAddOn('CrossGuard', licensed('crossguard'))).toBe(false);
        });

        test('should return true for an add-on the license does not grant', () => {
            expect(isUnlicensedAddOn('crossguard', licensed())).toBe(true);
            expect(isUnlicensedAddOn('crossguard', licensed('other'))).toBe(true);
        });

        test('should return false for an add-on the license grants', () => {
            expect(isUnlicensedAddOn('crossguard', licensed('crossguard'))).toBe(false);
            expect(isUnlicensedAddOn('crossguard', licensed('CrossGuard'))).toBe(false);
        });

        test('should return false while the license is still loading', () => {
            // Reporting "unlicensed" while loading would flash the banner.
            expect(isUnlicensedAddOn('crossguard', {})).toBe(false);
            expect(isUnlicensedAddOn('crossguard', undefined)).toBe(false);
        });

        test('should report unlicensed once the license has loaded without the add-on', () => {
            expect(isUnlicensedAddOn('crossguard', {IsLicensed: 'false'})).toBe(true);
            expect(isUnlicensedAddOn('crossguard', {IsLicensed: 'true'})).toBe(true);
        });
    });

    describe('pluginAddOnRequirements', () => {
        test('every entry should have a non-empty add-on name', () => {
            // Mirrors pluginAddOnRequirements on the server; the two must agree.
            Object.entries(pluginAddOnRequirements).forEach(([pluginId, addOn]) => {
                expect(pluginId).not.toEqual('');
                expect(addOn).not.toEqual('');
            });
        });
    });
});
