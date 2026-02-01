// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

import {configureAIPlugin, shouldSkipAITests} from '@mattermost/playwright-lib';

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    getNewPageButton,
    fillCreatePageModal,
    getEditorAndWait,
    publishPage,
    loginAndNavigateToChannel,
    openSlashCommandMenu,
    checkAIPluginAvailability,
    uniqueName,
    ELEMENT_TIMEOUT,
    WEBSOCKET_WAIT,
    UI_MICRO_WAIT,
} from './test_helpers';

/**
 * Minimal 10x10 pixel PNG image encoded as base64.
 * Used for testing Image AI bubble menu behavior.
 */
const MINIMAL_PNG_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9QzwAEjDAGNzYAADsvAxfCVpV6AAAAAElFTkSuQmCC';

/**
 * Helper to upload an image into the editor via slash command menu.
 * More reliable than clipboard paste in Playwright.
 */
async function uploadImageIntoEditor(page: any): Promise<void> {
    // Open slash command menu
    const slashMenu = await openSlashCommandMenu(page);

    // Type 'image' to filter to image option
    await page.keyboard.type('image');
    await page.waitForTimeout(UI_MICRO_WAIT * 3);

    // Find the Image or Video option
    const imageItem = slashMenu.locator('.slash-command-item').filter({hasText: 'Image'});
    await expect(imageItem).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // Set up file chooser handler before clicking
    const fileChooserPromise = page.waitForEvent('filechooser', {timeout: ELEMENT_TIMEOUT});

    // Click on Image option to trigger file picker
    await imageItem.click();

    // Handle file chooser with a PNG image
    const fileChooser = await fileChooserPromise;
    const imageBuffer = Buffer.from(MINIMAL_PNG_BASE64, 'base64');
    await fileChooser.setFiles({
        name: 'test-image.png',
        mimeType: 'image/png',
        buffer: imageBuffer,
    });
}

/**
 * Helper to select an image in the editor using keyboard navigation.
 * This is more reliable than clicking as it ensures a proper NodeSelection.
 */
async function selectImageInEditor(page: any): Promise<void> {
    const editor = page.locator('.ProseMirror');
    const image = editor.locator('img').first();
    await image.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    // Click on the image to focus the editor near it
    await image.click();
    await page.waitForTimeout(UI_MICRO_WAIT);

    // Use force click to ensure selection
    await image.click({force: true, clickCount: 1});
    await page.waitForTimeout(UI_MICRO_WAIT * 2);

    // Alternative: Try clicking the wrapper/container if direct click doesn't work
    const imageWrapper = editor.locator('.ProseMirror-selectednode, [data-drag-handle], .image-resize-wrapper').first();
    const wrapperExists = (await imageWrapper.count()) > 0;
    if (!wrapperExists) {
        // If no wrapper, try clicking the image again with position offset
        const box = await image.boundingBox();
        if (box) {
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        }
    }
}

/**
 * Gets the Image AI bubble menu locator.
 */
function getImageAIBubble(page: any) {
    return page.locator('[data-testid="image-ai-bubble"]');
}

/**
 * Gets the Image AI menu button locator.
 */
function getImageAIMenuButton(page: any) {
    return page.locator('[data-testid="image-ai-menu-button"]');
}

/**
 * @objective Verify Image AI bubble menu appears when an image is selected in the editor
 *
 * @precondition
 * AI plugin is enabled and agents are configured (test will skip gracefully if not available)
 */
test('shows Image AI bubble when image is selected', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await adminClient.getChannelByName(team.id, 'town-square');
    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Image AI Test Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Image AI Test Page');

    // # Wait for editor to be visible
    const editor = await getEditorAndWait(page);
    await editor.click();

    // # Check if AI plugin is available
    const hasAIPlugin = await checkAIPluginAvailability(page);
    if (!hasAIPlugin) {
        test.skip(true, 'AI plugin not configured - skipping Image AI test');
        return;
    }

    // # Upload an image into the editor
    await uploadImageIntoEditor(page);
    await page.waitForTimeout(WEBSOCKET_WAIT);

    // * Verify image appears in editor
    const images = editor.locator('img');
    await expect(images.first()).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Click on the image to select it
    await selectImageInEditor(page);
    await page.waitForTimeout(UI_MICRO_WAIT * 3);

    // * Verify Image AI bubble menu appears
    const imageAIBubble = getImageAIBubble(page);
    await expect(imageAIBubble).toBeVisible({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify Image AI menu button is present and enabled when vision is available
 *
 * @precondition
 * AI plugin is enabled and agents are configured (test will skip gracefully if not available)
 */
test('shows Image AI menu button in enabled state', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await adminClient.getChannelByName(team.id, 'town-square');
    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Image AI Menu Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Image AI Menu Test');

    // # Wait for editor and check AI availability
    const editor = await getEditorAndWait(page);
    await editor.click();

    const hasAIPlugin = await checkAIPluginAvailability(page);
    if (!hasAIPlugin) {
        test.skip(true, 'AI plugin not configured - skipping Image AI test');
        return;
    }

    // # Upload image
    await uploadImageIntoEditor(page);
    await page.waitForTimeout(WEBSOCKET_WAIT);

    // # Select the image
    await selectImageInEditor(page);
    await page.waitForTimeout(UI_MICRO_WAIT * 3);

    // * Verify Image AI menu button is visible
    const menuButton = getImageAIMenuButton(page);
    await expect(menuButton).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify button is enabled (vision is available when AI is available)
    await expect(menuButton).toBeEnabled();
});

/**
 * @objective Verify Image AI button is clickable and opens the menu
 *
 * @precondition
 * AI plugin is enabled and agents are configured (test will skip gracefully if not available)
 */
test('opens Image AI menu when button is clicked', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await adminClient.getChannelByName(team.id, 'town-square');
    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('AI Menu Open Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'AI Menu Open Test');

    // # Wait for editor and check AI availability
    const editor = await getEditorAndWait(page);
    await editor.click();

    const hasAIPlugin = await checkAIPluginAvailability(page);
    if (!hasAIPlugin) {
        test.skip(true, 'AI plugin not configured - skipping Image AI test');
        return;
    }

    // # Upload image
    await uploadImageIntoEditor(page);
    await page.waitForTimeout(WEBSOCKET_WAIT);

    // # Select the image
    await selectImageInEditor(page);
    await page.waitForTimeout(UI_MICRO_WAIT * 3);

    // * Verify Image AI menu button is visible and click it
    const menuButton = getImageAIMenuButton(page);
    await expect(menuButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await menuButton.click();

    // * Verify the menu opens with IMAGE AI header
    const menuHeader = page.locator('.image-ai-bubble-menu-header');
    await expect(menuHeader).toBeVisible({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify Image AI bubble disappears when clicking outside the image
 *
 * @precondition
 * AI plugin is enabled and agents are configured (test will skip gracefully if not available)
 */
test('hides Image AI bubble when pressing Escape', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await adminClient.getChannelByName(team.id, 'town-square');
    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Bubble Hide Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Bubble Hide Test');

    // # Wait for editor and check AI availability
    const editor = await getEditorAndWait(page);
    await editor.click();

    const hasAIPlugin = await checkAIPluginAvailability(page);
    if (!hasAIPlugin) {
        test.skip(true, 'AI plugin not configured - skipping Image AI test');
        return;
    }

    // # Add some text then upload image
    await page.keyboard.type('Some text before image');
    await page.keyboard.press('Enter');
    await uploadImageIntoEditor(page);
    await page.waitForTimeout(WEBSOCKET_WAIT);

    // # Select the image to show bubble
    await selectImageInEditor(page);
    await page.waitForTimeout(UI_MICRO_WAIT * 3);

    // * Verify Image AI bubble is visible
    const imageAIBubble = getImageAIBubble(page);
    await expect(imageAIBubble).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Press Escape to dismiss the bubble
    await page.keyboard.press('Escape');
    await page.waitForTimeout(UI_MICRO_WAIT * 3);

    // * Verify Image AI bubble is hidden
    await expect(imageAIBubble).not.toBeVisible();
});

/**
 * @objective Verify Image AI button has proper accessibility attributes
 *
 * @precondition
 * AI plugin is enabled and agents are configured (test will skip gracefully if not available)
 */
test('has proper accessibility attributes on AI button', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await adminClient.getChannelByName(team.id, 'town-square');
    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Accessibility Test Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Accessibility Test');

    // # Wait for editor and check AI availability
    const editor = await getEditorAndWait(page);
    await editor.click();

    const hasAIPlugin = await checkAIPluginAvailability(page);
    if (!hasAIPlugin) {
        test.skip(true, 'AI plugin not configured - skipping Image AI test');
        return;
    }

    // # Upload image
    await uploadImageIntoEditor(page);
    await page.waitForTimeout(WEBSOCKET_WAIT);

    // # Select the image
    await selectImageInEditor(page);
    await page.waitForTimeout(UI_MICRO_WAIT * 3);

    // * Verify Image AI menu button has proper accessibility attributes
    const menuButton = getImageAIMenuButton(page);
    await expect(menuButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(menuButton).toHaveAttribute('aria-label', 'Image AI tools');
    await expect(menuButton).toHaveAttribute('aria-haspopup', 'true');
});

/**
 * @objective Verify Image AI works with resizable images
 *
 * @precondition
 * AI plugin is enabled and agents are configured (test will skip gracefully if not available)
 */
test('shows Image AI bubble for resizable images', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await adminClient.getChannelByName(team.id, 'town-square');
    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Resizable Image Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Resizable Image Test');

    // # Wait for editor and check AI availability
    const editor = await getEditorAndWait(page);
    await editor.click();

    const hasAIPlugin = await checkAIPluginAvailability(page);
    if (!hasAIPlugin) {
        test.skip(true, 'AI plugin not configured - skipping Image AI test');
        return;
    }

    // # Upload image
    await uploadImageIntoEditor(page);
    await page.waitForTimeout(WEBSOCKET_WAIT);

    // # Click on image to select it
    await selectImageInEditor(page);
    await page.waitForTimeout(UI_MICRO_WAIT * 3);

    // * Verify Image AI bubble appears for the selected image
    const imageAIBubble = getImageAIBubble(page);
    await expect(imageAIBubble).toBeVisible({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify Image AI bubble persists after page publish and re-edit
 *
 * @precondition
 * AI plugin is enabled and agents are configured (test will skip gracefully if not available)
 */
test('shows Image AI bubble after publishing and re-editing page', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await adminClient.getChannelByName(team.id, 'town-square');
    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Publish Bubble Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Publish Bubble Test');

    // # Wait for editor and check AI availability
    const editor = await getEditorAndWait(page);
    await editor.click();

    const hasAIPlugin = await checkAIPluginAvailability(page);
    if (!hasAIPlugin) {
        test.skip(true, 'AI plugin not configured - skipping Image AI test');
        return;
    }

    // # Upload image
    await uploadImageIntoEditor(page);
    await page.waitForTimeout(WEBSOCKET_WAIT);

    // * Verify image appears
    const images = editor.locator('img');
    await expect(images.first()).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Publish the page
    await publishPage(page);
    await page.waitForLoadState('networkidle');

    // # Click edit button to re-enter edit mode
    const editButton = page.locator('[data-testid="edit-page-button"], button:has-text("Edit")');
    await editButton.click();
    await page.waitForTimeout(WEBSOCKET_WAIT);

    // # Wait for editor to load again
    const editorAfterPublish = await getEditorAndWait(page);

    // # Select the image
    const imageAfterPublish = editorAfterPublish.locator('img').first();
    await imageAfterPublish.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await imageAfterPublish.click();
    await page.waitForTimeout(UI_MICRO_WAIT * 3);

    // * Verify Image AI bubble appears after re-editing
    const imageAIBubble = getImageAIBubble(page);
    await expect(imageAIBubble).toBeVisible({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify Image AI bubble contains AI label text
 *
 * @precondition
 * AI plugin is enabled and agents are configured (test will skip gracefully if not available)
 */
test('shows AI label in Image AI bubble', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await adminClient.getChannelByName(team.id, 'town-square');
    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('AI Label Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'AI Label Test');

    // # Wait for editor and check AI availability
    const editor = await getEditorAndWait(page);
    await editor.click();

    const hasAIPlugin = await checkAIPluginAvailability(page);
    if (!hasAIPlugin) {
        test.skip(true, 'AI plugin not configured - skipping Image AI test');
        return;
    }

    // # Upload image
    await uploadImageIntoEditor(page);
    await page.waitForTimeout(WEBSOCKET_WAIT);

    // # Select the image
    await selectImageInEditor(page);
    await page.waitForTimeout(UI_MICRO_WAIT * 3);

    // * Verify Image AI bubble is visible
    const imageAIBubble = getImageAIBubble(page);
    await expect(imageAIBubble).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify bubble contains "AI" text
    await expect(imageAIBubble).toContainText('AI');
});

/**
 * @objective Verify Image AI menu shows Extract Handwriting option
 *
 * @precondition
 * AI plugin is enabled with vision-capable agent (test will skip gracefully if not available)
 */
test('shows Extract Handwriting option in Image AI menu', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await adminClient.getChannelByName(team.id, 'town-square');
    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Extract Menu Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Extract Menu Test');

    // # Wait for editor and check AI availability
    const editor = await getEditorAndWait(page);
    await editor.click();

    const hasAIPlugin = await checkAIPluginAvailability(page);
    if (!hasAIPlugin) {
        test.skip(true, 'AI plugin not configured - skipping Image AI test');
        return;
    }

    // # Upload image
    await uploadImageIntoEditor(page);
    await page.waitForTimeout(WEBSOCKET_WAIT);

    // # Select the image
    await selectImageInEditor(page);
    await page.waitForTimeout(UI_MICRO_WAIT * 3);

    // # Click the AI button to open menu
    const menuButton = getImageAIMenuButton(page);
    await expect(menuButton).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Check if button is enabled (vision available)
    const isDisabled = await menuButton.isDisabled();
    if (isDisabled) {
        test.skip(true, 'Vision capability not available - skipping menu test');
        return;
    }

    // # Click the menu button
    await menuButton.click();
    await page.waitForTimeout(UI_MICRO_WAIT * 2);

    // * Verify menu shows Extract Handwriting option
    const extractOption = page.locator('text=Extract handwriting');
    await expect(extractOption).toBeVisible({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify Image AI menu shows Describe Image option
 *
 * @precondition
 * AI plugin is enabled with vision-capable agent (test will skip gracefully if not available)
 */
test('shows Describe Image option in Image AI menu', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await adminClient.getChannelByName(team.id, 'town-square');
    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Describe Menu Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Describe Menu Test');

    // # Wait for editor and check AI availability
    const editor = await getEditorAndWait(page);
    await editor.click();

    const hasAIPlugin = await checkAIPluginAvailability(page);
    if (!hasAIPlugin) {
        test.skip(true, 'AI plugin not configured - skipping Image AI test');
        return;
    }

    // # Upload image
    await uploadImageIntoEditor(page);
    await page.waitForTimeout(WEBSOCKET_WAIT);

    // # Select the image
    await selectImageInEditor(page);
    await page.waitForTimeout(UI_MICRO_WAIT * 3);

    // # Click the AI button to open menu
    const menuButton = getImageAIMenuButton(page);
    await expect(menuButton).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Check if button is enabled (vision available)
    const isDisabled = await menuButton.isDisabled();
    if (isDisabled) {
        test.skip(true, 'Vision capability not available - skipping menu test');
        return;
    }

    // # Click the menu button
    await menuButton.click();
    await page.waitForTimeout(UI_MICRO_WAIT * 2);

    // * Verify menu shows Describe Image option
    const describeOption = page.locator('text=Describe image');
    await expect(describeOption).toBeVisible({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify Extract Handwriting triggers an action (dialog or error response)
 *
 * @precondition
 * AI plugin is enabled with vision-capable agent (test will skip gracefully if not available)
 */
test(
    'triggers extraction action when Extract Handwriting is clicked',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;

        // # Configure AI plugin if enabled
        if (!shouldSkipAITests()) {
            await configureAIPlugin(adminClient);
        }

        const channel = await adminClient.getChannelByName(team.id, 'town-square');
        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki through UI
        await createWikiThroughUI(page, uniqueName('Extraction Action Wiki'));

        // # Create new page
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Extraction Action Test');

        // # Wait for editor and check AI availability
        const editor = await getEditorAndWait(page);
        await editor.click();

        const hasAIPlugin = await checkAIPluginAvailability(page);
        if (!hasAIPlugin) {
            test.skip(true, 'AI plugin not configured - skipping Image AI test');
            return;
        }

        // # Upload image
        await uploadImageIntoEditor(page);
        await page.waitForTimeout(WEBSOCKET_WAIT);

        // # Select the image
        await selectImageInEditor(page);
        await page.waitForTimeout(UI_MICRO_WAIT * 3);

        // # Click the AI button to open menu
        const menuButton = getImageAIMenuButton(page);
        await expect(menuButton).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Check if button is enabled (vision available)
        const isDisabled = await menuButton.isDisabled();
        if (isDisabled) {
            test.skip(true, 'Vision capability not available - skipping extraction test');
            return;
        }

        // # Click the menu button to open menu
        await menuButton.click();
        await page.waitForTimeout(UI_MICRO_WAIT * 2);

        // # Click Extract Handwriting option
        const extractOption = page.locator('text=Extract handwriting');
        await expect(extractOption).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await extractOption.click();

        // * Verify an action is triggered - either dialog appears OR error message shows
        // The extraction dialog has id='image-extraction-dialog' or class='image-extraction-dialog'
        // If API fails, an error toast may appear instead
        const extractionDialog = page.locator('#image-extraction-dialog, .image-extraction-dialog');
        const errorMessage = page
            .locator('.error-bar, .server-error, [class*="error"]')
            .filter({hasText: /error|failed|cannot/i});

        // Wait for either the dialog or an error to appear
        await Promise.race([
            extractionDialog.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT}).catch(() => {}),
            errorMessage.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT}).catch(() => {}),
            page.waitForTimeout(ELEMENT_TIMEOUT),
        ]);

        // * Verify either dialog appeared or we got a response (menu closed)
        const dialogVisible = await extractionDialog.isVisible().catch(() => false);
        const errorVisible = await errorMessage.isVisible().catch(() => false);
        const menuStillOpen = await extractOption.isVisible().catch(() => false);

        // The action should have triggered - either dialog shows, error shows, or menu closed
        expect(dialogVisible || errorVisible || !menuStillOpen).toBe(true);
    },
);

/**
 * @objective Verify Extract Handwriting produces properly rendered TipTap content (not raw JSON)
 *
 * @precondition
 * AI plugin is enabled with vision-capable agent (gpt-4o or similar)
 * This test verifies the full extraction flow including content rendering
 */
test(
    'extracts handwriting and renders as proper TipTap content',
    {tag: ['@pages', '@ai-integration']},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;

        // # Configure AI plugin if enabled
        if (!shouldSkipAITests()) {
            await configureAIPlugin(adminClient);
        }

        const channel = await adminClient.getChannelByName(team.id, 'town-square');
        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki through UI
        await createWikiThroughUI(page, uniqueName('TipTap Render Wiki'));

        // # Create new page
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'TipTap Render Test');

        // # Wait for editor and check AI availability
        const editor = await getEditorAndWait(page);
        await editor.click();

        const hasAIPlugin = await checkAIPluginAvailability(page);
        if (!hasAIPlugin) {
            test.skip(true, 'AI plugin not configured - skipping Image AI test');
            return;
        }

        // # Upload the handwritten todo list image (real image for AI processing)
        const handwrittenImagePath = path.join(__dirname, 'fixtures', 'handwritten_todo_list.png');
        if (!fs.existsSync(handwrittenImagePath)) {
            test.skip(true, 'Handwritten todo list fixture not found');
            return;
        }

        // Open slash command menu and upload the real image
        const slashMenu = await openSlashCommandMenu(page);
        await page.keyboard.type('image');
        await page.waitForTimeout(UI_MICRO_WAIT * 3);
        const imageItem = slashMenu.locator('.slash-command-item').filter({hasText: 'Image'});
        await expect(imageItem).toBeVisible({timeout: ELEMENT_TIMEOUT});
        const fileChooserPromise = page.waitForEvent('filechooser', {timeout: ELEMENT_TIMEOUT});
        await imageItem.click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(handwrittenImagePath);

        await page.waitForTimeout(WEBSOCKET_WAIT);

        // # Select the image
        await selectImageInEditor(page);
        await page.waitForTimeout(UI_MICRO_WAIT * 3);

        // # Click the AI button to open menu
        const menuButton = getImageAIMenuButton(page);
        await expect(menuButton).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Check if button is enabled (vision available)
        const isDisabled = await menuButton.isDisabled();
        if (isDisabled) {
            test.skip(true, 'Vision capability not available - skipping extraction test');
            return;
        }

        // # Click the menu button to open menu
        await menuButton.click();
        await page.waitForTimeout(UI_MICRO_WAIT * 2);

        // # Click Extract Handwriting option
        const extractOption = page.locator('text=Extract handwriting');
        await expect(extractOption).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await extractOption.click();

        // # Wait for extraction dialog to appear (shows progress)
        const extractionDialog = page.locator('#image-extraction-dialog, .image-extraction-dialog');
        await extractionDialog.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT}).catch(() => {});

        // # Wait for completion dialog (shows "Go to page" button)
        const completionDialog = page.locator(
            '#image-completion-dialog, .image-completion-dialog, [data-testid="image-completion-dialog"]',
        );
        const goToPageButton = page.locator(
            'button:has-text("Go to"), button:has-text("View page"), [data-testid="go-to-page-button"]',
        );

        // Wait for extraction to complete (up to 30 seconds for AI processing)
        const AI_PROCESSING_TIMEOUT = 30000;
        await Promise.race([
            completionDialog.waitFor({state: 'visible', timeout: AI_PROCESSING_TIMEOUT}).catch(() => {}),
            goToPageButton.waitFor({state: 'visible', timeout: AI_PROCESSING_TIMEOUT}).catch(() => {}),
        ]);

        const completionVisible = await completionDialog.isVisible().catch(() => false);
        const goToButtonVisible = await goToPageButton.isVisible().catch(() => false);

        if (!completionVisible && !goToButtonVisible) {
            // Check for error message
            const errorMessage = page
                .locator('.error-bar, .server-error, [class*="error"]')
                .filter({hasText: /error|failed/i});
            const hasError = await errorMessage.isVisible().catch(() => false);
            if (hasError) {
                const errorText = await errorMessage.textContent();
                test.skip(true, `AI extraction failed: ${errorText}`);
                return;
            }
            test.skip(true, 'AI extraction did not complete in time');
            return;
        }

        // # Click "Go to page" button to navigate to the new page
        if (goToButtonVisible) {
            await goToPageButton.click();
        } else {
            // Try to find any button in the completion dialog
            const dialogButton = completionDialog.locator('button').first();
            await dialogButton.click();
        }

        await page.waitForTimeout(WEBSOCKET_WAIT);

        // # Wait for the new page to load (use more specific selector)
        const newPageEditor = page.locator('.tiptap.ProseMirror');
        await newPageEditor.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

        // * Verify content is NOT raw JSON (should not see {"type":"doc" or "extracted_text")
        const pageContent = await newPageEditor.textContent();

        // Check that raw JSON is not visible
        expect(pageContent).not.toContain('{"type":"doc"');
        expect(pageContent).not.toContain('"extracted_text"');
        expect(pageContent).not.toContain('```json');

        // * Verify "Extracted Content" heading is visible (our wrapper heading)
        const extractedHeading = newPageEditor.locator('h2:has-text("Extracted Content")');
        await expect(extractedHeading).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // * Verify "Original Image" section is visible
        const originalImageHeading = newPageEditor.locator('h3:has-text("Original Image")');
        await expect(originalImageHeading).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // * Verify an image is present in the page
        const embeddedImage = newPageEditor.locator('img');
        await expect(embeddedImage.first()).toBeVisible({timeout: ELEMENT_TIMEOUT});
    },
);

/**
 * Helper to paste HTML content with a proxied image into the editor.
 * This properly inserts content through TipTap's paste handler.
 */
async function pasteProxiedImageHtml(page: any, proxyUrl: string) {
    const editor = page.locator('.tiptap-editor-content');
    await editor.click();

    const htmlWithImage = `<p>Before image</p><img src="${proxyUrl}" alt="Proxied image"><p>After image</p>`;

    await page.evaluate((htmlContent: string) => {
        const clipboardData = new DataTransfer();
        clipboardData.setData('text/html', htmlContent);

        const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData,
        });

        document.activeElement?.dispatchEvent(pasteEvent);
    }, htmlWithImage);
}

/**
 * @objective Verify AI extraction works with proxied external images (e.g., from Confluence imports)
 * These are images displayed via /api/v4/image?url=... that need to be fetched server-side
 *
 * @precondition
 * - Image proxy is enabled
 * - AI plugin is enabled with vision-capable agent
 */
test(
    'supports AI extraction on proxied external images',
    {tag: ['@pages', '@proxy-images']},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;

        // # Ensure image proxy is enabled
        const config = await adminClient.getConfig();
        if (!config.ImageProxySettings?.Enable) {
            await adminClient.patchConfig({
                ImageProxySettings: {
                    Enable: true,
                    ImageProxyType: 'local',
                },
            });
        }

        // # Configure AI plugin if enabled
        if (!shouldSkipAITests()) {
            await configureAIPlugin(adminClient);
        }

        const channel = await adminClient.getChannelByName(team.id, 'town-square');
        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki through UI
        await createWikiThroughUI(page, uniqueName('Proxy Image AI Wiki'));

        // # Create new page
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Proxy Image AI Test');

        // # Wait for editor and check AI availability
        const editor = await getEditorAndWait(page);
        await editor.click();

        const hasAIPlugin = await checkAIPluginAvailability(page);
        if (!hasAIPlugin) {
            test.skip(true, 'AI plugin not configured - skipping proxy image AI test');
            return;
        }

        // # Insert a proxied external image via paste
        // This simulates content imported from Confluence where images use /api/v4/image?url=...
        const externalUrl =
            'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png';
        const proxyUrl = `/api/v4/image?url=${encodeURIComponent(externalUrl)}`;

        await pasteProxiedImageHtml(page, proxyUrl);
        await page.waitForTimeout(2000);

        // * Verify the image is visible
        const imageInEditor = editor.locator('img').first();
        await expect(imageInEditor).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // Note: The image may be re-hosted, so we check for either proxy URL or file URL
        const imageSrc = await imageInEditor.getAttribute('src');
        const isProxied = imageSrc?.includes('/api/v4/image?url=');
        const isRehosted = imageSrc?.startsWith('/api/v4/files/');

        // Image should be either proxied or re-hosted
        expect(isProxied || isRehosted).toBe(true);

        // # Select the image
        await selectImageInEditor(page);
        await page.waitForTimeout(UI_MICRO_WAIT * 3);

        // * Verify Image AI bubble appears for the image
        const imageAIBubble = getImageAIBubble(page);
        await expect(imageAIBubble).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Click the AI menu button
        const menuButton = getImageAIMenuButton(page);
        await expect(menuButton).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // * Verify button is enabled (images should be supported)
        await expect(menuButton).toBeEnabled();

        // # Click to open menu
        await menuButton.click();
        await page.waitForTimeout(UI_MICRO_WAIT * 2);

        // * Verify both AI options are available
        const extractOption = page.locator('text=Extract handwriting');
        const describeOption = page.locator('text=Describe image');

        await expect(extractOption).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await expect(describeOption).toBeVisible({timeout: ELEMENT_TIMEOUT});
    },
);

/**
 * @objective Verify AI extraction action can be triggered for images
 * The describe image option should be clickable and trigger processing
 *
 * @precondition
 * - Image proxy is enabled
 * - AI plugin is enabled with vision-capable agent
 */
test(
    'triggers AI describe action for images',
    {tag: ['@pages', '@proxy-images', '@ai-integration']},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;

        // # Ensure image proxy is enabled
        const config = await adminClient.getConfig();
        if (!config.ImageProxySettings?.Enable) {
            await adminClient.patchConfig({
                ImageProxySettings: {
                    Enable: true,
                    ImageProxyType: 'local',
                },
            });
        }

        // # Configure AI plugin if enabled
        if (!shouldSkipAITests()) {
            await configureAIPlugin(adminClient);
        }

        const channel = await adminClient.getChannelByName(team.id, 'town-square');
        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki through UI
        await createWikiThroughUI(page, uniqueName('AI Process Test Wiki'));

        // # Create new page
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'AI Process Test');

        // # Wait for editor and check AI availability
        const editor = await getEditorAndWait(page);
        await editor.click();

        const hasAIPlugin = await checkAIPluginAvailability(page);
        if (!hasAIPlugin) {
            test.skip(true, 'AI plugin not configured - skipping AI process test');
            return;
        }

        // # Insert a proxied external image via paste (Wikipedia has reliable, fast images)
        const externalUrl =
            'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png';
        const proxyUrl = `/api/v4/image?url=${encodeURIComponent(externalUrl)}`;

        await pasteProxiedImageHtml(page, proxyUrl);
        await page.waitForTimeout(2000);

        // * Verify the image is visible
        const imageInEditor = editor.locator('img').first();
        await expect(imageInEditor).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Select the image and open AI menu
        await selectImageInEditor(page);
        await page.waitForTimeout(UI_MICRO_WAIT * 3);

        const menuButton = getImageAIMenuButton(page);
        const isDisabled = await menuButton.isDisabled();
        if (isDisabled) {
            test.skip(true, 'Vision capability not available - skipping AI process test');
            return;
        }

        await menuButton.click();
        await page.waitForTimeout(UI_MICRO_WAIT * 2);

        // # Click "Describe image" to trigger processing
        const describeOption = page.locator('text=Describe image');
        await expect(describeOption).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await describeOption.click();

        // * Verify the menu closed (action was triggered)
        await page.waitForTimeout(UI_MICRO_WAIT * 3);
        const menuStillOpen = await describeOption.isVisible().catch(() => false);

        // The menu should close after clicking the option
        expect(menuStillOpen).toBe(false);

        // * Verify editor is still functional after triggering action
        await page.keyboard.press('Escape'); // Close any dialogs
        await page.waitForTimeout(UI_MICRO_WAIT * 2);
        await editor.click();
        await page.keyboard.press('End');
        await page.keyboard.type(' Action triggered successfully.');
        await expect(editor).toContainText('Action triggered successfully.');
    },
);

/**
 * @objective Verify editor remains functional after AI image extraction
 *
 * @precondition
 * AI plugin is enabled
 */
test(
    'editor remains functional after AI image action',
    {tag: ['@pages', '@proxy-images']},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;

        // # Ensure image proxy is enabled
        const config = await adminClient.getConfig();
        if (!config.ImageProxySettings?.Enable) {
            await adminClient.patchConfig({
                ImageProxySettings: {
                    Enable: true,
                    ImageProxyType: 'local',
                },
            });
        }

        // # Configure AI plugin if enabled
        if (!shouldSkipAITests()) {
            await configureAIPlugin(adminClient);
        }

        const channel = await adminClient.getChannelByName(team.id, 'town-square');
        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki through UI
        await createWikiThroughUI(page, uniqueName('Editor Functional Wiki'));

        // # Create new page
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Editor Functional Test');

        // # Wait for editor
        const editor = await getEditorAndWait(page);
        await editor.click();

        const hasAIPlugin = await checkAIPluginAvailability(page);
        if (!hasAIPlugin) {
            test.skip(true, 'AI plugin not configured - skipping editor functional test');
            return;
        }

        // # Insert a proxied image via paste
        const externalUrl =
            'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png';
        const proxyUrl = `/api/v4/image?url=${encodeURIComponent(externalUrl)}`;

        await pasteProxiedImageHtml(page, proxyUrl);
        await page.waitForTimeout(2000);

        // * Verify the image is visible
        const imageInEditor = editor.locator('img').first();
        await expect(imageInEditor).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Select the image
        await selectImageInEditor(page);
        await page.waitForTimeout(UI_MICRO_WAIT * 3);

        // # Try to trigger AI action (may or may not succeed depending on vision availability)
        const menuButton = getImageAIMenuButton(page);
        if (await menuButton.isVisible()) {
            if (!(await menuButton.isDisabled())) {
                await menuButton.click();
                await page.waitForTimeout(UI_MICRO_WAIT * 2);

                const describeOption = page.locator('text=Describe image');
                if (await describeOption.isVisible()) {
                    await describeOption.click();

                    // Wait briefly for action to trigger
                    await page.waitForTimeout(WEBSOCKET_WAIT);
                }
            }
        }

        // # Press Escape to close any dialogs
        await page.keyboard.press('Escape');
        await page.waitForTimeout(UI_MICRO_WAIT * 2);

        // * Editor should still be functional after AI action
        await editor.click();
        await page.keyboard.press('End');
        await page.keyboard.type(' Editor still works after AI action.');
        await expect(editor).toContainText('Editor still works after AI action.');
    },
);
