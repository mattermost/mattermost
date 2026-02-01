// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    createPageThroughUI,
    getNewPageButton,
    waitForPageInHierarchy,
    fillCreatePageModal,
    typeInEditor,
    publishPage,
    getEditorAndWait,
    getPageViewerContent,
    loginAndNavigateToChannel,
    pressModifierKey,
    waitForLinkBubbleMenu,
    positionCursorInLink,
    createLinkFromSelection,
    uniqueName,
    SHORT_WAIT,
    ELEMENT_TIMEOUT,
    HIERARCHY_TIMEOUT,
    UI_MICRO_WAIT,
} from './test_helpers';

/**
 * @objective Verify link can be created and displays correctly in the editor
 */
test('creates page link with correct text and styling', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Link Test Wiki'));

    // # Create a target page to link to
    await createPageThroughUI(page, 'Target Page');
    await waitForPageInHierarchy(page, 'Target Page');

    // # Create new page for testing link
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Link Test');

    // # Wait for editor to be visible
    const editor = await getEditorAndWait(page);
    await waitForPageInHierarchy(page, 'Target Page', HIERARCHY_TIMEOUT);

    // # Type some text and create a link using keyboard shortcut
    await typeInEditor(page, 'Check out this ');
    await editor.type('page link here');

    // # Select "page link here" by using Shift+ArrowLeft
    for (let i = 0; i < 14; i++) {
        await page.keyboard.press('Shift+ArrowLeft');
    }
    await page.waitForTimeout(UI_MICRO_WAIT);

    // # Open link modal with Ctrl+L
    await pressModifierKey(page, 'l');

    // # Wait for link modal to appear
    const linkModal = page.locator('[data-testid="page-link-modal"]').first();
    await expect(linkModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Search for target page
    const searchInput = linkModal.locator('input[id="page-search-input"]');
    await searchInput.fill('Target Page');

    // # Select the target page
    const targetPageOption = linkModal.locator('text="Target Page"').first();
    await targetPageOption.click();

    // # Click Insert Link button
    const insertLinkButton = linkModal.locator('button:has-text("Insert Link")');
    await insertLinkButton.click();

    // * Verify modal closes
    await expect(linkModal).not.toBeVisible();

    // # Wait for link to be inserted
    await page.waitForTimeout(SHORT_WAIT);

    // * Verify link exists in editor
    const pageLink = editor.locator('a').first();
    await expect(pageLink).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify link has correct text
    await expect(pageLink).toHaveText('page link here');

    // * Verify link has wiki-page-link class (from TipTap Link config)
    await expect(pageLink).toHaveClass(/wiki-page-link/);
});

/**
 * @objective Verify that links in editor are persisted after publish
 */
test('link persists after publishing page', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Link Persist Wiki'));

    // # Create a target page to link to
    const targetPage = await createPageThroughUI(page, 'Target Page');
    await waitForPageInHierarchy(page, 'Target Page');

    // # Create new page with a link
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Link Persist Test');

    const editor = await getEditorAndWait(page);
    await waitForPageInHierarchy(page, 'Target Page', HIERARCHY_TIMEOUT);

    // # Type short link text and select it
    await typeInEditor(page, 'See ');
    await editor.type('link');

    // # Select "link" (4 characters)
    for (let i = 0; i < 4; i++) {
        await page.keyboard.press('Shift+ArrowLeft');
    }
    await page.waitForTimeout(UI_MICRO_WAIT);

    await pressModifierKey(page, 'l');

    const linkModal = page.locator('[data-testid="page-link-modal"]').first();
    await expect(linkModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

    const searchInput = linkModal.locator('input[id="page-search-input"]');
    await searchInput.fill('Target Page');
    await page.waitForTimeout(UI_MICRO_WAIT);

    await linkModal.locator('text="Target Page"').first().click();
    await linkModal.locator('button:has-text("Insert Link")').click();
    await expect(linkModal).not.toBeVisible();

    // # Wait for link to be inserted and verify in editor
    await page.waitForTimeout(SHORT_WAIT);
    const editorLink = editor.locator('a').first();
    await expect(editorLink).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Publish the page
    await publishPage(page);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(SHORT_WAIT);

    // * Verify page content is visible
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toBeVisible();

    // * Verify link exists in published view (any link element)
    const publishedLink = pageContent.locator('a').first();
    await expect(publishedLink).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify link points to target page
    const href = await publishedLink.getAttribute('href');
    expect(href).toContain(targetPage.id);
});

/**
 * @objective Verify link text can be customized during link creation
 */
test('allows custom link text when creating link', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Custom Link Wiki'));

    // # Create a target page to link to
    await createPageThroughUI(page, 'Target Page');
    await waitForPageInHierarchy(page, 'Target Page');

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Custom Link Test');

    const editor = await getEditorAndWait(page);
    await waitForPageInHierarchy(page, 'Target Page', HIERARCHY_TIMEOUT);

    // # Type text and select it for linking
    await typeInEditor(page, 'Click ');
    await editor.type('here for more info');

    // # Select "here for more info"
    for (let i = 0; i < 18; i++) {
        await page.keyboard.press('Shift+ArrowLeft');
    }

    await pressModifierKey(page, 'l');

    const linkModal = page.locator('[data-testid="page-link-modal"]').first();
    await expect(linkModal).toBeVisible({timeout: ELEMENT_TIMEOUT});

    const searchInput = linkModal.locator('input[id="page-search-input"]');
    await searchInput.fill('Target Page');

    await linkModal.locator('text="Target Page"').first().click();

    // # Modify the link text in the modal
    const linkTextInput = linkModal.locator('input[id="link-text-input"]');
    await linkTextInput.clear();
    await linkTextInput.fill('Custom Link Text');

    await linkModal.locator('button:has-text("Insert Link")').click();
    await expect(linkModal).not.toBeVisible();

    await page.waitForTimeout(SHORT_WAIT);

    // * Verify link has custom text
    const pageLink = editor.locator('a').first();
    await expect(pageLink).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(pageLink).toHaveText('Custom Link Text');
});

/**
 * @objective Verify link bubble menu appears when clicking on a link without selecting text
 */
test('shows link bubble menu when clicking on a link', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // Capture console messages for debugging
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
        const text = msg.text();
        // Capture LinkBubbleMenu, tippy, and BubbleMenu logs
        if (
            text.includes('LinkBubbleMenu') ||
            text.includes('tippy') ||
            text.includes('Tippy') ||
            text.includes('BubbleMenu')
        ) {
            consoleLogs.push(text);
        }
    });

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Bubble Menu Wiki'));

    // # Create a target page to link to
    await createPageThroughUI(page, 'Target Page');
    await waitForPageInHierarchy(page, 'Target Page');

    // # Create new page for testing bubble menu
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Bubble Menu Test');

    const editor = await getEditorAndWait(page);
    await waitForPageInHierarchy(page, 'Target Page', HIERARCHY_TIMEOUT);

    // # Type text and create a link
    await typeInEditor(page, 'Click ');
    await editor.type('this link');

    // # Select "this link" and create link
    for (let i = 0; i < 9; i++) {
        await page.keyboard.press('Shift+ArrowLeft');
    }
    await page.waitForTimeout(UI_MICRO_WAIT);
    await createLinkFromSelection(page, 'Target Page');

    // * Verify link was created in editor
    const pageLink = editor.locator('a').first();
    await expect(pageLink).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Click directly on the link text to position cursor inside it
    await pageLink.click();
    await page.waitForTimeout(1000); // Wait longer for bubble menu to appear

    // Check if any bubble menu element exists (even if not visible)
    const bubbleExists = await page.locator('[data-testid="link-bubble-menu"]').count();
    // eslint-disable-next-line no-console
    console.log('Bubble menu element count:', bubbleExists);

    // Check for any Tippy-related elements
    const tippyBoxCount = await page.locator('.tippy-box').count();
    const tippyContentCount = await page.locator('.tippy-content').count();
    // eslint-disable-next-line no-console
    console.log('Tippy elements:', {tippyBoxCount, tippyContentCount});

    // Debug: Print console logs from LinkBubbleMenu
    // eslint-disable-next-line no-console
    console.log('LinkBubbleMenu console logs:', consoleLogs.slice(-20));

    // * Verify link bubble menu appears
    const bubbleMenu = await waitForLinkBubbleMenu(page);

    // * Verify bubble menu contains expected buttons
    await expect(bubbleMenu.locator('[data-testid="link-open-button"]')).toBeVisible();
    await expect(bubbleMenu.locator('[data-testid="link-copy-button"]')).toBeVisible();
    await expect(bubbleMenu.locator('[data-testid="link-edit-button"]')).toBeVisible();
    await expect(bubbleMenu.locator('[data-testid="link-unlink-button"]')).toBeVisible();
});

/**
 * @objective Verify link bubble menu closes when pressing Escape key
 */
test('closes link bubble menu when pressing Escape', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Escape Test Wiki'));

    // # Create a target page to link to
    await createPageThroughUI(page, 'Target Page');
    await waitForPageInHierarchy(page, 'Target Page');

    // # Create new page for testing Escape key
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Escape Key Test');

    const editor = await getEditorAndWait(page);
    await waitForPageInHierarchy(page, 'Target Page', HIERARCHY_TIMEOUT);

    // # Type text and create a link
    await typeInEditor(page, 'Press ');
    await editor.type('escape');

    // # Select "escape" and create link
    for (let i = 0; i < 6; i++) {
        await page.keyboard.press('Shift+ArrowLeft');
    }
    await page.waitForTimeout(UI_MICRO_WAIT);
    await createLinkFromSelection(page, 'Target Page');

    // * Verify link was created in editor
    const pageLink = editor.locator('a').first();
    await expect(pageLink).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Position cursor inside the link
    await positionCursorInLink(page, editor);

    // * Verify bubble menu is visible
    const bubbleMenu = await waitForLinkBubbleMenu(page);

    // # Press Escape key
    await page.keyboard.press('Escape');
    await page.waitForTimeout(UI_MICRO_WAIT);

    // * Verify bubble menu is closed
    await expect(bubbleMenu).not.toBeVisible();
});

/**
 * @objective Verify Copy Link button copies URL to clipboard
 */
test('copies link URL to clipboard when clicking Copy button', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Grant clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Copy Link Wiki'));

    // # Create a target page to link to
    const targetPage = await createPageThroughUI(page, 'Target Page');
    await waitForPageInHierarchy(page, 'Target Page');

    // # Create new page for testing copy
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Copy Link Test');

    const editor = await getEditorAndWait(page);
    await waitForPageInHierarchy(page, 'Target Page', HIERARCHY_TIMEOUT);

    // # Type text and create a link
    await typeInEditor(page, 'Copy ');
    await editor.type('this');

    // # Select "this" and create link
    for (let i = 0; i < 4; i++) {
        await page.keyboard.press('Shift+ArrowLeft');
    }
    await page.waitForTimeout(UI_MICRO_WAIT);
    await createLinkFromSelection(page, 'Target Page');

    // * Verify link was created in editor
    const pageLink = editor.locator('a').first();
    await expect(pageLink).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Position cursor inside the link
    await positionCursorInLink(page, editor);

    // * Verify bubble menu is visible
    const bubbleMenu = await waitForLinkBubbleMenu(page);

    // # Click Copy Link button
    const copyButton = bubbleMenu.locator('[data-testid="link-copy-button"]');
    await copyButton.click();
    await page.waitForTimeout(SHORT_WAIT);

    // * Verify link URL was copied to clipboard
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain(targetPage.id);
});

/**
 * @objective Verify Edit Link button opens the link edit modal
 */
test('opens link edit modal when clicking Edit button', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Edit Link Wiki'));

    // # Create a target page to link to
    await createPageThroughUI(page, 'Target Page');
    await waitForPageInHierarchy(page, 'Target Page');

    // # Create new page for testing edit
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Edit Link Test');

    const editor = await getEditorAndWait(page);
    await waitForPageInHierarchy(page, 'Target Page', HIERARCHY_TIMEOUT);

    // # Type text and create a link
    await typeInEditor(page, 'Edit ');
    await editor.type('me');

    // # Select "me" and create link
    for (let i = 0; i < 2; i++) {
        await page.keyboard.press('Shift+ArrowLeft');
    }
    await page.waitForTimeout(UI_MICRO_WAIT);
    await createLinkFromSelection(page, 'Target Page');

    // * Verify link was created in editor
    const pageLink = editor.locator('a').first();
    await expect(pageLink).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Position cursor inside the link
    await positionCursorInLink(page, editor);

    // * Verify bubble menu is visible
    const bubbleMenu = await waitForLinkBubbleMenu(page);
    const linkModal = page.locator('[data-testid="page-link-modal"]').first();

    // # Click Edit Link button
    const editButton = bubbleMenu.locator('[data-testid="link-edit-button"]');
    await editButton.click();
    await page.waitForTimeout(UI_MICRO_WAIT);

    // * Verify link modal opens for editing
    await expect(linkModal).toBeVisible({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify Remove Link button removes the link while keeping text
 */
test('removes link when clicking Unlink button', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Unlink Wiki'));

    // # Create a target page to link to
    await createPageThroughUI(page, 'Target Page');
    await waitForPageInHierarchy(page, 'Target Page');

    // # Create new page for testing unlink
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Unlink Test');

    const editor = await getEditorAndWait(page);
    await waitForPageInHierarchy(page, 'Target Page', HIERARCHY_TIMEOUT);

    // # Type text and create a link
    await typeInEditor(page, 'Remove ');
    await editor.type('this link');

    // # Select "this link" and create link
    for (let i = 0; i < 9; i++) {
        await page.keyboard.press('Shift+ArrowLeft');
    }
    await page.waitForTimeout(UI_MICRO_WAIT);
    await createLinkFromSelection(page, 'Target Page');

    // * Verify link exists
    const pageLink = editor.locator('a').first();
    await expect(pageLink).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(pageLink).toHaveText('this link');

    // # Position cursor inside the link
    await positionCursorInLink(page, editor);

    // * Verify bubble menu is visible
    const bubbleMenu = await waitForLinkBubbleMenu(page);

    // # Click Unlink button
    const unlinkButton = bubbleMenu.locator('[data-testid="link-unlink-button"]');
    await unlinkButton.click();
    await page.waitForTimeout(SHORT_WAIT);

    // * Verify bubble menu is closed
    await expect(bubbleMenu).not.toBeVisible();

    // * Verify link is removed (no more anchor elements)
    await expect(editor.locator('a')).toHaveCount(0);

    // * Verify text is preserved
    await expect(editor).toContainText('Remove this link');
});

/**
 * @objective Verify that pressing space after a link exits the link mark and bubble menu closes
 */
test('exits link mark when pressing space after link', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Link Space Test Wiki'));

    // # Create a target page to link to
    await createPageThroughUI(page, 'Target Page');
    await waitForPageInHierarchy(page, 'Target Page');

    // # Create new page for testing space behavior
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Space After Link Test');

    const editor = await getEditorAndWait(page);
    await waitForPageInHierarchy(page, 'Target Page', HIERARCHY_TIMEOUT);

    // # Type text and create a link
    await typeInEditor(page, 'Click ');
    await editor.type('mylink');

    // # Select "mylink" and create link
    for (let i = 0; i < 6; i++) {
        await page.keyboard.press('Shift+ArrowLeft');
    }
    await page.waitForTimeout(UI_MICRO_WAIT);
    await createLinkFromSelection(page, 'Target Page');

    // * Verify link was created in editor
    const pageLink = editor.locator('a').first();
    await expect(pageLink).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(pageLink).toHaveText('mylink');

    // # Position cursor at the end of the link by clicking on it
    await pageLink.click();
    await page.waitForTimeout(UI_MICRO_WAIT);

    // # Move cursor to the end of the link text
    await page.keyboard.press('End');
    await page.waitForTimeout(UI_MICRO_WAIT);

    // # Verify bubble menu is visible (cursor is inside link)
    const bubbleMenu = page.locator('[data-testid="link-bubble-menu"]').first();
    await expect(bubbleMenu).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Press space to exit the link
    await page.keyboard.press('Space');
    await page.waitForTimeout(SHORT_WAIT);

    // * Verify bubble menu is no longer visible (cursor is now outside link)
    await expect(bubbleMenu).not.toBeVisible();

    // # Type additional text after the space
    await page.keyboard.type('more text');
    await page.waitForTimeout(UI_MICRO_WAIT);

    // * Verify the link still only contains original text (space and new text are NOT part of link)
    await expect(pageLink).toHaveText('mylink');

    // * Verify the full text is present in the editor
    await expect(editor).toContainText('Click mylink more text');

    // * Verify there's still only one link in the editor
    await expect(editor.locator('a')).toHaveCount(1);
});
