// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a group message created from the Direct Messages modal can be closed from its channel menu.
 */
test('MM-T1799 closes a group message from the channel menu', {tag: '@direct_messages'}, async ({pw}) => {
    // # Create the test user and three other users on the team
    const {adminClient, team, user} = await pw.initSetup();
    const participants = await adminClient.createUsers(team.id, 3, 'gm-close');

    // # Open the Direct Messages modal and select all three users
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    const dmModal = await channelsPage.openDirectChannelsModal();
    for (const participant of participants) {
        await dmModal.selectUser(participant);
    }

    // * Verify the modal contains all three selected users
    await dmModal.toHaveNUsersSelected(3);

    // # Start the group message, then close it from the channel menu
    await dmModal.goToChannel();
    await channelsPage.closeGroupMessage();

    // * Verify the group message closes and Town Square becomes active
    await expect(page).toHaveURL(new RegExp(`/${team.name}/channels/town-square$`));
    await channelsPage.centerView.header.toHaveTitle('Town Square');
});
