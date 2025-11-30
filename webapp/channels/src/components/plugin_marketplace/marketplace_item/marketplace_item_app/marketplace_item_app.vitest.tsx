// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';

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
                installApp: vi.fn(async () => Promise.resolve(true)),
                closeMarketplaceModal: vi.fn(() => {}),
            },
        };

        test('should render', () => {
            const {container} = renderWithContext(
                <MarketplaceItemApp {...baseProps}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with no plugin description', () => {
            const props = {...baseProps};
            delete (props as any).description;

            const {container} = renderWithContext(
                <MarketplaceItemApp {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with no homepage url', () => {
            const props = {...baseProps};
            delete (props as any).homepageUrl;

            const {container} = renderWithContext(
                <MarketplaceItemApp {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with server error', () => {
            const props = {
                ...baseProps,
                error: 'An error occurred.',
            };

            const {container} = renderWithContext(
                <MarketplaceItemApp {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        it('when installing', () => {
            const props = {
                ...baseProps,
                isInstalling: true,
            };
            const {container} = renderWithContext(
                <MarketplaceItemApp {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render installed app', () => {
            const props = {
                ...baseProps,
                installed: true,
            };

            const {container} = renderWithContext(
                <MarketplaceItemApp {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with icon', () => {
            const props: MarketplaceItemAppProps = {
                ...baseProps,
                iconURL: 'http://localhost:8065/plugins/com.mattermost.apps/apps/com.mattermost.servicenow/static/now-mobile-icon.png',
            };

            const {container} = renderWithContext(
                <MarketplaceItemApp {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with empty list of labels', () => {
            const props = {
                ...baseProps,
                labels: [],
            };

            const {container} = renderWithContext(
                <MarketplaceItemApp {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with one labels', () => {
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

            const {container} = renderWithContext(
                <MarketplaceItemApp {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('should render with two labels', () => {
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

            const {container} = renderWithContext(
                <MarketplaceItemApp {...props}/>,
            );

            expect(container).toMatchSnapshot();
        });

        test('install should trigger app installation', () => {
            const props = {
                ...baseProps,
                isDefaultMarketplace: true,
            };

            renderWithContext(
                <MarketplaceItemApp {...props}/>,
            );

            // Find and click the Install button
            const installButton = screen.getByRole('button', {name: /install/i});
            fireEvent.click(installButton);

            expect(props.actions.installApp).toHaveBeenCalledWith('id');
        });
    });
});
