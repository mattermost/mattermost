// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';

import {Permissions} from 'mattermost-redux/constants';
import initialState from 'mattermost-redux/store/initial_state';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {TestHelper} from 'utils/test_helper';

import {mapStateToProps} from './index';

describe('components/admin_console/system_user_detail/index', () => {
    const stateWithPermissions = (permissions: string[]): GlobalState => mergeObjects(initialState, {
        entities: {
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: TestHelper.getUserMock({id: 'current_user_id', roles: 'system_user test_role'}),
                },
            },
            roles: {
                roles: {
                    system_user: {name: 'system_user', permissions: []},
                    test_role: {name: 'test_role', permissions},
                },
            },
        },
    }) as GlobalState;

    test('lets a user with manage_system edit admin-managed attributes', () => {
        expect(mapStateToProps(stateWithPermissions([Permissions.MANAGE_SYSTEM])).canEditAdminManaged).toBe(true);
    });

    test('does not let a delegated user manager edit admin-managed attributes', () => {
        const state = stateWithPermissions([Permissions.SYSCONSOLE_WRITE_USERMANAGEMENT_USERS, Permissions.SYSCONSOLE_READ_USERMANAGEMENT_USERS]);
        expect(mapStateToProps(state).canEditAdminManaged).toBe(false);
    });
});
