// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {LicenseSkus} from 'utils/constants';

export const getSkuDisplayName = (skuShortName: string, isGovSku: boolean): string => {
    let skuName = '';
    switch (skuShortName) {
    case LicenseSkus.E20:
        skuName = 'Enterprise E20';
        break;
    case LicenseSkus.E10:
        skuName = 'Enterprise E10';
        break;
    case LicenseSkus.Professional:
        skuName = 'Professional';
        break;
    case LicenseSkus.Starter:
        skuName = 'Starter';
        break;
    default:
        skuName = 'Enterprise';
        break;
    }

    skuName += isGovSku ? ' Gov' : '';

    return skuName;
};
