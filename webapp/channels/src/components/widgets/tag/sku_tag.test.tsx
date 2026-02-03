// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, screen} from 'tests/react_testing_utils';
import {LicenseSkus} from 'utils/constants';

import SkuTag from './sku_tag';

describe('components/widgets/tag/SkuTag', () => {
    test('should match the ENTRY SKU', () => {
        render(<SkuTag sku={LicenseSkus.Entry}/>);
        expect(screen.getByText('ENTRY')).toBeInTheDocument();
    });

    test('should match the ENTERPRISE ADVANCED SKU', () => {
        render(<SkuTag sku={LicenseSkus.EnterpriseAdvanced}/>);
        expect(screen.getByText('ENTERPRISE ADVANCED')).toBeInTheDocument();
    });
});
