// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setup} from './support';

test.describe('LDAP group configuration channel roles', () => {
    /**
     * @objective Verify changing a channel role without saving leaves the role as Member
     */
    test('does not update the channel role if not saved', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, channel, consolePage, group} = await setup(pw);
        await adminClient.linkGroupSyncable(group.id, channel.id, 'channel', {auto_add: true});
        await consolePage.groupConfiguration.goto(group.id);

        // # Promote the channel and reload after canceling the navigation warning
        await consolePage.groupConfiguration.changeMembershipRole(channel.display_name, 'Member', 'Channel Admin');
        await consolePage.groupConfiguration.attemptToLeave();
        await consolePage.groupConfiguration.cancelLeaving();
        await consolePage.groupConfiguration.goto(group.id);

        // * Verify the unsaved role change was discarded
        await consolePage.groupConfiguration.expectMembershipRole(channel.display_name, 'Member');
    });

    /**
     * @objective Verify a role change on a removed channel is not persisted when the removal is saved
     */
    test('does not update the role of a removed channel', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, channel, consolePage, group} = await setup(pw);
        await adminClient.linkGroupSyncable(group.id, channel.id, 'channel', {auto_add: true});
        await consolePage.groupConfiguration.goto(group.id);

        // # Promote and remove the channel, then save
        await consolePage.groupConfiguration.changeMembershipRole(channel.display_name, 'Member', 'Channel Admin');
        await consolePage.groupConfiguration.removeTeamOrChannel(channel.display_name);
        await consolePage.groupConfiguration.attemptToLeave();
        await consolePage.groupConfiguration.cancelLeaving();
        await consolePage.groupConfiguration.save();

        // * Verify the deleted membership did not retain the administrator role
        const link = await adminClient.getGroupSyncableIncludingDeleted(group.id, channel.id, 'channel');
        expect(link.delete_at).not.toBe(0);
        expect(link.scheme_admin).toBe(false);
    });
});
