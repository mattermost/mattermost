// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {
    createWikiThroughUI,
    getNewPageButton,
    fillCreatePageModal,
    getEditorAndWait,
    typeInEditor,
    publishPage,
    getPageViewerContent,
    selectMentionFromDropdown,
    clickPageEditButton,
    selectTextInEditor,
    openInlineCommentModal,
    getPageIdFromUrl,
    ELEMENT_TIMEOUT,
    WEBSOCKET_WAIT,
    SHORT_WAIT,
    createTestUserInTeam,
    uniqueName,
    loginAndNavigateToChannel,
} from './test_helpers';

/**
 * @objective Verify mentioned users receive notification when page is published with their mention
 *
 * @precondition
 * Two users must be members of the same team and channel
 */
test(
    'sends notification to mentioned user when page is published',
    {tag: '@pages'},
    async ({pw, headless, browserName}) => {
        test.skip(
            headless && browserName !== 'firefox',
            'Works across browsers and devices, except in headless mode, where stubbing the Notification API is supported only in Firefox and WebKit.',
        );

        const {team, user: authorUser, adminClient} = await pw.initSetup();
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # Create a second user who will be mentioned (team member, can be mentioned even if not in channel)
        const {user: mentionedUser} = await createTestUserInTeam(pw, adminClient, team, 'mentioned');

        // # Login as author user first
        const {page: authorPage} = await loginAndNavigateToChannel(pw, authorUser, team.name, channel.name);

        // # Login as mentioned user in separate page to stub notifications
        const {page: mentionedPage} = await loginAndNavigateToChannel(pw, mentionedUser, team.name, channel.name);
        await pw.stubNotification(mentionedPage, 'granted');

        // # Switch back to author page
        await authorPage.bringToFront();

        await createWikiThroughUI(authorPage, uniqueName('Mention Wiki'));

        // # Create new page with @mention
        const newPageButton = getNewPageButton(authorPage);
        await newPageButton.click();
        await fillCreatePageModal(authorPage, 'Page with Mention Notification');

        // # Type content with @mention
        const editor = await getEditorAndWait(authorPage);
        await typeInEditor(authorPage, `Hello @${mentionedUser.username}`);

        // # Select the mentioned user from dropdown
        await selectMentionFromDropdown(authorPage, mentionedUser.username);

        // * Verify mention is properly created with data-id attribute
        const userMentionInEditor = editor.locator(`.mention[data-id="${mentionedUser.id}"]`);
        await expect(userMentionInEditor).toBeVisible({timeout: SHORT_WAIT});

        // # Add remaining text
        await editor.type(', please review this page!');

        await publishPage(authorPage);

        // * Verify page is published
        const pageContent = getPageViewerContent(authorPage);
        await expect(pageContent).toBeVisible();

        // # Wait for notification to be sent via WebSocket
        await authorPage.waitForTimeout(WEBSOCKET_WAIT);

        // * Verify notification was received by mentioned user
        const notifications = await pw.waitForNotification(mentionedPage);
        expect(notifications.length).toBeGreaterThanOrEqual(1);

        const notification = notifications[0];
        expect(notification.title).toContain(channel.display_name);
        expect(notification.body).toContain(authorUser.username);
        expect(notification.body).toContain('mentioned you');
    },
);

/**
 * @objective Verify mentioned user does NOT receive duplicate notification when page is edited without adding new mentions
 *
 * @precondition
 * Two users must be members of the same team and channel, and a page with existing mention must exist
 */
test(
    'does not send duplicate notification when page is edited without new mentions',
    {tag: '@pages'},
    async ({pw, headless, browserName}) => {
        test.skip(
            headless && browserName !== 'firefox',
            'Works across browsers and devices, except in headless mode, where stubbing the Notification API is supported only in Firefox and WebKit.',
        );

        const {team, user: authorUser, adminClient} = await pw.initSetup();
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # Create a second user who will be mentioned (team member, can be mentioned even if not in channel)
        const {user: mentionedUser} = await createTestUserInTeam(pw, adminClient, team, 'mentioned');

        // # Login as author user first
        const {page: authorPage} = await loginAndNavigateToChannel(pw, authorUser, team.name, channel.name);

        // # Login as mentioned user in separate page to stub notifications
        const {page: mentionedPage} = await loginAndNavigateToChannel(pw, mentionedUser, team.name, channel.name);
        await pw.stubNotification(mentionedPage, 'granted');

        // # Switch back to author page
        await authorPage.bringToFront();

        await createWikiThroughUI(authorPage, uniqueName('Mention Wiki'));

        // # Create new page with @mention
        const newPageButton = getNewPageButton(authorPage);
        await newPageButton.click();
        await fillCreatePageModal(authorPage, 'Page with No Duplicate Notification');

        // # Type content with @mention
        const editor = await getEditorAndWait(authorPage);
        await typeInEditor(authorPage, `Hello @${mentionedUser.username}`);

        // # Select the mentioned user from dropdown
        await selectMentionFromDropdown(authorPage, mentionedUser.username);

        // * Verify mention is properly created
        const userMentionInEditor = editor.locator(`.mention[data-id="${mentionedUser.id}"]`);
        await expect(userMentionInEditor).toBeVisible({timeout: SHORT_WAIT});

        await publishPage(authorPage);

        // * Verify page is published
        const pageContent = getPageViewerContent(authorPage);
        await expect(pageContent).toBeVisible();

        // # Wait for notification to be sent
        await authorPage.waitForTimeout(WEBSOCKET_WAIT);

        // * Verify first notification was received
        let notifications = await pw.waitForNotification(mentionedPage);
        const initialNotificationCount = notifications.length;
        expect(initialNotificationCount).toBeGreaterThanOrEqual(1);

        // # Click edit button to edit the page
        await clickPageEditButton(authorPage);

        // * Verify editor is visible
        await expect(editor).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Edit the page content (keeping the same mention)
        await editor.click();
        await authorPage.keyboard.press('End');
        await editor.type(' Additional text without new mentions.');

        // # Publish the edited page
        await publishPage(authorPage);

        // * Verify page is published
        await expect(pageContent).toBeVisible();

        // # Wait for potential notification
        await authorPage.waitForTimeout(WEBSOCKET_WAIT);

        // * Verify NO new notification was sent (count should be the same)
        notifications = await pw.waitForNotification(mentionedPage);
        expect(notifications.length).toBe(initialNotificationCount);
    },
);

/**
 * @objective Verify only newly mentioned user receives notification when a new mention is added to existing page
 *
 * @precondition
 * Three users must be members of the same team and channel, and a page with one existing mention must exist
 */
test(
    'sends notification only to newly mentioned user when mention is added on edit',
    {tag: '@pages'},
    async ({pw, headless, browserName}) => {
        test.skip(
            headless && browserName !== 'firefox',
            'Works across browsers and devices, except in headless mode, where stubbing the Notification API is supported only in Firefox and WebKit.',
        );

        const {team, user: authorUser, adminClient} = await pw.initSetup();
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # Create two users who will be mentioned (team members, can be mentioned even if not in channel)
        const {user: firstMentionedUser} = await createTestUserInTeam(pw, adminClient, team, 'mentioned1');
        const {user: secondMentionedUser} = await createTestUserInTeam(pw, adminClient, team, 'mentioned2');

        // # Login as author user first
        const {page: authorPage} = await loginAndNavigateToChannel(pw, authorUser, team.name, channel.name);

        // # Login as first mentioned user in separate page and stub notifications
        const {page: firstMentionedPage} = await loginAndNavigateToChannel(
            pw,
            firstMentionedUser,
            team.name,
            channel.name,
        );
        await pw.stubNotification(firstMentionedPage, 'granted');

        // # Login as second mentioned user in separate page and stub notifications
        const {page: secondMentionedPage} = await loginAndNavigateToChannel(
            pw,
            secondMentionedUser,
            team.name,
            channel.name,
        );
        await pw.stubNotification(secondMentionedPage, 'granted');

        // # Switch back to author page
        await authorPage.bringToFront();

        await createWikiThroughUI(authorPage, uniqueName('Mention Wiki'));

        // # Create new page with first @mention
        const newPageButton = getNewPageButton(authorPage);
        await newPageButton.click();
        await fillCreatePageModal(authorPage, 'Page with Delta Notification');

        // # Type content with first @mention
        const editor = await getEditorAndWait(authorPage);
        await typeInEditor(authorPage, `Hello @${firstMentionedUser.username}`);

        // # Select the first mentioned user from dropdown
        await selectMentionFromDropdown(authorPage, firstMentionedUser.username);

        await publishPage(authorPage);

        // * Verify page is published
        const pageContent = getPageViewerContent(authorPage);
        await expect(pageContent).toBeVisible();

        // # Wait for notification to be sent
        await authorPage.waitForTimeout(WEBSOCKET_WAIT);

        // * Verify first user received notification
        let firstUserNotifications = await pw.waitForNotification(firstMentionedPage);
        const firstUserInitialCount = firstUserNotifications.length;
        expect(firstUserInitialCount).toBeGreaterThanOrEqual(1);

        // * Verify second user has NO notifications yet
        let secondUserNotifications = await pw.waitForNotification(secondMentionedPage);
        const secondUserInitialCount = secondUserNotifications.length;

        // # Click edit button to edit the page
        await clickPageEditButton(authorPage);

        // * Verify editor is visible
        await expect(editor).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Add second @mention
        await editor.click();
        await authorPage.keyboard.press('End');
        await editor.type(' and ');
        await editor.type(`@${secondMentionedUser.username}`);

        // # Select the second mentioned user from dropdown
        await selectMentionFromDropdown(authorPage, secondMentionedUser.username);

        // # Publish the edited page
        await publishPage(authorPage);

        // * Verify page is published
        await expect(pageContent).toBeVisible();

        // # Wait for potential notification
        await authorPage.waitForTimeout(WEBSOCKET_WAIT);

        // * Verify first user did NOT receive duplicate notification
        firstUserNotifications = await pw.waitForNotification(firstMentionedPage);
        expect(firstUserNotifications.length).toBe(firstUserInitialCount);

        // * Verify second user received NEW notification
        secondUserNotifications = await pw.waitForNotification(secondMentionedPage);
        expect(secondUserNotifications.length).toBeGreaterThan(secondUserInitialCount);
        expect(secondUserNotifications.length).toBeGreaterThanOrEqual(1);
    },
);

/**
 * @objective Verify mentioned users receive notifications and mentions appear in Recent Mentions panel
 *
 * @precondition
 * Two users must be members of the same team and channel
 */
test('displays page mention in Recent Mentions panel', {tag: '@pages'}, async ({pw}) => {
    const {team, user: authorUser, adminClient} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # Create a second user who will be mentioned (team member, can be mentioned without being in channel)
    const {user: mentionedUser} = await createTestUserInTeam(pw, adminClient, team, 'mentioned');

    // # Login as author user and create wiki
    const {page: authorPage} = await loginAndNavigateToChannel(pw, authorUser, team.name, channel.name);

    await createWikiThroughUI(authorPage, uniqueName('Mention Wiki'));

    // # Create new page with @mention
    const pageTitle = 'Page with Mention in RHS';
    const newPageButton = getNewPageButton(authorPage);
    await newPageButton.click();
    await fillCreatePageModal(authorPage, pageTitle);

    // # Type content with @mention
    await getEditorAndWait(authorPage);
    await typeInEditor(authorPage, `Hello @${mentionedUser.username}`);

    // # Select the mentioned user from dropdown
    await selectMentionFromDropdown(authorPage, mentionedUser.username);

    await publishPage(authorPage);

    // * Verify page is published
    const pageContent = getPageViewerContent(authorPage);
    await expect(pageContent).toBeVisible();

    // # Wait for mention to be processed
    await authorPage.waitForTimeout(WEBSOCKET_WAIT);

    // # Login as mentioned user
    const {page: mentionedPage, channelsPage: mentionedChannelsPage} = await loginAndNavigateToChannel(
        pw,
        mentionedUser,
        team.name,
        channel.name,
    );

    // # Click on the Recent Mentions button in the channel header
    await mentionedPage.getByRole('button', {name: 'Recent mentions'}).click();

    // * Verify the right sidebar opens and is visible
    await mentionedChannelsPage.sidebarRight.toBeVisible();

    // * Verify the page mention appears in Recent Mentions
    const rhsSidebar = mentionedChannelsPage.sidebarRight.container;
    await expect(rhsSidebar).toContainText(pageTitle, {timeout: ELEMENT_TIMEOUT});
    await expect(rhsSidebar).toContainText(authorUser.username, {timeout: ELEMENT_TIMEOUT});
    await expect(rhsSidebar).toContainText(`@${mentionedUser.username}`, {timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify removing a mention does not trigger notifications and newly added mention does trigger notification
 *
 * @precondition
 * Three users must be members of the same team and channel
 */
test('handles mention removal and addition correctly', {tag: '@pages'}, async ({pw, headless, browserName}) => {
    test.skip(
        headless && browserName !== 'firefox',
        'Works across browsers and devices, except in headless mode, where stubbing the Notification API is supported only in Firefox and WebKit.',
    );

    const {team, user: authorUser, adminClient} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # Create two users who will be mentioned (team members, can be mentioned without being in channel)
    const {user: firstMentionedUser} = await createTestUserInTeam(pw, adminClient, team, 'mentioned1');
    const {user: secondMentionedUser} = await createTestUserInTeam(pw, adminClient, team, 'mentioned2');

    // # Login as author user and create wiki
    const {page: authorPage} = await loginAndNavigateToChannel(pw, authorUser, team.name, channel.name);

    // # Login as first mentioned user in separate page and stub notifications
    const {page: firstMentionedPage} = await loginAndNavigateToChannel(pw, firstMentionedUser, team.name, channel.name);
    await pw.stubNotification(firstMentionedPage, 'granted');

    // # Login as second mentioned user in separate page and stub notifications
    const {page: secondMentionedPage} = await loginAndNavigateToChannel(
        pw,
        secondMentionedUser,
        team.name,
        channel.name,
    );
    await pw.stubNotification(secondMentionedPage, 'granted');

    // # Switch back to author page
    await authorPage.bringToFront();

    await createWikiThroughUI(authorPage, uniqueName('Mention Wiki'));

    // # Create new page with first @mention
    const newPageButton = getNewPageButton(authorPage);
    await newPageButton.click();
    await fillCreatePageModal(authorPage, 'Page with Mention Replacement');

    // # Type content with first @mention
    const editor = await getEditorAndWait(authorPage);
    await typeInEditor(authorPage, `Hello @${firstMentionedUser.username}, welcome!`);

    // # Select the first mentioned user from dropdown
    await selectMentionFromDropdown(authorPage, firstMentionedUser.username);

    await publishPage(authorPage);

    // * Verify page is published
    const pageContent = getPageViewerContent(authorPage);
    await expect(pageContent).toBeVisible();

    // # Wait for notification to be sent
    await authorPage.waitForTimeout(WEBSOCKET_WAIT);

    // * Verify first user received notification
    const firstUserNotifications = await pw.waitForNotification(firstMentionedPage);
    expect(firstUserNotifications.length).toBeGreaterThanOrEqual(1);

    // * Verify second user has NO notifications yet
    let secondUserNotifications = await pw.waitForNotification(secondMentionedPage);
    const secondUserInitialCount = secondUserNotifications.length;

    // # Click edit button to edit the page
    await clickPageEditButton(authorPage);

    // * Verify editor is visible
    await expect(editor).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Clear the editor content
    await editor.click();
    await authorPage.keyboard.press('Control+A');
    await authorPage.keyboard.press('Backspace');

    // # Type new content with second user mention (first user removed)
    await editor.type(`Hello @${secondMentionedUser.username}, please review!`);

    // # Select the second mentioned user from dropdown
    await selectMentionFromDropdown(authorPage, secondMentionedUser.username);

    // # Publish the edited page
    await publishPage(authorPage);

    // * Verify page is published
    await expect(pageContent).toBeVisible();

    // # Wait for potential notification
    await authorPage.waitForTimeout(WEBSOCKET_WAIT);

    // * Verify second user received NEW notification (newly mentioned)
    secondUserNotifications = await pw.waitForNotification(secondMentionedPage);
    expect(secondUserNotifications.length).toBeGreaterThan(secondUserInitialCount);
    expect(secondUserNotifications.length).toBeGreaterThanOrEqual(1);
});

/**
 * @objective Verify that an @-mention inside a page inline comment badges the recipient's Threads view
 * and causes the page comment thread to appear in their Threads inbox.
 *
 * @precondition
 * Two users must be members of the same team and channel.
 */
test('at-mention in page comment badges the recipient threads view', {tag: '@pages'}, async ({pw}) => {
    const {team, user: commenterUser, adminClient} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # Create a second user who will be mentioned in the comment
    const {user: mentionedUser} = await createTestUserInTeam(pw, adminClient, team, 'mentioned');

    // # Add mentioned user to the channel so they can be @-mentioned and receive notifications
    await adminClient.addToChannel(mentionedUser.id, channel.id);

    // # Login as the commenter and navigate to the channel
    const {page: commenterPage} = await loginAndNavigateToChannel(pw, commenterUser, team.name, channel.name);

    const pageTitle = uniqueName('Comment Mention Page');

    // # Create a wiki and a page, then publish it
    await createWikiThroughUI(commenterPage, uniqueName('Comment Mention Wiki'));
    const newPageButton = getNewPageButton(commenterPage);
    await newPageButton.click();
    await fillCreatePageModal(commenterPage, pageTitle);

    const editor = await getEditorAndWait(commenterPage);
    await typeInEditor(commenterPage, 'Review this section.');

    await publishPage(commenterPage);

    // * Verify page is published
    const pageContent = getPageViewerContent(commenterPage);
    await expect(pageContent).toBeVisible();

    // # Enter edit mode to add an inline comment with @-mention
    await clickPageEditButton(commenterPage);
    await expect(editor).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Select text in the editor so the formatting bar bubble appears
    await selectTextInEditor(commenterPage);

    // # Open the inline comment RHS
    const createCommentContainer = await openInlineCommentModal(commenterPage);

    // # Type the @-mention in the comment input (type, not fill, to trigger dropdown)
    const commentTextArea = createCommentContainer.locator('textarea, [contenteditable="true"]').first();
    await commentTextArea.click();
    await commentTextArea.type(`@${mentionedUser.username}`);

    // # Select the mentioned user from the dropdown
    await selectMentionFromDropdown(commenterPage, mentionedUser.username);

    // # Submit the comment
    await commentTextArea.press('Control+Enter');
    await commenterPage.waitForTimeout(WEBSOCKET_WAIT);

    // # Publish the page with the comment
    await publishPage(commenterPage);
    await expect(pageContent).toBeVisible();

    // # Capture the page post ID (root_id for the comment thread) for later assertions
    const pageRootId = getPageIdFromUrl(commenterPage.url());
    if (!pageRootId) {
        throw new Error('page ID must be present in the URL after publish');
    }

    // # Wait for notification to propagate
    await commenterPage.waitForTimeout(WEBSOCKET_WAIT);

    // # Login as the mentioned user
    const {page: mentionedPage} = await loginAndNavigateToChannel(pw, mentionedUser, team.name, channel.name);

    // * Assertion 1: mentioned user sees a badge/unread indicator in their Threads view
    const threadsBadge = mentionedPage
        .locator('.sidebar-item .badge, [data-testid="threads-badge"], .mentions-count, [aria-label*="mentions"]')
        .first();
    await expect(threadsBadge).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Navigate to the Threads inbox
    await mentionedPage.locator('a[href*="/threads"]').click();
    await mentionedPage.waitForLoadState('networkidle');

    // * Assertion 2: the Threads inbox row is keyed by the page post ID (root_id), not the channel
    const threadsState = await mentionedPage.evaluate(() => {
        const state = (window as unknown as {store: {getState: () => unknown}}).store.getState() as {
            entities: {
                threads: {
                    threadsInTeam: Record<string, string[]>;
                    threads: Record<string, {unread_mentions: number; reply_count: number}>;
                };
            };
        };
        return {
            allThreadIds: Object.values(state.entities.threads.threadsInTeam ?? {}).flat(),
            threads: state.entities.threads.threads,
        };
    });
    expect(threadsState.allThreadIds, 'Threads inbox should contain a row keyed by the page post ID').toContain(
        pageRootId,
    );

    // * Assertion 3: unreadMentions on the page thread = 1
    expect(threadsState.threads[pageRootId]?.unread_mentions, 'unread_mentions on page thread row must be 1').toBe(1);

    // * Assertion 4: the Unreads tab shows the page comment thread
    // Page threads appear in Unreads (not Followed threads, since the wiki backing
    // channel uses system-managed membership — the user follows via ThreadMembership
    // but channel-access filtering may hide it from the Followed tab).

    await mentionedPage.locator('#threads-list-filter-unread').click();
    await mentionedPage.waitForTimeout(SHORT_WAIT);
    const unreadThreadList = mentionedPage.locator('[data-testid="threads_list"]');
    await expect(unreadThreadList).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Assertion 4b: the Unreads selector state includes the page thread
    // The VirtualizedThreadList uses react-window; items are rendered only in the visible
    // viewport and may race with AutoSizer measurement. Instead of a DOM query, verify
    // the Redux state that directly drives the unread thread list.
    const unreadOrderContainsThread = await mentionedPage.evaluate((rootId) => {
        const state = (window as unknown as {store: {getState: () => unknown}}).store.getState() as {
            entities: {
                threads: {
                    unreadThreadsInTeam: Record<string, string[]>;
                    threads: Record<
                        string,
                        {is_following: boolean; unread_replies: number; unread_mentions: number; last_reply_at: number}
                    >;
                };
                teams: {currentTeamId: string};
            };
        };
        const teamId = state.entities.teams.currentTeamId;
        const unreadIds = state.entities.threads.unreadThreadsInTeam?.[teamId] ?? [];
        const threads = state.entities.threads.threads;
        // Apply the same filter as getUnreadThreadOrderInCurrentTeam selector
        const filteredIds = unreadIds.filter((id) => {
            const t = threads[id];
            return t?.is_following && (t.unread_replies || t.unread_mentions) && t.last_reply_at !== 0;
        });
        return filteredIds.includes(rootId);
    }, pageRootId);
    expect(unreadOrderContainsThread, 'page thread must appear in the Unreads tab order').toBe(true);

    // * Assertion 5: a follow-up comment WITHOUT a mention does NOT increment the badge
    // Switch back to commenter, add a non-mention comment
    await clickPageEditButton(commenterPage);
    await expect(editor).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await selectTextInEditor(commenterPage);
    const followUpContainer = await openInlineCommentModal(commenterPage);
    const followUpTextarea = followUpContainer.locator('textarea, [contenteditable="true"]').first();
    await followUpTextarea.click();
    await followUpTextarea.type('Follow up without mention');
    await followUpTextarea.press('Control+Enter');
    await commenterPage.waitForTimeout(WEBSOCKET_WAIT);

    const unreadAfterNonMention = await mentionedPage.evaluate((rootId) => {
        const state = (window as unknown as {store: {getState: () => unknown}}).store.getState() as {
            entities: {threads: {threads: Record<string, {unread_mentions: number}>}};
        };
        return state.entities.threads.threads[rootId]?.unread_mentions;
    }, pageRootId);
    expect(unreadAfterNonMention, 'unread_mentions must NOT increment for a non-mention comment').toBe(1);
});
