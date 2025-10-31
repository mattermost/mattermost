// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {LicenseSkus} from 'utils/constants';

import './license_sku_badge.scss';

type Props = {
    sku: string;
};

const getSkuLabel = (sku: string): string => {
    switch (sku) {
    case LicenseSkus.EnterpriseAdvanced:
        return 'Enterprise Advanced';
    case LicenseSkus.Enterprise:
        return 'Enterprise';
    case LicenseSkus.Professional:
        return 'Professional';
    case LicenseSkus.Starter:
        return 'Starter';
    default:
        return sku;
    }
};

const LicenseSkuBadge: React.FC<Props> = ({sku}) => {
    return (
        <span
            className='LicenseSkuBadge'
            aria-label={`Requires ${getSkuLabel(sku)} license`}
        >
            <i className='icon icon-key-variant'/>
            {getSkuLabel(sku)}
        </span>
    );
};

export default LicenseSkuBadge;

