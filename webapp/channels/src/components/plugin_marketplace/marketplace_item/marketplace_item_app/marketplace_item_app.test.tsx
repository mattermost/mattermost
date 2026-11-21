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

        test('falls back to default PluginIcon when BlockExternalImages is true and iconURL is external', () => {
            const props = {
                ...baseProps,
                iconURL: 'https://external.example.com/app-icon.png',
            };

            const {container} = renderWithContext(
                <MarketplaceItemApp {...props}/>,
                {
                    entities: {
                        general: {
                            config: {
                                BlockExternalImages: 'true',
                                SiteURL: 'https://chat.example.com',
                            },
                        },
                    },
                },
            );

            expect(container.querySelector('img[src="https://external.example.com/app-icon.png"]')).not.toBeInTheDocument();
            expect(screen.getByLabelText('Plugin Icon')).toBeInTheDocument();
        });

        test('renders internal iconURL when BlockExternalImages is true', () => {
            const props = {
                ...baseProps,
                iconURL: 'https://chat.example.com/static/app-icon.png',
            };

            const {container} = renderWithContext(
                <MarketplaceItemApp {...props}/>,
                {
                    entities: {
                        general: {
                            config: {
                                BlockExternalImages: 'true',
                                SiteURL: 'https://chat.example.com',
                            },
                        },
                    },
                },
            );

            expect(container.querySelector('img[src="https://chat.example.com/static/app-icon.png"]')).toBeInTheDocument();
            expect(screen.queryByLabelText('Plugin Icon')).not.toBeInTheDocument();
        });

        test('renders external iconURL when BlockExternalImages is false', () => {
            const props = {
                ...baseProps,
                iconURL: 'https://external.example.com/app-icon.png',
            };

            const {container} = renderWithContext(
                <MarketplaceItemApp {...props}/>,
                {
                    entities: {
                        general: {
                            config: {
                                BlockExternalImages: 'false',
                                SiteURL: 'https://chat.example.com',
                            },
                        },
                    },
                },
            );

            expect(container.querySelector('img[src="https://external.example.com/app-icon.png"]')).toBeInTheDocument();
            expect(screen.queryByLabelText('Plugin Icon')).not.toBeInTheDocument();
        });
    });
});
