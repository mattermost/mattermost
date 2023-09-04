// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import Menu from 'components/widgets/menu/menu';

import {TestHelper} from 'utils/test_helper';

import SystemUsersDropdown from './system_users_dropdown';
import type {Props} from './system_users_dropdown';

describe('components/admin_console/system_users/system_users_dropdown/system_users_dropdown', () => {
    const user: UserProfile & {mfa_active: boolean} = Object.assign(TestHelper.getUserMock(), {mfa_active: true});

    const otherUser = TestHelper.getUserMock({
        id: 'other_user_id',
        roles: '',
        username: 'other-user',
    });

    const requiredProps: Props = {
        user,
        mfaEnabled: true,
        isLicensed: true,
        enableUserAccessTokens: true,
        experimentalEnableAuthenticationTransfer: true,
        doPasswordReset: jest.fn(),
        doEmailReset: jest.fn(),
        doManageTeams: jest.fn(),
        doManageRoles: jest.fn(),
        doManageTokens: jest.fn(),
        onError: jest.fn(),
        currentUser: otherUser,
        index: 0,
        totalUsers: 10,
        isDisabled: false,
        actions: {
            updateUserActive: jest.fn().mockResolvedValue({data: true}),
            revokeAllSessionsForUser: jest.fn().mockResolvedValue({data: true}),
            promoteGuestToUser: jest.fn().mockResolvedValue({data: true}),
            demoteUserToGuest: jest.fn().mockResolvedValue({data: true}),
            loadBots: jest.fn(() => Promise.resolve([])),
            createGroupTeamsAndChannels: jest.fn().mockResolvedValue({data: true}),
        },
        config: {
            GuestAccountsSettings: {
                Enable: true,
            },
        },
        bots: {},
    };

    test('handleMakeActive() should have called updateUserActive', async () => {
        const wrapper = shallow<SystemUsersDropdown>(<SystemUsersDropdown {...requiredProps}/>);

        const event = {preventDefault: jest.fn()};
        wrapper.instance().handleMakeActive(event);

        expect(requiredProps.actions.updateUserActive).toHaveBeenCalledTimes(1);
        expect(requiredProps.actions.updateUserActive).toHaveBeenCalledWith(requiredProps.user.id, true);
    });

    test('handleMakeActive() should have called onError', async () => {
        const retVal = {error: {server_error_id: 'id', message: 'error'}};
        const updateUserActive = jest.fn().mockResolvedValue(retVal);
        const props = {...requiredProps, actions: {...requiredProps.actions, updateUserActive}};
        const wrapper = shallow<SystemUsersDropdown>(<SystemUsersDropdown {...props}/>);

        const event = {preventDefault: jest.fn()};
        await wrapper.instance().handleMakeActive(event);

        expect(requiredProps.onError).toHaveBeenCalledTimes(1);
        expect(requiredProps.onError).toHaveBeenCalledWith({id: retVal.error.server_error_id, ...retVal.error});
    });

    test('handleDeactivateMember() should have called updateUserActive', async () => {
        const wrapper = shallow<SystemUsersDropdown>(<SystemUsersDropdown {...requiredProps}/>);

        await wrapper.instance().handleDeactivateMember();

        expect(requiredProps.actions.updateUserActive).toHaveBeenCalledTimes(1);
        expect(requiredProps.actions.updateUserActive).toHaveBeenCalledWith(requiredProps.user.id, false);
    });

    test('handleDeactivateMember() should have called onError', async () => {
        const retVal = {error: {server_error_id: 'id', message: 'error'}};
        const updateUserActive = jest.fn().mockResolvedValue(retVal);
        const props = {...requiredProps, actions: {...requiredProps.actions, updateUserActive}};
        const wrapper = shallow<SystemUsersDropdown>(<SystemUsersDropdown {...props}/>);

        await wrapper.instance().handleDeactivateMember();

        expect(requiredProps.onError).toHaveBeenCalledTimes(1);
        expect(requiredProps.onError).toHaveBeenCalledWith({id: retVal.error.server_error_id, ...retVal.error});
    });

    test('handleRevokeSessions() should have called revokeAllSessions', async () => {
        const wrapper = shallow<SystemUsersDropdown>(<SystemUsersDropdown {...requiredProps}/>);

        await wrapper.instance().handleRevokeSessions();

        expect(requiredProps.actions.revokeAllSessionsForUser).toHaveBeenCalled();
        expect(requiredProps.actions.revokeAllSessionsForUser).toHaveBeenCalledWith(requiredProps.user.id);
    });

    test('handleRevokeSessions() should have called onError', async () => {
        const revokeAllSessionsForUser = jest.fn().mockResolvedValue({error: {}});
        const onError = jest.fn();
        const props = {...requiredProps, onError, actions: {...requiredProps.actions, revokeAllSessionsForUser}};
        const wrapper = shallow<SystemUsersDropdown>(<SystemUsersDropdown {...props}/>);

        await wrapper.instance().handleRevokeSessions();

        expect(onError).toHaveBeenCalled();
    });

    test('handleShowDeactivateMemberModal should not call the loadBots if the setting is not true', async () => {
        const wrapper = shallow<SystemUsersDropdown>(<SystemUsersDropdown {...requiredProps}/>);

        const event = {preventDefault: jest.fn()};
        await wrapper.instance().handleShowDeactivateMemberModal(event);

        expect(requiredProps.actions.loadBots).toHaveBeenCalledTimes(0);
    });

    test('handleShowDeactivateMemberModal should call the loadBots only if the setting is true', async () => {
        const overrideConfig = {
            ServiceSettings: {
                DisableBotsWhenOwnerIsDeactivated: true,
            },
        };
        const wrapper = shallow<SystemUsersDropdown>(<SystemUsersDropdown {...{...requiredProps, config: overrideConfig, bots: {}}}/>);

        const event = {preventDefault: jest.fn()};
        await wrapper.instance().handleShowDeactivateMemberModal(event);

        expect(requiredProps.actions.loadBots).toHaveBeenCalledTimes(1);
    });

    test('renderDeactivateMemberModal should not render the bot accounts warning in case the user do not have any bot accounts', async () => {
        const overrideProps = {
            config: {
                ServiceSettings: {
                    DisableBotsWhenOwnerIsDeactivated: true,
                },
            },
            bots: {
                1: TestHelper.getBotMock({owner_id: '1'}),
                2: TestHelper.getBotMock({owner_id: '1'}),
                3: TestHelper.getBotMock({owner_id: '2'}),
            },
        };
        const wrapper = shallow<SystemUsersDropdown>(<SystemUsersDropdown {...{...requiredProps, ...overrideProps}}/>);
        const ConfirmModal = () => wrapper.instance().renderDeactivateMemberModal();
        const modal = shallow(<ConfirmModal/>);
        expect(modal.prop('message')).toMatchSnapshot();
    });

    test('renderDeactivateMemberModal should render the bot accounts warning. owner_id has enabled bot accounts', async () => {
        const overrideProps = {
            config: {
                ServiceSettings: {
                    DisableBotsWhenOwnerIsDeactivated: true,
                },
            },
            bots: {
                1: TestHelper.getBotMock({owner_id: '1', delete_at: 0}),
                2: TestHelper.getBotMock({owner_id: '1', delete_at: 0}),
                3: TestHelper.getBotMock({owner_id: 'user_id', delete_at: 0}),
            },
        };
        const wrapper = shallow<SystemUsersDropdown>(<SystemUsersDropdown {...{...requiredProps, ...overrideProps}}/>);
        wrapper.setState({showDeactivateMemberModal: true});
        const ConfirmModal = () => wrapper.instance().renderDeactivateMemberModal();
        const modal = shallow(<ConfirmModal/>);
        expect(modal.prop('message')).toMatchSnapshot();
    });

    test('renderDeactivateMemberModal should not render the bot accounts warning. owner_id has no enabled bot accounts', async () => {
        const overrideProps = {
            config: {
                ServiceSettings: {
                    DisableBotsWhenOwnerIsDeactivated: true,
                },
            },
            bots: {
                1: TestHelper.getBotMock({owner_id: '1', delete_at: 0}),
                2: TestHelper.getBotMock({owner_id: '1', delete_at: 0}),
                3: TestHelper.getBotMock({owner_id: 'user_id', delete_at: 1234}),
            },
        };
        const wrapper = shallow<SystemUsersDropdown>(<SystemUsersDropdown {...{...requiredProps, ...overrideProps}}/>);
        wrapper.setState({showDeactivateMemberModal: true});
        const ConfirmModal = () => wrapper.instance().renderDeactivateMemberModal();
        const modal = shallow(<ConfirmModal/>);
        expect(modal.prop('message')).toMatchSnapshot();
    });

    test('Manage Roles button should be hidden for system manager', async () => {
        const systemManager = TestHelper.getUserMock({
            id: 'system_manager_id',
            roles: 'system_user system_manager',
            username: 'system-manager',
        });
        const overrideProps = {
            currentUser: systemManager,
        };
        const wrapper = shallow<SystemUsersDropdown>(<SystemUsersDropdown {...{...requiredProps, ...overrideProps}}/>);
        expect(wrapper.find(Menu.ItemAction).find({text: 'Manage Roles'}).props().show).toBe(false);
    });

    test('Manage Roles button should be visible for system admin', async () => {
        const systemAdmin = TestHelper.getUserMock({
            id: 'system_admin_id',
            roles: 'system_user system_admin',
            username: 'system-admin',
        });
        const overrideProps = {
            currentUser: systemAdmin,
        };
        const wrapper = shallow<SystemUsersDropdown>(<SystemUsersDropdown {...{...requiredProps, ...overrideProps}}/>);
        expect(wrapper.find(Menu.ItemAction).find({text: 'Manage Roles'}).props().show).toBe(true);
    });

    test('should match snapshot with license', async () => {
        const wrapper = shallow(<SystemUsersDropdown {...requiredProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot without license', async () => {
        const wrapper = shallow(<SystemUsersDropdown {...{...requiredProps, isLicensed: false}}/>);
        expect(wrapper).toMatchSnapshot();
    });
});
