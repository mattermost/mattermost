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
    getAIToolsDropdown,
    ELEMENT_TIMEOUT,
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

    const channel = await createTestChannel(adminClient, team.id, `Translation Test Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    await createWikiThroughUI(page, `Translation Test Wiki ${await pw.random.id()}`);

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

    const channel = await createTestChannel(adminClient, team.id, `Translation Submenu Test ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    await createWikiThroughUI(page, `Translation Submenu Wiki ${await pw.random.id()}`);

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
 * @objective Verify AI Tools dropdown shows Translate page option
 *
 * @precondition
 * AI plugin is enabled and agents are configured (test will skip gracefully if not available)
 */
test('shows Translate page option in AI Tools dropdown', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await createTestChannel(adminClient, team.id, `Translate Page Test ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    await createWikiThroughUI(page, `Translate Page Wiki ${await pw.random.id()}`);

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

    // # Click AI Tools dropdown
    const aiToolsDropdown = getAIToolsDropdown(page);
    await aiToolsDropdown.click();

    // * Verify Translate page option is visible
    const translatePageOption = page.getByRole('menuitem', {name: /translate page/i});
    await expect(translatePageOption).toBeVisible({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify Translate page modal opens when clicking Translate page option
 *
 * @precondition
 * AI plugin is enabled and agents are configured (test will skip gracefully if not available)
 */
test('opens Translate page modal from AI Tools dropdown', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await createTestChannel(adminClient, team.id, `Translate Modal Test ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    await createWikiThroughUI(page, `Translate Modal Wiki ${await pw.random.id()}`);

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

    // # Click AI Tools dropdown
    const aiToolsDropdown = getAIToolsDropdown(page);
    await aiToolsDropdown.click();

    // # Click Translate page option
    const translatePageOption = page.getByRole('menuitem', {name: /translate page/i});
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

    const channel = await createTestChannel(adminClient, team.id, `Language Select Test ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    await createWikiThroughUI(page, `Language Select Wiki ${await pw.random.id()}`);

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

    // # Click AI Tools dropdown
    const aiToolsDropdown = getAIToolsDropdown(page);
    await aiToolsDropdown.click();

    // # Click Translate page option
    const translatePageOption = page.getByRole('menuitem', {name: /translate page/i});
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

        const channel = await createTestChannel(adminClient, team.id, `No Translation Test ${await pw.random.id()}`);

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // # Create wiki through UI
        await createWikiThroughUI(page, `No Translation Wiki ${await pw.random.id()}`);

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
