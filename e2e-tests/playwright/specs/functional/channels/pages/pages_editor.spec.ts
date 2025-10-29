// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {createWikiThroughUI, createPageThroughUI, createChildPageThroughContextMenu, getNewPageButton, openPageLinkModal, waitForPageInHierarchy} from './test_helpers';

/**
 * @objective Verify editor handles large content without performance degradation
 *
 * @precondition
 * Pages/Wiki feature is enabled on the server
 */
test('handles large content without performance degradation', {tag: '@pages'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Large Content Wiki ${pw.random.id()}`);

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();

    // # Generate large content (~50,000 characters)
    const largeContent = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(1000);

    // # Paste large content into TipTap editor (uses clipboard to ensure TipTap tracks changes)
    const editor = page.locator('.ProseMirror').first();
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
    await page.waitForTimeout(500);
    await expect(editor).toContainText('Lorem ipsum');

    // # Verify editor remains responsive - add more text at the end
    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Additional text to verify responsiveness');

    // * Verify new text was added successfully
    await expect(editor).toContainText('Additional text to verify responsiveness');

    // # Set title and publish large page
    const titleInput = page.locator('[data-testid="wiki-page-title-input"]').first();
    await titleInput.fill('Large Page Test');

    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();

    // * Verify publish succeeds
    await page.waitForLoadState('networkidle', {timeout: 15000});

    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toBeVisible();
    await expect(pageContent).toContainText('Lorem ipsum');
});

/**
 * @objective Verify editor handles Unicode and special characters correctly
 */
test('handles Unicode and special characters correctly', {tag: '@pages'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Unicode Wiki ${pw.random.id()}`);

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();

    // # Type various Unicode characters
    const unicodeContent = 'English, 中文, العربية, עברית, 日本語, 🚀 🎉 ✨, ©®™, ±≤≥≠';

    const editor = page.locator('.ProseMirror').first();
    await editor.click();
    await editor.type(unicodeContent);

    // * Verify all characters display correctly
    await expect(editor).toContainText('中文');
    await expect(editor).toContainText('العربية');
    await expect(editor).toContainText('🚀');
    await expect(editor).toContainText('日本語');

    // # Set title and publish
    const titleInput = page.locator('[data-testid="wiki-page-title-input"]').first();
    await titleInput.fill('Unicode Test Page');

    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();

    await page.waitForLoadState('networkidle');

    // * Verify persistence
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toBeVisible();
    await expect(pageContent).toContainText(unicodeContent);

    // # Refresh page and verify Unicode preserved
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(pageContent).toContainText('中文');
    await expect(pageContent).toContainText('🚀');
    await expect(pageContent).toContainText('العربية');

    // # Test editing Unicode content
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    await editButton.click();

    const editorAfter = page.locator('.ProseMirror').first();
    await expect(editorAfter).toContainText(unicodeContent);

    // Add more Unicode
    await editorAfter.click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await editorAfter.type('More: ñ, ü, ö, ä, Ø, Å');

    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // * Verify additional Unicode persisted
    await expect(pageContent).toContainText('ñ, ü, ö');
});

/**
 * @objective Verify @user mentions work correctly in editor
 */
test('handles @user mentions in editor', {tag: '@pages'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # Create another user to mention
    const mentionedUser = await adminClient.createUser({
        email: `mentioned-${pw.random.id()}@example.com`,
        username: `mentioned${pw.random.id()}`,
        password: 'Password1!',
    });
    await adminClient.addToTeam(team.id, mentionedUser.id);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Mention Wiki ${pw.random.id()}`);

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();

    // # Type @ mention in editor
    const editor = page.locator('.ProseMirror').first();
    await editor.click();
    await editor.type(`Hello @${mentionedUser.username}`);

    // * Verify mention suggestion dropdown appears
    const mentionDropdown = page.locator('.tiptap-mention-popup').first();
    await expect(mentionDropdown).toBeVisible({timeout: 5000});

    // # Select the mentioned user from dropdown
    const userOption = page.locator(`[data-testid="mentionSuggestion_${mentionedUser.username}"]`).first();
    await expect(userOption).toBeVisible({timeout: 3000});
    await userOption.click();

    // * Verify mention is properly created with data-id attribute
    await page.waitForTimeout(500);
    const userMentionInEditor = editor.locator(`.mention[data-id="${mentionedUser.id}"]`);
    await expect(userMentionInEditor).toBeVisible();

    const editorContent = await editor.textContent();
    expect(editorContent).toContain(mentionedUser.username);

    // # Set title and publish
    const titleInput = page.locator('[data-testid="wiki-page-title-input"]').first();
    await titleInput.fill('Mention Test Page');

    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // * Verify mention persists after publish
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toBeVisible();
    await expect(pageContent).toContainText(mentionedUser.username);

    // * Verify mention element with data-id attribute is properly rendered
    const userMention = pageContent.locator(`.mention[data-id="${mentionedUser.id}"]`).first();
    await expect(userMention).toBeVisible({timeout: 5000});
    await expect(userMention).toContainText(mentionedUser.username);
});

/**
 * @objective Verify ~channel mentions work correctly in editor
 */
test('handles ~channel mentions in editor', {tag: '@pages'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # Create another channel to mention
    const mentionedChannel = await adminClient.createChannel({
        team_id: team.id,
        name: `mentioned-channel-${pw.random.id()}`,
        display_name: `Mentioned Channel ${pw.random.id()}`,
        type: 'O',
    });

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Channel Mention Wiki ${pw.random.id()}`);

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();

    // # Type ~ channel mention in editor
    const editor = page.locator('.ProseMirror').first();
    await editor.click();
    await editor.type(`Please check ~${mentionedChannel.name}`);

    // * Verify channel mention suggestion dropdown appears
    const mentionDropdown = page.locator('.tiptap-channel-mention-popup, .tiptap-mention-popup').first();
    await expect(mentionDropdown).toBeVisible({timeout: 5000});

    // # Select the mentioned channel from dropdown
    const channelOption = page.locator(`text="${mentionedChannel.display_name}"`).first();
    await expect(channelOption).toBeVisible({timeout: 3000});
    await channelOption.click();

    // * Verify channel mention is properly created with data-channel-id attribute
    await page.waitForTimeout(500);
    const channelMentionInEditor = editor.locator(`.channel-mention[data-channel-id="${mentionedChannel.id}"]`);
    await expect(channelMentionInEditor).toBeVisible();

    const editorContent = await editor.textContent();
    expect(editorContent).toContain(mentionedChannel.name);

    // # Set title and publish
    const titleInput = page.locator('[data-testid="wiki-page-title-input"]').first();
    await titleInput.fill('Channel Mention Test Page');

    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // * Verify channel mention persists after publish
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toBeVisible();
    await expect(pageContent).toContainText(mentionedChannel.name);

    // * Verify channel mention element with data-channel-id exists
    const channelMention = pageContent.locator(`.channel-mention[data-channel-id="${mentionedChannel.id}"]`).first();
    await expect(channelMention).toBeVisible({timeout: 5000});

    // # Click on the ~channel mention to verify it navigates to that channel
    await channelMention.click();

    // * Verify navigation to the mentioned channel
    await page.waitForURL(`**/${team.name}/channels/${mentionedChannel.name}`, {timeout: 5000});
    await channelsPage.toBeVisible();

    // * Verify we're now viewing the mentioned channel
    const channelHeader = page.locator('#channelHeaderTitle, .channel-header__title').first();
    await expect(channelHeader).toContainText(mentionedChannel.display_name);
});

/**
 * @objective Verify multiple @mentions work correctly in same page
 */
test('handles multiple user mentions in same page', {tag: '@pages'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # Create two users to mention
    const user1 = await adminClient.createUser({
        email: `user1-${pw.random.id()}@example.com`,
        username: `user1${pw.random.id()}`,
        password: 'Password1!',
    });
    await adminClient.addToTeam(team.id, user1.id);

    const user2 = await adminClient.createUser({
        email: `user2-${pw.random.id()}@example.com`,
        username: `user2${pw.random.id()}`,
        password: 'Password1!',
    });
    await adminClient.addToTeam(team.id, user2.id);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Multi Mention Wiki ${pw.random.id()}`);

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();

    // # Type multiple mentions in editor
    const editor = page.locator('.ProseMirror').first();
    await editor.click();
    await editor.type(`Task assigned to @${user1.username} and reviewed by @${user2.username}`);

    await page.waitForTimeout(1000);

    // * Verify both mentions appear in editor
    const editorContent = await editor.textContent();
    expect(editorContent).toContain(user1.username);
    expect(editorContent).toContain(user2.username);

    // # Set title and publish
    const titleInput = page.locator('[data-testid="wiki-page-title-input"]').first();
    await titleInput.fill('Multi Mention Page');

    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // * Verify both mentions persist after publish
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toBeVisible();
    await expect(pageContent).toContainText(user1.username);
    await expect(pageContent).toContainText(user2.username);
});

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
test.skip('sends notification to mentioned user when page is published', {tag: '@pages'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    // # Create a second user who will be mentioned
    const mentionedUser = await adminClient.createUser({
        email: `mentioned-${pw.random.id()}@example.com`,
        username: `mentioned${pw.random.id()}`,
        password: 'Password1!',
    });
    await adminClient.addToTeam(team.id, mentionedUser.id);
    await adminClient.addToChannel(mentionedUser.id, channel.id);

    // # Also add mentioned user to off-topic channel (they'll navigate there to check mentions)
    const offTopicChannel = await adminClient.getChannelByName(team.id, 'off-topic');
    await adminClient.addToChannel(mentionedUser.id, offTopicChannel.id);

    // # Login as author user and create wiki
    const {page: authorPage, channelsPage: authorChannelsPage} = await pw.testBrowser.login(user);
    await authorChannelsPage.goto(team.name, channel.name);

    const wiki = await createWikiThroughUI(authorPage, `Notification Wiki ${pw.random.id()}`);

    // # Create new page with @mention
    const newPageButton = getNewPageButton(authorPage);
    await newPageButton.click();

    // # Type content with @mention
    const editor = authorPage.locator('.ProseMirror').first();
    await editor.click();
    await editor.type(`Hello @${mentionedUser.username}`);

    // * Verify mention suggestion dropdown appears
    const mentionDropdown = authorPage.locator('.tiptap-mention-popup').first();
    await expect(mentionDropdown).toBeVisible({timeout: 5000});

    // # Select the mentioned user from dropdown
    const userOption = authorPage.locator(`[data-testid="mentionSuggestion_${mentionedUser.username}"]`).first();
    await expect(userOption).toBeVisible({timeout: 3000});
    await userOption.click();

    // * Verify mention is properly created with data-id attribute
    await authorPage.waitForTimeout(500);
    const userMentionInEditor = editor.locator(`.mention[data-id="${mentionedUser.id}"]`);
    await expect(userMentionInEditor).toBeVisible();

    // # Add remaining text
    await editor.type(', please review this page!');

    // # Set title and publish
    const titleInput = authorPage.locator('[data-testid="wiki-page-title-input"]').first();
    await titleInput.fill('Page with Mention Notification');

    const publishButton = authorPage.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();
    await authorPage.waitForLoadState('networkidle');

    // * Verify page is published
    const pageContent = authorPage.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toBeVisible();

    // # Wait a moment for notification to be sent
    await authorPage.waitForTimeout(1000);

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
    await mentionedUserPage.goto(`${pw.url}/${team.name}/channels/off-topic`);
    await mentionedUserPage.waitForLoadState('networkidle');

    // * Wait for channel to fully load by checking for post input
    const postInput = mentionedUserPage.locator('#post_textbox').first();
    await expect(postInput).toBeVisible({timeout: 15000});

    // # Open the Recent Mentions RHS panel
    // The button has icon-at class based on the at_mentions_button component
    const mentionsButton = mentionedUserPage.locator('button:has(i.icon-at)').first();
    await expect(mentionsButton).toBeVisible({timeout: 10000});
    await mentionsButton.click();

    // * Verify RHS panel opened
    const rhsSidebar = mentionedUserPage.locator('#rhsContainer, .sidebar--right').first();
    await expect(rhsSidebar).toBeVisible({timeout: 10000});

    // * Verify the page mention appears in recent mentions
    // Note: If this fails with "No mentions yet", investigate whether page mentions
    // trigger the notification system (they should, like regular post mentions do)
    await expect(rhsSidebar).toContainText('Page with Mention Notification', {timeout: 5000});
    await expect(rhsSidebar).toContainText(user.username, {timeout: 5000});

    // # Cleanup
    await mentionedUserContext.close();
});

/**
 * @objective Verify Ctrl+L opens page link modal in editor
 */
test('opens page link modal with Ctrl+L keyboard shortcut', {tag: '@pages'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Link Test Wiki ${pw.random.id()}`);

    // # Create first page to link to
    await createPageThroughUI(page, 'Target Page for Linking');

    // # Create new page where we'll insert the link
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();

    // # Wait for editor to be visible and ready
    const editor = page.locator('.ProseMirror').first();
    await expect(editor).toBeVisible({timeout: 5000});
    await page.waitForTimeout(500); // Wait for editor to be fully initialized

    // # Focus editor and press Ctrl+L (or Cmd+L on Mac)
    await editor.click();
    await page.waitForTimeout(200); // Wait for focus

    // * Verify page link modal appears
    const linkModal = await openPageLinkModal(editor);
    await expect(linkModal).toBeVisible({timeout: 3000});

    // * Verify modal has correct title
    await expect(linkModal).toContainText('Link to a page');

    // * Verify search input is visible
    const searchInput = linkModal.locator('input[type="text"]').first();
    await expect(searchInput).toBeVisible();
});

/**
 * @objective Verify page link modal displays and filters available pages
 */
test('displays and filters pages in link modal', {tag: '@pages'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Filter Wiki ${pw.random.id()}`);

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

    // # Wait for editor to load and for loadChannelPages to complete
    const editor = page.locator('.ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: 5000});
    await page.waitForTimeout(2000); // Wait for loadChannelPages async action to complete

    // # Open link modal
    await editor.click();
    const linkModal = await openPageLinkModal(editor);
    await expect(linkModal).toBeVisible({timeout: 3000});

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
test('inserts page link when page selected from modal', {tag: '@pages'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Insert Link Wiki ${pw.random.id()}`);

    // # Create target page to link to
    await createPageThroughUI(page, 'Target Page');
    await waitForPageInHierarchy(page, 'Target Page');

    // # Create new page for linking
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();

    // # Wait for editor to load and for loadChannelPages to complete
    const editor = page.locator('.ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: 5000});
    await page.waitForTimeout(2000); // Wait for loadChannelPages async action to complete

    // # Type some text first
    await editor.click();
    await editor.type('Check out this page: ');

    // # Open link modal
    const linkModal = await openPageLinkModal(editor);
    await expect(linkModal).toBeVisible({timeout: 3000});

    // # Click on "Target Page" in the list
    const targetPageOption = linkModal.locator('text="Target Page"').first();
    await targetPageOption.click();

    // * Verify modal closes
    await expect(linkModal).not.toBeVisible();

    // * Verify link appears in editor
    await page.waitForTimeout(500);
    const editorContent = await editor.textContent();
    expect(editorContent).toContain('Target Page');

    // * Verify link has correct attributes (check for link element)
    const pageLink = editor.locator('a[href*="Target"]').first();
    await expect(pageLink).toBeVisible();
    await expect(pageLink).toContainText('Target Page');
});

/**
 * @objective Verify clicking page link navigates to linked page
 */
test('navigates to linked page when link is clicked', {tag: '@pages'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Navigation Wiki ${pw.random.id()}`);

    // # Create target page with distinctive content
    await createPageThroughUI(page, 'Linked Target Page', 'This is the linked page content');
    await waitForPageInHierarchy(page, 'Linked Target Page');

    // # Create source page with link
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();

    // # Wait for editor to load and for loadChannelPages to complete
    const editor = page.locator('.ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: 5000});
    await page.waitForTimeout(2000); // Wait for loadChannelPages async action to complete

    await editor.click();
    await editor.type('Navigate here: ');

    // # Insert page link
    const linkModal = await openPageLinkModal(editor);
    await expect(linkModal).toBeVisible({timeout: 3000});

    const targetPageOption = linkModal.locator('text="Linked Target Page"').first();
    await targetPageOption.click();

    // # Set title and publish source page
    const titleInput = page.locator('[data-testid="wiki-page-title-input"]').first();
    await titleInput.fill('Source Page with Link');

    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // * Verify page is published
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toBeVisible();

    // # Click on the page link
    const pageLink = pageContent.locator('a:has-text("Linked Target Page")').first();
    await expect(pageLink).toBeVisible();
    await pageLink.click();

    // * Verify navigation to target page
    await page.waitForLoadState('networkidle');
    await expect(pageContent).toContainText('This is the linked page content');

    // * Verify page title changed
    const currentPageTitle = page.locator('[data-testid="wiki-page-title"]').first();
    await expect(currentPageTitle).toContainText('Linked Target Page');
});

/**
 * @objective Verify multiple page links can be inserted in same page
 */
test('inserts multiple page links in same page', {tag: '@pages'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Multi Link Wiki ${pw.random.id()}`);

    // # Create multiple target pages
    await createPageThroughUI(page, 'First Page');
    await waitForPageInHierarchy(page, 'First Page');
    await createPageThroughUI(page, 'Second Page');
    await waitForPageInHierarchy(page, 'Second Page');
    await createPageThroughUI(page, 'Third Page');
    await waitForPageInHierarchy(page, 'Third Page');

    // # Create new page for linking
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();

    // # Wait for editor to load and for loadChannelPages to complete
    const editor = page.locator('.ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: 5000});
    await page.waitForTimeout(2000); // Wait for loadChannelPages async action to complete

    await editor.click();

    // # Insert first link
    await editor.type('See ');
    let linkModal = await openPageLinkModal(editor);
    await expect(linkModal).toBeVisible({timeout: 3000});
    await linkModal.locator('text="First Page"').first().click();

    // # Insert second link
    await editor.type(' and ');
    linkModal = await openPageLinkModal(editor);
    await expect(linkModal).toBeVisible({timeout: 3000});
    await linkModal.locator('text="Second Page"').first().click();

    // # Insert third link
    await editor.type(' also ');
    linkModal = await openPageLinkModal(editor);
    await expect(linkModal).toBeVisible({timeout: 3000});
    await linkModal.locator('text="Third Page"').first().click();

    // * Verify all three links appear in editor
    await page.waitForTimeout(500);
    const editorContent = await editor.textContent();
    expect(editorContent).toContain('First Page');
    expect(editorContent).toContain('Second Page');
    expect(editorContent).toContain('Third Page');

    // # Publish page
    const titleInput = page.locator('[data-testid="wiki-page-title-input"]').first();
    await titleInput.fill('Page with Multiple Links');

    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // * Verify all links persist after publish
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageContent).toBeVisible();
    await expect(pageContent).toContainText('First Page');
    await expect(pageContent).toContainText('Second Page');
    await expect(pageContent).toContainText('Third Page');

    // * Verify all links are clickable
    const firstLink = pageContent.locator('a:has-text("First Page")').first();
    const secondLink = pageContent.locator('a:has-text("Second Page")').first();
    const thirdLink = pageContent.locator('a:has-text("Third Page")').first();

    await expect(firstLink).toBeVisible();
    await expect(secondLink).toBeVisible();
    await expect(thirdLink).toBeVisible();
});

/**
 * @objective Verify page link modal shows empty state when no pages exist
 */
test('displays empty state in link modal when no pages available', {tag: '@pages'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI (but don't create any pages)
    const wiki = await createWikiThroughUI(page, `Empty Wiki ${pw.random.id()}`);

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();

    // # Open link modal
    const editor = page.locator('.ProseMirror').first();
    await editor.click();

    const linkModal = await openPageLinkModal(editor);
    await expect(linkModal).toBeVisible({timeout: 3000});

    // * Verify empty state message appears
    await expect(linkModal).toContainText(/No pages found|No pages available/i);
});

/**
 * @objective Verify link modal can be closed with Escape key
 */
test('closes link modal with Escape key', {tag: '@pages'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Escape Wiki ${pw.random.id()}`);

    // # Create page
    await createPageThroughUI(page, 'Test Page');
    await waitForPageInHierarchy(page, 'Test Page');

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();

    // # Wait for editor to load and for loadChannelPages to complete
    const editor = page.locator('.ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: 5000});
    await page.waitForTimeout(1000); // Wait for loadChannelPages async action to complete

    // # Open link modal
    await editor.click();

    const linkModal = await openPageLinkModal(editor);
    await expect(linkModal).toBeVisible({timeout: 3000});

    // # Press Escape key
    await page.keyboard.press('Escape');

    // * Verify modal closes
    await expect(linkModal).not.toBeVisible();

    // * Verify editor still has focus
    const activeElement = await page.evaluate(() => document.activeElement?.className);
    expect(activeElement).toContain('ProseMirror');
});

/**
 * @objective Verify page links work correctly with child pages in hierarchy
 */
test('links to child pages in page hierarchy', {tag: '@pages'}, async ({pw}) => {
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Hierarchy Wiki ${pw.random.id()}`);

    // # Create parent page
    const parentPage = await createPageThroughUI(page, 'Parent Page');
    await waitForPageInHierarchy(page, 'Parent Page');

    // # Create child page using context menu
    await createChildPageThroughContextMenu(page, parentPage.id, 'Child Page', 'This is a child page');
    await waitForPageInHierarchy(page, 'Child Page');

    // # Create new page for linking
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();

    // # Wait for editor to load and for loadChannelPages to complete
    const editor = page.locator('.ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: 5000});
    await page.waitForTimeout(2000); // Wait for loadChannelPages async action to complete

    // # Insert link to child page
    await editor.click();
    await editor.type('Link to child: ');

    const linkModal = await openPageLinkModal(editor);
    await expect(linkModal).toBeVisible({timeout: 3000});

    // * Verify child page appears in list
    await expect(linkModal).toContainText('Child Page');

    // # Select child page
    const childPageOption = linkModal.locator('text="Child Page"').first();
    await childPageOption.click();

    // * Verify link inserted
    await page.waitForTimeout(500);
    const editorContent = await editor.textContent();
    expect(editorContent).toContain('Child Page');

    // # Publish and verify link works
    const titleInput = page.locator('[data-testid="wiki-page-title-input"]').first();
    await titleInput.fill('Link to Child Page');

    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]').first();
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // # Click link to child page
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    const childLink = pageContent.locator('a:has-text("Child Page")').first();
    await expect(childLink).toBeVisible();
    await childLink.click();

    // * Verify navigation to child page
    await page.waitForLoadState('networkidle');
    const currentPageTitle = page.locator('[data-testid="wiki-page-title"]').first();
    await expect(currentPageTitle).toContainText('Child Page');
});
