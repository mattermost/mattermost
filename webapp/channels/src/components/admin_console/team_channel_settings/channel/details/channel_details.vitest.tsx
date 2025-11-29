// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {Group} from '@mattermost/types/groups';
import type {Scheme} from '@mattermost/types/schemes';

import {renderWithContext, waitFor} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelDetails from './channel_details';

describe('admin_console/team_channel_settings/channel/ChannelDetails', () => {
    const createActions = () => ({
        getChannel: vi.fn().mockResolvedValue([]),
        getTeam: vi.fn().mockResolvedValue([]),
        linkGroupSyncable: vi.fn(),
        conver: vi.fn(),
        patchChannel: vi.fn(),
        setNavigationBlocked: vi.fn(),
        unlinkGroupSyncable: vi.fn(),
        getGroups: vi.fn().mockResolvedValue([]),
        membersMinusGroupMembers: vi.fn(),
        updateChannelPrivacy: vi.fn(),
        patchGroupSyncable: vi.fn(),
        getChannelModerations: vi.fn().mockResolvedValue([]),
        patchChannelModerations: vi.fn(),
        loadScheme: vi.fn(),
        addChannelMember: vi.fn(),
        removeChannelMember: vi.fn(),
        updateChannelMemberSchemeRoles: vi.fn(),
        deleteChannel: vi.fn(),
        unarchiveChannel: vi.fn(),
        getAccessControlPolicy: vi.fn().mockResolvedValue({data: null}),
        deleteAccessControlPolicy: vi.fn(),
        assignChannelToAccessControlPolicy: vi.fn(),
        unassignChannelsFromAccessControlPolicy: vi.fn(),
        searchPolicies: vi.fn(),
        getAccessControlFields: vi.fn().mockResolvedValue({data: []}),
        getVisualAST: vi.fn().mockResolvedValue({data: {}}),
        saveChannelAccessPolicy: vi.fn().mockResolvedValue({data: {}}),
        validateChannelExpression: vi.fn().mockResolvedValue({data: {}}),
        createAccessControlSyncJob: vi.fn().mockResolvedValue({data: {}}),
        updateAccessControlPolicyActive: vi.fn().mockResolvedValue({data: {}}),
        searchUsersForExpression: vi.fn().mockResolvedValue({data: {users: [], total: 0}}),
        getChannelMembers: vi.fn().mockResolvedValue({data: []}),
        getProfilesByIds: vi.fn().mockResolvedValue({data: []}),
    });

    const groups: Group[] = [{
        id: '123',
        name: 'name',
        display_name: 'DN',
        description: 'descript',
        source: 'A',
        remote_id: 'id',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        has_syncables: false,
        member_count: 3,
        scheme_admin: false,
        allow_reference: false,
    }];

    const allGroups = {
        123: groups[0],
    };

    const testChannel: Channel & {team_name: string} = {
        id: '123',
        team_name: 'team',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        team_id: 'id_123',
        type: 'O',
        display_name: 'name',
        name: 'DN',
        header: 'header',
        purpose: 'purpose',
        last_post_at: 0,
        last_root_post_at: 0,
        creator_id: 'id',
        scheme_id: 'id',
        group_constrained: false,
    };

    const team = TestHelper.getTeamMock({
        display_name: 'test',
    });

    const teamScheme: Scheme = {
        id: 'asdf',
        name: 'asdf',
        description: 'asdf',
        display_name: 'asdf',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        scope: 'team',
        default_team_admin_role: 'asdf',
        default_team_user_role: 'asdf',
        default_team_guest_role: 'asdf',
        default_channel_admin_role: 'asdf',
        default_channel_user_role: 'asdf',
        default_channel_guest_role: 'asdf',
        default_playbook_admin_role: 'asdf',
        default_playbook_member_role: 'asdf',
        default_run_member_role: 'asdf',
    };

    test('should match snapshot', async () => {
        const actions = createActions();
        const additionalProps = {
            channelPermissions: [],
            guestAccountsEnabled: true,
            channelModerationEnabled: true,
            channelGroupsEnabled: true,
            abacSupported: true,
            isDisabled: false,
        };

        let result = renderWithContext(
            <ChannelDetails
                teamScheme={teamScheme}
                groups={groups}
                team={team}
                totalGroups={groups.length}
                actions={actions}
                channel={testChannel}
                channelID={testChannel.id}
                allGroups={allGroups}
                {...additionalProps}
            />,
        );
        await waitFor(() => {
            expect(actions.getChannel).toHaveBeenCalled();
        });
        expect(result.container).toMatchSnapshot();

        const actions2 = createActions();
        result = renderWithContext(
            <ChannelDetails
                teamScheme={teamScheme}
                groups={groups}
                team={undefined}
                totalGroups={groups.length}
                actions={actions2}
                channel={testChannel}
                channelID={testChannel.id}
                allGroups={allGroups}
                {...additionalProps}
            />,
        );
        await waitFor(() => {
            expect(actions2.getChannel).toHaveBeenCalled();
        });
        expect(result.container).toMatchSnapshot();
    });

    test('should match snapshot for Professional', async () => {
        const actions = createActions();
        const additionalProps = {
            channelPermissions: [],
            guestAccountsEnabled: true,
            channelModerationEnabled: true,
            channelGroupsEnabled: false,
            isDisabled: false,
            abacSupported: false,
        };

        let result = renderWithContext(
            <ChannelDetails
                teamScheme={teamScheme}
                groups={groups}
                team={team}
                totalGroups={groups.length}
                actions={actions}
                channel={testChannel}
                channelID={testChannel.id}
                allGroups={allGroups}
                {...additionalProps}
            />,
        );
        await waitFor(() => {
            expect(actions.getChannel).toHaveBeenCalled();
        });
        expect(result.container).toMatchSnapshot();

        const actions2 = createActions();
        result = renderWithContext(
            <ChannelDetails
                teamScheme={teamScheme}
                groups={groups}
                team={undefined}
                totalGroups={groups.length}
                actions={actions2}
                channel={testChannel}
                channelID={testChannel.id}
                allGroups={allGroups}
                {...additionalProps}
            />,
        );
        await waitFor(() => {
            expect(actions2.getChannel).toHaveBeenCalled();
        });
        expect(result.container).toMatchSnapshot();
    });

    test('should match snapshot for Enterprise', async () => {
        const actions = createActions();
        const additionalProps = {
            channelPermissions: [],
            guestAccountsEnabled: true,
            channelModerationEnabled: true,
            channelGroupsEnabled: false,
            isDisabled: false,
            abacSupported: true,
        };

        let result = renderWithContext(
            <ChannelDetails
                teamScheme={teamScheme}
                groups={groups}
                team={team}
                totalGroups={groups.length}
                actions={actions}
                channel={testChannel}
                channelID={testChannel.id}
                allGroups={allGroups}
                {...additionalProps}
            />,
        );
        await waitFor(() => {
            expect(actions.getChannel).toHaveBeenCalled();
        });
        expect(result.container).toMatchSnapshot();

        const actions2 = createActions();
        result = renderWithContext(
            <ChannelDetails
                teamScheme={teamScheme}
                groups={groups}
                team={undefined}
                totalGroups={groups.length}
                actions={actions2}
                channel={testChannel}
                channelID={testChannel.id}
                allGroups={allGroups}
                {...additionalProps}
            />,
        );
        await waitFor(() => {
            expect(actions2.getChannel).toHaveBeenCalled();
        });
        expect(result.container).toMatchSnapshot();
    });
});
