// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';
import type {ProductSwitcherMenuItemRegistration} from 'types/store/plugins';

import ProductSwitcherPluginMenuItems from './switch_product_plugin_menuitems';

function getItemMock(overrides: Partial<ProductSwitcherMenuItemRegistration> = {}) {
    return {
        id: 'item_id',
        pluginId: 'plugin_id',
        text: 'Plugin Item',
        icon: 'product-channels',
        action: jest.fn(),
        ...overrides,
    } as ProductSwitcherMenuItemRegistration;
}

function getState(items: ProductSwitcherMenuItemRegistration[]): DeepPartial<GlobalState> {
    return {
        plugins: {
            components: {
                ProductSwitcherMenuItem: items,
            },
        },
    };
}

describe('ProductSwitcherPluginMenuItems', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render nothing when no plugin registered an item', () => {
        renderWithContext(<ProductSwitcherPluginMenuItems/>, getState([]));

        expect(screen.queryByText('Plugin Item')).not.toBeInTheDocument();
    });

    test('should render a registered item', () => {
        renderWithContext(<ProductSwitcherPluginMenuItems/>, getState([getItemMock()]));

        expect(screen.getByText('Plugin Item')).toBeInTheDocument();
    });

    test('should render an item that its own predicate leaves visible', () => {
        renderWithContext(<ProductSwitcherPluginMenuItems/>, getState([getItemMock({isHidden: () => false})]));

        expect(screen.getByText('Plugin Item')).toBeInTheDocument();
    });

    test('should not render an item hidden by its own predicate', () => {
        renderWithContext(<ProductSwitcherPluginMenuItems/>, getState([getItemMock({isHidden: () => true})]));

        expect(screen.queryByText('Plugin Item')).not.toBeInTheDocument();
    });

    test('should hide an item whose isHidden predicate throws', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const item = getItemMock({
            isHidden: () => {
                throw new Error('isHidden blew up');
            },
        });

        renderWithContext(<ProductSwitcherPluginMenuItems/>, getState([item]));

        expect(screen.queryByText('Plugin Item')).not.toBeInTheDocument();
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    test('should render an item registered without an icon', () => {
        renderWithContext(<ProductSwitcherPluginMenuItems/>, getState([getItemMock({icon: undefined})]));

        expect(screen.getByText('Plugin Item')).toBeInTheDocument();
    });
});
