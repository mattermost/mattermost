// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {
    decomposeKorean,
    expect,
    koreanTestPhrase,
    test,
    typeHangulCharacterWithIme,
    type PlaywrightExtended,
} from '@mattermost/playwright-lib';

/** Logs in as the admin and opens the Invite People dialog from the team menu. */
async function openInvitePeopleModal(pw: PlaywrightExtended, adminUser: UserProfile, team: {name: string}) {
    const {app} = await pw.testBrowser.login(adminUser);
    await app.channelsPage.goto({team, channel: 'town-square'});
    await app.lhs.header.openTeamMenuButton.clickTo(app.lhs.teamMenu);
    await expect(app.lhs.teamMenu).toBeVisible();
    await app.lhs.teamMenu.invitePeopleMenuItem.click();
    const modal = app.invitationModal;
    await expect(modal).toBeVisible();
    await expect(modal.invite.users.inputCombobox).toBeVisible();
    return {app, invite: modal.invite, modal};
}

/** The ids of the suggested users, sorted (the suggestions' own order isn't under test here). */
async function suggestedIds(users: {userList: {keys(): Promise<string[]>}}) {
    return (await users.userList.keys()).sort();
}

/** The element's bounding box; fails the test when the element has none (it is not rendered). */
async function boxOf(target: {boundingBox(): Promise<{x: number; y: number; width: number; height: number} | null>}) {
    const box = await target.boundingBox();
    if (!box) {
        throw new Error('The element has no bounding box: it is not rendered');
    }
    return box;
}

/** Creates `count` users outside the team whose usernames start with `prefix` followed by a, b, c, … */
async function createPrefixedUsers(pw: PlaywrightExtended, prefix: string, count: number) {
    const {adminClient} = await pw.getAdminClient();
    const letters = 'abcdefghijklmnopqrstuvwxyz'.slice(0, count).split('');
    return Promise.all(
        letters.map(async (letter) => adminClient.createUser(await pw.random.user(prefix + letter), '', '')),
    );
}

test('MM-66937 Invite modal results match the current input state', async ({pw}) => {
    const {adminUser, team} = await pw.initSetup();

    // # Create two users not on the team whose usernames share a prefix but differ at the end
    const randomPrefix = pw.random.id(8);
    const [user1, user2] = await createPrefixedUsers(pw, randomPrefix, 2);

    // # Open the Invite People modal
    const {invite} = await openInvitePeopleModal(pw, adminUser, team);
    const {users} = invite;
    const input = users.inputCombobox;

    // # Type the prefix to filter out all users
    await input.type(randomPrefix);

    // * Verify that both users appear in the results initially
    await expect.poll(() => suggestedIds(users)).toEqual([user1.id, user2.id].sort());
    await expect(users.emailOption).not.toBeAttached();
    await expect(users.user(user1)).toBeVisible();
    await expect(users.user(user2)).toBeVisible();

    // # Type an 'a' to filter the results
    await input.press('a');

    // * Verify that only user1 is now listed
    await expect.poll(() => suggestedIds(users)).toEqual([user1.id]);
    await expect(users.emailOption).not.toBeAttached();
    await expect(users.user(user1)).toBeVisible();
    await expect(users.user(user2)).not.toBeAttached();

    // # Backspace that 'a'
    await input.press('Backspace');

    // * Verify that both users are listed again
    await expect.poll(() => suggestedIds(users)).toEqual([user1.id, user2.id].sort());
    await expect(users.emailOption).not.toBeAttached();
    await expect(users.user(user1)).toBeVisible();
    await expect(users.user(user2)).toBeVisible();

    // # Type a 'b' to filter the results
    await input.press('b');

    // * Verify that only user2 is now listed
    await expect.poll(() => suggestedIds(users)).toEqual([user2.id]);
    await expect(users.emailOption).not.toBeAttached();
    await expect(users.user(user1)).not.toBeAttached();
    await expect(users.user(user2)).toBeVisible();
});

test('Invite modal autocomplete is not clipped vertically', async ({pw}) => {
    const {adminUser, team} = await pw.initSetup();
    const randomPrefix = pw.random.id(8);
    const created = await createPrefixedUsers(pw, randomPrefix, 8);

    const {invite, modal} = await openInvitePeopleModal(pw, adminUser, team);
    await invite.users.inputCombobox.type(randomPrefix);
    await expect(invite.users.inputCombobox).toHaveValue(randomPrefix);
    await expect(invite.users.userList).toHaveKeyCount(created.length);
    await expect(invite.users.emailOption).not.toBeAttached();

    const lastOption = await invite.users.userList.last();
    await expect(lastOption).toBeVisible();
    // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the CSS overflow of `.modal-content` is under test, and react-bootstrap renders that element, so GenericModal cannot give it a test id
    const modalContent = modal.locator.locator('.modal-content');
    const modalContentBox = await boxOf(modalContent);
    const lastOptionBox = await boxOf(lastOption.locator);
    expect(lastOptionBox.y + lastOptionBox.height).toBeGreaterThan(modalContentBox.y + modalContentBox.height);
    await expect(modalContent).toHaveCSS('overflow-x', 'visible');
    await expect(modalContent).toHaveCSS('overflow-y', 'visible');

    // Bounding boxes preserve the layout assertions; the driver has no geometry API.
    // * The suggestions reach below the dialog's Send button, i.e. past the dialog's own content
    const sendBox = await boxOf(invite.sendButton.locator);
    const sendBottom = sendBox.y + sendBox.height;
    const boxes = await Promise.all(created.map((user) => boxOf(invite.users.user(user).locator)));
    const below = boxes
        .map((box, i) => ({box, i}))
        .filter(({box}) => box.y + box.height > sendBottom)
        .sort((a, b) => a.box.y - b.box.y);
    expect(below.length).toBeGreaterThan(0);
    const firstBelow = below[0].i;

    // * ...and the dialog doesn't clip them: `toBeInViewport` uses IntersectionObserver, which applies the clipping
    // of overflowing ancestors. The first suggestion past the dialog's bottom is still on screen (later ones are
    // clipped by the list's own scroll, which the next test checks).
    await expect(invite.users.user(created[firstBelow])).toBeInViewport();
});

test('Invite modal results are visible outside the modal', async ({pw}) => {
    const {adminUser, team} = await pw.initSetup();

    // # Create enough users that the results will extend outside the modal until past when the result list is capped
    const randomPrefix = pw.random.id(8);
    const created = await createPrefixedUsers(pw, randomPrefix, 8);

    // # Open the Invite People modal and type the prefix to filter out other users
    const {invite} = await openInvitePeopleModal(pw, adminUser, team);
    await invite.users.inputCombobox.type(randomPrefix);
    await expect(invite.users.inputCombobox).toHaveValue(randomPrefix);

    // At time of writing, 4 results are fully visible, the next is partly visible, and the rest are clipped
    const visibleCount = 5;

    for (const [i, user] of created.entries()) {
        const option = invite.users.user(user);
        await expect(option).toBeVisible();
        if (i < visibleCount) {
            // * Verify that this user is in the list and on the screen
            await expect(option).toBeInViewport();
        } else {
            // * Verify that this user is in the list but off the screen
            await expect(option).not.toBeInViewport();
        }
    }
});

test('Invite modal remains width-constrained with long unbroken input', async ({pw}) => {
    const {adminUser, team} = await pw.initSetup();
    const {invite, modal} = await openInvitePeopleModal(pw, adminUser, team);

    // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the width and CSS overflow of `.modal-content` are under test, and react-bootstrap renders that element, so GenericModal cannot give it a test id
    const select = modal.locator.locator('.modal-content');
    const initialBox = await boxOf(select);

    await invite.users.inputCombobox.type(
        'averyveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryveryverylongunbrokeninviteinput@example.com',
    );
    await expect(invite.users.inputCombobox).toHaveValue(/longunbrokeninviteinput@example\.com$/);

    // * The people input (and with it the dialog) doesn't grow wider to fit the text
    const box = await boxOf(select);
    expect(Math.round(box.width)).toBeLessThanOrEqual(Math.ceil(initialBox.width));
    await expect(select).toHaveCSS('overflow-x', 'visible');
    await expect(select).toHaveCSS('overflow-y', 'visible');
    await expect(invite.sendButton).toBeInViewport();
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

    // # Open the Invite People modal and type the prefix to filter out other users
    const {app, invite} = await openInvitePeopleModal(pw, adminUser, team);
    await invite.users.inputCombobox.type(randomPrefix);
    await expect(invite.users.inputCombobox).toHaveValue(randomPrefix);

    // * Verify that the user appears in the results initially
    await expect.poll(() => suggestedIds(invite.users)).toEqual([user.id]);
    await expect(invite.users.emailOption).not.toBeAttached();
    await expect(invite.users.user(user)).toBeVisible();

    // # Type all 3 keys that form a single Hangul character
    const client = await app.page.context().newCDPSession(app.page);
    await typeHangulCharacterWithIme(client, decomposeKorean(koreanTestPhrase)[0], undefined);

    // * Verify that the user is still listed
    await expect.poll(() => suggestedIds(invite.users)).toEqual([user.id]);
    await expect(invite.users.emailOption).not.toBeAttached();
    await expect(invite.users.user(user)).toBeVisible();

    await client.detach();
});
