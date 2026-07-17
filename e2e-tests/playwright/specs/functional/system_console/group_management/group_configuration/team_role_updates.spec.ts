// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {saveAndReload, setup} from './support';

test.describe('LDAP group configuration team roles', () => {
    /**
     * @objective Verify changing and saving the role for a newly added team persists Team Admin
     */
    test('updates the role for a new team', {tag: '@ldap'}, async ({pw}) => {
        const {consolePage, group, team} = await setup(pw);

        // # Add a team, promote it, cancel navigation, and save
        await consolePage.groupConfiguration.addTeamOrChannel('Team', team.display_name);
        await consolePage.groupConfiguration.changeMembershipRole(team.display_name, 'Member', 'Team Admin');
        await consolePage.groupConfiguration.attemptToLeave();
        await consolePage.groupConfiguration.cancelLeaving();
        await saveAndReload(consolePage, group.id);

        // * Verify Team Admin persisted
        await consolePage.groupConfiguration.expectMembershipRole(team.display_name, 'Team Admin');
    });

    /**
     * @objective Verify changing and saving the role for an existing team persists Team Admin
     */
    test('updates the role for an existing team', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, consolePage, group, team} = await setup(pw);
        await adminClient.linkGroupSyncable(group.id, team.id, 'team', {auto_add: true});
        await consolePage.groupConfiguration.goto(group.id);

        // # Promote the existing team, cancel navigation, and save
        await consolePage.groupConfiguration.changeMembershipRole(team.display_name, 'Member', 'Team Admin');
        await consolePage.groupConfiguration.attemptToLeave();
        await consolePage.groupConfiguration.cancelLeaving();
        await saveAndReload(consolePage, group.id);

        // * Verify Team Admin persisted
        await consolePage.groupConfiguration.expectMembershipRole(team.display_name, 'Team Admin');
    });
});
