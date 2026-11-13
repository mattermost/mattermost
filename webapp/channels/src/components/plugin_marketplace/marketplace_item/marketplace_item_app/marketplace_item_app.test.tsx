// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import MarketplaceItemApp from './marketplace_item_app';
import type {MarketplaceItemAppProps} from './marketplace_item_app';

describe('components/MarketplaceItemApp', () => {
    describe('MarketplaceItem', () => {
        const baseProps: MarketplaceItemAppProps = {
            id: 'id',
            name: 'name',
            description: 'test plugin',
            homepageUrl: 'http://example.com',
            installed: false,
            installing: false,
            actions: {
                installApp: jest.fn(async () => Promise.resolve(true)),
                closeMarketplaceModal: jest.fn(() => {}),
            },
        };

        test('install should trigger app installation', async () => {
            const props = {
                ...baseProps,
                isDefaultMarketplace: true,
            };

            renderWithContext(
                <MarketplaceItemApp {...props}/>,
            );

            await userEvent.click(screen.getByText('Install'));
            expect(props.actions.installApp).toHaveBeenCalledWith('id');
        });
    });
});
