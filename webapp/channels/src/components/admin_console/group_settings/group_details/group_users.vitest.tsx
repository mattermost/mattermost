// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import range from 'lodash/range';
import React from 'react';

import {GroupSource, PluginGroupSourcePrefix} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import GroupUsers from 'components/admin_console/group_settings/group_details/group_users';

import {renderWithContext, waitFor} from 'tests/vitest_react_testing_utils';

describe('components/admin_console/group_settings/group_details/GroupUsers', () => {
    const members = range(0, 55).map((i) => ({
        id: 'id' + i,
        username: 'username' + i,
        first_name: 'Name' + i,
        last_name: 'Surname' + i,
        email: 'test' + i + '@test.com',
        last_picture_update: i,
    } as UserProfile));

    const defaultProps = {
        groupID: 'xxxxxxxxxxxxxxxxxxxxxxxxxx',
        members: members.slice(0, 20),
        total: 20,
        source: GroupSource.Ldap,
        getMembers: vi.fn().mockReturnValue(Promise.resolve()),
    };

    test('should match snapshot, on loading without data', async () => {
        const {container} = renderWithContext(
            <GroupUsers
                {...defaultProps}
                members={[]}
            />,
        );
        await waitFor(() => {
            expect(defaultProps.getMembers).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, plugin group', async () => {
        const {container} = renderWithContext(
            <GroupUsers
                {...defaultProps}
                source={PluginGroupSourcePrefix.Plugin + 'keycloak'}
            />,
        );
        await waitFor(() => {
            expect(defaultProps.getMembers).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on loading with data', async () => {
        const {container} = renderWithContext(<GroupUsers {...defaultProps}/>);
        await waitFor(() => {
            expect(defaultProps.getMembers).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with multiple pages', async () => {
        const {container} = renderWithContext(
            <GroupUsers
                {...defaultProps}
                members={members.slice(0, 55)}
                total={55}
            />,
        );
        await waitFor(() => {
            expect(defaultProps.getMembers).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should call getMembers on mount', async () => {
        const getMembers = vi.fn().mockReturnValue(Promise.resolve());
        renderWithContext(
            <GroupUsers
                {...defaultProps}
                getMembers={getMembers}
            />,
        );
        await waitFor(() => {
            expect(getMembers).toHaveBeenCalledWith('xxxxxxxxxxxxxxxxxxxxxxxxxx', 0, 20);
        });
    });
});
