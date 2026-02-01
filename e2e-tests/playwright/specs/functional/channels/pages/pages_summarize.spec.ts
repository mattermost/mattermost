// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {configureAIPlugin, shouldSkipAITests} from '@mattermost/playwright-lib';

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    createTestChannel,
    checkAIPluginAvailability,
    getPageViewerContent,
    openAIActionsMenu,
    clickAIActionsMenuItem,
    createPostsForSummarization,
    verifyPageInHierarchy,
    switchToWikiTab,
    isAIPluginRunning,
    loginAndNavigateToChannel,
    uniqueName,
    getEditor,
    EDITOR_LOAD_WAIT,
    ELEMENT_TIMEOUT,
    HIERARCHY_TIMEOUT,
} from './test_helpers';

/**
 * @objective Verify "Summarize to Page" menu item appears in post actions when AI plugin is available
 *
 * @precondition
 * AI plugin is enabled and agents are configured (test will skip gracefully if not available)
 */
test('shows summarize to page option in post actions menu', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await createTestChannel(adminClient, team.id, uniqueName('Summarize Test'));
    const {page, channelsPage} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki first (required for page creation)
    const wikiName = uniqueName('Test Wiki');
    await createWikiThroughUI(page, wikiName);

    // # Check if AI plugin is available while we're in wiki view
    const hasAIPlugin = await checkAIPluginAvailability(page);
    if (!hasAIPlugin) {
        test.skip(true, 'AI plugin not configured - skipping summarize to page test');
        return;
    }

    // # Navigate back to channel (messages view)
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create posts in the channel using API
    const rootPost = await createPostsForSummarization(
        adminClient,
        channel.id,
        'Discussion about the new feature implementation',
        ['We should start with the database schema design', 'Then move on to the API endpoints'],
    );

    // # Reload to see the posts
    await page.reload();
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    // # Open AI actions menu
    await openAIActionsMenu(page, rootPost.id);

    // * Verify "Summarize to Page" option is visible
    const summarizeButton = page.getByRole('button', {name: /Summarize to Page/i});
    await expect(summarizeButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify clicking "Summarize to Page" prompts for page title
 *
 * @precondition
 * AI plugin is enabled and agents are configured (test will skip gracefully if not available)
 */
test('prompts for page title when summarize to page is clicked', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await createTestChannel(adminClient, team.id, uniqueName('Summarize Prompt Test'));
    const {page, channelsPage} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki
    const wikiName = uniqueName('Test Wiki');
    await createWikiThroughUI(page, wikiName);

    // # Check AI plugin availability
    const hasAIPlugin = await checkAIPluginAvailability(page);
    if (!hasAIPlugin) {
        test.skip(true, 'AI plugin not configured - skipping summarize to page test');
        return;
    }

    // # Navigate back to channel
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create posts
    const rootPost = await createPostsForSummarization(adminClient, channel.id, 'Test discussion for summarization', [
        'Reply with more context',
    ]);

    // # Reload to see posts
    await page.reload();
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    // # Open AI actions menu
    await openAIActionsMenu(page, rootPost.id);

    // # Set up dialog handler to capture the prompt
    let dialogAppeared = false;
    let dialogMessage = '';

    page.once('dialog', async (dialog) => {
        dialogAppeared = true;
        dialogMessage = dialog.message();
        await dialog.accept('Test Page Summary');
    });

    // # Click "Summarize to Page"
    await clickAIActionsMenuItem(page, 'Summarize to Page');

    // # Wait for dialog to be handled
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    // * Verify dialog appeared with correct message
    expect(dialogAppeared).toBeTruthy();
    expect(dialogMessage).toContain('title');
});

/**
 * @objective Verify summarize to page creates a page with AI-generated content
 *
 * @precondition
 * AI plugin is enabled and agents are configured with valid API keys
 */
test('creates page with summarized content from channel thread', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await createTestChannel(adminClient, team.id, uniqueName('Summarize Create Test'));
    const {page, channelsPage} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki
    const wikiName = uniqueName('Test Wiki');
    await createWikiThroughUI(page, wikiName);

    // # Check AI plugin availability
    const hasAIPlugin = await checkAIPluginAvailability(page);
    if (!hasAIPlugin) {
        test.skip(true, 'AI plugin not configured - skipping summarize to page integration test');
        return;
    }

    // # Navigate back to channel
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create posts with meaningful content for summarization
    const rootPost = await createPostsForSummarization(
        adminClient,
        channel.id,
        'We need to implement a new authentication system for our application.',
        [
            'I suggest we use OAuth 2.0 with JWT tokens for better security.',
            'Good idea! We should also implement refresh tokens to improve user experience.',
        ],
    );

    // # Reload to see posts
    await page.reload();
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    // # Open AI actions menu
    await openAIActionsMenu(page, rootPost.id);

    // # Accept dialog with page title
    const pageTitle = 'Authentication Discussion Summary';
    page.once('dialog', async (dialog) => {
        await dialog.accept(pageTitle);
    });

    await clickAIActionsMenuItem(page, 'Summarize to Page');

    // * Wait for page creation (AI processing can take time)
    await page.waitForTimeout(ELEMENT_TIMEOUT);

    // # Check if we're already on the wiki view (summarize action may auto-navigate)
    const currentUrl = page.url();
    const isOnWikiView = currentUrl.includes('/wiki/');

    if (!isOnWikiView) {
        // # Switch to wiki tab if we're still on messages view
        await switchToWikiTab(page, wikiName);
    }

    // * Verify page appears in the hierarchy panel
    const pageLink = await verifyPageInHierarchy(page, pageTitle, HIERARCHY_TIMEOUT);

    // # Click the page to open it
    await pageLink.click();

    // * Verify page viewer is displayed with content
    const pageViewer = getPageViewerContent(page);
    await expect(pageViewer).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify page has some content (AI-generated summary)
    const pageContent = await pageViewer.textContent();
    expect(pageContent).toBeTruthy();
    expect(pageContent!.length).toBeGreaterThan(0);

    // * Content should not be just the placeholder text
    expect(pageContent).not.toContain('Generating summary');

    // # Try to enter Edit mode to verify content is valid TipTap JSON
    const editButton = page.getByRole('button', {name: /Edit/i});
    await editButton.click();

    // * Verify editor loaded successfully (no error state)
    const editor = getEditor(page);
    await expect(editor).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify no error messages appear
    const errorMessage = page.locator('[role="alert"]').or(page.getByText(/error|invalid|failed/i));
    await expect(errorMessage).not.toBeVisible();
});

/**
 * @objective Verify graceful degradation when AI plugin is not available
 *
 * @precondition
 * AI plugin is NOT configured (test will skip if AI is available)
 */
test(
    'hides summarize to page option when AI plugin is not available',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;

        // Check if AI plugin is actually running on the server (not just test config)
        const aiRunning = await isAIPluginRunning(adminClient);

        // Skip if AI is actually running on server - we can't test graceful degradation when AI is enabled
        if (aiRunning || !shouldSkipAITests()) {
            test.skip(true, 'AI plugin is running on server - cannot test graceful degradation');
            return;
        }

        const channel = await createTestChannel(adminClient, team.id, uniqueName('No AI Test'));
        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create a post
        const postResponse = await adminClient.createPost({
            channel_id: channel.id,
            message: 'Test post without AI plugin',
        });

        // # Reload to see posts
        await page.reload();
        await page.waitForTimeout(EDITOR_LOAD_WAIT);

        // # Hover over post to show menu
        const postLocator = page.locator(`#post_${postResponse.id}`);
        await expect(postLocator).toBeVisible();
        await postLocator.hover();

        // * Verify AI actions menu does not appear
        const aiActionsButton = page.getByTestId('ai-actions-menu');
        await expect(aiActionsButton).not.toBeVisible();
    },
);
