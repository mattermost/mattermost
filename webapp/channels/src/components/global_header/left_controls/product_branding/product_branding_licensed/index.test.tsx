// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TopLevelProducts} from 'utils/constants';
import * as productUtils from 'utils/products';
import {TestHelper} from 'utils/test_helper';

import ProductBranding from '.';

describe('components/ProductBranding', () => {
    test('should show Channels branding when no product is selected', () => {
        const currentProductSpy = jest.spyOn(productUtils, 'useCurrentProduct');
        currentProductSpy.mockReturnValue(null);

        renderWithContext(<ProductBranding/>);

        expect(screen.queryByText('Channels')).toBeInTheDocument();
    });

    test('should show Playbooks branding when Playbooks is selected', () => {
        const currentProductSpy = jest.spyOn(productUtils, 'useCurrentProduct');
        currentProductSpy.mockReturnValue(TestHelper.makeProduct(TopLevelProducts.PLAYBOOKS));

        renderWithContext(<ProductBranding/>);

        expect(screen.queryByText('Playbooks')).toBeInTheDocument();
    });

    test('should show Boards branding when Boards is selected', () => {
        const currentProductSpy = jest.spyOn(productUtils, 'useCurrentProduct');
        currentProductSpy.mockReturnValue(TestHelper.makeProduct(TopLevelProducts.BOARDS));

        renderWithContext(<ProductBranding/>);

        expect(screen.queryByText('Boards')).toBeInTheDocument();
    });
});
