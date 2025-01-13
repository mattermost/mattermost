// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@e2e-support/test_fixture';
import {createRandomUser} from '@e2e-support/server';

test('MM-T53377 Profile popover should show correct fields after at-mention autocomplete', async ({pw, pages}) => {
    // # Initialize with specific config and get admin client
    const {user, adminClient, team} = await pw.initSetup();

    await adminClient.patchConfig({
        PrivacySettings: {
            ShowEmailAddress: false,
            ShowFullName: false,
        },
    });

    // # Create and add another user using admin client
    const testUser2 = await adminClient.createUser(createRandomUser(), '', '');
    await adminClient.addToTeam(team.id, testUser2.id);

    // # Log in as user in new browser context
    const {page} = await pw.testBrowser.login(user);

    // # Visit default channel page
    const channelPage = new pages.ChannelsPage(page);
    await channelPage.goto();
    await channelPage.toBeVisible();

    // # Send mentions quickly
    await channelPage.centerView.postCreate.postMessage(`@${user.username} @${testUser2.username}`);

    // # Open profile popover for current user
    const firstMention = channelPage.centerView.container.getByText(`@${user.username}`, {exact: true});
    await firstMention.click();

    // * Verify all fields are visible for current user
    const popover = channelPage.userProfilePopover;
    await expect(popover.container.getByText(`@${user.username}`)).toBeVisible();
    await expect(popover.container.getByText(`${user.first_name} ${user.last_name}`)).toBeVisible();
    await expect(popover.container.getByText(user.email)).toBeVisible();

    // # Close profile popover
    await popover.close();

    // # Open profile popover for other user
    const secondMention = channelPage.centerView.container.getByText(`@${testUser2.username}`, {exact: true});
    await secondMention.click();

    // * Verify only username is visible for other user
    await expect(popover.container.getByText(`@${testUser2.username}`)).toBeVisible();
    await expect(popover.container.getByText(testUser2.email)).not.toBeVisible();

    // # Close profile popover
    await popover.close();

    // # Trigger autocomplete
    await channelPage.centerView.postCreate.writeMessage(`@${user.username}`);

    // # Wait for autocomplete
    const suggestionList = channelPage.centerView.postCreate.suggestionList;
    await expect(suggestionList.getByText(`@${user.username}`)).toBeVisible();

    // # Clear textbox
    await channelPage.centerView.postCreate.writeMessage('');

    // # Open profile popover for current user again
    await firstMention.click();

    // * Verify all fields are still visible
    await expect(popover.container.getByText(`@${user.username}`)).toBeVisible();
    await expect(popover.container.getByText(`${user.first_name} ${user.last_name}`)).toBeVisible();
    await expect(popover.container.getByText(user.email)).toBeVisible();
});
