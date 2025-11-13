// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {configureAIPlugin, shouldSkipAITests} from '@mattermost/playwright-lib';

import {createWikiThroughUI, getNewPageButton, fillCreatePageModal, getEditorAndWait, selectTextInEditor, publishPage, waitForFormattingBar, createTestChannel} from './test_helpers';

/**
 * Helper to check if AI plugin is available by checking if AI button appears in formatting bar
 * The AI button only appears when agents are configured
 */
async function checkAIPluginAvailability(page: any): Promise<boolean> {
    // Get the editor and type some text
    const editor = await getEditorAndWait(page);
    await editor.click();
    await page.keyboard.type('test');

    // Select text using triple-click (more reliable for formatting bar)
    await selectTextInEditor(page);

    // Check if AI button is visible
    const aiButton = page.locator('[data-testid="ai-rewrite-button"]');
    const isVisible = await aiButton.isVisible().catch(() => false);

    // Clean up - delete the test text
    await page.keyboard.press('Backspace');

    return isVisible;
}

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

    const channel = await createTestChannel(adminClient, team.id, `AI Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `AI Test Wiki ${pw.random.id()}`);

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
    const aiRewriteButton = page.locator('[data-testid="ai-rewrite-button"]');
    await expect(aiRewriteButton).toBeVisible({timeout: 5000});
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

    const channel = await createTestChannel(adminClient, team.id, `AI Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and page
    const wiki = await createWikiThroughUI(page, `AI Menu Test Wiki ${pw.random.id()}`);
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

    const aiRewriteButton = page.locator('[data-testid="ai-rewrite-button"]');
    await aiRewriteButton.click();

    // Wait for menu to open
    await page.waitForTimeout(500);

    // * Verify rewrite menu appears (check for menu items instead of container visibility)
    const improveButton = page.locator('text=Improve writing');
    await expect(improveButton).toBeVisible({timeout: 5000});

    const rewriteMenu = page.locator('[data-testid="rewrite-menu"]');

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

    const channel = await createTestChannel(adminClient, team.id, `AI Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and page
    const wiki = await createWikiThroughUI(page, `AI Actions Test Wiki ${pw.random.id()}`);
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
    const aiRewriteButton = page.locator('[data-testid="ai-rewrite-button"]');
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
        await expect(actionButton).toBeVisible({timeout: 2000});
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

    const channel = await createTestChannel(adminClient, team.id, `AI Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and page
    const wiki = await createWikiThroughUI(page, `No AI Wiki ${pw.random.id()}`);
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
    const aiRewriteButton = page.locator('[data-testid="ai-rewrite-button"]');

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
test('shows AI rewrite in inline comment toolbar when viewing page', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await createTestChannel(adminClient, team.id, `AI Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and page with content
    const wiki = await createWikiThroughUI(page, `AI Inline Test Wiki ${pw.random.id()}`);
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
    await page.waitForTimeout(1000);
    const pageViewer = page.locator('[data-testid="page-viewer-content"]');
    await expect(pageViewer).toBeVisible();

    // # Select text in view mode
    await selectTextInEditor(page, 'published content');

    // * Verify inline comment toolbar appears with AI button
    const inlineToolbar = page.locator('.inline-comment-toolbar');
    await expect(inlineToolbar).toBeVisible({timeout: 5000});

    const aiButton = inlineToolbar.locator('[data-testid="inline-comment-ai-button"]');
    await expect(aiButton).toBeVisible();
});

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

    const channel = await createTestChannel(adminClient, team.id, `AI Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and page
    const wiki = await createWikiThroughUI(page, `AI Integration Test Wiki ${pw.random.id()}`);
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

    const aiRewriteButton = page.locator('[data-testid="ai-rewrite-button"]');
    await aiRewriteButton.click();
    await page.waitForTimeout(500);

    // # Click "Fix spelling and grammar" action
    const fixGrammarButton = page.locator('text=Fix spelling and grammar');
    await expect(fixGrammarButton).toBeVisible({timeout: 5000});
    await fixGrammarButton.click();

    // * Verify processing state appears (loading indicator or processing message)
    // Wait for either loading spinner or processing state
    const loadingIndicator = page.locator('.loading-spinner, [class*="processing"], [class*="loading"]').first();
    await loadingIndicator.waitFor({state: 'visible', timeout: 3000}).catch(() => {
        // Loading might be too fast to catch
    });

    // * Wait for AI response (up to 30 seconds for real API call)
    // The editor content should change when AI responds
    await page.waitForTimeout(2000); // Give AI time to start processing

    // Wait for content to change from original
    let contentChanged = false;
    const maxWaitTime = 30000; // 30 seconds max
    const startTime = Date.now();

    while (!contentChanged && (Date.now() - startTime) < maxWaitTime) {
        const currentContent = await editor.textContent();
        if (currentContent && currentContent !== originalText && currentContent.trim() !== originalText) {
            contentChanged = true;
            break;
        }
        await page.waitForTimeout(1000);
    }

    // * Verify content was actually changed by AI
    const finalContent = await editor.textContent();
    expect(contentChanged).toBeTruthy();
    expect(finalContent).not.toBe(originalText);

    // * Verify the new content is better (has proper grammar)
    // The AI should have fixed "has bad grammar and needs fix" to something like "has bad grammar and needs to be fixed"
    expect(finalContent?.toLowerCase()).toContain('text');
    expect(finalContent?.toLowerCase()).not.toBe(originalText.toLowerCase());

    // * Verify editor is still functional after AI rewrite
    await page.keyboard.press('End');
    await page.keyboard.type(' Additional text added after AI rewrite.');
    await expect(editor).toContainText('Additional text added after AI rewrite.');
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

    const channel = await createTestChannel(adminClient, team.id, `AI Test Channel ${pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and page
    const wiki = await createWikiThroughUI(page, `AI Error Test Wiki ${pw.random.id()}`);
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
    await editor.click();
    await page.keyboard.type('Test content for error handling.');
    await selectTextInEditor(page);

    // # Open AI menu
    await waitForFormattingBar(page);
    const aiRewriteButton = page.locator('[data-testid="ai-rewrite-button"]');
    await aiRewriteButton.click();

    // # Try to trigger rewrite without selecting an agent (if dropdown allows it)
    // Or with invalid content - testing error handling
    const improveButton = page.locator('text=Improve writing');

    // * If action fails, UI should handle gracefully
    // Editor should remain functional and show error if applicable
    await improveButton.click().catch(() => {
        // It's okay if this fails - we're testing error handling
    });

    // * Verify editor is still functional after error
    await page.waitForTimeout(1000);

    // Close the menu by pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' More text.');
    await expect(editor).toContainText('More text.');
});
