// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * Verify that profile popover shows correct user information based on privacy settings
 * and continues to show correct information after at-mention autocomplete is used.
 *
 * Precondition:
 * 1. A test server configured with privacy settings to hide email and full name
 * 2. Two user accounts, with one user able to see their own information
 */
test('Profile popover should show correct fields after at-mention autocomplete @user_profile', async ({pw}) => {
    test.setTimeout(120000);
    // Initialize with user's privacy settings set to hide email and full name
    const {user, adminClient, team} = await pw.initSetup();
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

    // Create and add another user using admin client
    const testUser2 = await adminClient.createUser(await pw.random.user('other'), '', '');
    await adminClient.addToTeam(team.id, testUser2.id);

    // 1. Login as the first user
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // 2. Post a message with mentions of both users
    await channelsPage.postMessage(`@${user.username} @${testUser2.username}`);

    // 3. Open profile popover for the current user on first
    const lastPost = await channelsPage.getLastPost();
    await expect(lastPost.container).toContainText(`@${user.username}`);
    await expect(lastPost.container).toContainText(`@${testUser2.username}`);
    const firstMention = await lastPost.container.getByText(`@${user.username}`, {exact: true});
    await firstMention.click();
    const currentUserProfilePopover = channelsPage.userProfilePopover;

    // * Verify all fields are visible for current user in the profile popover
    await expect(currentUserProfilePopover.container.getByText(`@${user.username}`)).toBeVisible();
    await expect(currentUserProfilePopover.container.getByText(`${user.first_name} ${user.last_name}`)).toBeVisible();
    await expect(currentUserProfilePopover.container.getByText(user.email)).toBeVisible();

    // 4. Close the current user's profile popover
    await currentUserProfilePopover.close();

    // 5. Open profile popover for the other user on second mention.
    // Re-apply privacy settings in case a concurrent initSetup() reset them,
    // then wait until the server confirms the value before proceeding.
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

    // Reload the page so the browser fetches the new config synchronously.
    // waitUntil above only confirms the server-side state; the browser updates its
    // Redux store via WebSocket (CONFIG_CHANGED event) which can lag significantly.
    // A full page reload forces a fresh /api/v4/config/client fetch, so the privacy
    // settings are guaranteed to be in effect before we render any popover.
    await channelsPage.page.reload();
    await channelsPage.toBeVisible();

    // Re-locate the post after reload (DOM was replaced)
    const lastPostAfterReload = await channelsPage.getLastPost();
    await expect(lastPostAfterReload.container).toContainText(`@${testUser2.username}`);
    const secondMention = lastPostAfterReload.container.getByText(`@${testUser2.username}`, {exact: true});
    await secondMention.click();
    const otherUserProfilePopover = channelsPage.userProfilePopover;

    // * Verify only username is visible for other user in the profile popover
    await expect(otherUserProfilePopover.container.getByText(`@${testUser2.username}`)).toBeVisible();
    await expect(otherUserProfilePopover.container.getByText(testUser2.email)).not.toBeVisible();

    // 6. Close the other user's profile popover
    await otherUserProfilePopover.close();

    // 7. Start typing an at-mention to trigger autocomplete suggestion
    await channelsPage.centerView.postCreate.writeMessage(`@${user.username}`);

    // * Verify autocomplete suggestion appears
    const suggestionList = channelsPage.centerView.postCreate.suggestionList;
    await expect(suggestionList.getByText(`@${user.username}`)).toBeVisible();

    // 8. Clear the message box and wait for the autocomplete overlay to fully
    // disappear before interacting with the post — the overlay can otherwise
    // block hover/click events on the message area and cause a flaky failure.
    await channelsPage.centerView.postCreate.writeMessage('');
    await expect(suggestionList).toBeHidden({timeout: 5000});

    // 9. Open profile popover by clicking the @mention text directly (same
    // approach as steps 3-4) — more reliable than openProfilePopover() which
    // uses a hover-then-click sequence that the overlay can intercept.
    const currentUserMention = lastPostAfterReload.container.getByText(`@${user.username}`, {exact: true});
    await currentUserMention.click();
    const profilePopoverAgain = channelsPage.userProfilePopover;

    // * Verify all fields are still visible
    await expect(profilePopoverAgain.container.getByText(`@${user.username}`)).toBeVisible();
    await expect(profilePopoverAgain.container.getByText(`${user.first_name} ${user.last_name}`)).toBeVisible();
    await expect(profilePopoverAgain.container.getByText(user.email)).toBeVisible();
});
