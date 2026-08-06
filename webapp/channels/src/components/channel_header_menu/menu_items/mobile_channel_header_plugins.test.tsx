// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import MobileChannelHeaderPlugins from './mobile_channel_header_plugins';

describe('components/ChannelHeaderMenu/MenuItems/MobileChannelHeaderPlugins, with no extended components', () => {
    const channel = TestHelper.getChannelMock();
    const action = jest.fn();
    const pluginState = {
        plugins: {
            components: {
                MobileChannelHeaderButton: [
                    {
                        id: 'someid',
                        pluginId: 'pluginid',
                        icon: <i className='fa fa-anchor'/>,
                        action,
                        dropdownText: 'some dropdown text',
                    },
                ],
            },
        },
    };

    test('renders the component correctly', () => {
        const {container} = renderWithContext(
            <WithTestMenuContext>
                <MobileChannelHeaderPlugins
                    channel={channel}
                    isDropdown={true}
                />
            </WithTestMenuContext>, {},
        );
        expect(container.firstChild).toBeNull();
    });

    test('renders the component correctly, with one extended component, and handle click event', async () => {
        renderWithContext(
            <WithTestMenuContext>
                <MobileChannelHeaderPlugins
                    channel={channel}
                    isDropdown={true}
                />
            </WithTestMenuContext>, pluginState,
        );
        const menuItem = screen.getByText('some dropdown text');
        expect(menuItem).toBeInTheDocument();
        await userEvent.click(menuItem);
        expect(action).toHaveBeenCalledTimes(1);
    });

    test('renders the component correctly, with two extended component', () => {
        const testState = {
            ...pluginState,
            plugins: {
                ...pluginState.plugins,
                components: {
                    ...pluginState.plugins.components,
                    MobileChannelHeaderButton: [
                        ...pluginState.plugins.components.MobileChannelHeaderButton,
                        {
                            id: 'someid2',
                            pluginId: 'pluginid2',
                            icon: <i className='fa fa-anchor'/>,
                            action: jest.fn(),
                            dropdownText: 'some other dropdown text',
                        },
                    ],
                },
            },
        };

        renderWithContext(
            <WithTestMenuContext>
                <MobileChannelHeaderPlugins
                    channel={channel}
                    isDropdown={true}
                />
            </WithTestMenuContext>, testState,
        );
        const menuItem = screen.getByText('some dropdown text');
        expect(menuItem).toBeInTheDocument();
        const menuItem2 = screen.getByText('some other dropdown text');
        expect(menuItem2).toBeInTheDocument();
    });

    test('renders the component correctly, with one extended component, isDropDown false', async () => {
        const action = jest.fn();
        const pluginState = {
            plugins: {
                components: {
                    MobileChannelHeaderButton: [
                        {
                            id: 'someid',
                            pluginId: 'pluginid',
                            icon: <i className='fa fa-anchor'/>,
                            action,
                            dropdownText: 'some dropdown text',
                        },
                    ],
                },
            },
        };

        renderWithContext(
            <WithTestMenuContext>
                <MobileChannelHeaderPlugins
                    channel={channel}
                    isDropdown={false}
                />
            </WithTestMenuContext>, pluginState,
        );
        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
        await userEvent.click(button);
        expect(action).toHaveBeenCalledTimes(1);
    });

    test('renders nothing if multiple components isDropDown false', () => {
        const testState = {
            plugins: {
                components: {
                    MobileChannelHeaderButton: [
                        {
                            id: 'someid',
                            pluginId: 'pluginid',
                            icon: <i className='fa fa-anchor'/>,
                            action: jest.fn(),
                            dropdownText: 'some dropdown text',
                        },
                        {
                            id: 'someid2',
                            pluginId: 'pluginid2',
                            icon: <i className='fa fa-anchor'/>,
                            action: jest.fn(),
                            dropdownText: 'some other dropdown text',
                        },
                    ],
                },
            },
        };

        renderWithContext(
            <WithTestMenuContext>
                <MobileChannelHeaderPlugins
                    channel={channel}
                    isDropdown={false}
                />
            </WithTestMenuContext>, testState,
        );
        const button = screen.queryByRole('button');
        expect(button).toBeNull();
    });
});
