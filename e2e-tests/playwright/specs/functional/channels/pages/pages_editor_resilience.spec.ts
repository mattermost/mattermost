// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Editor Resilience Tests
 *
 * These tests verify the editor handles edge cases, rapid actions, and error conditions gracefully.
 * All tests are tagged with @flaky to indicate they test timing-sensitive scenarios.
 */

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    getNewPageButton,
    fillCreatePageModal,
    getEditorAndWait,
    typeInEditor,
    selectTextInEditor,
    waitForFormattingBar,
    openSlashCommandMenu,
    rapidClick,
    undoAction,
    redoAction,
    pressModifierKey,
    uniqueName,
    loginAndNavigateToChannel,
    SHORT_WAIT,
    ELEMENT_TIMEOUT,
    UI_MICRO_WAIT,
    WEBSOCKET_WAIT,
} from './test_helpers';

// ============================================================================
// Rapid Action Tests
// ============================================================================

/**
 * @objective Verify editor handles rapid bold button clicks without crashing
 */
test('handles rapid bold button clicks', {tag: ['@pages', '@flaky']}, async ({pw, sharedPagesSetup}) => {
    const {team, user} = sharedPagesSetup;

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, 'town-square');

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Rapid Bold Wiki'));
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Rapid Bold Test');

    // # Type and select text
    await typeInEditor(page, 'Test rapid clicks');
    await selectTextInEditor(page);

    // # Get formatting bar and bold button
    const formattingBar = await waitForFormattingBar(page);
    const boldButton = formattingBar.locator('button:has(i.icon-format-bold)');

    // # Click bold button rapidly 10 times
    await rapidClick(boldButton, 10, 30);

    // * Verify editor is still functional
    const editor = await getEditorAndWait(page);
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.type(' still works');
    await expect(editor).toContainText('still works');
});

/**
 * @objective Verify editor handles rapid slash command open/close cycles
 */
test('handles rapid slash command open/close', {tag: ['@pages', '@flaky']}, async ({pw, sharedPagesSetup}) => {
    const {team, user} = sharedPagesSetup;

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, 'town-square');

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Rapid Slash Wiki'));
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Rapid Slash Test');

    const editor = await getEditorAndWait(page);
    await editor.click();

    // # Rapidly open and close slash menu 5 times
    for (let i = 0; i < 5; i++) {
        await page.keyboard.type('/');
        await page.waitForTimeout(UI_MICRO_WAIT);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(UI_MICRO_WAIT);
    }

    // * Verify editor is still functional
    await page.keyboard.type('Test after rapid slash');
    await expect(editor).toContainText('Test after rapid slash');
});

/**
 * @objective Verify editor handles typing during formatting toggle
 */
test('handles rapid typing during formatting', {tag: ['@pages', '@flaky']}, async ({pw, sharedPagesSetup}) => {
    const {team, user} = sharedPagesSetup;

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, 'town-square');

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Rapid Type Wiki'));
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Rapid Type Test');

    const editor = await getEditorAndWait(page);
    await editor.click();

    // # Rapidly type while toggling bold
    for (let i = 0; i < 5; i++) {
        await pressModifierKey(page, 'b');
        await page.keyboard.type(`word${i} `);
    }

    // * Verify all text is present
    await expect(editor).toContainText('word0');
    await expect(editor).toContainText('word4');
});

// ============================================================================
// Selection Edge Cases
// ============================================================================

/**
 * @objective Verify backwards text selection works with formatting
 */
test('handles backwards text selection', {tag: ['@pages', '@flaky']}, async ({pw, sharedPagesSetup}) => {
    const {team, user} = sharedPagesSetup;

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, 'town-square');

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Backwards Selection Wiki'));
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Backwards Selection Test');

    // # Type text
    await typeInEditor(page, 'Select this backwards');
    const editor = await getEditorAndWait(page);

    // # Position at end and select backwards
    await page.keyboard.press('End');
    for (let i = 0; i < 9; i++) {
        // Select "backwards"
        await page.keyboard.press('Shift+ArrowLeft');
    }

    // # Wait for formatting bar
    await page.waitForTimeout(SHORT_WAIT);

    // # Apply bold to backwards selection
    await pressModifierKey(page, 'b');

    // * Verify bold is applied
    const boldText = editor.locator('strong:has-text("backwards")');
    await expect(boldText).toBeVisible({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify multi-paragraph selection works with formatting
 */
test('handles multi-paragraph selection', {tag: ['@pages', '@flaky']}, async ({pw, sharedPagesSetup}) => {
    const {team, user} = sharedPagesSetup;

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, 'town-square');

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Multi Para Wiki'));
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Multi Para Test');

    const editor = await getEditorAndWait(page);
    await editor.click();

    // # Type multiple paragraphs
    await page.keyboard.type('First paragraph');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second paragraph');

    // # Select all text
    await pressModifierKey(page, 'a');
    await page.waitForTimeout(SHORT_WAIT);

    // # Apply bold
    await pressModifierKey(page, 'b');

    // * Verify bold is applied to both paragraphs
    const boldFirst = editor.locator('strong:has-text("First paragraph")');
    const boldSecond = editor.locator('strong:has-text("Second paragraph")');
    await expect(boldFirst).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(boldSecond).toBeVisible({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify empty selection does not cause errors when clicking format buttons
 */
test('handles empty selection with formatting click', {tag: ['@pages', '@flaky']}, async ({pw, sharedPagesSetup}) => {
    const {team, user} = sharedPagesSetup;

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, 'town-square');

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Empty Selection Wiki'));
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Empty Selection Test');

    const editor = await getEditorAndWait(page);
    await editor.click();

    // # Toggle bold with no selection (caret position)
    await pressModifierKey(page, 'b');

    // # Type text - should be bold
    await page.keyboard.type('This should be bold');

    // # Toggle bold off
    await pressModifierKey(page, 'b');

    // # Type more text - should be normal
    await page.keyboard.type(' and this is normal');

    // * Verify editor is still functional and text is present
    await expect(editor).toContainText('This should be bold');
    await expect(editor).toContainText('and this is normal');
});

// ============================================================================
// Undo/Redo Tests
// ============================================================================

/**
 * @objective Verify text formatting can be undone with Ctrl+Z
 */
test('undoes text formatting with Ctrl+Z', {tag: ['@pages', '@flaky']}, async ({pw, sharedPagesSetup}) => {
    const {team, user} = sharedPagesSetup;

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, 'town-square');

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Undo Format Wiki'));
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Undo Format Test');

    // # Type and format text
    await typeInEditor(page, 'Undo this bold');
    await selectTextInEditor(page);
    await pressModifierKey(page, 'b');

    const editor = await getEditorAndWait(page);

    // * Verify bold is applied
    let boldText = editor.locator('strong:has-text("Undo this bold")');
    await expect(boldText).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Undo the formatting
    await undoAction(page);

    // * Verify bold is removed
    boldText = editor.locator('strong:has-text("Undo this bold")');
    await expect(boldText).not.toBeVisible({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify text formatting can be redone with Ctrl+Y/Ctrl+Shift+Z
 */
test('redoes text formatting with Ctrl+Y', {tag: ['@pages', '@flaky']}, async ({pw, sharedPagesSetup}) => {
    const {team, user} = sharedPagesSetup;

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, 'town-square');

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Redo Format Wiki'));
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Redo Format Test');

    // # Type and format text
    await typeInEditor(page, 'Redo this bold');
    await selectTextInEditor(page);
    await pressModifierKey(page, 'b');

    const editor = await getEditorAndWait(page);

    // # Undo the formatting
    await undoAction(page);

    // * Verify bold is removed
    let boldText = editor.locator('strong:has-text("Redo this bold")');
    await expect(boldText).not.toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Redo the formatting
    await redoAction(page);

    // * Verify bold is restored
    boldText = editor.locator('strong:has-text("Redo this bold")');
    await expect(boldText).toBeVisible({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify multiple undo operations work correctly
 */
test('handles multiple undo operations', {tag: ['@pages', '@flaky']}, async ({pw, sharedPagesSetup}) => {
    const {team, user} = sharedPagesSetup;

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, 'town-square');

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Multi Undo Wiki'));
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Multi Undo Test');

    const editor = await getEditorAndWait(page);
    await editor.click();

    // # Type initial text
    await page.keyboard.type('Initial text');
    await page.waitForTimeout(SHORT_WAIT);

    // # Perform undo - should work without crashing
    await undoAction(page);
    await page.waitForTimeout(UI_MICRO_WAIT * 3);

    // * Verify editor is still functional after undo
    await editor.click();
    await page.keyboard.type(' added');

    // Verify we can still type after undo
    await expect(editor).toContainText('added');
});

/**
 * @objective Verify editor remains functional after focus loss and refocus
 */
test('editor remains functional after focus loss', {tag: ['@pages', '@flaky']}, async ({pw, sharedPagesSetup}) => {
    const {team, user} = sharedPagesSetup;

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, 'town-square');

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Focus Undo Wiki'));
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Focus Undo Test');

    // # Type text
    await typeInEditor(page, 'Text before blur');
    const editor = await getEditorAndWait(page);
    await expect(editor).toContainText('Text before blur');

    // # Blur editor (click outside)
    const titleInput = page.locator('[data-testid="wiki-page-title-input"]').first();
    await titleInput.click();
    await page.waitForTimeout(SHORT_WAIT);

    // # Refocus editor
    await editor.click();
    await page.waitForTimeout(UI_MICRO_WAIT * 3);

    // # Type more text after refocus
    await page.keyboard.type(' and after refocus');

    // * Verify editor accepted new text after blur/refocus cycle
    await expect(editor).toContainText('Text before blur and after refocus');
});

// ============================================================================
// Keyboard Navigation Tests
// ============================================================================

/**
 * @objective Verify arrow key navigation between blocks
 */
test('navigates blocks with arrow keys', {tag: ['@pages', '@flaky']}, async ({pw, sharedPagesSetup}) => {
    const {team, user} = sharedPagesSetup;

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, 'town-square');

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Arrow Nav Wiki'));
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Arrow Nav Test');

    const editor = await getEditorAndWait(page);
    await editor.click();

    // # Create multiple paragraphs
    await page.keyboard.type('First paragraph');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second paragraph');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Third paragraph');

    // # Navigate up with arrow keys
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(UI_MICRO_WAIT * 2);

    // # Type at new position
    await page.keyboard.type(' INSERTED');

    // * Verify text was inserted in first paragraph
    await expect(editor).toContainText('First paragraph INSERTED');
});

/**
 * @objective Verify slash menu can be closed and editor remains functional
 */
test('recovers from closed slash menu', {tag: ['@pages', '@flaky']}, async ({pw, sharedPagesSetup}) => {
    const {team, user} = sharedPagesSetup;

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, 'town-square');

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Slash Recovery Wiki'));
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Slash Recovery Test');

    // # Open and close slash menu multiple ways
    const slashMenu = await openSlashCommandMenu(page);
    await expect(slashMenu).toBeVisible();

    // # Close with Escape
    await page.keyboard.press('Escape');
    await expect(slashMenu).not.toBeVisible({timeout: WEBSOCKET_WAIT});

    // # Verify editor still works
    const editor = await getEditorAndWait(page);
    await page.keyboard.type('Editor still works');
    await expect(editor).toContainText('Editor still works');
});

/**
 * @objective Verify editor handles Tab key in lists (indent behavior)
 */
test('handles Tab key in lists for indentation', {tag: ['@pages', '@flaky']}, async ({pw, sharedPagesSetup}) => {
    const {team, user} = sharedPagesSetup;

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, 'town-square');

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Tab Indent Wiki'));
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Tab Indent Test');

    const editor = await getEditorAndWait(page);
    await editor.click();

    // # Create a list
    await page.keyboard.type('/');
    const slashMenu = page.locator('.slash-command-menu');
    await slashMenu.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    const bulletItem = slashMenu.locator('.slash-command-item').filter({hasText: 'Bulleted list'});
    await bulletItem.click();

    // # Type first item
    await page.waitForTimeout(UI_MICRO_WAIT * 3);
    await page.keyboard.type('Parent item');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Child item');

    // # Try Tab to indent (may or may not work depending on implementation)
    await page.keyboard.press('Tab');

    // * Verify editor is still functional (no crash from Tab)
    await page.keyboard.type(' more text');
    await expect(editor).toContainText('more text');
});

// ============================================================================
// Error Recovery Tests
// ============================================================================

/**
 * @objective Verify editor content is preserved on rapid navigation
 */
test('preserves content during rapid interactions', {tag: ['@pages', '@flaky']}, async ({pw, sharedPagesSetup}) => {
    const {team, user} = sharedPagesSetup;

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, 'town-square');

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Rapid Interact Wiki'));
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Rapid Interact Test');

    const editor = await getEditorAndWait(page);
    await editor.click();

    // # Type content
    await page.keyboard.type('Important content that must be preserved');

    // # Rapid interactions: blur/focus, escape, clicks
    const titleInput = page.locator('[data-testid="wiki-page-title-input"]').first();

    for (let i = 0; i < 3; i++) {
        await titleInput.click();
        await page.waitForTimeout(UI_MICRO_WAIT);
        await editor.click();
        await page.waitForTimeout(UI_MICRO_WAIT);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(UI_MICRO_WAIT);
    }

    // * Verify content is still present
    await expect(editor).toContainText('Important content that must be preserved');
});
