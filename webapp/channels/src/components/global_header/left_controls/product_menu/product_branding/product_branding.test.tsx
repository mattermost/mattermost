// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TopLevelProducts} from 'utils/constants';
import * as productUtils from 'utils/products';
import {TestHelper} from 'utils/test_helper';

import type {ProductComponent} from 'types/store/plugins';

import ProductBranding from './product_branding';

jest.mock('@mattermost/compass-icons/components', () => {
    const actual = jest.requireActual('@mattermost/compass-icons/components');
    return {
        ...actual,
        ProductChannelsIcon: (props: any) => (
            <svg
                data-testid='ProductChannelsIcon'
                {...props}
            />
        ),
    };
});

describe('components/ProductBranding', () => {
    test('should show correct icon glyph when we are on Channels', () => {
        const currentProductSpy = jest.spyOn(productUtils, 'useCurrentProduct');
        currentProductSpy.mockReturnValue(null);

        const {container} = renderWithContext(
            <ProductBranding/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should show correct icon glyph when we are on Playbooks', () => {
        const currentProductSpy = jest.spyOn(productUtils, 'useCurrentProduct');
        currentProductSpy.mockReturnValue(TestHelper.makeProduct(TopLevelProducts.PLAYBOOKS));
        const {container} = renderWithContext(
            <ProductBranding/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should show correct icon glyph when we are on Boards', () => {
        const currentProductSpy = jest.spyOn(productUtils, 'useCurrentProduct');
        currentProductSpy.mockReturnValue(TestHelper.makeProduct(TopLevelProducts.BOARDS));

        const {container} = renderWithContext(
            <ProductBranding/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should render a React element icon when switcherIcon is a React node', () => {
        const currentProductSpy = jest.spyOn(productUtils, 'useCurrentProduct');
        const CustomIcon = (
            <svg data-testid='custom-icon'>
                <circle
                    cx='12'
                    cy='12'
                    r='10'
                />
            </svg>
        );
        const productWithReactIcon: ProductComponent = {
            ...TestHelper.makeProduct('CustomProduct'),
            switcherIcon: CustomIcon,
        };
        currentProductSpy.mockReturnValue(productWithReactIcon);

        const {container} = renderWithContext(
            <ProductBranding/>,
        );

        expect(container).toMatchSnapshot();
        expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    test('should fallback to ProductChannelsIcon when string icon name is not found in glyphMap', () => {
        const currentProductSpy = jest.spyOn(productUtils, 'useCurrentProduct');
        const productWithInvalidIcon: ProductComponent = {
            ...TestHelper.makeProduct('InvalidProduct'),
            switcherIcon: 'non-existent-icon-name' as ProductComponent['switcherIcon'],
        };
        currentProductSpy.mockReturnValue(productWithInvalidIcon);

        const {container} = renderWithContext(
            <ProductBranding/>,
        );

        expect(container).toMatchSnapshot();
        expect(screen.getByTestId('ProductChannelsIcon')).toBeInTheDocument();
    });
});
