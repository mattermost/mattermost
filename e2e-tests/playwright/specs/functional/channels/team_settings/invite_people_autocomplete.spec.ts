// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {decomposeKorean, expect, koreanTestPhrase, test, typeHangulCharacterWithIme} from '@mattermost/playwright-lib';

async function openInvitePeopleModal(pw: any, adminUser: any, team: any) {
    const {channelsPage} = await pw.testBrowser.login(adminUser);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    await channelsPage.sidebarLeft.teamMenuButton.click();
    await channelsPage.teamMenu.toBeVisible();
    await channelsPage.teamMenu.clickInvitePeople();

    const inviteModal = await channelsPage.getInvitePeopleModal(team.display_name);
    await inviteModal.toBeVisible();

    return inviteModal;
}

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

test('Invite modal autocomplete is not clipped vertically', async ({pw}) => {
    const {adminUser, adminClient, team} = await pw.initSetup();

    const randomPrefix = pw.random.id(8);
    const users = await Promise.all([
        adminClient.createUser(await pw.random.user(randomPrefix + 'a'), '', ''),
        adminClient.createUser(await pw.random.user(randomPrefix + 'b'), '', ''),
        adminClient.createUser(await pw.random.user(randomPrefix + 'c'), '', ''),
        adminClient.createUser(await pw.random.user(randomPrefix + 'd'), '', ''),
        adminClient.createUser(await pw.random.user(randomPrefix + 'e'), '', ''),
        adminClient.createUser(await pw.random.user(randomPrefix + 'f'), '', ''),
        adminClient.createUser(await pw.random.user(randomPrefix + 'g'), '', ''),
        adminClient.createUser(await pw.random.user(randomPrefix + 'h'), '', ''),
    ]);

    const inviteModal = await openInvitePeopleModal(pw, adminUser, team);

    await inviteModal.inviteInput.pressSequentially(randomPrefix);

    const modalContent = inviteModal.container.locator('.modal-content');
    const listbox = inviteModal.container.getByRole('listbox');
    const options = listbox.getByRole('option');
    await expect(options).toHaveCount(users.length);

    const lastOption = options.last();
    await expect(lastOption).toBeVisible();

    const geometry = await Promise.all([modalContent.boundingBox(), lastOption.boundingBox()]);
    const [modalContentBox, lastOptionBox] = geometry;
    expect(modalContentBox).not.toBeNull();
    expect(lastOptionBox).not.toBeNull();
    expect(lastOptionBox!.y + lastOptionBox!.height).toBeGreaterThan(modalContentBox!.y + modalContentBox!.height);

    const modalContentOverflow = await modalContent.evaluate((element: HTMLElement) => {
        const style = window.getComputedStyle(element);

        return {
            overflowX: style.overflowX,
            overflowY: style.overflowY,
        };
    });

    expect(modalContentOverflow.overflowX).toBe('visible');
    expect(modalContentOverflow.overflowY).toBe('visible');
});

test('Invite modal results are visible outside the modal', async ({pw}) => {
    const {adminUser, adminClient, team} = await pw.initSetup();

    // # Create enough users that the results will extend outside the modal until past when the result list is capped
    const randomPrefix = pw.random.id(8);
    const users = await Promise.all([
        adminClient.createUser(await pw.random.user(randomPrefix + 'a'), '', ''),
        adminClient.createUser(await pw.random.user(randomPrefix + 'b'), '', ''),
        adminClient.createUser(await pw.random.user(randomPrefix + 'c'), '', ''),
        adminClient.createUser(await pw.random.user(randomPrefix + 'd'), '', ''),
        adminClient.createUser(await pw.random.user(randomPrefix + 'e'), '', ''),
        adminClient.createUser(await pw.random.user(randomPrefix + 'f'), '', ''),
        adminClient.createUser(await pw.random.user(randomPrefix + 'g'), '', ''),
        adminClient.createUser(await pw.random.user(randomPrefix + 'h'), '', ''),
    ]);

    // # Open the Invite People modal
    const inviteModal = await openInvitePeopleModal(pw, adminUser, team);

    // # Type the prefix to filter out other users
    await inviteModal.inviteInput.type(randomPrefix);

    // At time of writing, 4 results are fully visible, the next is partly visible, and the rest are clipped
    const visibleCount = 5;

    for (let i = 0; i < users.length; i++) {
        const user = users[i];

        const option = await inviteModal.container.getByRole('option', {name: user.username, exact: false});
        if (i < visibleCount) {
            // * Verify that this user is in the list and on the screen
            await expect(option).toBeVisible();
            await expect(option).toBeInViewport();
        } else {
            // * Verify that this user is in the list but off the screen
            await expect(option).toBeVisible();
            await expect(option).not.toBeInViewport();
        }
    }
});

test('Invite modal remains width-constrained with long unbroken input', async ({pw}) => {
    const {adminUser, team} = await pw.initSetup();
    const inviteModal = await openInvitePeopleModal(pw, adminUser, team);

    const modalContent = inviteModal.container.locator('.modal-content');
    const initialModalContentBox = await modalContent.boundingBox();
    expect(initialModalContentBox).not.toBeNull();

    await inviteModal.inviteInput.pressSequentially(
        'averyveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryverylongunbrokeninviteinput@example.com',
    );

    const modalContentMetrics = await modalContent.evaluate((element: HTMLElement) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return {
            width: Math.round(rect.width),
            overflowX: style.overflowX,
            overflowY: style.overflowY,
        };
    });

    expect(modalContentMetrics.width).toBeLessThanOrEqual(Math.ceil(initialModalContentBox!.width));
    expect(modalContentMetrics.overflowX).toBe('visible');
    expect(modalContentMetrics.overflowY).toBe('visible');
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
