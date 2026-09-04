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
    });

    describe('isUnlicensedAddOn', () => {
        test('should return false for plugins that are not add-ons, regardless of license', () => {
            expect(isUnlicensedAddOn('playbooks', undefined)).toBe(false);
            expect(isUnlicensedAddOn('playbooks', licensed('crossguard'))).toBe(false);
        });

        test('should return true for an add-on the license does not grant', () => {
            expect(isUnlicensedAddOn('crossguard', undefined)).toBe(true);
            expect(isUnlicensedAddOn('crossguard', licensed())).toBe(true);
            expect(isUnlicensedAddOn('crossguard', licensed('other'))).toBe(true);
        });

        test('should return false for an add-on the license grants', () => {
            expect(isUnlicensedAddOn('crossguard', licensed('crossguard'))).toBe(false);
        });
    });

    describe('pluginAddOnRequirements', () => {
        test('every entry should have a non-empty add-on name', () => {
            // Mirrors model.PluginAddOnRequirements on the server; the two must agree.
            Object.entries(pluginAddOnRequirements).forEach(([pluginId, addOn]) => {
                expect(pluginId).not.toEqual('');
                expect(addOn).not.toEqual('');
            });
        });
    });
});
