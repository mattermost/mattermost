// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {saveAndReload, setup} from './support';

test.describe('LDAP group configuration', () => {
    /**
     * @objective Verify removing a team without saving leaves the persisted membership intact
     */
    test('does not remove a team without saving', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, consolePage, group, team} = await setup(pw);
        await adminClient.linkGroupSyncable(group.id, team.id, 'team', {auto_add: true});
        await consolePage.groupConfiguration.goto(group.id);

        // # Remove the team, start to leave, cancel the warning, and reload without saving
        await consolePage.groupConfiguration.removeTeamOrChannel(team.display_name);
        await consolePage.groupConfiguration.expectNoTeamOrChannelMemberships();
        await consolePage.groupConfiguration.attemptToLeave();
        await consolePage.groupConfiguration.cancelLeaving();
        await consolePage.groupConfiguration.goto(group.id);

        // * Verify the team is still present
        await consolePage.groupConfiguration.expectTeamOrChannelMembership(team.display_name);
    });

    /**
     * @objective Verify removing and saving a team deletes the membership
     */
    test('does remove a team when saved', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, consolePage, group, team} = await setup(pw);
        await adminClient.linkGroupSyncable(group.id, team.id, 'team', {auto_add: true});
        await consolePage.groupConfiguration.goto(group.id);

        // # Remove the team, cancel navigation, then save
        await consolePage.groupConfiguration.removeTeamOrChannel(team.display_name);
        await consolePage.groupConfiguration.attemptToLeave();
        await consolePage.groupConfiguration.cancelLeaving();
        await saveAndReload(consolePage, group.id);

        // * Verify the team is no longer present
        await consolePage.groupConfiguration.expectNoTeamOrChannelMemberships();
    });
});
