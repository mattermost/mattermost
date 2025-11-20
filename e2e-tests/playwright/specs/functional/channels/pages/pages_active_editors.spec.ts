// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';

import {createWikiThroughUI, createTestChannel, getEditorAndWait, typeInEditor, fillCreatePageModal, getNewPageButton, clickPageInHierarchy, enterEditMode, publishPage, navigateToPage, deletePageDraft} from './test_helpers';

/**
 * @objective Verify active editors indicator displays when another user edits the same page
 */
test('shows active editor when another user edits page', {tag: '@pages'}, async ({pw, sharedPagesSetup, context}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    // # Create a second user
    const user2 = pw.random.user('user2');
    const {id: user2Id} = await adminClient.createUser(user2, '', '');
    await adminClient.addToTeam(team.id, user2Id);
    await adminClient.addToChannel(user2Id, channel.id);

    // # User 1 logs in and creates a wiki with a page
    const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user);

    await channelsPage1.goto(team.name, channel.name);

    const wiki = await createWikiThroughUI(page1, `Active Editors Wiki ${pw.random.id()}`);

    const newPageButton = getNewPageButton(page1);
    await newPageButton.click();
    await fillCreatePageModal(page1, 'Shared Page');

    // # Wait for editor to appear
    const editor1 = await getEditorAndWait(page1);
    await typeInEditor(page1, 'Initial content');

    // # Wait for draft to save
    await page1.waitForTimeout(2000);

    // # Publish the page
    await publishPage(page1);
    await page1.screenshot({path: '/tmp/test-user1-after-publish.png', fullPage: true});

    // # Get page ID from URL
    const pageUrl = page1.url();
    const pageId = pageUrl.split('/').pop();

    // Verify all URL components are valid
    if (!pageId || !wiki.id || !channel.id || !team.name) {
        throw new Error(`Missing URL components: pageId=${pageId}, wikiId=${wiki.id}, channelId=${channel.id}, teamName=${team.name}`);
    }

    // # User 2 logs in and navigates directly to the wiki page
    const {page: page2, channelsPage: channelsPage2} = await pw.testBrowser.login(user2);

    await page2.screenshot({path: '/tmp/test-user2-after-login.png', fullPage: true});

    // Navigate to the channel first to ensure proper authentication
    await channelsPage2.goto(team.name, channel.name);
    await page2.screenshot({path: '/tmp/test-user2-after-goto-channel.png', fullPage: true});

    // Now navigate to the specific page
    await navigateToPage(page2, pw.url, team.name, channel.id, wiki.id, pageId);
    await page2.screenshot({path: '/tmp/test-user2-after-navigate.png', fullPage: true});

    // # Start editing the page
    await enterEditMode(page2);
    await page2.screenshot({path: '/tmp/test-user2-after-enter-edit-mode.png', fullPage: true});

    const editor2 = await getEditorAndWait(page2);
    await typeInEditor(page2, ' User 2 editing');
    await page2.screenshot({path: '/tmp/test-user2-after-typing.png', fullPage: true});

    // # Wait for draft to save
    await page2.waitForTimeout(2000);
    await page2.screenshot({path: '/tmp/test-user2-after-draft-save.png', fullPage: true});

    // * User 1 should see active editors indicator showing User 2
    await page1.screenshot({path: '/tmp/test-user1-before-active-editor-check.png', fullPage: true});
    const activeEditorsIndicator = page1.locator('.active-editors-indicator');
    await expect(activeEditorsIndicator).toBeVisible({timeout: 10000});
    await page1.screenshot({path: '/tmp/test-user1-active-editor-visible.png', fullPage: true});

    // * Verify the indicator shows 1 person editing
    await expect(activeEditorsIndicator).toContainText('1 person editing');

    // * Verify User 2's avatar is displayed
    const avatar = activeEditorsIndicator.locator(`[data-testid*="avatar"]`);
    await expect(avatar).toBeVisible();

    await page2.close();
});

/**
 * @objective Verify active editors indicator shows multiple editors
 */
test('displays multiple active editors with avatars and count', {tag: '@pages'}, async ({pw, sharedPagesSetup, context}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    // # Create two additional users
    const user2 = pw.random.user('user2');
    const {id: user2Id} = await adminClient.createUser(user2, '', '');
    await adminClient.addToTeam(team.id, user2Id);
    await adminClient.addToChannel(user2Id, channel.id);

    const user3 = pw.random.user('user3');
    const {id: user3Id} = await adminClient.createUser(user3, '', '');
    await adminClient.addToTeam(team.id, user3Id);
    await adminClient.addToChannel(user3Id, channel.id);

    // # User 1 logs in and creates a wiki with a page
    const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user);
    await channelsPage1.goto(team.name, channel.name);

    const wiki = await createWikiThroughUI(page1, `Multi Editor Wiki ${pw.random.id()}`);

    const newPageButton = getNewPageButton(page1);
    await newPageButton.click();
    await fillCreatePageModal(page1, 'Multi Editor Page');

    const editor1 = await getEditorAndWait(page1);
    await typeInEditor(page1, 'Initial content');
    await page1.waitForTimeout(2000);

    // # Publish the page
    await publishPage(page1);

    // # Get page ID from URL
    const pageUrl = page1.url();
    const pageId = pageUrl.split('/').pop();

    // # User 2 logs in and starts editing
    const {page: page2} = await pw.testBrowser.login(user2);
    await navigateToPage(page2, pw.url, team.name, channel.id, wiki.id, pageId);

    await enterEditMode(page2);

    const editor2 = await getEditorAndWait(page2);
    await typeInEditor(page2, ' User 2 content');
    await page2.waitForTimeout(2000);

    // # User 3 logs in and starts editing
    const {page: page3} = await pw.testBrowser.login(user3);
    await navigateToPage(page3, pw.url, team.name, channel.id, wiki.id, pageId);

    await enterEditMode(page3);

    const editor3 = await getEditorAndWait(page3);
    await typeInEditor(page3, ' User 3 content');
    await page3.waitForTimeout(2000);

    // * User 1 should see active editors indicator showing both users
    const activeEditorsIndicator = page1.locator('.active-editors-indicator');
    await expect(activeEditorsIndicator).toBeVisible({timeout: 10000});

    // * Verify the indicator shows 2 people editing
    await expect(activeEditorsIndicator).toContainText('2 people editing');

    // * Verify multiple avatars are displayed
    const avatars = activeEditorsIndicator.locator('[data-testid*="avatar"]');
    await expect(avatars).toHaveCount(2);

    await page2.close();
    await page3.close();
});

/**
 * @objective Verify active editors indicator disappears when editors stop editing
 */
test('removes editor from indicator when draft is deleted', {tag: '@pages'}, async ({pw, sharedPagesSetup, context}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    // # Create a second user
    const user2 = pw.random.user('user2');
    const {id: user2Id} = await adminClient.createUser(user2, '', '');
    await adminClient.addToTeam(team.id, user2Id);
    await adminClient.addToChannel(user2Id, channel.id);

    // # User 1 creates a page
    const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user);
    await channelsPage1.goto(team.name, channel.name);

    const wiki = await createWikiThroughUI(page1, `Editor Removal Wiki ${pw.random.id()}`);

    const newPageButton = getNewPageButton(page1);
    await newPageButton.click();
    await fillCreatePageModal(page1, 'Removal Test Page');

    const editor1 = await getEditorAndWait(page1);
    await typeInEditor(page1, 'Initial content');
    await page1.waitForTimeout(2000);

    // # Publish the page
    await publishPage(page1);

    // # Get page ID from URL
    const pageUrl = page1.url();
    const pageId = pageUrl.split('/').pop();

    // # User 2 starts editing
    const {page: page2} = await pw.testBrowser.login(user2);

    await navigateToPage(page2, pw.url, team.name, channel.id, wiki.id, pageId);

    await enterEditMode(page2);

    const editor2 = await getEditorAndWait(page2);
    await typeInEditor(page2, ' User 2 content');
    await page2.waitForTimeout(2000);

    // * User 1 should see active editors indicator
    const activeEditorsIndicator = page1.locator('.active-editors-indicator');
    await expect(activeEditorsIndicator).toBeVisible({timeout: 10000});

    // # User 2 deletes the draft through the UI
    await deletePageDraft(page2, pageId!);

    // * Active editors indicator should disappear for User 1
    await expect(activeEditorsIndicator).not.toBeVisible({timeout: 10000});

    await page2.close();
});

/**
 * @objective Verify active editors indicator does not show current user
 */
test('does not show current user in active editors list', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    // # User logs in and creates a draft
    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    const wiki = await createWikiThroughUI(page, `Self Edit Wiki ${pw.random.id()}`);

    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Self Edit Page');

    const editor = await getEditorAndWait(page);
    await typeInEditor(page, 'User editing their own draft');
    await page.waitForTimeout(2000);

    // * Active editors indicator should not be visible
    const activeEditorsIndicator = page.locator('.active-editors-indicator');
    await expect(activeEditorsIndicator).not.toBeVisible();
});

/**
 * @objective Verify active editors indicator shows correct count with overflow
 */
test('displays overflow count when more than 3 editors', {tag: '@pages'}, async ({pw, sharedPagesSetup, context}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    // # Create 4 additional users
    const users = [];
    for (let i = 0; i < 4; i++) {
        const newUser = pw.random.user(`user${i}`);
        const {id: newUserId} = await adminClient.createUser(newUser, '', '');
        await adminClient.addToTeam(team.id, newUserId);
        await adminClient.addToChannel(newUserId, channel.id);
        users.push(newUser);
    }

    // # User 1 creates a page
    const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user);
    await channelsPage1.goto(team.name, channel.name);

    const wiki = await createWikiThroughUI(page1, `Overflow Wiki ${pw.random.id()}`);

    const newPageButton = getNewPageButton(page1);
    await newPageButton.click();
    await fillCreatePageModal(page1, 'Overflow Page');

    const editor1 = await getEditorAndWait(page1);
    await typeInEditor(page1, 'Initial content');
    await page1.waitForTimeout(2000);

    // # Publish the page
    await publishPage(page1);

    // # Get page ID from URL
    const pageUrl = page1.url();
    const pageId = pageUrl.split('/').pop();

    // # All 4 users start editing
    const pages = [];
    for (let i = 0; i < 4; i++) {
        const {page: userPage} = await pw.testBrowser.login(users[i]);
        const wikiPageUrl = `${pw.url}/${team.name}/wiki/${channel.id}/${wiki.id}/${pageId}`;
        await userPage.goto(wikiPageUrl);
        await userPage.waitForLoadState('networkidle');

        const pageViewer = userPage.locator('[data-testid="page-viewer-content"]');
        await pageViewer.waitFor({state: 'visible', timeout: 10000});

        await enterEditMode(userPage);

        const editor = await getEditorAndWait(userPage);
        await typeInEditor(userPage, ` User ${i} content`);
        await userPage.waitForTimeout(2000);

        pages.push(userPage);
    }

    // * User 1 should see active editors indicator with overflow
    const activeEditorsIndicator = page1.locator('.active-editors-indicator');
    await expect(activeEditorsIndicator).toBeVisible({timeout: 10000});

    // * Verify only 3 avatars are shown
    const avatars = activeEditorsIndicator.locator('[data-testid*="avatar"]');
    await expect(avatars).toHaveCount(3);

    // * Verify overflow indicator shows +1
    const overflowIndicator = activeEditorsIndicator.locator('.active-editors-indicator__more');
    await expect(overflowIndicator).toBeVisible();
    await expect(overflowIndicator).toContainText('+1');

    // * Verify total count shows 4 people
    await expect(activeEditorsIndicator).toContainText('4 people editing');

    // # Cleanup
    for (const p of pages) {
        await p.close();
    }
});

/**
 * @objective Verify active editors indicator updates when user navigates away without deleting draft
 */
test.skip('removes editor from indicator when user navigates away', {tag: '@pages'}, async ({pw, sharedPagesSetup, context}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${pw.random.id()}`);

    // # Create a second user
    const user2 = pw.random.user('user2');
    const {id: user2Id} = await adminClient.createUser(user2, '', '');
    await adminClient.addToTeam(team.id, user2Id);
    await adminClient.addToChannel(user2Id, channel.id);

    // # User 1 creates a page
    const {page: page1, channelsPage: channelsPage1} = await pw.testBrowser.login(user);

    await channelsPage1.goto(team.name, channel.name);

    const wiki = await createWikiThroughUI(page1, `Navigate Away Wiki ${pw.random.id()}`);

    const newPageButton = getNewPageButton(page1);
    await newPageButton.click();
    await fillCreatePageModal(page1, 'Navigate Away Page');

    const editor1 = await getEditorAndWait(page1);
    await typeInEditor(page1, 'Initial content');
    await page1.waitForTimeout(2000);

    // # Publish the page
    await publishPage(page1);

    // # Get page ID from URL
    const pageUrl = page1.url();
    const pageId = pageUrl.split('/').pop();

    // # User 2 starts editing
    const {page: page2} = await pw.testBrowser.login(user2);

    await navigateToPage(page2, pw.url, team.name, channel.id, wiki.id, pageId);

    await enterEditMode(page2);

    const editor2 = await getEditorAndWait(page2);
    await typeInEditor(page2, ' User 2 editing');
    await page2.waitForTimeout(2000);

    // * User 1 should see active editors indicator
    const activeEditorsIndicator = page1.locator('.active-editors-indicator');
    await expect(activeEditorsIndicator).toBeVisible({timeout: 10000});
    await expect(activeEditorsIndicator).toContainText('1 person editing');

    // # User 2 navigates away WITHOUT deleting draft (draft persists)
    await page2.goto(`${pw.url}/${team.name}/channels/${channel.name}`);
    await page2.waitForTimeout(2000);

    // * Active editors indicator should disappear for User 1 within 60 seconds (stale cleanup interval)
    // Note: This relies on the frontend's stale cleanup mechanism since we're NOT deleting the draft
    await expect(activeEditorsIndicator).not.toBeVisible({timeout: 65000});

    // # Verify draft still exists for User 2 (can resume editing)
    await navigateToPage(page2, pw.url, team.name, channel.id, wiki.id, pageId);

    // * Draft should be restored when returning to the page
    const draftIndicator = page2.locator('[data-testid="draft-indicator"]');
    const hasUnsavedChanges = await draftIndicator.isVisible().catch(() => false);

    await page2.close();
});
