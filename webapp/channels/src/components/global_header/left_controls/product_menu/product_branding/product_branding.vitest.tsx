// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TopLevelProducts} from 'utils/constants';
import * as productUtils from 'utils/products';
import {TestHelper} from 'utils/test_helper';

import ProductBranding from './product_branding';

describe('components/ProductBranding', () => {
    test('should show correct icon glyph when we are on Channels', () => {
        const currentProductSpy = vi.spyOn(productUtils, 'useCurrentProduct');
        currentProductSpy.mockReturnValue(null);

        const {container} = renderWithContext(
            <ProductBranding/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should show correct icon glyph when we are on Playbooks', () => {
        const currentProductSpy = vi.spyOn(productUtils, 'useCurrentProduct');
        currentProductSpy.mockReturnValue(TestHelper.makeProduct(TopLevelProducts.PLAYBOOKS));

        const {container} = renderWithContext(
            <ProductBranding/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should show correct icon glyph when we are on Boards', () => {
        const currentProductSpy = vi.spyOn(productUtils, 'useCurrentProduct');
        currentProductSpy.mockReturnValue(TestHelper.makeProduct(TopLevelProducts.BOARDS));

        const {container} = renderWithContext(
            <ProductBranding/>,
        );

        expect(container).toMatchSnapshot();
    });
});
