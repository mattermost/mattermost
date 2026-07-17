// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {saveAndReload, setup} from './support';

test.describe('LDAP group configuration channel roles', () => {
    /**
     * @objective Verify changing and saving the role for a newly added channel persists Channel Admin
     */
    test('updates the role for a new channel', {tag: '@ldap'}, async ({pw}) => {
        const {channel, consolePage, group} = await setup(pw);

        // # Add a channel, promote it, cancel navigation, and save
        await consolePage.groupConfiguration.addTeamOrChannel('Channel', channel.display_name);
        await consolePage.groupConfiguration.changeMembershipRole(channel.display_name, 'Member', 'Channel Admin');
        await consolePage.groupConfiguration.attemptToLeave();
        await consolePage.groupConfiguration.cancelLeaving();
        await saveAndReload(consolePage, group.id);

        // * Verify Channel Admin persisted
        await consolePage.groupConfiguration.expectMembershipRole(channel.display_name, 'Channel Admin');
    });

    /**
     * @objective Verify changing and saving the role for an existing channel persists Channel Admin
     */
    test('updates the role for an existing channel', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, channel, consolePage, group} = await setup(pw);
        await adminClient.linkGroupSyncable(group.id, channel.id, 'channel', {auto_add: true});
        await consolePage.groupConfiguration.goto(group.id);

        // # Promote the existing channel, cancel navigation, and save
        await consolePage.groupConfiguration.changeMembershipRole(channel.display_name, 'Member', 'Channel Admin');
        await consolePage.groupConfiguration.attemptToLeave();
        await consolePage.groupConfiguration.cancelLeaving();
        await saveAndReload(consolePage, group.id);

        // * Verify Channel Admin persisted
        await consolePage.groupConfiguration.expectMembershipRole(channel.display_name, 'Channel Admin');
    });
});
