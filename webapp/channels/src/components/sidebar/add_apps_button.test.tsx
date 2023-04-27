// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';
import {AnyAction, Store} from 'redux';

import {GeneralState} from '@mattermost/types/general';
import {UsersState} from '@mattermost/types/users';

import Permissions from 'mattermost-redux/constants/permissions';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';
import {GlobalState} from 'types/store';
import {Preferences, Touched} from 'utils/constants';

import AddAppsButton from './add_apps_button';

jest.mock('actions/telemetry_actions.jsx', () => {
    const original = jest.requireActual('actions/telemetry_actions.jsx');
    return {
        ...original,
        trackEvent: jest.fn(),
    };
});

const mockDispatch = jest.fn();
let mockState: GlobalState;
let store: Store<any, AnyAction>;

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
    useDispatch: () => mockDispatch,
}));

jest.mock('mattermost-redux/actions/preferences', () => ({
    savePreferences: (...args: any[]) => ({type: 'MOCK_SAVE_PREFERENCES', args}),
}));

describe('components/add_apps_button', () => {
    beforeEach(() => {
        mockState = {
            entities: {
                general: {
                    config: {
                        PluginsEnabled: 'true',
                        EnableMarketplace: 'true',
                    },
                },
                teams: {
                    currentTeamId: 'current_team_id',
                    myMembers: {
                        current_team_id: {
                            roles: 'team_user team_admin',
                        },
                    },
                    teams: {
                        current_team_id: {
                            id: 'current_team_id',
                            description: 'Curent team description',
                            name: 'current-team',
                        },
                    },
                },
                preferences: {
                    myPreferences: {},
                },
                users: {
                    currentUserId: 'current_user_id',
                    profiles: {
                        current_user_id: {roles: 'system_user'},
                    },
                },
                roles: {
                    roles: {
                        system_user: {
                            permissions: [Permissions.SYSCONSOLE_WRITE_PLUGINS],
                        },
                        guest_user: {
                            permissions: [],
                        },
                    },
                },
            },
            views: {
                addChannelCtaDropdown: {
                    isOpen: false,
                },
            },
        } as unknown as GlobalState;

        store = mockStore(mockState);
    });

    test('should find the add apps button when marketplace enabled and user has permission', () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <AddAppsButton/>
            </Provider>,
        );

        expect(wrapper.find('.SidebarChannelNavigator__addAppsCtaLhsButton').exists()).toBeTruthy();
    });

    test('should return null when marketplace not enabled', () => {
        const general = {
            config: {
                PluginsEnabled: 'false',
                EnableMarketplace: 'false',
            },
        } as unknown as GeneralState;

        mockState = {
            ...mockState,
            entities: {...mockState.entities, general},
        };

        store = mockStore(mockState);

        const wrapper = mountWithIntl(
            <Provider store={store}>
                <AddAppsButton/>
            </Provider>,

        );

        expect(wrapper.find('.SidebarChannelNavigator__addAppsCtaLhsButton').exists()).toBeFalsy();
    });

    test('should return null when user does not have permission', () => {
        const users = {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {roles: 'guest_user'},
            },
        } as unknown as UsersState;

        mockState = {
            ...mockState,
            entities: {...mockState.entities, users},
        };

        store = mockStore(mockState);

        const wrapper = mountWithIntl(
            <Provider store={store}>
                <AddAppsButton/>
            </Provider>,

        );

        expect(wrapper.find('.SidebarChannelNavigator__addAppsCtaLhsButton').exists()).toBeFalsy();
    });

    test('should fire dispatch to save preferences when button is clicked', () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <AddAppsButton/>
            </Provider>,
        );

        expect(mockDispatch).not.toHaveBeenCalled();

        const button = wrapper.find('.SidebarChannelNavigator__addAppsCtaLhsButton button');

        button.simulate('click');

        expect(mockDispatch).toHaveBeenCalledWith({
            args: [
                'current_user_id',
                [
                    {
                        category: Preferences.TOUCHED,
                        name: Touched.ADD_APPS,
                        user_id: mockState.entities.users.currentUserId,
                        value: 'true',
                    },
                ],
            ],
            type: 'MOCK_SAVE_PREFERENCES',
        });
    });
});
