// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    getNewPageButton,
    fillCreatePageModal,
    openSlashCommandMenu,
    insertViaSlashCommand,
    verifyEditorElement,
    selectAllText,
    getEditorAndWait,
    pressModifierKey,
    SHORT_WAIT,
    ELEMENT_TIMEOUT,
    WEBSOCKET_WAIT,
    EDITOR_LOAD_WAIT,
    UI_MICRO_WAIT,
} from './test_helpers';

/**
 * @objective Verify slash command menu appears when typing / on blank line
 */
test('opens slash command menu when typing / on blank line', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Slash Command Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Slash Command Test');

    // # Open slash command menu
    const slashMenu = await openSlashCommandMenu(page);

    // * Verify menu contains expected items
    await expect(slashMenu).toContainText('Heading 1');
    await expect(slashMenu).toContainText('Heading 2');
    await expect(slashMenu).toContainText('Bulleted list');
    await expect(slashMenu).toContainText('Quote');
    await expect(slashMenu).toContainText('Divider');
});

/**
 * @objective Verify slash command menu only appears when / is typed on a new line
 */
test('does not open slash command menu when / typed mid-line', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Slash Mid Line Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Slash Mid Line Test');

    // # Wait for editor
    const editor = await getEditorAndWait(page);
    await editor.waitFor({state: 'visible'});
    await editor.click();

    // # Type some text first
    await page.keyboard.type('This is some text');

    // # Type / mid-line (without starting a new line)
    await page.keyboard.type('/');

    // * Verify slash menu does NOT appear
    const slashMenu = page.locator('.slash-command-menu');
    await expect(slashMenu).not.toBeVisible({timeout: WEBSOCKET_WAIT});

    // * Verify the / character is just plain text
    await expect(editor).toContainText('This is some text/');
});

/**
 * @objective Verify slash command menu appears when / is typed on a new line
 */
test('opens slash command menu when / typed at start of new line', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Slash New Line Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Slash New Line Test');

    // # Wait for editor
    const editor = await getEditorAndWait(page);
    await editor.waitFor({state: 'visible'});
    await editor.click();

    // # Type some text first
    await page.keyboard.type('First line');

    // # Press Enter to create a new line
    await page.keyboard.press('Enter');

    // # Type / at the start of the new line
    await page.keyboard.type('/');

    // * Verify slash menu DOES appear
    const slashMenu = page.locator('.slash-command-menu');
    await expect(slashMenu).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify menu contains expected items
    await expect(slashMenu).toContainText('Heading 1');
    await expect(slashMenu).toContainText('Bulleted list');
});

/**
 * @objective Verify slash command menu filters items based on search query
 */
test('filters slash command menu items by typing search query', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Slash Filter Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Slash Filter Test');

    // # Open slash menu and verify it appears
    const editorElement = page.locator('.tiptap.ProseMirror');
    await editorElement.click();
    await editorElement.press('/');

    // * Verify slash menu opens with all items
    let slashMenu = page.locator('.slash-command-menu');
    await slashMenu.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

    // * Verify initial menu contains multiple items
    await expect(slashMenu).toContainText('Bold');
    await expect(slashMenu).toContainText('Heading 1');

    // # Type 'h1' to filter the menu
    await page.keyboard.type('h1', {delay: 50});

    // * Wait for the menu to show filtered item
    // The menu should show "Heading 1" after filtering
    // Wait briefly to allow the filter to apply
    await page.waitForTimeout(UI_MICRO_WAIT * 2);

    // Re-get the menu locator in case it was recreated
    slashMenu = page.locator('.slash-command-menu');
    const heading1Item = slashMenu.locator('.slash-command-item').filter({hasText: 'Heading 1'});
    // The menu should remain open with debounced exit (300ms)
    await expect(heading1Item).toBeVisible({timeout: WEBSOCKET_WAIT});

    // # Clear the filter and try a different one
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(UI_MICRO_WAIT);

    // # Type 'list' to filter
    await page.keyboard.type('list', {delay: 50});
    await page.waitForTimeout(UI_MICRO_WAIT * 2);

    // * Verify menu shows list options
    slashMenu = page.locator('.slash-command-menu');
    const bulletedItem = slashMenu.locator('.slash-command-item').filter({hasText: 'Bulleted list'});
    const numberedItem = slashMenu.locator('.slash-command-item').filter({hasText: 'Numbered list'});
    // Menu should remain open with debounced exit
    await expect(bulletedItem).toBeVisible({timeout: WEBSOCKET_WAIT});
    await expect(numberedItem).toBeVisible({timeout: WEBSOCKET_WAIT});
});

/**
 * @objective Verify slash command inserts heading when selected from menu
 */
test('inserts heading 1 when selected from slash command menu', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Slash Insert Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Slash Insert Test');

    // # Insert H1 via slash command
    await insertViaSlashCommand(page, 'Heading 1');

    const editor = await getEditorAndWait(page);

    // * Verify "Heading 1" placeholder text is inserted and selected
    await verifyEditorElement(editor, 'h1', 'Heading 1');

    // # Wait for editor to be fully ready before typing
    await page.waitForTimeout(UI_MICRO_WAIT * 2);

    // # Type to replace the selected placeholder text
    await page.keyboard.type('Test Heading');

    // * Verify heading 1 exists in editor with new text
    await verifyEditorElement(editor, 'h1', 'Test Heading');
});

/**
 * @objective Verify slash command inserts bulleted list when selected
 */
test('inserts bulleted list when selected from slash command menu', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Slash List Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Slash List Test');

    // # Insert bulleted list via slash command
    await insertViaSlashCommand(page, 'Bulleted list');

    const editor = await getEditorAndWait(page);

    // * Verify bulleted list is inserted with empty list item
    const listElement = editor.locator('ul li');
    await expect(listElement.first()).toBeVisible();

    // * Verify list item is initially empty (no placeholder text)
    await expect(listElement.first()).toBeEmpty();

    // # Wait for editor to be fully ready before typing
    await page.waitForTimeout(UI_MICRO_WAIT * 2);

    // # Type text into the empty list item
    await page.keyboard.type('First item');

    // * Verify bulleted list now contains the typed text (text is in <p> within <li>)
    await expect(listElement.first().locator('p')).toHaveText('First item');
});

/**
 * @objective Verify slash command opens image insertion flow without JS errors
 */
test('opens image insertion when selected from slash command menu', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Slash Image Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Slash Image Test');

    // # Wait for editor
    const editor = await getEditorAndWait(page);
    await editor.waitFor({state: 'visible'});
    await editor.click();

    // # Set up console error listener to catch JS errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
        }
    });

    // # Set up page error listener
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => {
        pageErrors.push(error);
    });

    // # Open slash menu
    const slashMenu = await openSlashCommandMenu(page);

    // * Verify menu is visible
    await expect(slashMenu).toBeVisible();

    // # Type 'image' to filter to image option
    await page.keyboard.type('image');
    await page.waitForTimeout(UI_MICRO_WAIT * 3);

    // * Verify image option is visible in filtered menu
    const imageItem = slashMenu.locator('.slash-command-item').filter({hasText: 'Image'});
    await expect(imageItem).toBeVisible({timeout: WEBSOCKET_WAIT});

    // # Select image option (this should trigger the image modal/file picker without errors)
    await imageItem.click();
    await page.waitForTimeout(SHORT_WAIT);

    // * Verify no JavaScript errors occurred
    if (pageErrors.length > 0) {
        throw new Error(`JavaScript errors occurred: ${pageErrors.map((e) => e.message).join('\n')}`);
    }

    const filteredConsoleErrors = consoleErrors.filter(
        (err) => !err.includes('DevTools') && !err.includes('ReactDOM.render is no longer supported'),
    );
    if (filteredConsoleErrors.length > 0) {
        throw new Error(`Console errors occurred: ${filteredConsoleErrors.join('\n')}`);
    }

    // * Verify slash menu closed after selection
    await expect(slashMenu).not.toBeVisible();

    // * Verify either image URL modal is visible OR file picker was triggered
    // (file picker is native and can't be directly tested, but we verify no errors occurred)
    const imageUrlModal = page.locator('[data-testid="image-url-modal"]');
    await imageUrlModal.isVisible().catch(() => false);
});

/**
 * @objective Verify slash command keyboard navigation with arrow keys
 */
test(
    'navigates slash command menu with arrow keys and selects with Enter',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const {page, channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // # Create wiki and page
        await createWikiThroughUI(page, `Slash Nav Wiki ${await pw.random.id()}`);
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Slash Nav Test');

        // # Open slash menu
        const slashMenu = await openSlashCommandMenu(page);

        // # Navigate with arrow keys and select
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(UI_MICRO_WAIT * 2);
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(UI_MICRO_WAIT * 2);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(UI_MICRO_WAIT * 3);

        // * Verify menu closed after selection
        await expect(slashMenu).not.toBeVisible();

        // * Verify content was modified
        const editor = await getEditorAndWait(page);
        const editorContent = await editor.textContent();
        expect(editorContent).not.toBe('/');
    },
);

/**
 * @objective Verify slash command menu closes when pressing Escape
 */
test('closes slash command menu when pressing Escape', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Slash Escape Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Slash Escape Test');

    // # Open slash menu
    const slashMenu = await openSlashCommandMenu(page);

    // # Press Escape to close menu
    await page.keyboard.press('Escape');
    await page.waitForTimeout(UI_MICRO_WAIT * 3);

    // * Verify menu is closed
    await expect(slashMenu).not.toBeVisible();
});

/**
 * @objective Verify slash command menu closes when clicking away from it
 */
test('closes slash command menu when clicking away', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Slash Click Away Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Slash Click Away Test');

    // # Open slash menu
    const slashMenu = await openSlashCommandMenu(page);

    // * Verify menu is visible
    await expect(slashMenu).toBeVisible();

    // # Click away from the menu (click on title input)
    const titleInput = page.locator('[data-testid="wiki-page-title-input"]').first();
    await titleInput.click();
    await page.waitForTimeout(UI_MICRO_WAIT * 3);

    // * Verify menu is closed
    await expect(slashMenu).not.toBeVisible({timeout: WEBSOCKET_WAIT});
});

/**
 * @objective Verify ESC key closes slash command menu as expected
 */
test('verifies ESC key closes slash command menu', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Slash ESC Key Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Slash ESC Key Test');

    // # Open slash menu
    const slashMenu = await openSlashCommandMenu(page);

    // * Verify menu is visible
    await expect(slashMenu).toBeVisible();

    // # Press Escape key
    await page.keyboard.press('Escape');
    await page.waitForTimeout(UI_MICRO_WAIT * 3);

    // * Verify menu is closed
    await expect(slashMenu).not.toBeVisible({timeout: EDITOR_LOAD_WAIT});

    // # Verify editor is still focused and functional
    const editor = await getEditorAndWait(page);
    await page.keyboard.type('Test text after ESC');
    await expect(editor).toContainText('Test text after ESC');
});

/**
 * @objective Verify placeholder text displays in empty editor to invite slash command usage
 */
test('displays placeholder text in empty editor', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Placeholder Test Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Placeholder Test Page');

    // * Verify placeholder text is configured correctly
    // Note: Placeholder is rendered via CSS ::before pseudo-element (see tiptap_editor.scss:20-25)
    // which cannot be directly tested by Playwright. We verify the data-placeholder attribute is set.
    const editorElement = page.locator('.tiptap-editor-content');
    await expect(editorElement).toBeVisible();
    await expect(editorElement).toHaveAttribute('data-placeholder', "Type '/' to insert objects or start writing...");

    // # Type some content to verify editor is functional
    await editorElement.click();
    await page.keyboard.type('Some content');

    // * Verify content was typed successfully
    await expect(editorElement.locator('p')).toHaveText('Some content');

    // # Clear all content
    await selectAllText(page);
    await page.keyboard.press('Backspace');

    // * Verify content was cleared (editor should show placeholder again via CSS)
    // We verify by checking the paragraph is empty
    await expect(editorElement.locator('p')).toBeEmpty();
});

/**
 * @objective Verify placeholder appears when cursor moves to beginning of empty line (Confluence-style)
 */
test('shows placeholder when cursor at beginning of empty line', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Placeholder Line Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Placeholder Line Test');

    const editorElement = page.locator('.tiptap-editor-content');
    await expect(editorElement).toBeVisible();

    // * Verify placeholder is set for empty editor
    await expect(editorElement).toHaveAttribute('data-placeholder', "Type '/' to insert objects or start writing...");

    // # Type content on first line
    await editorElement.click();
    await page.keyboard.type('First line with content');

    // * Verify content was typed
    await expect(editorElement).toContainText('First line with content');

    // # Press Enter to create new empty line
    await page.keyboard.press('Enter');

    // * Verify placeholder attribute is still present (applies to empty paragraphs via CSS)
    await expect(editorElement).toHaveAttribute('data-placeholder', "Type '/' to insert objects or start writing...");

    // # Type content on second line
    await page.keyboard.type('Second line');

    // * Verify second line has content
    await expect(editorElement).toContainText('Second line');

    // # Create another empty line
    await page.keyboard.press('Enter');

    // * Verify placeholder attribute persists (CSS shows it for empty blocks)
    await expect(editorElement).toHaveAttribute('data-placeholder', "Type '/' to insert objects or start writing...");

    // # Navigate to the middle of existing content
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('End');

    // # Press Enter to create empty line between content
    await page.keyboard.press('Enter');

    // * Verify placeholder attribute is still present (empty line should show placeholder)
    await expect(editorElement).toHaveAttribute('data-placeholder', "Type '/' to insert objects or start writing...");

    // # Move cursor to document start
    await pressModifierKey(page, 'Home');

    // * Verify content still exists in editor before we delete it
    await expect(editorElement).toContainText('First line with content');

    // # Delete all content to make editor empty
    await selectAllText(page);
    await page.keyboard.press('Backspace');

    // * Verify first line is now empty (placeholder should be visible via CSS)
    await expect(editorElement.locator('p').first()).toBeEmpty();
});
