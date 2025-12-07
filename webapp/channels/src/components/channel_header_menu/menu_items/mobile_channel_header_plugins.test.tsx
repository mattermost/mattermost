// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import cloneDeep from 'lodash/cloneDeep';
import React from 'react';

import {AppBindingLocations, AppCallResponseTypes} from 'mattermost-redux/constants/apps';

import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen, fireEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import MobileChannelHeaderPlugins from './mobile_channel_header_plugins';

const mockOpenModal = jest.fn();
const mockLeaveChannel = jest.fn();
const mockHandleBindingClick = jest.fn();
const mockOpenAppsModal = jest.fn();
const mockPostEphemeralCallResponseForChannel = jest.fn();
const mockDispatch = jest.fn().mockImplementation((action) => {
    if (typeof action === 'function') {
        return action(mockDispatch);
    }
    return action;
});

jest.mock('actions/views/modals', () => ({
    openModal: (...args: unknown[]) => {
        mockOpenModal(...args);
        return {type: 'MOCK_OPEN_MODAL'};
    },
}));

jest.mock('actions/views/channel', () => ({
    leaveChannel: (...args: unknown[]) => {
        mockLeaveChannel(...args);
        return {type: 'MOCK_LEAVE_CHANNEL'};
    },
}));

jest.mock('actions/apps', () => ({
    handleBindingClick: (...args: unknown[]) => {
        mockHandleBindingClick(...args);

        // Return a thunk that resolves to the mock return value or a default
        return () => Promise.resolve(mockHandleBindingClick.mock.results[mockHandleBindingClick.mock.calls.length - 1]?.value?.() || {data: {type: 'ok'}});
    },
    openAppsModal: (...args: unknown[]) => {
        mockOpenAppsModal(...args);
        return {type: 'MOCK_OPEN_APPS_MODAL'};
    },
    postEphemeralCallResponseForChannel: (...args: unknown[]) => {
        mockPostEphemeralCallResponseForChannel(...args);
        return {type: 'MOCK_POST_EPHEMERAL_CALL_RESPONSE'};
    },
}));

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useDispatch: () => mockDispatch,
}));

describe('components/ChannelHeaderMenu/MenuItems/MobileChannelHeaderPlugins, with no extended components', () => {
    beforeEach(() => {
        mockOpenModal.mockClear();
        mockLeaveChannel.mockClear();
        mockHandleBindingClick.mockClear();
        mockOpenAppsModal.mockClear();
        mockPostEphemeralCallResponseForChannel.mockClear();
        mockDispatch.mockClear();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

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

    const bindingState = {
        entities: {
            apps: {
                main: {
                    bindings: [
                        {
                            app_id: 'appid',
                            location: AppBindingLocations.CHANNEL_HEADER_ICON,
                            icon: 'http://test.com/icon.png',
                            label: 'Label',
                            hint: 'Hint',
                            bindings: [
                                {
                                    app_id: 'app1',
                                    location: 'channel-header-1',
                                    label: 'App 1 Channel Header',
                                    form: {
                                        submit: {
                                            path: '/call/path',
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                },
            },
            general: {
                config: {
                    FeatureFlagAppsEnabled: 'true',
                },
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

    test('renders the component correctly, with one extended component, and handle click event', () => {
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
        fireEvent.click(menuItem);
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

    test('renders the component correctly, with two extended bindings', () => {
        const testState = cloneDeep(bindingState);
        testState.entities.apps.main.bindings[0].bindings.push({
            app_id: 'app2',
            location: 'channel-header-2',
            label: 'App 2 Channel Header',
            form: {
                submit: {
                    path: '/call/path',
                },
            },
        });

        renderWithContext(
            <WithTestMenuContext>
                <MobileChannelHeaderPlugins
                    channel={channel}
                    isDropdown={true}
                />
            </WithTestMenuContext>, testState,
        );

        const menuItem = screen.getByText('App 1 Channel Header');
        expect(menuItem).toBeInTheDocument();

        const menuItem2 = screen.getByText('App 2 Channel Header');
        expect(menuItem2).toBeInTheDocument();
    });

    test('Processes handleBinding, returns AppCallResponseTypes.OK', async () => {
        mockHandleBindingClick.mockReturnValueOnce(() => Promise.resolve({
            data: {
                type: AppCallResponseTypes.OK,
                text: 'hello',
            },
        }));

        renderWithContext(
            <WithTestMenuContext>
                <MobileChannelHeaderPlugins
                    channel={channel}
                    isDropdown={true}
                />
            </WithTestMenuContext>, bindingState,
        );

        const menuItem = screen.getByText('App 1 Channel Header');
        expect(menuItem).toBeInTheDocument();

        fireEvent.click(menuItem);
        await waitFor(() => {
            expect(mockHandleBindingClick).toHaveBeenCalledTimes(1);
            expect(mockPostEphemeralCallResponseForChannel).toHaveBeenCalledTimes(1);
        });
    });

    test('Processes handleBinding, returns AppCallResponseTypes.Form', async () => {
        mockHandleBindingClick.mockReturnValueOnce(() => Promise.resolve({
            data: {
                type: AppCallResponseTypes.FORM,
                form: {
                    submit: {
                        path: '/call/path',
                    },
                },
            },
        }));

        renderWithContext(
            <WithTestMenuContext>
                <MobileChannelHeaderPlugins
                    channel={channel}
                    isDropdown={true}
                />
            </WithTestMenuContext>, bindingState,
        );

        const menuItem = screen.getByText('App 1 Channel Header');
        expect(menuItem).toBeInTheDocument();

        fireEvent.click(menuItem);
        await waitFor(() => {
            expect(mockHandleBindingClick).toHaveBeenCalledTimes(1);
            expect(mockOpenAppsModal).toHaveBeenCalledTimes(1);
        });
    });

    test('Processes handleBinding, returns Error', async () => {
        mockHandleBindingClick.mockReturnValueOnce(() => Promise.resolve({
            error: {
                type: AppCallResponseTypes.ERROR,
                text: 'Error returned from method',
            },
        }));

        renderWithContext(
            <WithTestMenuContext>
                <MobileChannelHeaderPlugins
                    channel={channel}
                    isDropdown={true}
                />
            </WithTestMenuContext>, bindingState,
        );

        const menuItem = screen.getByText('App 1 Channel Header');
        expect(menuItem).toBeInTheDocument();

        fireEvent.click(menuItem);
        await waitFor(() => {
            expect(mockHandleBindingClick).toHaveBeenCalledTimes(1);
            expect(mockPostEphemeralCallResponseForChannel).toHaveBeenCalledTimes(1);
        });
    });

    test('renders the component correctly, with one extended component, isDropDown false', () => {
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
        fireEvent.click(button);
        expect(action).toHaveBeenCalledTimes(1);
    });

    test('renders the component correctly, with one extended appbinding, isDropDown false', async () => {
        mockHandleBindingClick.mockReturnValueOnce(() => Promise.resolve({
            data: {
                type: AppCallResponseTypes.OK,
            },
        }));

        renderWithContext(
            <WithTestMenuContext>
                <MobileChannelHeaderPlugins
                    channel={channel}
                    isDropdown={false}
                />
            </WithTestMenuContext>, bindingState,
        );
        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
        fireEvent.click(button);
        await waitFor(() => {
            expect(mockHandleBindingClick).toHaveBeenCalledTimes(1);
        });
    });

    test('renders noting if multiple appbindings or components isDropDown false', () => {
        const pluginState = {
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
                    ],
                },
            },
        };
        const bothState = {
            ...bindingState,
            ...pluginState,
        };

        renderWithContext(
            <WithTestMenuContext>
                <MobileChannelHeaderPlugins
                    channel={channel}
                    isDropdown={false}
                />
            </WithTestMenuContext>, bothState,
        );
        const button = screen.queryByRole('button');
        expect(button).toBeNull();
    });
});
