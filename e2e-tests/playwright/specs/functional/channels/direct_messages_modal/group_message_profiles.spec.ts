// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';
import type {Page} from '@playwright/test';

import {Api, expect, settle, test} from '@mattermost/playwright-lib';

import {goToChannel, openDirectMessages, selectUser} from './dm_dialog';

/**
 * @objective Verify that a group message whose channel has fallen out of the sidebar (because the user
 * has more DMs/GMs than the configured "Number of direct messages to show" limit) still appears in the
 * Direct Messages modal with its members fully loaded — i.e. with a non-zero member count and the
 * participant usernames as its name.
 */
test(
    "MM-65058 Direct Messages modal should load group members for GMs which haven't been loaded otherwise",
    {tag: '@direct_messages'},
    async ({pw}) => {
        const {adminClient, user, userClient, team} = await pw.initSetup({withDefaultProfileImage: false});

        // Use a lower visible DM limit than the UI normally lets you use to speed up this test
        const totalGms = 2;
        const visibleLimit = 1;

        // # Limit the user's visible DMs/GMs in the sidebar so one GM falls off the sidebar
        await userClient.savePreferences(user.id, [
            {
                user_id: user.id,
                category: 'sidebar_settings',
                name: 'limit_visible_dms_gms',
                value: visibleLimit.toString(),
            },
        ]);

        // # Create enough users to populate 11 GMs with unique users
        const users = [];
        for (let i = 0; i < totalGms * 2; i++) {
            const user = await pw.createNewUserProfile(adminClient, {prefix: `mm65058gm${i}`});
            users.push(user);
        }

        // # Log the user in and open the channels page
        const {app, page} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: 'town-square'});
        await expect(app.center.postCreate).toBeVisible();

        // # Create 11 GMs using the Direct Channels modal
        const gmChannels = [];
        for (let i = 0; i < totalGms; i++) {
            const memberA = users[i * 2];
            const memberB = users[i * 2 + 1];

            // # Open the modal
            await openDirectMessages(app);

            // # Select the users and create the channel
            await selectUser(app, memberA);
            await selectUser(app, memberB);
            await goToChannel(app);

            // # Make a post in the channel to ensure that it has a last_post_at value
            await app.center.postCreate.message.container.fill(`gm message ${i}`);
            await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();

            // # Save the channel's information for later
            gmChannels.push({
                channel: await getCurrentChannel(page),
                members: [memberA, memberB],
            });
        }

        const targetGm = gmChannels[0];
        const otherGms = gmChannels.slice(1);

        // # Refresh the app and go back to Town Square
        await app.channelsPage.goto({team, channel: 'town-square'});

        // * Verify the target GM is not present in the sidebar to ensure that the sidebar hasn't loaded it
        await expect(app.lhs.channelList.channel(targetGm.channel)).toHaveCount(0);

        // * Wait until the other GMs are loaded and present in the sidebar
        for (const otherGm of otherGms) {
            const otherGmEntry = app.lhs.channelList.channel(otherGm.channel);

            await expect(otherGmEntry).toHaveCount(1);
            await expect(otherGmEntry).toContainText(gmChannelDisplayName(otherGm.members));
        }

        // * Verify that the members of the target GM haven't been loaded and the members of other GMs have
        await assertChannelUsersNotLoaded(page, targetGm.channel.id);
        for (const otherGm of otherGms) {
            await assertChannelUsersLoaded(page, otherGm.channel.id, otherGm.members);
        }

        // # Open the Direct Messages modal again
        const dialog = await openDirectMessages(app);

        // # Wait for the list to populate
        await expect.poll(async () => (await dialog.options.groupList.keys()).length).toBeGreaterThanOrEqual(totalGms);

        // * Verify the modal contains an entry for every GM the user has, including the one that fell
        // * out of the sidebar
        for (const {channel, members} of gmChannels) {
            const gmRow = dialog.options.group(channel);

            // * Verify the row is rendered
            await expect(gmRow, `expected to find a row in the DM modal for GM ${channel.id}`).toHaveCount(1);

            // * Verify the GM icon shows the correct member count (channel members minus current user)
            await expect(
                gmRow.memberCountText,
                `expected GM ${channel.id} to show a member count of ${members.length}`,
            ).toHaveText(members.length.toString());

            // * Verify the row's name section includes every participant's username
            const nameContainer = gmRow.nameText;
            for (const participant of members) {
                await expect(
                    nameContainer,
                    `expected GM ${channel.id} to include @${participant.username} in its name`,
                ).toContainText(`@${participant.username}`);
            }
        }

        // * Double check that the members of the target GM have been loaded now
        await assertChannelUsersLoaded(page, targetGm.channel.id, targetGm.members);
    },
);

async function getCurrentChannel(page: Page) {
    return page.evaluate<Channel>(
        'store.getState().entities.channels.channels[store.getState().entities.channels.currentChannelId]',
    );
}

function gmChannelDisplayName(users: UserProfile[]) {
    return users
        .toSorted((a, b) => {
            return a.username.localeCompare(b.username, undefined, {numeric: true});
        })
        .map((user) => user.username)
        .join(', ');
}

async function assertChannelUsersLoaded(page: Page, channelId: string, expectedUsers: UserProfile[]) {
    // profilesInChannel contains Sets which aren't serializable for return from page.evaluate
    const loadedIds = await page.evaluate(
        `Array.from(store.getState().entities.users.profilesInChannel['${channelId}'])`,
    );

    expect(loadedIds).toHaveLength(expectedUsers.length);
    expect(loadedIds).toEqual(expect.arrayContaining(expectedUsers.map((user) => user.id)));
}

async function assertChannelUsersNotLoaded(page: Page, channelId: string) {
    const loadedIds = await page.evaluate(`store.getState().entities.users.profilesInChannel['${channelId}']`);

    expect(loadedIds).toBeUndefined();
}
