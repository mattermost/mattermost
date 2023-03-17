// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import MarketplaceItemApp, {MarketplaceItemAppProps} from './marketplace_item_app';

describe('components/MarketplaceItemApp', () => {
    describe('MarketplaceItem', () => {
        const baseProps: MarketplaceItemAppProps = {
            id: 'id',
            name: 'name',
            description: 'test plugin',
            homepageUrl: 'http://example.com',
            installed: false,
            installing: false,
            trackEvent: jest.fn(() => {}),
            actions: {
                installApp: jest.fn(async () => Promise.resolve(true)),
                closeMarketplaceModal: jest.fn(() => {}),
            },
        };

        test('should render', () => {
            const wrapper = shallow<MarketplaceItemApp>(
                <MarketplaceItemApp {...baseProps}/>,
            );

            expect(wrapper).toMatchSnapshot();
        });

        test('should render with no plugin description', () => {
            const props = {...baseProps};
            delete props.description;

            const wrapper = shallow(
                <MarketplaceItemApp {...props}/>,
            );

            expect(wrapper).toMatchSnapshot();
        });

        test('should render with no homepage url', () => {
            const props = {...baseProps};
            delete props.homepageUrl;

            const wrapper = shallow<MarketplaceItemApp>(
                <MarketplaceItemApp {...props}/>,
            );

            expect(wrapper).toMatchSnapshot();
        });

        test('should render with server error', () => {
            const props = {
                ...baseProps,
                error: 'An error occurred.',
            };

            const wrapper = shallow<MarketplaceItemApp>(
                <MarketplaceItemApp {...props}/>,
            );

            expect(wrapper).toMatchSnapshot();
        });

        it('when installing', () => {
            const props = {
                ...baseProps,
                isInstalling: true,
            };
            const wrapper = shallow<MarketplaceItemApp>(
                <MarketplaceItemApp {...props}/>,
            );

            expect(wrapper).toMatchSnapshot();
        });

        test('should render installed app', () => {
            const props = {
                ...baseProps,
                installed: true,
            };

            const wrapper = shallow<MarketplaceItemApp>(
                <MarketplaceItemApp {...props}/>,
            );

            expect(wrapper).toMatchSnapshot();
        });

        test('should render with icon', () => {
            const props: MarketplaceItemAppProps = {
                ...baseProps,
                iconURL: 'http://localhost:8065/plugins/com.mattermost.apps/apps/com.mattermost.servicenow/static/now-mobile-icon.png',
            };

            const wrapper = shallow<MarketplaceItemApp>(
                <MarketplaceItemApp {...props}/>,
            );

            expect(wrapper).toMatchSnapshot();
        });

        test('should render with empty list of labels', () => {
            const props = {
                ...baseProps,
                labels: [],
            };

            const wrapper = shallow<MarketplaceItemApp>(
                <MarketplaceItemApp {...props}/>,
            );

            expect(wrapper).toMatchSnapshot();
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

            const wrapper = shallow<MarketplaceItemApp>(
                <MarketplaceItemApp {...props}/>,
            );

            expect(wrapper).toMatchSnapshot();
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

            const wrapper = shallow<MarketplaceItemApp>(
                <MarketplaceItemApp {...props}/>,
            );

            expect(wrapper).toMatchSnapshot();
        });

        describe('install should trigger track event and close modal', () => {
            const props = {
                ...baseProps,
                isDefaultMarketplace: true,
            };

            const wrapper = shallow<MarketplaceItemApp>(
                <MarketplaceItemApp {...props}/>,
            );

            wrapper.instance().onInstall();
            expect(props.trackEvent).toBeCalledWith('plugins', 'ui_marketplace_install_app', {
                app_id: 'id',
            });
            expect(props.actions.installApp).toHaveBeenCalledWith('id');
        });
    });
});
