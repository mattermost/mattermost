// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {LicenseSkus} from 'utils/constants';

export function licenseSkuToFeatureDiscoveryLabel(sku: LicenseSkus): string {
    switch (sku) {
    case LicenseSkus.Starter:
        return 'STARTER';
    case LicenseSkus.Professional:
        return 'PROFESSIONAL';
    case LicenseSkus.Enterprise:
        return 'ENTERPRISE';
    case LicenseSkus.E10:
        return 'ENTERPRISE E10';
    case LicenseSkus.E20:
        return 'ENTERPRISE E20';
    case LicenseSkus.EnterpriseAdvanced:
        return 'ENTERPRISE ADVANCED';
    case LicenseSkus.Entry:
        return 'ENTRY';
    default:
        return 'UNKNOWN';
    }
}
