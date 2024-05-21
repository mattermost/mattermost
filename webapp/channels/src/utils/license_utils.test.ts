// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {LicenseSkus} from 'utils/constants';
import {isLicenseExpired, isLicenseExpiring, isLicensePastGracePeriod, isEnterpriseOrE20License} from 'utils/license_utils';

describe('license_utils', () => {
    const millisPerDay = 24 * 60 * 60 * 1000;
    describe('isLicenseExpiring', () => {
        it('should return false if cloud expiring in 5 days', () => {
            const license = {Id: '1234', IsLicensed: 'true', Cloud: 'true', ExpiresAt: `${Date.now() + (5 * millisPerDay)}`};

            expect(isLicenseExpiring(license)).toBeFalsy();
        });

        it('should return True if expiring in 5 days - non Cloud', () => {
            const license = {Id: '1234', IsLicensed: 'true', Cloud: 'false', ExpiresAt: `${Date.now() + (5 * millisPerDay)}`};

            expect(isLicenseExpiring(license)).toBeTruthy();
        });
    });
    describe('isLicenseExpired', () => {
        it('should return false if cloud expired 1 day ago', () => {
            const license = {Id: '1234', IsLicensed: 'true', Cloud: 'true', ExpiresAt: `${Date.now() - (Number(millisPerDay))}`};

            expect(isLicenseExpired(license)).toBeFalsy();
        });

        it('should return True if expired 1 day ago - non Cloud', () => {
            const license = {Id: '1234', IsLicensed: 'true', Cloud: 'false', ExpiresAt: `${Date.now() - (Number(millisPerDay))}`};

            expect(isLicenseExpired(license)).toBeTruthy();
        });
    });

    describe('isLicensePastGracePeriod', () => {
        it('should return False if cloud expired 11 days ago', () => {
            const license = {Id: '1234', IsLicensed: 'true', Cloud: 'true', ExpiresAt: `${Date.now() - (11 * millisPerDay)}`};

            expect(isLicensePastGracePeriod(license)).toBeFalsy();
        });

        it('should return True if expired 1 day ago - non Cloud', () => {
            const license = {Id: '1234', IsLicensed: 'true', Cloud: 'false', ExpiresAt: `${Date.now() - (11 * millisPerDay)}`};

            expect(isLicensePastGracePeriod(license)).toBeTruthy();
        });
    });

    describe('isEnterpriseOrE20License', () => {
        it('should return False if not Enterprise or E20', () => {
            const license = {Id: '1234', IsLicensed: 'true', Cloud: 'false', SkuShortName: LicenseSkus.Starter};

            expect(isEnterpriseOrE20License(license)).toBeFalsy();
        });

        it('should return True if Enterprise', () => {
            const license = {Id: '1234', IsLicensed: 'true', Cloud: 'false', SkuShortName: LicenseSkus.Enterprise};

            expect(isEnterpriseOrE20License(license)).toBeTruthy();
        });

        it('should return True if E20', () => {
            const license = {Id: '1234', IsLicensed: 'true', Cloud: 'false', SkuShortName: LicenseSkus.E20};

            expect(isEnterpriseOrE20License(license)).toBeTruthy();
        });
    });
});
