// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';

import SkuTag, {LicenseSkus} from './sku_tag';

// Test wrapper with IntlProvider
const renderWithIntl = (ui: React.ReactElement) => {
    return render(
        <IntlProvider locale='en' messages={{}}>
            {ui}
        </IntlProvider>,
    );
};

describe('components/primitives/tag/SkuTag', () => {
    test('should match the ENTRY SKU', () => {
        renderWithIntl(<SkuTag sku={LicenseSkus.Entry}/>);
        expect(screen.getByText('ENTRY')).toBeInTheDocument();
    });

    test('should match the ENTERPRISE ADVANCED SKU', () => {
        renderWithIntl(<SkuTag sku={LicenseSkus.EnterpriseAdvanced}/>);
        expect(screen.getByText('ENTERPRISE ADVANCED')).toBeInTheDocument();
    });
});
