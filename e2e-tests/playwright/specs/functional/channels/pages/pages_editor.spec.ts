// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import {expect, test} from './pages_test_fixture';
import {
    buildChannelUrl,
    createTestChannel,
    createTestUserInTeam,
    createWikiThroughUI,
    createPageThroughUI,
    createChildPageThroughContextMenu,
    getNewPageButton,
    getPageViewerContent,
    openPageLinkModal,
    openPageLinkModalViaButton,
    openSlashCommandMenu,
    waitForPageInHierarchy,
    fillCreatePageModal,
    typeInEditor,
    publishPage,
    getEditorAndWait,
    selectTextInEditor,
    clickPageEditButton,
    loginAndNavigateToChannel,
    uniqueName,
    AUTOSAVE_WAIT,
    SHORT_WAIT,
    EDITOR_LOAD_WAIT,
    ELEMENT_TIMEOUT,
    HIERARCHY_TIMEOUT,
    WEBSOCKET_WAIT,
    PAGE_LOAD_TIMEOUT,
    UI_MICRO_WAIT,
    pressModifierKey,
} from './test_helpers';

/**
 * @objective Verify editor handles large content correctly
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 */
test('handles large content correctly', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Large Content Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Large Page Test');

    // # Wait for editor to be visible
    const editor = await getEditorAndWait(page);

    // # Generate large content (~50,000 characters)
    const largeContent = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(1000);

    // # Paste large content into TipTap editor (uses clipboard to ensure TipTap tracks changes)
    await editor.click();

    // Trigger paste event with large content (TipTap will handle this properly)
    await page.evaluate((content) => {
        const editorElement = document.querySelector('.ProseMirror');
        if (editorElement) {
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', content);
            const pasteEvent = new ClipboardEvent('paste', {
                clipboardData: dataTransfer,
                bubbles: true,
                cancelable: true,
            });
            editorElement.dispatchEvent(pasteEvent);
        }
    }, largeContent);

    // * Verify editor remains responsive with large content
    await expect(editor).toContainText('Lorem ipsum', {timeout: SHORT_WAIT});

    // # Verify editor remains responsive - add more text at the end
    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Additional text to verify responsiveness');

    // * Verify new text was added successfully
    await expect(editor).toContainText('Additional text to verify responsiveness');

    // # Publish large page
    await publishPage(page);

    // * Verify publish succeeds
    await page.waitForLoadState('networkidle', {timeout: PAGE_LOAD_TIMEOUT});

    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toBeVisible();
    await expect(pageContent).toContainText('Lorem ipsum');
});

/**
 * @objective Verify editor handles Unicode and special characters correctly
 */
test('handles Unicode and special characters correctly', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Unicode Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Unicode Test Page');

    // # Wait for editor to be visible
    const editor = await getEditorAndWait(page);

    // # Type various Unicode characters
    const unicodeContent = 'English, 中文, العربية, עברית, 日本語, 🚀 🎉 ✨, ©®™, ±≤≥≠';

    await typeInEditor(page, unicodeContent);

    // * Verify all characters display correctly
    await expect(editor).toContainText('中文');
    await expect(editor).toContainText('العربية');
    await expect(editor).toContainText('🚀');
    await expect(editor).toContainText('日本語');

    // # Publish
    await publishPage(page);

    await page.waitForLoadState('networkidle');

    // * Verify persistence
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toBeVisible();
    await expect(pageContent).toContainText(unicodeContent);

    // # Refresh page and verify Unicode preserved
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(pageContent).toContainText('中文');
    await expect(pageContent).toContainText('🚀');
    await expect(pageContent).toContainText('العربية');

    // # Test editing Unicode content
    await clickPageEditButton(page);

    const editorAfter = await getEditorAndWait(page);
    await expect(editorAfter).toContainText(unicodeContent);

    // Add more Unicode
    await editorAfter.click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('More: ñ, ü, ö, ä, Ø, Å');

    await publishPage(page);
    await page.waitForLoadState('networkidle');

    // * Verify additional Unicode persisted
    await expect(pageContent).toContainText('ñ, ü, ö');
});

/**
 * @objective Verify @user mentions work correctly in editor
 */
test('handles @user mentions in editor', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # Create another user to mention
    const {user: mentionedUser} = await createTestUserInTeam(pw, adminClient, team, 'mentioned');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Mention Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Mention Test Page');

    // # Wait for editor to be visible
    const editor = await getEditorAndWait(page);

    // # Type @ mention in editor
    await editor.click();
    await editor.type(`Hello @${mentionedUser.username}`);

    // * Verify mention suggestion dropdown appears
    const mentionDropdown = page.locator('.tiptap-mention-popup').first();
    await expect(mentionDropdown).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Select the mentioned user from dropdown
    const userOption = page.locator(`[data-testid="mentionSuggestion_${mentionedUser.username}"]`).first();
    await expect(userOption).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await userOption.click();

    // * Verify mention is properly created with data-id attribute
    const userMentionInEditor = editor.locator(`.mention[data-id="${mentionedUser.id}"]`);
    await expect(userMentionInEditor).toBeVisible({timeout: SHORT_WAIT});

    const editorContent = await editor.textContent();
    expect(editorContent).toContain(mentionedUser.username);

    // # Publish
    await publishPage(page);
    await page.waitForLoadState('networkidle');

    // * Verify mention persists after publish
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toBeVisible();
    await expect(pageContent).toContainText(mentionedUser.username);

    // * Verify mention element with data-id attribute is properly rendered
    const userMention = pageContent.locator(`.mention[data-id="${mentionedUser.id}"]`).first();
    await expect(userMention).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(userMention).toContainText(mentionedUser.username);
});

/**
 * @objective Verify ~channel mentions work correctly in editor
 */
test('handles ~channel mentions in editor', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # Create another channel to mention (user must be a member for it to appear in autocomplete)
    const mentionedChannel = await createTestChannel(adminClient, team.id, uniqueName('mentioned-channel'), 'O', [
        user.id,
    ]);

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Channel Mention Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Channel Mention Test Page');

    // # Wait for editor to be visible
    const editor = await getEditorAndWait(page);

    // # Type ~ channel mention in editor (include partial channel name like user mention test)
    await editor.click();
    const channelNamePrefix = mentionedChannel.name.substring(0, 5);
    await editor.type(`Please check ~${channelNamePrefix}`);

    // * Verify channel mention suggestion dropdown appears
    const mentionDropdown = page.locator('.tiptap-channel-mention-popup, .tiptap-mention-popup').first();
    await expect(mentionDropdown).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Select the mentioned channel from dropdown (use the popup locator to ensure we click in the dropdown)
    const channelOption = mentionDropdown.locator(`text="${mentionedChannel.display_name}"`).first();
    await expect(channelOption).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await channelOption.click();

    // * Verify channel mention is properly created with data-channel-id attribute
    const channelMentionInEditor = editor.locator(`.channel-mention[data-channel-id="${mentionedChannel.id}"]`);
    await expect(channelMentionInEditor).toBeVisible({timeout: SHORT_WAIT});

    const editorContent = await editor.textContent();
    expect(editorContent).toContain(mentionedChannel.name);

    // # Publish
    await publishPage(page);
    await page.waitForLoadState('networkidle');

    // * Verify channel mention persists after publish
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toBeVisible();
    await expect(pageContent).toContainText(mentionedChannel.name);

    // * Verify channel mention element with data-channel-id exists
    const channelMention = pageContent.locator(`.channel-mention[data-channel-id="${mentionedChannel.id}"]`).first();
    await expect(channelMention).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Click on the ~channel mention to verify it navigates to that channel
    await channelMention.click();

    // * Verify navigation to the mentioned channel
    await page.waitForURL(`**/${team.name}/channels/${mentionedChannel.name}`, {timeout: ELEMENT_TIMEOUT});

    const channelHeaderTitle = page.locator('#channelHeaderTitle, .channel-header__title').first();
    await expect(channelHeaderTitle).toBeVisible();

    // * Verify we're now viewing the mentioned channel
    const channelHeader = page.locator('#channelHeaderTitle, .channel-header__title').first();
    await expect(channelHeader).toContainText(mentionedChannel.display_name);
});

/**
 * @objective Verify multiple @mentions work correctly in same page
 */
test('handles multiple user mentions in same page', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # Create two users to mention
    const {user: user1} = await createTestUserInTeam(pw, adminClient, team, 'user1');
    const {user: user2} = await createTestUserInTeam(pw, adminClient, team, 'user2');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Multi Mention Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Multi Mention Page');

    // # Wait for editor to be visible
    const editor = await getEditorAndWait(page);

    // # Type first mention in editor
    await editor.click();
    await editor.type(`Task assigned to @${user1.username}`);

    // * Verify first mention suggestion dropdown appears
    const mentionDropdown = page.locator('.tiptap-mention-popup').first();
    await expect(mentionDropdown).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Select the first mentioned user from dropdown
    const userOption1 = page.locator(`[data-testid="mentionSuggestion_${user1.username}"]`).first();
    await expect(userOption1).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await userOption1.click();

    // * Verify first mention is properly created with data-id attribute
    const userMentionInEditor1 = editor.locator(`.mention[data-id="${user1.id}"]`);
    await expect(userMentionInEditor1).toBeVisible({timeout: SHORT_WAIT});

    // # Type second mention in editor
    await editor.type(` and reviewed by @${user2.username}`);

    // * Verify second mention suggestion dropdown appears
    await expect(mentionDropdown).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Select the second mentioned user from dropdown
    const userOption2 = page.locator(`[data-testid="mentionSuggestion_${user2.username}"]`).first();
    await expect(userOption2).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await userOption2.click();

    // * Verify second mention is properly created with data-id attribute
    const userMentionInEditor2 = editor.locator(`.mention[data-id="${user2.id}"]`);
    await expect(userMentionInEditor2).toBeVisible({timeout: SHORT_WAIT});

    // * Verify both mentions appear in editor text content
    const editorContent = await editor.textContent();
    expect(editorContent).toContain(user1.username);
    expect(editorContent).toContain(user2.username);

    // # Publish
    await publishPage(page);
    await page.waitForLoadState('networkidle');

    // * Verify both mentions persist after publish
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toBeVisible();
    await expect(pageContent).toContainText(user1.username);
    await expect(pageContent).toContainText(user2.username);

    // * Verify both mention elements with data-id attributes are properly rendered
    const userMention1 = pageContent.locator(`.mention[data-id="${user1.id}"]`).first();
    await expect(userMention1).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(userMention1).toContainText(user1.username);

    const userMention2 = pageContent.locator(`.mention[data-id="${user2.id}"]`).first();
    await expect(userMention2).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(userMention2).toContainText(user2.username);
});

/**
 * @objective Verify mention autocomplete does not duplicate typed text after insertion
 */
test('does not duplicate typed text after mention selection', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # Create another user to mention
    const {user: mentionedUser} = await createTestUserInTeam(pw, adminClient, team, 'matttest');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Mention Bug Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Mention Duplication Test');

    // # Wait for editor to be visible
    const editor = await getEditorAndWait(page);

    // # Type @ mention text character by character (simulating real user typing)
    await editor.click();
    await page.keyboard.type('Hello ');
    await page.keyboard.type('@matt');

    // * Verify mention suggestion dropdown appears
    const mentionDropdown = page.locator('.tiptap-mention-popup').first();
    await expect(mentionDropdown).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Select the mentioned user from dropdown
    const userOption = page.locator(`[data-testid="mentionSuggestion_${mentionedUser.username}"]`).first();
    await expect(userOption).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // Click to select (this is where the bug commonly occurs)
    await userOption.click();

    // * Verify mention is properly created
    const userMentionInEditor = editor.locator(`.mention[data-id="${mentionedUser.id}"]`);
    await expect(userMentionInEditor).toBeVisible({timeout: SHORT_WAIT});

    // * Verify editor content does NOT contain duplicated text
    const editorContent = await editor.textContent();

    // The bug: typing "@matt" then selecting from autocomplete inserts the mention
    // but ALSO keeps the original "@matt" text after it, resulting in:
    // "Hello @matttest123 matt" (incorrect - duplication)
    // Expected: "Hello @matttest123" (correct - no duplication)

    // Check that "matt" does NOT appear as duplicate text after the mention
    const mentionText = await userMentionInEditor.textContent();
    const textAfterMention = (editorContent ?? '').substring(
        (editorContent ?? '').indexOf(mentionText || '') + (mentionText?.length || 0),
    );

    // * Verify no duplicate "matt" text appears after the mention
    expect(textAfterMention.trim()).not.toContain('matt');

    // * Verify the full content is correct (should be "Hello @username" without duplication)
    expect(editorContent).toContain('Hello');
    expect(editorContent).toContain(mentionedUser.username);

    // Count occurrences of "matt" - should only appear once (in the mention itself)
    const mattOccurrences = ((editorContent ?? '').toLowerCase().match(/matt/g) || []).length;
    expect(mattOccurrences).toBe(1);
});

/**
 * @objective Verify multiple mentions can be added in same editing session without refresh
 */
test('allows multiple mentions in same document without refresh', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # Create two users to mention
    const {user: user1} = await createTestUserInTeam(pw, adminClient, team, 'alice');
    const {user: user2} = await createTestUserInTeam(pw, adminClient, team, 'bob');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Multi Mention Bug Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Multiple Mentions Test');

    // # Wait for editor to be visible
    const editor = await getEditorAndWait(page);

    // # Add first mention
    await editor.click();
    await editor.type('First mention: @alice');

    // * Verify first mention dropdown appears
    let mentionDropdown = page.locator('.tiptap-mention-popup').first();
    await expect(mentionDropdown).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Select first user
    let userOption = page.locator(`[data-testid="mentionSuggestion_${user1.username}"]`).first();
    await expect(userOption).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await userOption.click();

    // * Verify first mention is inserted
    const firstMention = editor.locator(`.mention[data-id="${user1.id}"]`);
    await expect(firstMention).toBeVisible({timeout: SHORT_WAIT});

    // # Add some text between mentions
    await editor.type(' and ');

    // # Add second mention
    await editor.type('@bob');

    // * Verify second mention dropdown appears
    mentionDropdown = page.locator('.tiptap-mention-popup').first();
    await expect(mentionDropdown).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Select second user
    userOption = page.locator(`[data-testid="mentionSuggestion_${user2.username}"]`).first();
    await expect(userOption).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await userOption.click();

    // * Verify second mention is inserted
    const secondMention = editor.locator(`.mention[data-id="${user2.id}"]`);
    await expect(secondMention).toBeVisible({timeout: SHORT_WAIT});

    // * Verify both mentions are present in final content
    const editorContent = await editor.textContent();
    expect(editorContent).toContain(user1.username);
    expect(editorContent).toContain(user2.username);
});

/**
 * @objective Verify mention dropdown reappears after canceling first mention attempt
 */
test(
    'shows mention dropdown on second attempt after canceling first',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # Create a user to mention
        const {user: mentionedUser} = await createTestUserInTeam(pw, adminClient, team, 'testuser');

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki through UI
        await createWikiThroughUI(page, uniqueName('Dropdown Bug Wiki'));

        // # Create new page
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Dropdown Reappearance Test');

        // # Wait for editor to be visible
        const editor = await getEditorAndWait(page);

        // # First attempt: Type @ and verify dropdown appears
        await editor.click();
        await page.keyboard.type('Testing @test');

        // * Verify first mention dropdown appears
        const firstDropdown = page.locator('.tiptap-mention-popup').first();
        await expect(firstDropdown).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Cancel the first mention by pressing Escape
        await page.keyboard.press('Escape');

        // * Verify dropdown is gone
        await expect(firstDropdown).not.toBeVisible({timeout: WEBSOCKET_WAIT});

        // # Add some more text
        await page.keyboard.type(' more text ');

        // # Second attempt: Type @ again (THIS IS WHERE THE BUG OCCURS)
        await page.keyboard.type('@test');

        // * Verify second mention dropdown appears (BUG: it doesn't appear)
        const secondDropdown = page.locator('.tiptap-mention-popup').first();
        await expect(secondDropdown).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // * Verify dropdown has users
        const userOption = page.locator(`[data-testid="mentionSuggestion_${mentionedUser.username}"]`).first();
        await expect(userOption).toBeVisible({timeout: ELEMENT_TIMEOUT});
    },
);

/**
 * @objective Verify mentioned users receive notifications when page is published
 *
 * @precondition
 * Two users must be created and both must be members of the team/channel
 *
 * Note: This test documents expected behavior. Currently skipped due to flaky page loading
 * issues when creating second browser context. Core mention functionality is tested in
 * "handles @user mentions in editor" test. When re-enabling, investigate:
 * 1. Whether page mentions trigger the notification system (they should, like post mentions)
 * 2. Why second context page loading is flaky (networkidle doesn't reliably complete)
 */
test.skip(
    'sends notification to mentioned user when page is published',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # Create a second user who will be mentioned
        const {user: mentionedUser} = await createTestUserInTeam(pw, adminClient, team, 'mentioned');
        await adminClient.addToChannel(mentionedUser.id, channel.id);

        // # Also add mentioned user to off-topic channel (they'll navigate there to check mentions)
        const offTopicChannel = await adminClient.getChannelByName(team.id, 'off-topic');
        await adminClient.addToChannel(mentionedUser.id, offTopicChannel.id);

        // # Login as author user and create wiki
        const {page: authorPage} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        await createWikiThroughUI(authorPage, uniqueName('Notification Wiki'));

        // # Create new page with @mention
        const newPageButton = getNewPageButton(authorPage);
        await newPageButton.click();

        // # Type content with @mention
        const authorEditor = await getEditorAndWait(authorPage);
        await typeInEditor(authorPage, `Hello @${mentionedUser.username}`);

        // * Verify mention suggestion dropdown appears
        const mentionDropdown = authorPage.locator('.tiptap-mention-popup').first();
        await expect(mentionDropdown).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Select the mentioned user from dropdown
        const userOption = authorPage.locator(`[data-testid="mentionSuggestion_${mentionedUser.username}"]`).first();
        await expect(userOption).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await userOption.click();

        // * Verify mention is properly created with data-id attribute
        await authorPage.waitForTimeout(SHORT_WAIT);
        const userMentionInEditor = authorEditor.locator(`.mention[data-id="${mentionedUser.id}"]`);
        await expect(userMentionInEditor).toBeVisible();

        // # Add remaining text
        await authorEditor.type(', please review this page!');

        // # Set title and publish
        const titleInput = authorPage.locator('[data-testid="wiki-page-title-input"]').first();
        await titleInput.fill('Page with Mention Notification');

        await publishPage(authorPage);
        await authorPage.waitForLoadState('networkidle');

        // * Verify page is published
        const pageContent = getPageViewerContent(authorPage);
        await expect(pageContent).toBeVisible();

        // # Wait a moment for notification to be sent
        await authorPage.waitForTimeout(EDITOR_LOAD_WAIT);

        // # Create a second browser context for mentioned user (simulating them checking notifications)
        // First get mentioned user's storage state by logging them in temporarily
        const {page: mentionedUserTempPage} = await pw.testBrowser.login(mentionedUser);
        const mentionedUserStorageState = await pw.testBrowser.context!.storageState();
        await mentionedUserTempPage.close();

        // # Now create a new context for mentioned user and navigate to a DIFFERENT channel (off-topic)
        // This ensures the mention appears as "unread" in the mentions list
        const mentionedUserContext = await pw.testBrowser.browser.newContext({
            storageState: mentionedUserStorageState,
        });
        const mentionedUserPage = await mentionedUserContext.newPage();
        await mentionedUserPage.goto(buildChannelUrl(pw.url, team.name, 'off-topic'));
        await mentionedUserPage.waitForLoadState('networkidle');

        // * Wait for channel to fully load by checking for post input
        const postInput = mentionedUserPage.locator('#post_textbox').first();
        await expect(postInput).toBeVisible({timeout: PAGE_LOAD_TIMEOUT});

        // # Open the Recent Mentions RHS panel
        // The button has icon-at class based on the at_mentions_button component
        const mentionsButton = mentionedUserPage.locator('button:has(i.icon-at)').first();
        await expect(mentionsButton).toBeVisible({timeout: HIERARCHY_TIMEOUT});
        await mentionsButton.click();

        // * Verify RHS panel opened
        const rhsSidebar = mentionedUserPage.locator('#rhsContainer, .sidebar--right').first();
        await expect(rhsSidebar).toBeVisible({timeout: HIERARCHY_TIMEOUT});

        // * Verify the page mention appears in recent mentions
        // Note: If this fails with "No mentions yet", investigate whether page mentions
        // trigger the notification system (they should, like regular post mentions do)
        await expect(rhsSidebar).toContainText('Page with Mention Notification', {timeout: ELEMENT_TIMEOUT});
        await expect(rhsSidebar).toContainText(user.username, {timeout: ELEMENT_TIMEOUT});

        // # Cleanup
        await mentionedUserContext.close();
    },
);

/**
 * @objective Verify Ctrl+L keyboard shortcut opens page link modal in editor
 */
test('opens page link modal with Ctrl+L keyboard shortcut', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Link Test Wiki'));

    // # Create a page first so we have pages to link to
    await createPageThroughUI(page, 'Existing Page');
    await waitForPageInHierarchy(page, 'Existing Page');

    // # Create new page to test keyboard shortcut
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Keyboard Shortcut Test');

    // # Wait for editor to be visible and ready
    const editor = await getEditorAndWait(page);

    // # Wait for previously created pages to load in hierarchy (confirms loadChannelPages completed)
    await waitForPageInHierarchy(page, 'Existing Page');

    // # Focus editor and press Ctrl+L (or Cmd+L on Mac) keyboard shortcut
    await editor.click();
    await page.waitForTimeout(UI_MICRO_WAIT * 2);
    const linkModal = await openPageLinkModal(editor);

    // * Verify modal opens via keyboard shortcut
    await expect(linkModal).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(linkModal).toContainText('Link to a page');
});

/**
 * @objective Verify page link modal displays and filters available pages
 */
test('displays and filters pages in link modal', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Filter Wiki'));

    // # Create multiple pages with different names
    await createPageThroughUI(page, 'Getting Started Guide');
    await waitForPageInHierarchy(page, 'Getting Started Guide');
    await createPageThroughUI(page, 'API Documentation');
    await waitForPageInHierarchy(page, 'API Documentation');
    await createPageThroughUI(page, 'Deployment Guide');
    await waitForPageInHierarchy(page, 'Deployment Guide');

    // # Create new page for linking
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'New Page for Links');

    // # Wait for navigation to the new draft page (publish button only appears in edit mode)
    await page
        .locator('[data-testid="wiki-page-publish-button"]')
        .waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

    // # Wait for editor to load and for loadChannelPages to complete
    await getEditorAndWait(page);

    // # Wait for previously created pages to load in hierarchy (confirms loadChannelPages completed)
    await waitForPageInHierarchy(page, 'Getting Started Guide', 15000);

    // # Open link modal via toolbar button
    const linkModal = await openPageLinkModalViaButton(page);
    await expect(linkModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify all three pages appear in the list
    await expect(linkModal).toContainText('Getting Started Guide');
    await expect(linkModal).toContainText('API Documentation');
    await expect(linkModal).toContainText('Deployment Guide');

    // # Type search query
    const searchInput = linkModal.locator('input[type="text"]').first();
    await searchInput.fill('API');

    // * Verify only matching page appears
    await expect(linkModal).toContainText('API Documentation');
    await expect(linkModal).not.toContainText('Getting Started Guide');
    await expect(linkModal).not.toContainText('Deployment Guide');

    // # Clear search and type different query
    await searchInput.clear();
    await searchInput.fill('Guide');

    // * Verify both "Guide" pages appear
    await expect(linkModal).toContainText('Getting Started Guide');
    await expect(linkModal).toContainText('Deployment Guide');
    await expect(linkModal).not.toContainText('API Documentation');
});

/**
 * @objective Verify selecting page from modal inserts link in editor
 */
test('inserts page link when page selected from modal', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Insert Link Wiki'));

    // # Create target page to link to
    const targetPage = await createPageThroughUI(page, 'Target Page');
    await waitForPageInHierarchy(page, 'Target Page');

    // # Create new page for linking
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'New Page for Links');

    // # Wait for navigation to the new draft page (publish button only appears in edit mode)
    await page
        .locator('[data-testid="wiki-page-publish-button"]')
        .waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

    // # Wait for editor to load and for loadChannelPages to complete
    const editor = await getEditorAndWait(page);

    // # Wait for previously created pages to load in hierarchy (confirms loadChannelPages completed)
    await waitForPageInHierarchy(page, 'Target Page', 15000);

    // # Open link modal via toolbar button (this will type and select "test text")
    const linkModal = await openPageLinkModalViaButton(page);
    await expect(linkModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Click on "Target Page" in the list
    const targetPageOption = linkModal.locator('text="Target Page"').first();
    await targetPageOption.click();

    // # Click Insert Link button
    const insertLinkButton = linkModal.locator('button:has-text("Insert Link")');
    await insertLinkButton.click();

    // * Verify modal closes
    await expect(linkModal).not.toBeVisible();

    // * Verify link appears in editor (should contain "test text" which was typed by the helper)
    await page.waitForTimeout(EDITOR_LOAD_WAIT);
    const editorContent = await editor.textContent();
    expect(editorContent).toContain('test text');

    // * Verify link has correct attributes (check for link element)
    const pageLink = editor.locator('a').filter({hasText: 'test text'}).first();
    await expect(pageLink).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify link href contains the target page ID
    const href = await pageLink.getAttribute('href');
    expect(href).toBeTruthy();
    expect(href).toContain(targetPage.id);
});

/**
 * @objective Verify clicking page link navigates to linked page
 */
test('navigates to linked page when link is clicked', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Navigation Wiki'));

    // # Create target page with distinctive content
    const targetPage = await createPageThroughUI(page, 'Linked Target Page', 'This is the linked page content');
    await waitForPageInHierarchy(page, 'Linked Target Page');

    // # Create source page with link
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Source Page with Link');

    // # Wait for navigation to the new draft page (publish button only appears in edit mode)
    await page
        .locator('[data-testid="wiki-page-publish-button"]')
        .waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

    // # Wait for editor to load and for loadChannelPages to complete
    await getEditorAndWait(page);

    // # Wait for previously created pages to load in hierarchy (confirms loadChannelPages completed)
    await waitForPageInHierarchy(page, 'Linked Target Page', 15000);

    await typeInEditor(page, 'Navigate here: ');

    // # Open link modal using keyboard shortcut (without selecting text)
    await pressModifierKey(page, 'l');

    // # Wait for link modal to appear
    const linkModal = page.locator('[data-testid="page-link-modal"]').first();
    await expect(linkModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Search for the target page (modal only shows first 10, so we need to search)
    const searchInput = linkModal.locator('input[id="page-search-input"]');
    await searchInput.fill('Linked Target Page');

    // # Wait for search to filter results
    await expect(linkModal).toContainText('Linked Target Page');

    const targetPageOption = linkModal.locator('text="Linked Target Page"').first();
    await targetPageOption.click();

    // # Fill in the link text input with the target page name
    const linkTextInput = linkModal.locator('input[id="link-text-input"]');
    await linkTextInput.fill('Linked Target Page');

    // # Click Insert Link button
    const insertLinkButton = linkModal.locator('button:has-text("Insert Link")');
    await insertLinkButton.click();

    // # Set title and publish source page
    const titleInput = page.locator('[data-testid="wiki-page-title-input"]').first();
    await titleInput.fill('Source Page with Link');

    await publishPage(page);
    await page.waitForLoadState('networkidle');

    // * Verify page is published
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toBeVisible();
    await expect(pageContent).toContainText('Navigate here:', {timeout: ELEMENT_TIMEOUT});

    // Wait for the edit button to appear, confirming the page is in view mode
    const editButton = page.getByRole('button', {name: 'Edit', exact: true});
    await expect(editButton).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Click on the actual link in the page content to verify it works
    const pageLink = pageContent.locator('a:has-text("Linked Target Page")');
    await expect(pageLink).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // Get the href for verification
    const linkHref = await pageLink.getAttribute('href');
    expect(linkHref).toContain(targetPage.id);

    // * Click the link and verify navigation to target page (links navigate in same tab)
    await pageLink.click();

    // Wait for navigation to complete
    await page.waitForLoadState('networkidle');

    // * Verify navigation by checking content changed to target page
    const targetPageContent = getPageViewerContent(page);
    await expect(targetPageContent).toContainText('This is the linked page content', {timeout: PAGE_LOAD_TIMEOUT});
});

/**
 * @objective Verify /link slash command uses page title as fallback when link text is empty
 *
 * @precondition
 * At least one page must exist to link to
 */
test(
    'inserts page link via slash command using page title when link text empty',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki through UI
        await createWikiThroughUI(page, uniqueName('Slash Link Wiki'));

        // # Create target page to link to
        const targetPage = await createPageThroughUI(page, 'Target Page For Slash Command');
        await waitForPageInHierarchy(page, 'Target Page For Slash Command');

        // # Create new page for linking
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Page With Slash Link');

        // # Wait for navigation to the new draft page
        await page
            .locator('[data-testid="wiki-page-publish-button"]')
            .waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

        // # Wait for editor to load
        const editor = await getEditorAndWait(page);

        // # Wait for previously created pages to load in hierarchy
        await waitForPageInHierarchy(page, 'Target Page For Slash Command', 15000);

        // # Type /link to open slash command menu and select Link
        await editor.click();
        await page.keyboard.type('/link');

        // * Verify slash command menu appears with Link option
        const slashMenu = page.locator('.slash-command-menu');
        await slashMenu.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

        const linkItem = slashMenu.locator('.slash-command-item').filter({hasText: 'Link'});
        await expect(linkItem).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Press Enter to select the Link option
        await page.keyboard.press('Enter');

        // * Verify page link modal opens
        const linkModal = page.locator('[data-testid="page-link-modal"]').first();
        await expect(linkModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Search for target page
        const searchInput = linkModal.locator('input[id="page-search-input"]');
        await searchInput.fill('Target Page For Slash Command');

        // * Verify target page appears in results
        await expect(linkModal).toContainText('Target Page For Slash Command');

        // # Select the target page by clicking on it
        const targetPageOption = linkModal
            .locator('[role="option"]')
            .filter({hasText: 'Target Page For Slash Command'})
            .first();
        await targetPageOption.click();

        // # Do NOT fill in link text - leave it empty to test fallback behavior
        // The link text input should be empty
        const linkTextInput = linkModal.locator('input[id="link-text-input"]');
        await expect(linkTextInput).toHaveValue('');

        // # Press Enter to confirm (using page title as fallback)
        await page.keyboard.press('Enter');

        // * Verify modal closes
        await expect(linkModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // * Verify link was inserted with page title as link text (the fallback)
        await page.waitForTimeout(EDITOR_LOAD_WAIT);
        const editorContent = await editor.textContent();
        expect(editorContent).toContain('Target Page For Slash Command');

        // * Verify the link element exists with correct text
        const pageLink = editor.locator('a').filter({hasText: 'Target Page For Slash Command'}).first();
        await expect(pageLink).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // * Verify link href contains the target page ID
        const href = await pageLink.getAttribute('href');
        expect(href).toBeTruthy();
        expect(href).toContain(targetPage.id);

        // # Publish and verify persistence
        await publishPage(page);
        await page.waitForLoadState('networkidle');

        // * Verify link persists after publish
        const pageContent = getPageViewerContent(page);
        await expect(pageContent).toBeVisible();
        await expect(pageContent).toContainText('Target Page For Slash Command');

        const publishedLink = pageContent.locator('a').filter({hasText: 'Target Page For Slash Command'}).first();
        await expect(publishedLink).toBeVisible({timeout: ELEMENT_TIMEOUT});
    },
);

/**
 * @objective Verify multiple page links can be inserted in same page
 */
test('inserts multiple page links in same page', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Multi Link Wiki'));

    // # Create multiple target pages and capture their IDs
    const firstPage = await createPageThroughUI(page, 'First Page');
    await waitForPageInHierarchy(page, 'First Page');

    const secondPage = await createPageThroughUI(page, 'Second Page');
    await waitForPageInHierarchy(page, 'Second Page');

    const thirdPage = await createPageThroughUI(page, 'Third Page');
    await waitForPageInHierarchy(page, 'Third Page');

    // # Create new page for linking
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'New Page for Links');

    // # Wait for navigation to the new draft page (publish button only appears in edit mode)
    await page
        .locator('[data-testid="wiki-page-publish-button"]')
        .waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

    // # Wait for editor to load and for loadChannelPages to complete
    const editor = await getEditorAndWait(page);

    // # Wait for previously created pages to load in hierarchy (confirms loadChannelPages completed)
    await waitForPageInHierarchy(page, 'First Page', 15000);

    // # Type first word and convert to link
    await typeInEditor(page, 'link1');
    await selectTextInEditor(page);
    await pressModifierKey(page, 'l');

    let linkModal = page.locator('[data-testid="page-link-modal"]').first();
    await linkModal.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    let searchInput = linkModal.locator('input[type="text"]').first();
    await searchInput.fill('First Page');

    // Wait for filtering to complete and only the matching page to be visible
    const firstPageOption = linkModal.locator('[role="option"]:has-text("First Page")').first();
    await firstPageOption.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await expect(linkModal.locator('[role="option"]')).toHaveCount(1, {timeout: ELEMENT_TIMEOUT});

    await firstPageOption.click();
    await expect(firstPageOption.locator('.icon-check')).toBeVisible({timeout: EDITOR_LOAD_WAIT});

    await linkModal.locator('button:has-text("Insert Link")').click();
    await linkModal.waitFor({state: 'hidden', timeout: ELEMENT_TIMEOUT});
    await page.waitForTimeout(UI_MICRO_WAIT * 3);

    // # Type separator and second word, then convert second word to link
    await editor.type(' and link2');
    await page.keyboard.press('Shift+Alt+ArrowLeft');
    await pressModifierKey(page, 'l');

    linkModal = page.locator('[data-testid="page-link-modal"]').first();
    await linkModal.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    searchInput = linkModal.locator('input[type="text"]').first();
    await searchInput.fill('Second Page');

    // Wait for filtering to complete and only the matching page to be visible
    const secondPageOption = linkModal.locator('[role="option"]:has-text("Second Page")').first();
    await secondPageOption.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await expect(linkModal.locator('[role="option"]')).toHaveCount(1, {timeout: ELEMENT_TIMEOUT});

    await secondPageOption.click();
    await expect(secondPageOption.locator('.icon-check')).toBeVisible({timeout: EDITOR_LOAD_WAIT});

    // Fill in the link text field
    let linkTextInput = linkModal.locator('input[id="link-text-input"]');
    await linkTextInput.fill('link2');

    await linkModal.locator('button:has-text("Insert Link")').click();
    await linkModal.waitFor({state: 'hidden', timeout: ELEMENT_TIMEOUT});
    await page.waitForTimeout(UI_MICRO_WAIT * 3);

    // # Type separator and third word, then convert third word to link
    await editor.type(' also link3');
    await page.keyboard.press('Shift+Alt+ArrowLeft');
    await pressModifierKey(page, 'l');

    linkModal = page.locator('[data-testid="page-link-modal"]').first();
    await linkModal.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    searchInput = linkModal.locator('input[type="text"]').first();
    await searchInput.fill('Third Page');

    // Wait for filtering to complete and only the matching page to be visible
    const thirdPageOption = linkModal.locator('[role="option"]:has-text("Third Page")').first();
    await thirdPageOption.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await expect(linkModal.locator('[role="option"]')).toHaveCount(1, {timeout: ELEMENT_TIMEOUT});

    await thirdPageOption.click();
    await expect(thirdPageOption.locator('.icon-check')).toBeVisible({timeout: EDITOR_LOAD_WAIT});

    // Fill in the link text field
    linkTextInput = linkModal.locator('input[id="link-text-input"]');
    await linkTextInput.fill('link3');

    await linkModal.locator('button:has-text("Insert Link")').click();
    await linkModal.waitFor({state: 'hidden', timeout: ELEMENT_TIMEOUT});
    await page.waitForTimeout(UI_MICRO_WAIT * 3);

    // # Publish page
    const titleInput = page.locator('[data-testid="wiki-page-title-input"]').first();
    await titleInput.fill('Page with Multiple Links');

    await publishPage(page);
    await page.waitForLoadState('networkidle');

    // * Verify all links persist after publish
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toBeVisible();

    // * Verify all three links are present and clickable with their selected text
    const link1 = pageContent.locator('a:has-text("link1")');
    const link2 = pageContent.locator('a:has-text("link2")');
    const link3 = pageContent.locator('a:has-text("link3")');

    await expect(link1).toBeVisible();
    await expect(link2).toBeVisible();
    await expect(link3).toBeVisible();

    // * Verify the separator text is present as plain text
    await expect(pageContent).toContainText(' and ');
    await expect(pageContent).toContainText(' also ');

    // * Verify links have valid href attributes pointing to the correct pages
    const link1Href = await link1.getAttribute('href');
    const link2Href = await link2.getAttribute('href');
    const link3Href = await link3.getAttribute('href');

    expect(link1Href).toContain('/wiki/');
    expect(link2Href).toContain('/wiki/');
    expect(link3Href).toContain('/wiki/');

    // * Verify each link points to the expected page by checking page IDs
    expect(link1Href).toContain(firstPage.id);
    expect(link2Href).toContain(secondPage.id);
    expect(link3Href).toContain(thirdPage.id);
});

/**
 * @objective Verify page link modal shows empty state when no pages exist
 */
test('displays empty state in link modal when no pages available', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Create a unique channel for this test (to avoid cross-wiki page pollution)
    const uniqueChannel = await createTestChannel(adminClient, team.id, uniqueName('empty-test'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, uniqueChannel.name);

    // # Create wiki through UI (but don't create any pages)
    await createWikiThroughUI(page, uniqueName('Empty Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Empty State Test');

    // # Wait for editor to be visible
    await getEditorAndWait(page);

    // # Open link modal via toolbar button
    const linkModal = await openPageLinkModalViaButton(page);
    await expect(linkModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify empty state message appears
    await expect(linkModal).toContainText(/No pages found|No pages available/i);
});

/**
 * @objective Verify link modal can be closed with Escape key
 */
test('closes link modal with Escape key', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Escape Wiki'));

    // # Create page
    await createPageThroughUI(page, 'Test Page');
    await waitForPageInHierarchy(page, 'Test Page');

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Test Page for Escape');

    // # Wait for navigation to the new draft page (publish button only appears in edit mode)
    await page
        .locator('[data-testid="wiki-page-publish-button"]')
        .waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

    // # Wait for editor to load and for loadChannelPages to complete
    const editor = await getEditorAndWait(page);

    // # Wait for previously created pages to load in hierarchy (confirms loadChannelPages completed)
    await waitForPageInHierarchy(page, 'Test Page', 15000);

    // # Open link modal via toolbar button
    const linkModal = await openPageLinkModalViaButton(page);
    await expect(linkModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Press Escape key
    await page.keyboard.press('Escape');

    // * Verify modal closes
    await expect(linkModal).not.toBeVisible();

    // * Verify editor is still visible and editable
    await expect(editor).toBeVisible();
});

/**
 * @objective Verify page links work correctly with child pages in hierarchy
 */
test('links to child pages in page hierarchy', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Hierarchy Wiki'));

    // # Create parent page
    const parentPage = await createPageThroughUI(page, 'Parent Page');
    await waitForPageInHierarchy(page, 'Parent Page');

    // # Create child page using context menu
    await createChildPageThroughContextMenu(page, parentPage.id, 'Child Page', 'This is a child page');
    await waitForPageInHierarchy(page, 'Child Page');

    // Store the child page ID from the URL
    const childPageUrl = page.url();
    const childPageId = childPageUrl.split('/').pop();

    // # Create new page for linking
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'New Page for Links');

    // # Wait for navigation to the new draft page (publish button only appears in edit mode)
    await page
        .locator('[data-testid="wiki-page-publish-button"]')
        .waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

    // # Wait for editor to load and for loadChannelPages to complete
    const editor = await getEditorAndWait(page);

    // # Wait for previously created pages to load in hierarchy (confirms loadChannelPages completed)
    await waitForPageInHierarchy(page, 'Child Page', 15000);

    // # Insert link to child page via toolbar button
    await typeInEditor(page, 'Link to child: ');

    const linkModal = await openPageLinkModalViaButton(page);
    await expect(linkModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Search for Child Page (modal only shows first 10, so search is needed)
    const searchInput = linkModal.locator('input[type="text"]').first();
    await searchInput.fill('Child Page');
    await expect(linkModal).toContainText('Child Page');

    // # Select child page
    const childPageOption = linkModal.locator('text="Child Page"').first();
    await childPageOption.click();

    // # Click Insert Link button
    const insertLinkButton = linkModal.locator('button:has-text("Insert Link")');
    await insertLinkButton.click();

    // * Verify link inserted (should keep the selected text "test text" as the link text)
    await expect(async () => {
        const editorContent = await editor.textContent();
        expect(editorContent).toContain('test text');
    }).toPass({timeout: SHORT_WAIT});

    // # Publish the page
    const titleInput = page.locator('[data-testid="wiki-page-title-input"]').first();
    await titleInput.fill('Link to Child Page');

    await publishPage(page);
    await page.waitForLoadState('networkidle');

    // # Wait for page viewer to show the published content and for edit button to appear (confirms publish complete)
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toContainText('Link to child:', {timeout: ELEMENT_TIMEOUT});

    // Wait for the edit button to appear, confirming the page is in view mode
    const editButton = page.getByRole('button', {name: 'Edit', exact: true});
    await expect(editButton).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Click on the actual link in the page content to verify it works
    // Note: The entire "Link to child: test text" became a link because it was all selected when creating the link
    const pageLink = pageContent.locator('a:has-text("test text")');
    await expect(pageLink).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // Get the href for verification
    const linkHref = await pageLink.getAttribute('href');
    expect(linkHref).toContain(childPageId);

    // * Click the link and verify navigation to child page (links navigate in same tab)
    await pageLink.click();

    // Wait for navigation to complete
    await page.waitForLoadState('networkidle');

    // * Verify the page shows the child page content
    const childPageContent = getPageViewerContent(page);
    await expect(childPageContent).toContainText('This is a child page', {timeout: PAGE_LOAD_TIMEOUT});
});

/**
 * @objective Verify formatting buttons correctly reflect active state based on cursor position
 */
test(
    'formatting buttons show correct active state for text formatting',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki through UI
        await createWikiThroughUI(page, uniqueName('Formatting Wiki'));

        // # Create new page
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Formatting Test Page');

        // # Wait for editor to be visible
        const editor = await getEditorAndWait(page);

        // # Type test content with different formatting
        await editor.click();
        await page.keyboard.type('Plain text ');

        // # Toggle bold on and type
        await pressModifierKey(page, 'b');
        await page.keyboard.type('bold text');
        await pressModifierKey(page, 'b'); // Toggle bold off

        await page.keyboard.type(' more plain');
        await page.waitForTimeout(SHORT_WAIT);

        // # Now test if formatting buttons show correct active state
        // Select just the word "Plain" at the beginning
        await page.keyboard.press('Home');
        await page.keyboard.press('Shift+ArrowRight');
        await page.keyboard.press('Shift+ArrowRight');
        await page.keyboard.press('Shift+ArrowRight');
        await page.keyboard.press('Shift+ArrowRight');
        await page.keyboard.press('Shift+ArrowRight');
        await page.waitForTimeout(SHORT_WAIT);

        // # Wait for formatting bubble to appear
        const formattingBubble = page.locator('.formatting-bar-bubble').first();
        await formattingBubble.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

        // * Verify bold button is NOT active when selection is on plain text
        const boldButtonInPlain = formattingBubble.locator('button[title*="Bold"]').first();
        const boldButtonNotActive = await boldButtonInPlain.evaluate((el) => {
            return !el.classList.contains('is-active');
        });
        expect(boldButtonNotActive).toBe(true);

        // # Now select the bold text - "Plain text " is 11 chars, select next 9 chars for "bold text"
        await page.keyboard.press('Home');
        for (let i = 0; i < 11; i++) {
            await page.keyboard.press('ArrowRight');
        }
        for (let i = 0; i < 9; i++) {
            await page.keyboard.press('Shift+ArrowRight');
        }
        await page.waitForTimeout(SHORT_WAIT);

        // * Verify bold button IS active when selection is on bold text
        const boldButton = formattingBubble.locator('button[title*="Bold"]').first();
        const boldButtonActive = await boldButton.evaluate((el) => {
            return el.classList.contains('is-active');
        });
        expect(boldButtonActive).toBe(true);

        // # Test italic formatting - clear editor and start fresh
        await page.keyboard.press('Escape');
        await page.waitForTimeout(SHORT_WAIT);

        // # Select all and delete to start fresh
        await pressModifierKey(page, 'a');
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(SHORT_WAIT);

        // # Type only italic text
        await pressModifierKey(page, 'i'); // Toggle italic on
        await page.keyboard.type('italic only text');
        await pressModifierKey(page, 'i'); // Toggle italic off
        await page.waitForTimeout(SHORT_WAIT);

        // # Select the italic text
        await page.keyboard.press('Home');
        for (let i = 0; i < 16; i++) {
            // "italic only text" = 16 chars
            await page.keyboard.press('Shift+ArrowRight');
        }
        await page.waitForTimeout(SHORT_WAIT);

        // # Wait for fresh formatting bubble to appear for new selection
        const italicFormattingBubble = page.locator('.formatting-bar-bubble').first();
        await italicFormattingBubble.waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

        // * Verify italic button IS active when selection is on italic text
        const italicButton = italicFormattingBubble.locator('button[title*="Italic"]').first();
        const italicButtonActive = await italicButton.evaluate((el) => {
            return el.classList.contains('is-active');
        });
        expect(italicButtonActive).toBe(true);

        // * Verify bold button is NOT active in italic-only text
        const boldButtonInItalic = italicFormattingBubble.locator('button[title*="Bold"]').first();
        const boldNotActiveInItalic = await boldButtonInItalic.evaluate((el) => {
            return !el.classList.contains('is-active');
        });
        expect(boldNotActiveInItalic).toBe(true);
    },
);

/**
 * @objective Verify page content exceeding 64KB TEXT column limit can be published successfully
 */
test(
    'publishes page with content exceeding 64KB TEXT column limit',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki through UI
        await createWikiThroughUI(page, uniqueName('Character Limit Wiki'));

        // # Create new page
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Character Limit Test');

        // # Wait for editor to be visible
        const editor = await getEditorAndWait(page);

        // # Generate content exceeding 64KB (65,535 bytes - the MySQL TEXT column limit)
        // Using 100,000 characters to clearly exceed both the post limit (16,383) and TEXT column limit (64KB)
        const repeatedText =
            'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ';
        const targetCharacters = 100000; // 100K characters, well over 64KB limit
        const repetitions = Math.ceil(targetCharacters / repeatedText.length);
        const largeContent = repeatedText.repeat(repetitions);

        // * Verify we're testing with more than 64KB (assuming worst-case 1 byte per char)
        expect(largeContent.length).toBeGreaterThan(65535);
        expect(largeContent.length).toBeGreaterThan(16383);

        // # Paste large content into editor
        await editor.click();
        await page.evaluate((content) => {
            const editorElement = document.querySelector('.ProseMirror');
            if (editorElement) {
                const dataTransfer = new DataTransfer();
                dataTransfer.setData('text/plain', content);
                const pasteEvent = new ClipboardEvent('paste', {
                    clipboardData: dataTransfer,
                    bubbles: true,
                    cancelable: true,
                });
                editorElement.dispatchEvent(pasteEvent);
            }
        }, largeContent);

        // # Wait for content to be inserted
        await page.waitForTimeout(EDITOR_LOAD_WAIT);

        // * Verify content appears in editor
        await expect(editor).toContainText('Lorem ipsum');

        // # Publish page
        await publishPage(page);

        // # Wait for publish to complete (or for error to appear)
        await page.waitForTimeout(ELEMENT_TIMEOUT);

        // * Verify publish succeeds WITHOUT "body too long" or similar error
        // Check for common error indicators
        const errorBanner = page.locator('[role="alert"], .error, .alert-danger, [class*="error"]');
        const errorText = await errorBanner.allTextContents();
        const hasBodyTooLongError = errorText.some(
            (text) =>
                text.toLowerCase().includes('body too long') ||
                text.toLowerCase().includes('message too long') ||
                text.toLowerCase().includes('exceeds') ||
                text.toLowerCase().includes('too large'),
        );

        // * Verify NO "body too long" error appears
        expect(hasBodyTooLongError).toBe(false);

        // * Verify page was published successfully
        const pageContent = getPageViewerContent(page);
        await expect(pageContent).toBeVisible({timeout: HIERARCHY_TIMEOUT});
        await expect(pageContent).toContainText('Lorem ipsum');

        // * Verify large content persists after publish (should be ~100K characters)
        const publishedContent = await pageContent.textContent();
        expect(publishedContent?.length).toBeGreaterThan(65535); // Verify it's more than 64KB
    },
);

/**
 * @objective Verify pasting image from clipboard inserts only one image without broken icon
 *
 * @precondition
 * Test can optionally use an external image file at /tmp/test-paste-image.png if it exists,
 * otherwise uses a generated test image
 */
test('pastes image from clipboard without broken image icon', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Image Paste Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Image Paste Test');

    // # Wait for editor to be visible
    const editor = await getEditorAndWait(page);

    // # Click into editor and add some initial text
    await typeInEditor(page, 'Here is an image: ');

    // # Try to load external test image if provided, otherwise use generated test image
    // Default: 100x100 colored rectangle PNG
    const DEFAULT_BASE64_IMAGE =
        'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH5QoVEg8kHPx8MQAAAA1pVFh0Q29tbWVudADYLxcBAAAAAW9yTlQBz6J3mgAAABpJREFUeNrt3UENADAIQ0HRf89VJCLgkBmS7P0CAACAfRcAAgAAEAAAgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEAAAhCAAAQgAAEIQAACEIAABCAAAQhAAAIQgAAEIAABCEDQ9AGaRQMlSSgAAAAASUVORK5CYII=';

    let base64Image: string;
    try {
        // Check if external test image exists
        const fs = await import('fs');
        const externalImagePath = '/tmp/test-paste-image.png';
        if (fs.existsSync(externalImagePath)) {
            const imageBuffer = fs.readFileSync(externalImagePath);
            base64Image = imageBuffer.toString('base64');
        } else {
            // Use default generated image (100x100 colored rectangle)
            base64Image = DEFAULT_BASE64_IMAGE;
        }
    } catch {
        // Fallback to default image if file reading fails
        base64Image = DEFAULT_BASE64_IMAGE;
    }

    // # Simulate pasting an image from clipboard (more realistic scenario with both file and HTML data)
    await page.evaluate((imageData) => {
        const editorElement = document.querySelector('.ProseMirror');
        if (editorElement) {
            // Convert base64 to blob
            const byteCharacters = atob(imageData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], {type: 'image/png'});

            // Create file from blob
            const file = new File([blob], 'screenshot.png', {type: 'image/png'});

            // Create DataTransfer with the image file AND HTML data (common when copying from browser)
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            // Also add HTML data which might trigger duplicate insertion
            const imgUrl = URL.createObjectURL(blob);
            dataTransfer.setData('text/html', `<img src="${imgUrl}" alt="screenshot" />`);

            // Dispatch paste event
            const pasteEvent = new ClipboardEvent('paste', {
                clipboardData: dataTransfer,
                bubbles: true,
                cancelable: true,
            });
            editorElement.dispatchEvent(pasteEvent);
        }
    }, base64Image);

    // # Wait for image to be processed and inserted
    await page.waitForTimeout(WEBSOCKET_WAIT);

    // * Verify exactly one image element appears in editor
    const images = editor.locator('img');
    const imageCount = await images.count();
    expect(imageCount).toBe(1);

    // * Verify the image has a valid src attribute (not broken)
    const imageSrc = await images.first().getAttribute('src');
    expect(imageSrc).toBeTruthy();
    expect(imageSrc).not.toContain('broken');
    expect(imageSrc).not.toContain('error');

    // * Verify the image is visible (not displaying broken icon)
    await expect(images.first()).toBeVisible();

    // * Verify no error icons or broken image indicators exist
    const brokenImageIcons = editor.locator('[alt*="broken"], [title*="broken"], .broken-image');
    const brokenIconCount = await brokenImageIcons.count();
    expect(brokenIconCount).toBe(0);

    // # Publish the page
    await publishPage(page);
    await page.waitForLoadState('networkidle');

    // * Verify page publishes successfully with the image
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toBeVisible();

    // * Verify the image persists after publish
    const publishedImages = pageContent.locator('img');
    const publishedImageCount = await publishedImages.count();
    expect(publishedImageCount).toBe(1);

    // * Verify published image has valid src
    const publishedImageSrc = await publishedImages.first().getAttribute('src');
    expect(publishedImageSrc).toBeTruthy();
    await expect(publishedImages.first()).toBeVisible();
});

/**
 * @objective Verify link modal supports external URL linking
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 */
test('inserts external URL link via link modal', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('External Link Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Page With External Link');

    // # Wait for navigation to the new draft page
    await page
        .locator('[data-testid="wiki-page-publish-button"]')
        .waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

    // # Wait for editor to load
    const editor = await getEditorAndWait(page);

    // # Open link modal via Ctrl+L keyboard shortcut
    await editor.click();
    await page.waitForTimeout(UI_MICRO_WAIT * 2);
    const linkModal = await openPageLinkModal(editor);

    // * Verify modal opens
    await expect(linkModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify both tabs are visible
    const pageTab = linkModal.locator('[data-testid="tab-page"]');
    const urlTab = linkModal.locator('[data-testid="tab-url"]');
    await expect(pageTab).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(urlTab).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Click on Web URL tab
    await urlTab.click();

    // * Verify URL input is visible
    const urlInput = linkModal.locator('[data-testid="url-input"]');
    await expect(urlInput).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Enter external URL
    await urlInput.fill('https://mattermost.com');

    // # Enter custom link text
    const linkTextInput = linkModal.locator('input[id="link-text-input"]');
    await linkTextInput.fill('Mattermost Website');

    // # Click Insert Link button
    await linkModal.locator('button:has-text("Insert Link")').click();

    // * Verify modal closes
    await expect(linkModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify link was inserted with correct text
    await page.waitForTimeout(EDITOR_LOAD_WAIT);
    const editorContent = await editor.textContent();
    expect(editorContent).toContain('Mattermost Website');

    // * Verify the link element exists with correct href
    const externalLink = editor.locator('a').filter({hasText: 'Mattermost Website'}).first();
    await expect(externalLink).toBeVisible({timeout: ELEMENT_TIMEOUT});

    const href = await externalLink.getAttribute('href');
    expect(href).toBe('https://mattermost.com');

    // # Publish and verify persistence
    await publishPage(page);
    await page.waitForLoadState('networkidle');

    // * Verify link persists after publish
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toBeVisible();
    await expect(pageContent).toContainText('Mattermost Website');

    const publishedLink = pageContent.locator('a').filter({hasText: 'Mattermost Website'}).first();
    await expect(publishedLink).toBeVisible({timeout: ELEMENT_TIMEOUT});

    const publishedHref = await publishedLink.getAttribute('href');
    expect(publishedHref).toBe('https://mattermost.com');
});

/**
 * @objective Verify clicking external URL link in published page opens in new tab
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 */
test(
    'clicking external URL link in published page opens in new tab',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki through UI
        await createWikiThroughUI(page, uniqueName('External Link Click Wiki'));

        // # Create new page
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Page With Clickable External Link');

        // # Wait for navigation to the new draft page
        await page
            .locator('[data-testid="wiki-page-publish-button"]')
            .waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

        // # Wait for editor to load
        const editor = await getEditorAndWait(page);

        // # Open link modal via Ctrl+L keyboard shortcut
        await editor.click();
        await page.waitForTimeout(UI_MICRO_WAIT * 2);
        const linkModal = await openPageLinkModal(editor);

        // # Click on Web URL tab
        const urlTab = linkModal.locator('[data-testid="tab-url"]');
        await urlTab.click();

        // # Enter external URL
        const urlInput = linkModal.locator('[data-testid="url-input"]');
        await urlInput.fill('https://example.com');

        // # Enter custom link text
        const linkTextInput = linkModal.locator('input[id="link-text-input"]');
        await linkTextInput.fill('Example Site');

        // # Click Insert Link button
        await linkModal.locator('button:has-text("Insert Link")').click();

        // * Verify modal closes
        await expect(linkModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Publish the page
        await publishPage(page);
        await page.waitForLoadState('networkidle');

        // * Verify link is visible in published view
        const pageContent = getPageViewerContent(page);
        await expect(pageContent).toBeVisible();

        const publishedLink = pageContent.locator('a').filter({hasText: 'Example Site'}).first();
        await expect(publishedLink).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Click the external link and wait for new tab to open
        const [popup] = await Promise.all([page.waitForEvent('popup'), publishedLink.click()]);

        // * Verify new tab opened with correct URL
        await popup.waitForLoadState('domcontentloaded');
        expect(popup.url()).toContain('example.com');

        // * Verify original page is still on the wiki page (didn't navigate away)
        expect(page.url()).toContain('wiki');

        // # Clean up: close the popup
        await popup.close();
    },
);

/**
 * @objective Verify external URL link uses URL as fallback when link text is empty
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 */
test('uses URL as fallback link text when link text is empty', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('URL Fallback Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Page With URL Fallback');

    // # Wait for navigation to the new draft page
    await page
        .locator('[data-testid="wiki-page-publish-button"]')
        .waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

    // # Wait for editor to load
    const editor = await getEditorAndWait(page);

    // # Open link modal via Ctrl+L keyboard shortcut
    await editor.click();
    await page.waitForTimeout(UI_MICRO_WAIT * 2);
    const linkModal = await openPageLinkModal(editor);

    // * Verify modal opens
    await expect(linkModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Click on Web URL tab
    const urlTab = linkModal.locator('[data-testid="tab-url"]');
    await urlTab.click();

    // # Enter external URL
    const urlInput = linkModal.locator('[data-testid="url-input"]');
    await urlInput.fill('https://github.com/mattermost');

    // # Do NOT enter link text - leave it empty to test fallback
    const linkTextInput = linkModal.locator('input[id="link-text-input"]');
    await expect(linkTextInput).toHaveValue('');

    // # Click Insert Link button
    await linkModal.locator('button:has-text("Insert Link")').click();

    // * Verify modal closes
    await expect(linkModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify link was inserted with URL as link text (fallback)
    await page.waitForTimeout(EDITOR_LOAD_WAIT);
    const editorContent = await editor.textContent();
    expect(editorContent).toContain('https://github.com/mattermost');

    // * Verify the link element exists with URL as both text and href
    const externalLink = editor.locator('a').filter({hasText: 'https://github.com/mattermost'}).first();
    await expect(externalLink).toBeVisible({timeout: ELEMENT_TIMEOUT});

    const href = await externalLink.getAttribute('href');
    expect(href).toBe('https://github.com/mattermost');
});

/**
 * @objective Verify link modal shows error for invalid URLs
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 */
test('shows error for invalid URL in link modal', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Invalid URL Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Page With Invalid URL Test');

    // # Wait for navigation to the new draft page
    await page
        .locator('[data-testid="wiki-page-publish-button"]')
        .waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

    // # Wait for editor to load
    const editor = await getEditorAndWait(page);

    // # Open link modal via Ctrl+L keyboard shortcut
    await editor.click();
    await page.waitForTimeout(UI_MICRO_WAIT * 2);
    const linkModal = await openPageLinkModal(editor);

    // * Verify modal opens
    await expect(linkModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Click on Web URL tab
    const urlTab = linkModal.locator('[data-testid="tab-url"]');
    await urlTab.click();

    // # Enter invalid URL
    const urlInput = linkModal.locator('[data-testid="url-input"]');
    await urlInput.fill('not-a-valid-url');

    // # Click Insert Link button
    await linkModal.locator('button:has-text("Insert Link")').click();

    // * Verify error message is shown
    const errorMessage = linkModal.locator('[data-testid="url-error"]');
    await expect(errorMessage).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify modal is still open (didn't close on error)
    await expect(linkModal).toBeVisible();
});

/**
 * @objective Verify selected text can be hyperlinked to external URL
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 */
test('hyperlinks selected text to external URL', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Select Text Link Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Page With Selected Text Link');

    // # Wait for navigation to the new draft page
    await page
        .locator('[data-testid="wiki-page-publish-button"]')
        .waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

    // # Wait for editor to load
    const editor = await getEditorAndWait(page);

    // # Type text that we'll select
    await typeInEditor(page, 'Click here');
    await page.waitForTimeout(UI_MICRO_WAIT);

    // # Select all text using Ctrl+A
    await selectTextInEditor(page);
    await page.waitForTimeout(UI_MICRO_WAIT);

    // # Open link modal with selection
    await pressModifierKey(page, 'l');

    const linkModal = page.locator('[data-testid="page-link-modal"]').first();
    await expect(linkModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify the link text input has the selected text pre-filled
    const linkTextInput = linkModal.locator('input[id="link-text-input"]');
    await expect(linkTextInput).toHaveValue('Click here');

    // # Click on Web URL tab
    const urlTab = linkModal.locator('[data-testid="tab-url"]');
    await urlTab.click();

    // * Verify link text is still preserved after switching tabs
    await expect(linkTextInput).toHaveValue('Click here');

    // # Enter external URL
    const urlInput = linkModal.locator('[data-testid="url-input"]');
    await urlInput.fill('https://docs.mattermost.com');

    // # Click Insert Link button
    await linkModal.locator('button:has-text("Insert Link")').click();

    // * Verify modal closes
    await expect(linkModal).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify link was created with selected text
    await page.waitForTimeout(EDITOR_LOAD_WAIT);
    const externalLink = editor.locator('a').filter({hasText: 'Click here'}).first();
    await expect(externalLink).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify link href is correct
    const href = await externalLink.getAttribute('href');
    expect(href).toBe('https://docs.mattermost.com');
});

const UPLOAD_TIMEOUT = 15000; // Timeout for image upload to complete

/**
 * @objective Verify image upload shows placeholder with spinner during upload, then replaces with actual image
 */
test(
    'shows image placeholder during upload via slash command then replaces with image',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Image Upload Test'));

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki and get into edit mode
        await createWikiThroughUI(page, uniqueName('Image Upload Wiki'));

        // # Wait for editor to be ready
        const editor = await getEditorAndWait(page);

        // # Focus editor
        await editor.click();

        // # Open slash command menu
        const slashMenu = await openSlashCommandMenu(page);

        // # Type to filter to image upload option
        await page.keyboard.type('image');
        await page.waitForTimeout(SHORT_WAIT);

        // # Find the upload image option
        const imageOption = slashMenu.locator('.slash-command-item').filter({hasText: 'Image'}).first();
        await expect(imageOption).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Set up file chooser handler before clicking
        const fileChooserPromise = page.waitForEvent('filechooser', {timeout: ELEMENT_TIMEOUT});

        // # Click on Image option to trigger file picker
        await imageOption.click();

        // # Handle file chooser with the test image
        const fileChooser = await fileChooserPromise;
        const testImagePath = path.join(__dirname, '../../../../asset/mattermost-icon_128x128.png');
        await fileChooser.setFiles(testImagePath);

        // * Verify either placeholder or final image appears (upload may complete quickly)
        const placeholder = editor.locator('.wiki-image-placeholder');
        const uploadedImage = editor.locator('img[src*="/api/v4/files/"]');

        // Wait for either placeholder or image to appear
        await expect(placeholder.or(uploadedImage)).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // * If placeholder is visible, verify it has the expected structure
        const placeholderVisible = await placeholder.isVisible();
        if (placeholderVisible) {
            // Verify placeholder has aspect-ratio style
            const placeholderStyle = await placeholder.getAttribute('style');
            expect(placeholderStyle).toContain('aspect-ratio');

            // Wait for upload to complete and placeholder to be replaced
            await expect(placeholder).not.toBeVisible({timeout: UPLOAD_TIMEOUT});
        }

        // * Verify actual image is now in the editor
        await expect(uploadedImage).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // * Verify image has correct source (pointing to files API)
        const imageSrc = await uploadedImage.getAttribute('src');
        expect(imageSrc).toMatch(/\/api\/v4\/files\/[a-z0-9]+/i);

        // # Wait for auto-save
        await page.waitForTimeout(AUTOSAVE_WAIT);

        // # Reload and verify image persisted
        await page.reload();
        await page.waitForLoadState('networkidle');

        const editorAfterReload = await getEditorAndWait(page);
        const imageAfterReload = editorAfterReload.locator('img[src*="/api/v4/files/"]');
        await expect(imageAfterReload).toBeVisible({timeout: ELEMENT_TIMEOUT});
    },
);
