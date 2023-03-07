// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {mount} from 'enzyme';
import {Provider} from 'react-redux';

import AnyTeamPermissionGate from 'components/permissions_gates/any_team_permission_gate';

import mockStore from 'tests/test_store';

describe('components/permissions_gates', () => {
    const state = {
        entities: {
            channels: {
                myMembers: {
                    channel_id: {channel_id: 'channel_id', roles: 'channel_role'},
                },
            },
            teams: {
                teams: {
                    team_id: {id: 'team_id', delete_at: 0},
                    team_id2: {id: 'team_id2', delete_at: 0},
                },
                myMembers: {
                    team_id: {team_id: 'team_id', roles: 'team_role'},
                    team_id2: {team_id: 'team_id2', roles: 'team_role2'},
                },
            },
            users: {
                currentUserId: 'user_id',
                profiles: {
                    user_id: {
                        id: 'user_id',
                        roles: 'system_role',
                    },
                },
            },
            roles: {
                roles: {
                    system_role: {permissions: ['test_system_permission']},
                    team_role: {permissions: ['test_team_permission']},
                    team_role2: {permissions: ['other_permission']},
                    channel_role: {permissions: ['test_channel_permission']},
                },
            },
        },
    };
    const store = mockStore(state);

    describe('TeamPermissionGate', () => {
        test('should match snapshot when user have permission', () => {
            const wrapper = mount(
                <Provider store={store}>
                    <AnyTeamPermissionGate permissions={['test_team_permission']}>
                        <p>{'Valid permission (shown)'}</p>
                    </AnyTeamPermissionGate>
                </Provider>,
            );

            expect(wrapper).toMatchSnapshot();
        });
        test('should match snapshot when user have the permission in other team', () => {
            const wrapper = mount(
                <Provider store={store}>
                    <AnyTeamPermissionGate permissions={['other_permission']}>
                        <p>{'Valid permission (shown)'}</p>
                    </AnyTeamPermissionGate>
                </Provider>,
            );

            expect(wrapper).toMatchSnapshot();
        });
        test('should match snapshot when user have at least one of the permissions', () => {
            const wrapper = mount(
                <Provider store={store}>
                    <AnyTeamPermissionGate permissions={['test_team_permission', 'not_existing_permission']}>
                        <p>{'Valid permission (shown)'}</p>
                    </AnyTeamPermissionGate>
                </Provider>,
            );

            expect(wrapper).toMatchSnapshot();
        });
        test('should match snapshot when user have permission and use invert', () => {
            const wrapper = mount(
                <Provider store={store}>
                    <AnyTeamPermissionGate
                        permissions={['test_team_permission']}
                        invert={true}
                    >
                        <p>{'Valid permission but inverted (not shown)'}</p>
                    </AnyTeamPermissionGate>
                </Provider>,
            );

            expect(wrapper).toMatchSnapshot();
        });
        test('should match snapshot when user not have permission and use invert', () => {
            const wrapper = mount(
                <Provider store={store}>
                    <AnyTeamPermissionGate
                        permissions={['invalid_permission']}
                        invert={true}
                    >
                        <p>{'Invalid permission but inverted (shown)'}</p>
                    </AnyTeamPermissionGate>
                </Provider>,
            );

            expect(wrapper).toMatchSnapshot();
        });
        test('should match snapshot when user have the permission in other team and use invert', () => {
            const wrapper = mount(
                <Provider store={store}>
                    <AnyTeamPermissionGate
                        permissions={['other_permission']}
                        invert={true}
                    >
                        <p>{'Valid permission but inverted (not shown)'}</p>
                    </AnyTeamPermissionGate>
                </Provider>,
            );

            expect(wrapper).toMatchSnapshot();
        });
        test('should match snapshot when user doesn\'t have permission', () => {
            const wrapper = mount(
                <Provider store={store}>
                    <AnyTeamPermissionGate
                        permissions={['invalid_permission']}
                    >
                        <p>{'Invalid permission (not shown)'}</p>
                    </AnyTeamPermissionGate>
                </Provider>,
            );

            expect(wrapper).toMatchSnapshot();
        });
        test('should match snapshot when user have permission system wide', () => {
            const wrapper = mount(
                <Provider store={store}>
                    <AnyTeamPermissionGate
                        permissions={['test_system_permission']}
                    >
                        <p>{'Valid permission (shown)'}</p>
                    </AnyTeamPermissionGate>
                </Provider>,
            );

            expect(wrapper).toMatchSnapshot();
        });
    });
});
