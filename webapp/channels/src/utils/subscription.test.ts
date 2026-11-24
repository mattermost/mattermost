// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {LicenseSkus} from 'utils/constants';

import {getSkuDisplayName} from './subscription';

describe('getSkuDisplayName', () => {
    test.each([
        [LicenseSkus.E10, 'Enterprise E10'],
        [LicenseSkus.E20, 'Enterprise E20'],
        [LicenseSkus.Professional, 'Professional'],
        [LicenseSkus.Starter, 'Starter'],
        [LicenseSkus.Enterprise, 'Enterprise'],
        [LicenseSkus.Entry, 'Entry'],
        [LicenseSkus.EnterpriseAdvanced, 'Enterprise Advanced'],
        ['future-sku', 'future-sku'],
    ])('%s is shown as %s', (sku, name) => {
        expect(getSkuDisplayName(sku, false)).toBe(name);
    });

    test('appends Gov for a government SKU', () => {
        expect(getSkuDisplayName(LicenseSkus.Enterprise, true)).toBe('Enterprise Gov');
    });
});
