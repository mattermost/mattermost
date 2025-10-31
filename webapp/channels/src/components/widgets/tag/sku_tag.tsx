// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useMemo} from 'react';

import {LicenseSkus} from 'utils/constants';

import Tag from './tag';
import type {TagSize} from './tag';

type Props = {
    className?: string;
    size?: TagSize;
    sku: LicenseSkus;
};

const SkuTag = ({className = '', size = 'xs', sku}: Props) => {
    const namedSku = useMemo(() => {
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
    }, [sku]);

    return (
        <Tag
            className={classNames('SkuTag', className)}
            icon='mattermost'
            size={size}
            text={namedSku}
        />
    );
};

export default SkuTag;
