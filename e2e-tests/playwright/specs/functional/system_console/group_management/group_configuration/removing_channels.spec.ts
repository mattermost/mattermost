// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {saveAndReload, setup} from './support';

test.describe('LDAP group configuration', () => {
    /**
     * @objective Verify removing a channel without saving leaves the persisted channel and implied team intact
     */
    test('does not remove a channel without saving', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, channel, consolePage, group} = await setup(pw);
        await adminClient.linkGroupSyncable(group.id, channel.id, 'channel', {auto_add: true});
        await consolePage.groupConfiguration.goto(group.id);

        // # Remove the channel, cancel the navigation warning, and reload
        await consolePage.groupConfiguration.removeTeamOrChannel(channel.display_name);
        await consolePage.groupConfiguration.attemptToLeave();
        await consolePage.groupConfiguration.cancelLeaving();
        await consolePage.groupConfiguration.goto(group.id);

        // * Verify the channel is still present
        await consolePage.groupConfiguration.expectTeamOrChannelMembership(channel.display_name);
    });

    /**
     * @objective Verify removing and saving a channel leaves only its implied team membership
     */
    test('does remove a channel when saved', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, channel, consolePage, group, team} = await setup(pw);
        await adminClient.linkGroupSyncable(group.id, channel.id, 'channel', {auto_add: true});
        await consolePage.groupConfiguration.goto(group.id);
        await consolePage.groupConfiguration.expectTeamOrChannelMembership(team.display_name);
        await consolePage.groupConfiguration.expectTeamOrChannelMembership(channel.display_name);

        // # Remove the channel, cancel navigation, then save
        await consolePage.groupConfiguration.removeTeamOrChannel(channel.display_name);
        await consolePage.groupConfiguration.attemptToLeave();
        await consolePage.groupConfiguration.cancelLeaving();
        await saveAndReload(consolePage, group.id);

        // * Verify only the implied team remains
        await consolePage.groupConfiguration.expectTeamOrChannelMembership(team.display_name);
        await consolePage.groupConfiguration.expectTeamOrChannelMembership(channel.display_name, false);
    });
});
