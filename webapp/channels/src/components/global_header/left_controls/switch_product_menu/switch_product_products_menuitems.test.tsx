// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TopLevelProducts} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';
import type {ProductComponent} from 'types/store/plugins';

import ProductSwitcherProductsMenuItems from './switch_product_products_menuitems';

function getState(products: ProductComponent[], currentTeamName?: string): DeepPartial<GlobalState> {
    const team = currentTeamName ? TestHelper.getTeamMock({id: 'team1', name: currentTeamName}) : undefined;

    return {
        entities: {
            teams: team ? {currentTeamId: team.id, teams: {[team.id]: team}} : {currentTeamId: '', teams: {}},
        },
        plugins: {
            components: {
                Product: products,
            },
        },
    };
}

describe('ProductSwitcherProductsMenuItems', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render nothing when there are no products available', () => {
        renderWithContext(<ProductSwitcherProductsMenuItems currentProductID={null}/>, getState([]));

        expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
    });

    test('should render one item per available product', () => {
        const products = [
            TestHelper.makeProduct(TopLevelProducts.BOARDS),
            TestHelper.makeProduct(TopLevelProducts.PLAYBOOKS),
        ];

        renderWithContext(<ProductSwitcherProductsMenuItems currentProductID={null}/>, getState(products));

        expect(screen.getAllByRole('menuitem')).toHaveLength(2);
        expect(screen.getByText(TopLevelProducts.BOARDS)).toBeInTheDocument();
        expect(screen.getByText(TopLevelProducts.PLAYBOOKS)).toBeInTheDocument();
    });

    test('should render the product label', () => {
        renderWithContext(
            <ProductSwitcherProductsMenuItems currentProductID={null}/>,
            getState([TestHelper.makeProduct('Boards')]),
        );

        expect(screen.getByRole('menuitem')).toBeInTheDocument();
        expect(screen.getByText('Boards')).toBeInTheDocument();
    });

    test('should render a compass glyph when the icon is a string', () => {
        renderWithContext(
            <ProductSwitcherProductsMenuItems currentProductID={null}/>,
            getState([TestHelper.makeProduct('Boards')]),
        );

        expect(screen.getByRole('menuitem').querySelector('svg')).toBeInTheDocument();
    });

    test('should render a React element icon as-is', () => {
        const product = {
            ...TestHelper.makeProduct('Boards'),
            switcherIcon: (
                <svg data-testid='custom-svg-icon'>
                    <rect
                        width='24'
                        height='24'
                    />
                </svg>
            ) as unknown as ProductComponent['switcherIcon'],
        };

        renderWithContext(<ProductSwitcherProductsMenuItems currentProductID={null}/>, getState([product]));

        expect(screen.getByTestId('custom-svg-icon')).toBeInTheDocument();
    });

    test('should show a check icon and no open in new tab button for the active product', () => {
        const product = TestHelper.makeProduct('Boards');

        renderWithContext(<ProductSwitcherProductsMenuItems currentProductID={product.id}/>, getState([product]));

        // The product icon plus the check icon.
        expect(screen.getByRole('menuitem').querySelectorAll('svg')).toHaveLength(2);
        expect(screen.queryByLabelText('Open in new tab')).not.toBeInTheDocument();
    });

    test('should show an open in new tab button for a product that is not active', () => {
        renderWithContext(
            <ProductSwitcherProductsMenuItems currentProductID={null}/>,
            getState([TestHelper.makeProduct('Boards')]),
        );

        expect(screen.getByLabelText('Open in new tab')).toBeInTheDocument();
    });

    test('should open the product in a new tab when the open in new tab button is clicked', async () => {
        const windowOpenSpy = jest.spyOn(window, 'open').mockImplementation();

        const product = {...TestHelper.makeProduct('Boards'), switcherLinkURL: '/boards'};

        renderWithContext(<ProductSwitcherProductsMenuItems currentProductID={null}/>, getState([product]));

        await userEvent.click(screen.getByLabelText('Open in new tab'), {pointerEventsCheck: 0});

        expect(windowOpenSpy).toHaveBeenCalledWith('/boards', '_blank', 'noopener,noreferrer');

        windowOpenSpy.mockRestore();
    });

    test('should give each product an id derived from its plugin or product id', () => {
        renderWithContext(
            <ProductSwitcherProductsMenuItems currentProductID={null}/>,
            getState([TestHelper.makeProduct('Boards')]),
        );

        expect(screen.getByRole('menuitem')).toHaveAttribute('id', 'product-menu-item-Boards');
    });

    test('should hide a team-scoped product when there is no current team', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const globalProduct = TestHelper.makeProduct('Boards');
        const teamScopedProduct = {
            ...TestHelper.makeProduct('Spaces'),
            switcherLinkURL: '/spaces',
            isTeamScoped: true,
        };

        renderWithContext(
            <ProductSwitcherProductsMenuItems currentProductID={null}/>,
            getState([globalProduct, teamScopedProduct]),
        );

        expect(screen.getByText('Boards')).toBeInTheDocument();
        expect(screen.queryByText('Spaces')).not.toBeInTheDocument();
        expect(screen.getAllByRole('menuitem')).toHaveLength(1);

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Spaces'));
        consoleSpy.mockRestore();
    });

    test('should prefix a team-scoped product link with the current team name', async () => {
        const windowOpenSpy = jest.spyOn(window, 'open').mockImplementation();

        const teamScopedProduct = {
            ...TestHelper.makeProduct('Spaces'),
            switcherLinkURL: '/spaces',
            isTeamScoped: true,
        };

        renderWithContext(
            <ProductSwitcherProductsMenuItems currentProductID={null}/>,
            getState([teamScopedProduct], 'myteam'),
        );

        expect(screen.getByText('Spaces')).toBeInTheDocument();

        await userEvent.click(screen.getByLabelText('Open in new tab'), {pointerEventsCheck: 0});

        expect(windowOpenSpy).toHaveBeenCalledWith('/myteam/spaces', '_blank', 'noopener,noreferrer');

        windowOpenSpy.mockRestore();
    });
});
