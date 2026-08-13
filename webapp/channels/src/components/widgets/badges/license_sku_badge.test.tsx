// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {LicenseSkus} from 'utils/constants';

import LicenseSkuBadge from './license_sku_badge';

describe('components/widgets/badges/LicenseSkuBadge', () => {
    test('renders Enterprise Advanced label', () => {
        renderWithContext(<LicenseSkuBadge sku={LicenseSkus.EnterpriseAdvanced}/>);
        expect(screen.getByText('Enterprise Advanced')).toBeInTheDocument();
    });

    test('renders Enterprise label', () => {
        renderWithContext(<LicenseSkuBadge sku={LicenseSkus.Enterprise}/>);
        expect(screen.getByText('Enterprise')).toBeInTheDocument();
    });

    test('renders Professional label', () => {
        renderWithContext(<LicenseSkuBadge sku={LicenseSkus.Professional}/>);
        expect(screen.getByText('Professional')).toBeInTheDocument();
    });

    test('renders Starter label', () => {
        renderWithContext(<LicenseSkuBadge sku={LicenseSkus.Starter}/>);
        expect(screen.getByText('Starter')).toBeInTheDocument();
    });

    test('has accessible label', () => {
        renderWithContext(<LicenseSkuBadge sku={LicenseSkus.EnterpriseAdvanced}/>);
        const badge = screen.getByLabelText('Requires Enterprise Advanced license');
        expect(badge).toBeInTheDocument();
    });

    test('renders custom SKU as-is', () => {
        renderWithContext(<LicenseSkuBadge sku='CustomSKU'/>);
        expect(screen.getByText('CustomSKU')).toBeInTheDocument();
    });
});

