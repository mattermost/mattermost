// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {decomposeKorean, expect, koreanTestPhrase, test, typeHangulCharacterWithIme} from '@mattermost/playwright-lib';

test('MM-66937 Invite modal results match the current input state', async ({pw}) => {
    const {adminUser, adminClient, team} = await pw.initSetup();

    // # Create two users not on the team whose usernames share a prefix but differ at the end
    const randomPrefix = pw.random.id(8);
    const user1 = await adminClient.createUser(await pw.random.user(randomPrefix + 'a'), '', '');
    const user2 = await adminClient.createUser(await pw.random.user(randomPrefix + 'b'), '', '');

    // # Log in as admin
    const {channelsPage} = await pw.testBrowser.login(adminUser);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Open the Invite People modal
    await channelsPage.sidebarLeft.teamMenuButton.click();
    await channelsPage.teamMenu.toBeVisible();
    await channelsPage.teamMenu.clickInvitePeople();
    const inviteModal = await channelsPage.getInvitePeopleModal(team.display_name);
    await inviteModal.toBeVisible();

    // # Type the prefix to filter out all users
    await inviteModal.inviteInput.pressSequentially(randomPrefix);

    // * Verify that both users appear in the results initially
    const listbox = inviteModal.container.getByRole('listbox');
    await expect(listbox.getByRole('option')).toHaveCount(2);
    await expect(listbox.getByRole('option', {name: `@${user1.username}`})).toBeVisible();
    await expect(listbox.getByRole('option', {name: `@${user2.username}`})).toBeVisible();

    // # Type an 'a' to filter the results
    await inviteModal.inviteInput.press('a');

    // * Verify that only user1 is now listed
    await expect(listbox.getByRole('option')).toHaveCount(1);
    await expect(listbox.getByRole('option', {name: `@${user1.username}`})).toBeVisible();
    await expect(listbox.getByRole('option', {name: `@${user2.username}`})).not.toBeAttached();

    // # Backspace that 'a'
    await inviteModal.inviteInput.press('Backspace');

    // * Verify that both users are listed again
    await expect(listbox.getByRole('option')).toHaveCount(2);
    await expect(listbox.getByRole('option', {name: `@${user1.username}`})).toBeVisible();
    await expect(listbox.getByRole('option', {name: `@${user2.username}`})).toBeVisible();

    // # Type a 'b' to filter the results
    await inviteModal.inviteInput.press('b');

    // * Verify that only user2 is now listed
    await expect(listbox.getByRole('option')).toHaveCount(1);
    await expect(listbox.getByRole('option', {name: `@${user1.username}`})).not.toBeAttached();
    await expect(listbox.getByRole('option', {name: `@${user2.username}`})).toBeVisible();
});

test('MM-66937 Invite modal results match the current input state when typing in Korean', async ({browserName, pw}) => {
    test.skip(browserName !== 'chromium', 'The API used to test this is only available in Chrome');

    const {adminUser, adminClient, team} = await pw.initSetup();

    // # Create a users with a Korean name (plus a prefix to avoid interfering test runs)
    const randomPrefix = pw.random.id(8);
    const user = await adminClient.createUser(
        {
            ...(await pw.random.user(randomPrefix + 'a')),
            first_name: randomPrefix + koreanTestPhrase,
        },
        '',
        '',
    );

    // # Log in as admin
    const {channelsPage, page} = await pw.testBrowser.login(adminUser);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Open the Invite People modal
    await channelsPage.sidebarLeft.teamMenuButton.click();
    await channelsPage.teamMenu.toBeVisible();
    await channelsPage.teamMenu.clickInvitePeople();
    const inviteModal = await channelsPage.getInvitePeopleModal(team.display_name);
    await inviteModal.toBeVisible();

    // # Type the prefix to filter out other users
    await inviteModal.inviteInput.pressSequentially(randomPrefix);

    // * Verify that the user appears in the results initially
    const listbox = inviteModal.container.getByRole('listbox');
    await expect(listbox.getByRole('option')).toHaveCount(1);
    await expect(listbox.getByRole('option', {name: `@${user.username}`})).toBeVisible();

    // # Type all 3 keys that form a single Hangul character
    const client = await page.context().newCDPSession(page);
    await typeHangulCharacterWithIme(client, decomposeKorean(koreanTestPhrase)[0], undefined);

    // * Verify that the user is still listed
    await expect(listbox.getByRole('option')).toHaveCount(1);
    await expect(listbox.getByRole('option', {name: `@${user.username}`})).toBeVisible();

    await client.detach();
});
