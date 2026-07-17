// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setup} from './support';

test.describe('LDAP group configuration team roles', () => {
    /**
     * @objective Verify changing a team role without saving leaves the role as Member
     */
    test('does not update the team role if not saved', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, consolePage, group, team} = await setup(pw);
        await adminClient.linkGroupSyncable(group.id, team.id, 'team', {auto_add: true});
        await consolePage.groupConfiguration.goto(group.id);

        // # Promote the team and reload after canceling the navigation warning
        await consolePage.groupConfiguration.changeMembershipRole(team.display_name, 'Member', 'Team Admin');
        await consolePage.groupConfiguration.attemptToLeave();
        await consolePage.groupConfiguration.cancelLeaving();
        await consolePage.groupConfiguration.goto(group.id);

        // * Verify the unsaved role change was discarded
        await consolePage.groupConfiguration.expectMembershipRole(team.display_name, 'Member');
    });

    /**
     * @objective Verify a role change on a removed team is not persisted when the removal is saved
     */
    test('does not update the role of a removed team', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, consolePage, group, team} = await setup(pw);
        await adminClient.linkGroupSyncable(group.id, team.id, 'team', {auto_add: true});
        await consolePage.groupConfiguration.goto(group.id);

        // # Promote and remove the team, then save
        await consolePage.groupConfiguration.changeMembershipRole(team.display_name, 'Member', 'Team Admin');
        await consolePage.groupConfiguration.removeTeamOrChannel(team.display_name);
        await consolePage.groupConfiguration.attemptToLeave();
        await consolePage.groupConfiguration.cancelLeaving();
        await consolePage.groupConfiguration.save();

        // * Verify the deleted membership did not retain the administrator role
        const link = await adminClient.getGroupSyncableIncludingDeleted(group.id, team.id, 'team');
        expect(link.delete_at).not.toBe(0);
        expect(link.scheme_admin).toBe(false);
    });
});
