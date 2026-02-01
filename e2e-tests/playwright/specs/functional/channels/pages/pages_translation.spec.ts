// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {configureAIPlugin, shouldSkipAITests} from '@mattermost/playwright-lib';

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    getNewPageButton,
    fillCreatePageModal,
    getEditorAndWait,
    selectTextInEditor,
    publishPage,
    waitForFormattingBar,
    createTestChannel,
    checkAIPluginAvailability,
    getAIRewriteButton,
    openAIToolsMenu,
    getAIToolsTranslateButton,
    loginAndNavigateToChannel,
    uniqueName,
    ELEMENT_TIMEOUT,
    PAGE_LOAD_TIMEOUT,
} from './test_helpers';

/**
 * @objective Verify Translate to option appears in AI rewrite menu when text is selected
 *
 * @precondition
 * AI plugin is enabled and agents are configured (test will skip gracefully if not available)
 */
test('shows Translate to option in AI rewrite menu', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await createTestChannel(adminClient, team.id, uniqueName('Translation Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Translation Test Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Translation Test Page');

    // # Wait for editor to be visible
    const editor = await getEditorAndWait(page);

    // # Check if AI plugin is available
    const hasAIPlugin = await checkAIPluginAvailability(page);
    if (!hasAIPlugin) {
        test.skip(true, 'AI plugin not configured - skipping translation test');
        return;
    }

    // # Type some content
    await editor.click();
    await page.keyboard.type('This is content to translate.');

    // # Select text
    await selectTextInEditor(page);

    // # Wait for formatting bar to appear
    await waitForFormattingBar(page);

    // # Click AI rewrite button
    const aiRewriteButton = getAIRewriteButton(page);
    await aiRewriteButton.click();

    // * Verify translate to option is visible in the menu
    const translateOption = page.getByRole('menuitem', {name: /translate to/i});
    await expect(translateOption).toBeVisible({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify language submenu appears when hovering over Translate to option
 *
 * @precondition
 * AI plugin is enabled and agents are configured (test will skip gracefully if not available)
 */
test('shows language submenu for translation', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await createTestChannel(adminClient, team.id, uniqueName('Translation Submenu Test'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Translation Submenu Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Translation Submenu Page');

    // # Wait for editor to be visible
    const editor = await getEditorAndWait(page);

    // # Check if AI plugin is available
    const hasAIPlugin = await checkAIPluginAvailability(page);
    if (!hasAIPlugin) {
        test.skip(true, 'AI plugin not configured - skipping translation test');
        return;
    }

    // # Type some content
    await editor.click();
    await page.keyboard.type('Test content for translation submenu.');

    // # Select text
    await selectTextInEditor(page);

    // # Wait for formatting bar to appear
    await waitForFormattingBar(page);

    // # Click AI rewrite button
    const aiRewriteButton = getAIRewriteButton(page);
    await aiRewriteButton.click();

    // # Hover over translate to option
    const translateOption = page.getByRole('menuitem', {name: /translate to/i});
    await translateOption.hover();

    // * Verify language submenu is visible with common languages
    const spanishOption = page.getByRole('menuitem', {name: /spanish|espa/i});
    await expect(spanishOption).toBeVisible({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify AI Tools submenu shows Translate page option
 *
 * @precondition
 * AI plugin is enabled and agents are configured (test will skip gracefully if not available)
 */
test('shows Translate page option in AI Tools submenu', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await createTestChannel(adminClient, team.id, uniqueName('Translate Page Test'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Translate Page Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Page to Translate');

    // # Wait for editor to be visible
    const editor = await getEditorAndWait(page);

    // # Check if AI plugin is available
    const hasAIPlugin = await checkAIPluginAvailability(page);
    if (!hasAIPlugin) {
        test.skip(true, 'AI plugin not configured - skipping translation test');
        return;
    }

    // # Type some content
    await editor.click();
    await page.keyboard.type('Page content that will be translated.');

    // # Open page actions menu and navigate to AI Tools submenu
    await openAIToolsMenu(page);

    // * Verify Translate page option is visible
    const translatePageOption = getAIToolsTranslateButton(page);
    await expect(translatePageOption).toBeVisible({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify Translate page modal opens when clicking Translate page option
 *
 * @precondition
 * AI plugin is enabled and agents are configured (test will skip gracefully if not available)
 */
test('opens Translate page modal from AI Tools submenu', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await createTestChannel(adminClient, team.id, uniqueName('Translate Modal Test'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Translate Modal Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Modal Test Page');

    // # Wait for editor to be visible
    const editor = await getEditorAndWait(page);

    // # Check if AI plugin is available
    const hasAIPlugin = await checkAIPluginAvailability(page);
    if (!hasAIPlugin) {
        test.skip(true, 'AI plugin not configured - skipping translation test');
        return;
    }

    // # Type some content
    await editor.click();
    await page.keyboard.type('Content for modal test.');

    // # Open page actions menu and navigate to AI Tools submenu
    await openAIToolsMenu(page);

    // # Click Translate page option
    const translatePageOption = getAIToolsTranslateButton(page);
    await translatePageOption.click();

    // * Verify modal is visible
    const modal = page.locator('#translate-page-modal');
    await expect(modal).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify modal title
    const modalTitle = modal.getByRole('heading', {name: /translate page/i});
    await expect(modalTitle).toBeVisible();

    // * Verify language options are visible
    const spanishOption = modal.locator('[data-testid="translate-modal-es"]');
    await expect(spanishOption).toBeVisible();
});

/**
 * @objective Verify Translate page modal allows selecting a target language
 *
 * @precondition
 * AI plugin is enabled and agents are configured (test will skip gracefully if not available)
 */
test('selects target language in Translate page modal', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await createTestChannel(adminClient, team.id, uniqueName('Language Select Test'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Language Select Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Language Select Page');

    // # Wait for editor to be visible
    const editor = await getEditorAndWait(page);

    // # Check if AI plugin is available
    const hasAIPlugin = await checkAIPluginAvailability(page);
    if (!hasAIPlugin) {
        test.skip(true, 'AI plugin not configured - skipping translation test');
        return;
    }

    // # Type some content
    await editor.click();
    await page.keyboard.type('Content for language selection test.');

    // # Open page actions menu and navigate to AI Tools submenu
    await openAIToolsMenu(page);

    // # Click Translate page option
    const translatePageOption = getAIToolsTranslateButton(page);
    await translatePageOption.click();

    // # Wait for modal
    const modal = page.locator('#translate-page-modal');
    await expect(modal).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Click Spanish language option
    const spanishOption = modal.locator('[data-testid="translate-modal-es"]');
    await spanishOption.click();

    // * Verify Spanish option is selected (has selected class)
    await expect(spanishOption).toHaveClass(/selected/);

    // * Verify Translate button is enabled
    const translateButton = modal.getByRole('button', {name: /^translate$/i});
    await expect(translateButton).toBeEnabled();
});

/**
 * @objective Verify translation indicator is not shown for pages without translations
 *
 * @precondition
 * Page is created and published without any translations
 */
test(
    'does not show translation indicator for pages without translations',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;

        const channel = await createTestChannel(adminClient, team.id, uniqueName('No Translation Test'));

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki through UI
        await createWikiThroughUI(page, uniqueName('No Translation Wiki'));

        // # Create new page
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'No Translation Page');

        // # Wait for editor to be visible
        const editor = await getEditorAndWait(page);

        // # Type some content
        await editor.click();
        await page.keyboard.type('Page without any translations.');

        // # Publish the page
        await publishPage(page);

        // * Verify translation indicator is not visible
        const translationIndicator = page.locator('[data-testid="translation-indicator-trigger"]');
        await expect(translationIndicator).not.toBeVisible();
    },
);

/**
 * @objective Verify URLs are preserved during page translation
 *
 * @precondition
 * AI plugin is enabled and agents are configured (test will skip gracefully if not available)
 *
 * @description
 * This test verifies that when a page contains a link where the visible text IS the URL itself
 * (e.g., "See https://example.com/path for details"), the URL is not corrupted during translation.
 * The URL protection feature replaces URLs with placeholders before sending to AI, then restores them.
 */
test('preserves URLs during page translation', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await createTestChannel(adminClient, team.id, uniqueName('URL Preservation Test'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('URL Preservation Wiki'));

    // # Create new page with content containing a URL as link text
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'URL Preservation Test Page');

    // # Wait for editor to be visible
    const editor = await getEditorAndWait(page);

    // # Check if AI plugin is available
    const hasAIPlugin = await checkAIPluginAvailability(page);
    if (!hasAIPlugin) {
        test.skip(true, 'AI plugin not configured - skipping URL preservation test');
        return;
    }

    // # Type content with a URL - the URL will be auto-linked by TipTap
    const testUrl = 'https://dashboard.stripe.com/invoices/in_1JqrhOI67GP2qpb4b2BTCBkz';
    await editor.click();
    await page.keyboard.type(`See this invoice: ${testUrl} for billing details.`);

    // # Wait for TipTap to auto-link the URL
    await page.waitForTimeout(500);

    // # Open page actions menu and navigate to AI Tools submenu
    await openAIToolsMenu(page);

    // # Click Translate page option
    const translatePageOption = getAIToolsTranslateButton(page);
    await translatePageOption.click();

    // # Wait for modal
    const modal = page.locator('#translate-page-modal');
    await expect(modal).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Select Spanish as target language
    const spanishOption = modal.locator('[data-testid="translate-modal-es"]');
    await spanishOption.click();

    // # Click translate button
    const translateButton = modal.getByRole('button', {name: /^translate$/i});
    await translateButton.click();

    // # Wait for translation to complete and navigate to translated page
    // The translation creates a new draft page as a child
    await page.waitForURL(/\/drafts\//, {timeout: PAGE_LOAD_TIMEOUT});

    // # Wait for the translated content to load in the editor
    const translatedEditor = await getEditorAndWait(page);
    await expect(translatedEditor).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify the URL is preserved unchanged in the translated content
    // The URL should appear as a link with the exact same href
    const linkWithUrl = translatedEditor.locator(`a[href="${testUrl}"]`);
    await expect(linkWithUrl).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify the link text IS the exact URL (not scrambled or shifted)
    // This catches bugs where the link mark positions are miscalculated,
    // causing the <a> tag to wrap the wrong portion of text
    const linkText = await linkWithUrl.textContent();
    expect(linkText).toBe(testUrl);

    // * Also verify the link starts with https:// (catches position shift bugs)
    expect(linkText).toMatch(/^https:\/\//);
});
