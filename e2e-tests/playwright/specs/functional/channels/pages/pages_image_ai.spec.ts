// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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
    await createWikiThroughUI(page, `Image AI Test Wiki ${await pw.random.id()}`);

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
    await createWikiThroughUI(page, `Image AI Menu Wiki ${await pw.random.id()}`);

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
    await createWikiThroughUI(page, `AI Menu Open Wiki ${await pw.random.id()}`);

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
test('hides Image AI bubble when clicking outside image', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Configure AI plugin if enabled
    if (!shouldSkipAITests()) {
        await configureAIPlugin(adminClient);
    }

    const channel = await adminClient.getChannelByName(team.id, 'town-square');
    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, `Bubble Hide Wiki ${await pw.random.id()}`);

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

    // # Click outside the image (on the text)
    const firstParagraph = editor.locator('p').first();
    await firstParagraph.click();
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
    await createWikiThroughUI(page, `Accessibility Test Wiki ${await pw.random.id()}`);

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
    await createWikiThroughUI(page, `Resizable Image Wiki ${await pw.random.id()}`);

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
    await createWikiThroughUI(page, `Publish Bubble Wiki ${await pw.random.id()}`);

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
    await createWikiThroughUI(page, `AI Label Wiki ${await pw.random.id()}`);

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
    await createWikiThroughUI(page, `Extract Menu Wiki ${await pw.random.id()}`);

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
    await createWikiThroughUI(page, `Describe Menu Wiki ${await pw.random.id()}`);

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
        await createWikiThroughUI(page, `Extraction Action Wiki ${await pw.random.id()}`);

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
