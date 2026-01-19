// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {configureAIPlugin, shouldSkipAITests} from '@mattermost/playwright-lib';

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    getNewPageButton,
    getPageViewerContent,
    fillCreatePageModal,
    getEditorAndWait,
    selectTextInEditor,
    publishPage,
    waitForFormattingBar,
    createTestChannel,
    checkAIPluginAvailability,
    isAIPluginRunning,
    getAIRewriteButton,
    closeAIRewriteMenu,
    getPageActionsMenuButton,
    getAIToolsProofreadButton,
    isAIToolsDropdownVisible,
    triggerProofread,
    openAIToolsMenu,
    UI_MICRO_WAIT,
    EDITOR_LOAD_WAIT,
    AUTOSAVE_WAIT,
    ELEMENT_TIMEOUT,
    WEBSOCKET_WAIT,
} from './test_helpers';

/**
 * @objective Verify AI rewrite button appears in formatting bar when text is selected
 *
 * @precondition
 * AI plugin is enabled and agents are configured (test will skip gracefully if not available)
 */
test('shows AI rewrite button when text is selected', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await createTestChannel(adminClient, team.id, `AI Test Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki through UI
    await createWikiThroughUI(page, `AI Test Wiki ${await pw.random.id()}`);

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'AI Rewrite Test Page');

    // # Wait for editor to be visible
    const editor = await getEditorAndWait(page);

    // # Check if AI plugin is available
    const hasAIPlugin = await checkAIPluginAvailability(page);
    if (!hasAIPlugin) {
        test.skip(true, 'AI plugin not configured - skipping AI rewrite test');
        return;
    }

    // # Type some content
    await editor.click();
    await page.keyboard.type('This is a test message that can be improved by AI.');

    // # Select text
    await selectTextInEditor(page);

    // # Wait for formatting bar to appear
    await waitForFormattingBar(page);

    // * Verify AI rewrite button is visible
    const aiRewriteButton = getAIRewriteButton(page);
    await expect(aiRewriteButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify AI rewrite menu opens when AI button is clicked
 *
 * @precondition
 * AI plugin is enabled and agents are configured (test will skip gracefully if not available)
 */
test('opens AI rewrite menu when button is clicked', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await createTestChannel(adminClient, team.id, `AI Test Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `AI Menu Test Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'AI Menu Test Page');

    // # Wait for editor and type content
    const editor = await getEditorAndWait(page);

    // # Check if AI plugin is available
    const hasAIPlugin = await checkAIPluginAvailability(page);
    if (!hasAIPlugin) {
        test.skip(true, 'AI plugin not configured - skipping AI rewrite test');
        return;
    }
    await editor.click();
    await page.keyboard.type('Test content for AI rewriting.');

    // # Select text and click AI button
    await selectTextInEditor(page);
    await waitForFormattingBar(page);

    const aiRewriteButton = getAIRewriteButton(page);
    await aiRewriteButton.click();

    // * Verify rewrite menu appears (check for menu items instead of container visibility)
    const improveButton = page.locator('text=Improve writing');
    await expect(improveButton).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify agent dropdown is visible
    const agentDropdown = page.locator('[role="combobox"]');
    await expect(agentDropdown).toBeVisible();
});

/**
 * @objective Verify all 7 rewrite actions are available in the menu
 *
 * @precondition
 * AI plugin is enabled and agents are configured (test will skip gracefully if not available)
 */
test('displays all 7 rewrite actions in menu', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await createTestChannel(adminClient, team.id, `AI Test Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `AI Actions Test Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'AI Actions Test Page');

    // # Type and select content
    const editor = await getEditorAndWait(page);

    // # Check if AI plugin is available
    const hasAIPlugin = await checkAIPluginAvailability(page);
    if (!hasAIPlugin) {
        test.skip(true, 'AI plugin not configured - skipping AI rewrite test');
        return;
    }
    await editor.click();
    await page.keyboard.type('Test content for verifying all AI actions.');
    await selectTextInEditor(page);

    // # Open AI rewrite menu
    await waitForFormattingBar(page);
    const aiRewriteButton = getAIRewriteButton(page);
    await aiRewriteButton.click();

    // * Verify all 7 rewrite actions are present
    const expectedActions = [
        'Shorten',
        'Elaborate',
        'Improve writing',
        'Fix spelling and grammar',
        'Simplify',
        'Summarize',
    ];

    for (const action of expectedActions) {
        const actionButton = page.locator(`text=${action}`);
        await expect(actionButton).toBeVisible({timeout: WEBSOCKET_WAIT});
    }

    // * Verify custom prompt input exists
    const customPromptInput = page.locator('input[placeholder*="AI"]');
    await expect(customPromptInput).toBeVisible();
});

/**
 * @objective Verify AI rewrite gracefully handles missing plugin
 *
 * @precondition
 * This test can only run when AI plugin is NOT configured. It verifies graceful
 * degradation behavior. When plugin IS available, test is skipped.
 */
test('gracefully degrades when AI plugin is not available', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    const channel = await createTestChannel(adminClient, team.id, `AI Test Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `No AI Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'No AI Test Page');

    // # Type and select content
    const editor = await getEditorAndWait(page);

    // # Check if AI plugin is available - skip test if it IS available
    const hasAIPlugin = await checkAIPluginAvailability(page);
    if (hasAIPlugin) {
        test.skip(true, 'AI plugin is configured - cannot test graceful degradation without disabling plugin');
        return;
    }

    await editor.click();
    await page.keyboard.type('Test content without AI plugin.');
    await selectTextInEditor(page);

    // * Wait for formatting bar and verify AI button does NOT appear
    await waitForFormattingBar(page);
    const aiRewriteButton = getAIRewriteButton(page);

    // * AI button should not be visible when plugin is not configured
    await expect(aiRewriteButton).not.toBeVisible();

    // * Editor should still be functional regardless
    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' Additional text.');
    await expect(editor).toContainText('Additional text.');
});

/**
 * @objective Verify AI rewrite button appears in inline comment toolbar
 *
 * @precondition
 * AI plugin is enabled and agents are configured (test will skip gracefully if not available)
 */
test(
    'shows AI rewrite in inline comment toolbar when viewing page',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;

        // # Configure AI plugin if enabled
        if (!shouldSkipAITests()) {
            await configureAIPlugin(adminClient);
        }

        const channel = await createTestChannel(adminClient, team.id, `AI Test Channel ${await pw.random.id()}`);

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // # Create wiki and page with content
        await createWikiThroughUI(page, `AI Inline Test Wiki ${await pw.random.id()}`);
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'AI Inline Test Page');

        // # Add content and publish
        const editor = await getEditorAndWait(page);

        // # Check if AI plugin is available
        const hasAIPlugin = await checkAIPluginAvailability(page);
        if (!hasAIPlugin) {
            test.skip(true, 'AI plugin not configured - skipping AI rewrite test');
            return;
        }
        await editor.click();
        await page.keyboard.type('This is published content that can be selected for AI rewriting.');
        await publishPage(page);

        // # Wait for page to be in view mode
        const pageViewer = getPageViewerContent(page);
        await expect(pageViewer).toBeVisible({timeout: EDITOR_LOAD_WAIT});

        // # Select text in view mode
        await selectTextInEditor(page, 'published content');

        // * Verify inline comment toolbar appears with AI button
        const inlineToolbar = page.locator('.inline-comment-toolbar');
        await expect(inlineToolbar).toBeVisible({timeout: ELEMENT_TIMEOUT});

        const aiButton = inlineToolbar.locator('[data-testid="inline-comment-ai-button"]');
        await expect(aiButton).toBeVisible();
    },
);

/**
 * @objective Verify AI actually processes text and returns rewritten content
 *
 * @precondition
 * AI plugin is enabled and agents are configured with valid API keys
 */
test('performs actual AI rewrite and updates editor content', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await createTestChannel(adminClient, team.id, `AI Test Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `AI Integration Test Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'AI Integration Test Page');

    // # Wait for editor
    const editor = await getEditorAndWait(page);

    // # Check if AI plugin is available
    const hasAIPlugin = await checkAIPluginAvailability(page);
    if (!hasAIPlugin) {
        test.skip(true, 'AI plugin not configured - skipping AI integration test');
        return;
    }

    // # Type test content that can be improved
    await editor.click();
    const originalText = 'this text has bad grammar and needs fix';
    await page.keyboard.type(originalText);

    // # Select text and open AI menu
    await selectTextInEditor(page);
    await waitForFormattingBar(page);

    const aiRewriteButton = getAIRewriteButton(page);
    await aiRewriteButton.click();

    // # Click "Fix spelling and grammar" action
    const fixGrammarButton = page.locator('text=Fix spelling and grammar');
    await expect(fixGrammarButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await fixGrammarButton.click();

    // * Verify processing state appears (loading indicator or processing message)
    // Wait for either loading spinner or processing state
    const loadingIndicator = page.locator('.loading-spinner, [class*="processing"], [class*="loading"]').first();
    await loadingIndicator.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT}).catch(() => {
        // Loading might be too fast to catch
    });

    // * Wait for AI response (up to 30 seconds for real API call)
    // The editor content should change when AI responds
    await page.waitForTimeout(AUTOSAVE_WAIT); // Give AI time to start processing

    // Wait for content to change from original
    let contentChanged = false;
    const maxWaitTime = 30000; // 30 seconds max
    const startTime = Date.now();

    while (!contentChanged && Date.now() - startTime < maxWaitTime) {
        const currentContent = await editor.textContent();
        if (currentContent && currentContent !== originalText && currentContent.trim() !== originalText) {
            contentChanged = true;
            break;
        }
        await page.waitForTimeout(EDITOR_LOAD_WAIT);
    }

    // * Verify content was actually changed by AI
    const finalContent = await editor.textContent();
    expect(contentChanged).toBeTruthy();
    expect(finalContent).not.toBe(originalText);

    // * Verify the AI actually fixed the grammatical error
    // Original: "needs fix" (incorrect - ends abruptly without proper verb form)
    // Expected: "needs fixing", "needs to be fixed", "needs correction", or similar grammatically correct form
    const contentLower = finalContent?.toLowerCase() || '';
    expect(contentLower).not.toMatch(/needs fix[^a-z]|needs fix$/); // "needs fix" not followed by letters
    expect(contentLower).toMatch(/needs (to be )?(fix(ed|ing)|correction|improving)/); // Proper grammar
    expect(contentLower).toContain('text'); // Core content preserved

    // * Verify editor is still functional after AI rewrite
    // Close the AI rewrite menu
    await closeAIRewriteMenu(page);

    // Verify we're still on the correct page by checking the page title
    const pageTitle = page.locator('[data-testid="wiki-page-title-input"]').first();
    await expect(pageTitle).toHaveValue('AI Integration Test Page', {timeout: ELEMENT_TIMEOUT});

    // Re-query editor after AI rewrite (DOM may have been updated)
    const editorAfterRewrite = await getEditorAndWait(page);

    // Ensure editor is focused before adding text
    await editorAfterRewrite.click();
    await page.waitForTimeout(UI_MICRO_WAIT * 2);

    await page.keyboard.press('End');
    await page.keyboard.type(' Additional text added after AI rewrite.');
    await expect(editorAfterRewrite).toContainText('Additional text added after AI rewrite.');
});

/**
 * @objective Verify error handling when AI rewrite fails
 *
 * @precondition
 * AI plugin is enabled and agents are configured (test will skip gracefully if not available)
 */
test('handles AI rewrite errors gracefully', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await createTestChannel(adminClient, team.id, `AI Test Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `AI Error Test Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'AI Error Test Page');

    // # Type and select content
    const editor = await getEditorAndWait(page);

    // # Check if AI plugin is available
    const hasAIPlugin = await checkAIPluginAvailability(page);
    if (!hasAIPlugin) {
        test.skip(true, 'AI plugin not configured - skipping AI rewrite test');
        return;
    }

    // # Mock AI API to return 500 error
    await page.route('**/api/v4/posts/rewrite', (route) => {
        route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
                id: 'app.post.rewrite.error',
                message: 'AI service is temporarily unavailable',
                status_code: 500,
            }),
        });
    });

    await editor.click();
    const originalText = 'Test content for error handling.';
    await page.keyboard.type(originalText);

    // # Select text and open AI menu
    await selectTextInEditor(page);
    await waitForFormattingBar(page);

    const aiRewriteButton = getAIRewriteButton(page);
    await aiRewriteButton.click();

    // # Click "Improve writing" action to trigger the mocked error
    const improveButton = page.locator('text=Improve writing');
    await expect(improveButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await improveButton.click();

    // * Verify loading state appears briefly
    const loadingIndicator = page.locator('.loading-spinner, [class*="processing"], [class*="loading"]').first();
    await loadingIndicator.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT}).catch(() => {
        // Loading might be too fast
    });

    // * Wait for error to be processed
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    // * Verify original text is preserved (error didn't corrupt content)
    const currentContent = await editor.textContent();
    expect(currentContent).toContain(originalText);

    // * Verify processing state has ended (no infinite loading)
    await expect(loadingIndicator).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify editor is still functional after error
    await closeAIRewriteMenu(page);

    // Re-query editor after error handling
    const editorAfterError = await getEditorAndWait(page);
    await editorAfterError.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' More text.');
    await expect(editorAfterError).toContainText('More text.');
});

// =============================================================================
// AI TOOLS - FULL PAGE PROOFREADING TESTS (via Page Actions Menu)
// =============================================================================

/**
 * @objective Verify AI Tools are available in page actions menu when AI is available
 *
 * @precondition
 * AI plugin is enabled and agents are configured (test will skip gracefully if not available)
 */
test('shows AI Tools in page actions menu when AI is available', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Check if AI plugin is running on server (standard server-side check)
    const aiRunning = await isAIPluginRunning(adminClient);
    if (!aiRunning) {
        test.skip(true, 'AI plugin not running on server - skipping AI Tools test');
        return;
    }

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await createTestChannel(adminClient, team.id, `AI Tools Test Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `AI Tools Test Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'AI Tools Test Page');

    // # Wait for editor
    await getEditorAndWait(page);

    // * Verify AI Tools are available in page actions menu
    const aiToolsVisible = await isAIToolsDropdownVisible(page);
    expect(aiToolsVisible).toBe(true);

    // * Verify page actions menu button is visible
    const menuButton = getPageActionsMenuButton(page);
    await expect(menuButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify AI Tools submenu shows "Proofread page" option when opened
 *
 * @precondition
 * AI plugin is enabled and agents are configured (test will skip gracefully if not available)
 */
test('shows Proofread page option in AI Tools submenu', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Check if AI plugin is running on server (standard server-side check)
    const aiRunning = await isAIPluginRunning(adminClient);
    if (!aiRunning) {
        test.skip(true, 'AI plugin not running on server - skipping AI proofread test');
        return;
    }

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await createTestChannel(adminClient, team.id, `AI Proofread Test Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `AI Proofread Test Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'AI Proofread Test Page');

    // # Wait for editor and type content
    const editor = await getEditorAndWait(page);
    await editor.click();
    await page.keyboard.type('Test content with intentional typos.');

    // # Open page actions menu and navigate to AI Tools submenu
    await openAIToolsMenu(page);

    // * Verify "Proofread page" option is visible
    const proofreadButton = getAIToolsProofreadButton(page);
    await expect(proofreadButton).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify the button shows the correct label
    await expect(proofreadButton).toContainText('Proofread page');
});

/**
 * @objective Verify clicking Proofread page actually processes the document
 *
 * @precondition
 * AI plugin is enabled and agents are configured with valid API keys
 */
test('performs full-page proofreading and updates editor content', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Check if AI plugin is running on server (standard server-side check)
    const aiRunning = await isAIPluginRunning(adminClient);
    if (!aiRunning) {
        test.skip(true, 'AI plugin not running on server - skipping AI proofread integration test');
        return;
    }

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await createTestChannel(
        adminClient,
        team.id,
        `AI Proofread Int Test Channel ${await pw.random.id()}`,
    );

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `AI Proofread Int Test Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'AI Proofread Integration Test Page');

    // # Wait for editor and type content with intentional spelling errors
    const editor = await getEditorAndWait(page);
    await editor.click();
    const originalText = 'This sentance has bad grammer and speling erors.';
    await page.keyboard.type(originalText);

    // # Trigger proofreading via page actions menu
    await triggerProofread(page);

    // Note: Processing state is handled internally by the editor
    // The menu closes after clicking proofread, so we wait for content to change

    // * Wait for AI to process (up to 30 seconds for real API call)
    let contentChanged = false;
    const maxWaitTime = 30000; // 30 seconds max
    const startTime = Date.now();

    while (!contentChanged && Date.now() - startTime < maxWaitTime) {
        const currentContent = await editor.textContent();
        if (currentContent && currentContent !== originalText && currentContent.trim() !== originalText.trim()) {
            contentChanged = true;
            break;
        }
        await page.waitForTimeout(EDITOR_LOAD_WAIT);
    }

    // * Verify content was changed by AI proofreading
    const finalContent = await editor.textContent();
    expect(contentChanged).toBeTruthy();
    expect(finalContent).not.toBe(originalText);

    // * Verify the AI fixed at least some spelling errors
    const contentLower = finalContent?.toLowerCase() || '';
    expect(contentLower).not.toContain('sentance'); // Should be "sentence"
    expect(contentLower).not.toContain('grammer'); // Should be "grammar"
    expect(contentLower).not.toContain('speling'); // Should be "spelling"

    // * Verify editor is still functional after proofreading
    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' Added after proofreading.');
    await expect(editor).toContainText('Added after proofreading.');
});

/**
 * @objective Verify AI Tools submenu does not appear in page actions menu when AI plugin is unavailable
 *
 * @precondition
 * This test can only run when AI plugin is NOT configured. When plugin IS available, test is skipped.
 */
test(
    'does not show AI Tools in page actions menu when AI plugin is unavailable',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;

        // # Check if AI plugin is running on server - skip if it IS running
        const aiRunning = await isAIPluginRunning(adminClient);
        if (aiRunning) {
            test.skip(true, 'AI plugin is running on server - cannot test graceful degradation');
            return;
        }

        const channel = await createTestChannel(
            adminClient,
            team.id,
            `No AI Tools Test Channel ${await pw.random.id()}`,
        );

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // # Create wiki and page
        await createWikiThroughUI(page, `No AI Tools Test Wiki ${await pw.random.id()}`);
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'No AI Tools Test Page');

        // # Wait for editor and type content
        const editor = await getEditorAndWait(page);
        await editor.click();
        await page.keyboard.type('Test content without AI plugin.');

        // * Verify AI Tools submenu does NOT appear in page actions menu
        const aiToolsVisible = await isAIToolsDropdownVisible(page);
        expect(aiToolsVisible).toBe(false);

        // * Editor should still be functional regardless
        await editor.click();
        await page.keyboard.press('End');
        await page.keyboard.type(' Additional text.');
        await expect(editor).toContainText('Additional text.');
    },
);
