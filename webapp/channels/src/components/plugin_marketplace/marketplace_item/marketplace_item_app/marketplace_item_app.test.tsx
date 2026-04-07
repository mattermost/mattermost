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

        test('should render', async () => {
            const {container} = await renderWithContext(
                <MarketplaceItemApp {...baseProps}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with no plugin description', async () => {
            const props = {...baseProps};
            delete props.description;

            const {container} = await renderWithContext(
                <MarketplaceItemApp {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with no homepage url', async () => {
            const props = {...baseProps};
            delete props.homepageUrl;

            const {container} = await renderWithContext(
                <MarketplaceItemApp {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with server error', async () => {
            const props = {
                ...baseProps,
                error: 'An error occurred.',
            };

            const {container} = await renderWithContext(
                <MarketplaceItemApp {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        it('when installing', async () => {
            const props = {
                ...baseProps,
                isInstalling: true,
            };
            const {container} = await renderWithContext(
                <MarketplaceItemApp {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render installed app', async () => {
            const props = {
                ...baseProps,
                installed: true,
            };

            const {container} = await renderWithContext(
                <MarketplaceItemApp {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with icon', async () => {
            const props: MarketplaceItemAppProps = {
                ...baseProps,
                iconURL: 'http://localhost:8065/plugins/com.mattermost.apps/apps/com.mattermost.servicenow/static/now-mobile-icon.png',
            };

            const {container} = await renderWithContext(
                <MarketplaceItemApp {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with empty list of labels', async () => {
            const props = {
                ...baseProps,
                labels: [],
            };

            const {container} = await renderWithContext(
                <MarketplaceItemApp {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with one labels', async () => {
            // Suppress known React ref warning from WithTooltip wrapping Tag (function component)
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

            const props = {
                ...baseProps,
                labels: [
                    {
                        name: 'someName',
                        description: 'some description',
                        url: 'http://example.com/info',
                    },
                ],
            };

            const {container} = await renderWithContext(
                <MarketplaceItemApp {...props}/>,
            );

            spy.mockRestore();

            expect(container).toMatchSnapshot();
        });

        test('should render with two labels', async () => {
            const props = {
                ...baseProps,
                labels: [
                    {
                        name: 'someName',
                        description: 'some description',
                        url: 'http://example.com/info',
                    }, {
                        name: 'someName2',
                        description: 'some description2',
                        url: 'http://example.com/info2',
                    },
                ],
            };

            const {container} = await renderWithContext(
                <MarketplaceItemApp {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('install should trigger app installation', async () => {
            const props = {
                ...baseProps,
                isDefaultMarketplace: true,
            };

            await renderWithContext(
                <MarketplaceItemApp {...props}/>,
            );

            await userEvent.click(screen.getByText('Install'));
            expect(props.actions.installApp).toHaveBeenCalledWith('id');
        });
    });
});
