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
    await createWikiThroughUI(page, `Link Test Wiki ${await pw.random.id()}`);

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
    await createWikiThroughUI(page, `Link Persist Wiki ${await pw.random.id()}`);

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
    await createWikiThroughUI(page, `Custom Link Wiki ${await pw.random.id()}`);

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
