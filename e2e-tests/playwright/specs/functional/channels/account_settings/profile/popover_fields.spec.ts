// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {Api, expect, settle, test, type App, duration} from '@mattermost/playwright-lib';

/** Opens the profile popover from the user's mention in the post, and returns it. */
async function openFromMention(app: App, postId: string, user: Pick<UserProfile, 'id'>) {
    await app.center.postList.post({id: postId}).markdown.mention(user).click();
    await expect(app.profilePopover).toBeVisible();
    return app.profilePopover;
}

/** Closes the open profile popover with Escape. */
async function closePopover(app: App) {
    await app.page.keyboard.press('Escape');
    await expect(app.profilePopover).not.toBeVisible();
}

/**
 * Verify that profile popover shows correct user information based on privacy settings
 * and continues to show correct information after at-mention autocomplete is used.
 *
 * Precondition:
 * 1. A test server configured with privacy settings to hide email and full name
 * 2. Two user accounts, with one user able to see their own information
 */
test('Profile popover should show correct fields after at-mention autocomplete @user_profile', async ({pw}) => {
    test.setTimeout(duration.two_min);
    // Initialize with user's privacy settings set to hide email and full name
    const {user, adminClient, team, townSquare} = await pw.initSetup();
    const hidePrivateFields = async () => {
        await adminClient.patchConfig({
            PrivacySettings: {
                ShowEmailAddress: false,
                ShowFullName: false,
            },
        });
        await pw.waitUntil(async () => {
            const cfg = await adminClient.getConfig();
            return cfg.PrivacySettings?.ShowEmailAddress === false && cfg.PrivacySettings?.ShowFullName === false;
        });
    };
    await hidePrivateFields();

    // Create and add another user using admin client
    const testUser2 = await adminClient.createUser(await pw.random.user('other'), '', '');
    await adminClient.addToTeam(team.id, testUser2.id);

    // 1. Login as the first user
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: townSquare});

    // 2. Post a message with mentions of both users
    const message = `@${user.username} @${testUser2.username}`;
    await app.center.postCreate.message.container.fill(`${message} `);
    const {id: postId} = await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();
    await expect(app.center.postList.post({id: postId}).message.container).toContainText(message);

    // 3. Open profile popover for the current user on first mention
    let popover = await openFromMention(app, postId, user);

    // * Verify all fields are visible for current user in the profile popover
    await expect(popover.usernameText).toHaveText(`@${user.username}`);
    await expect(popover.fullNameText).toContainText(`${user.first_name} ${user.last_name}`);
    await expect(popover.emailLink).toHaveText(user.email);

    // 4. Close the current user's profile popover
    await closePopover(app);

    // 5. Open profile popover for the other user on second mention.
    // Re-apply privacy settings in case a concurrent initSetup() reset them,
    // then wait until the server confirms the value before proceeding.
    await hidePrivateFields();

    // Reload the page so the browser fetches the new config synchronously.
    // waitUntil above only confirms the server-side state; the browser updates its
    // Redux store via WebSocket (CONFIG_CHANGED event) which can lag significantly.
    // A full page reload forces a fresh /api/v4/config/client fetch, so the privacy
    // settings are guaranteed to be in effect before we render any popover.
    await app.page.reload();
    await expect(app.center.postCreate.message).toBeVisible();
    popover = await openFromMention(app, postId, testUser2);

    // * Verify only username is visible for other user in the profile popover
    await expect(popover.usernameText).toHaveText(`@${testUser2.username}`);
    await expect(popover.emailLink).not.toBeVisible();

    // 6. Close the other user's profile popover
    await closePopover(app);

    // # Type an at-mention so autocomplete searches on each keystroke
    const textbox = app.center.postCreate.message.container.locator;
    await textbox.pressSequentially(`@${user.username}`);

    // * Verify autocomplete suggestion appears
    const suggestions = app.center.postCreate.message.suggestions;
    await expect(suggestions.suggestion(`@${user.username}`)).toBeVisible();

    // 8. Clear the message box and wait for the autocomplete overlay to fully
    // disappear before interacting with the post — the overlay can otherwise
    // block hover/click events on the message area and cause a flaky failure.
    await textbox.fill('');
    await expect(suggestions.suggestionList).toHaveKeyCount(0);

    // 9. Open profile popover by clicking the @mention text directly (same
    // approach as steps 3-4)
    popover = await openFromMention(app, postId, user);

    // * Verify all fields are still visible
    await expect(popover.usernameText).toHaveText(`@${user.username}`);
    await expect(popover.fullNameText).toContainText(`${user.first_name} ${user.last_name}`);
    await expect(popover.emailLink).toHaveText(user.email);
});
