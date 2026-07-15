// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a deactivated user without a previous conversation is omitted from the Direct Messages modal.
 */
test(
    'MM-T1665_1 omits a deactivated user without a previous conversation from the Direct Messages modal',
    {tag: '@direct_messages'},
    async ({pw}) => {
        // # Create and deactivate another user without creating a direct-message conversation
        const {user, team, adminClient} = await pw.initSetup();
        const [deactivatedUser] = await adminClient.createUsers(team.id, 1, 'inactive-no-dm');
        await adminClient.updateUserActive(deactivatedUser.id, false);

        // # Log in, open the Direct Messages modal, and search for the deactivated user's email
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();
        const modal = await channelsPage.openDirectChannelsModal();
        await modal.fillSearchInput(deactivatedUser.email);

        // * Verify the modal reports no matching results
        await modal.toHaveNoResultsFor(deactivatedUser.email);
    },
);

/**
 * @objective Verify a deactivated user with a previous conversation remains available in the Direct Messages modal.
 */
test(
    'MM-T1665_2 shows a deactivated user with a previous conversation in the Direct Messages modal',
    {tag: '@direct_messages'},
    async ({pw}) => {
        // # Create another user and establish a direct-message conversation through the API
        const {user, team, adminClient} = await pw.initSetup();
        const [deactivatedUser] = await adminClient.createUsers(team.id, 1, 'inactive-with-dm');
        const directChannel = await adminClient.createDirectChannel([user.id, deactivatedUser.id]);
        await adminClient.createPost({
            channel_id: directChannel.id,
            user_id: user.id,
            message: `Hello ${deactivatedUser.username}`,
        });
        await adminClient.updateUserActive(deactivatedUser.id, false);

        // # Log in, open the Direct Messages modal, and search for the deactivated user's email
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();
        const modal = await channelsPage.openDirectChannelsModal();
        await modal.fillSearchInput(deactivatedUser.email);

        // * Verify the previous conversation is listed with the username and deactivated status
        await modal.toHaveDeactivatedConversation(deactivatedUser.username, deactivatedUser.email);
    },
);
