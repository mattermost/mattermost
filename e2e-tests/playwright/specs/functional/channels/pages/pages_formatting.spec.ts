// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    getNewPageButton,
    fillCreatePageModal,
    getEditorAndWait,
    typeInEditor,
    selectTextInEditor,
    publishPage,
    getPageViewerContent,
    pressModifierKey,
    verifyTextHasFormatting,
    verifyTextNoFormatting,
    clickFormattingButtonByIcon,
    insertViaSlashCommand,
    verifyEditorElement,
    SHORT_WAIT,
    ELEMENT_TIMEOUT,
    UI_MICRO_WAIT,
} from './test_helpers';

// ============================================================================
// Text Formatting Tests - Bold, Italic, Strikethrough
// ============================================================================

/**
 * @objective Verify bold toggle via formatting bar button
 */
test('toggles bold via formatting bar button', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Bold Test Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Bold Format Test');

    // # Type text and select it
    await typeInEditor(page, 'Make this bold');
    await selectTextInEditor(page);

    // # Click bold button in formatting bar
    await clickFormattingButtonByIcon(page, 'icon-format-bold');

    // * Verify text has bold formatting
    const editor = await getEditorAndWait(page);
    await verifyTextHasFormatting(editor, 'strong', 'Make this bold');
});

/**
 * @objective Verify bold toggle via keyboard shortcut Ctrl+B
 */
test('toggles bold via keyboard shortcut Ctrl+B', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Bold Shortcut Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Bold Shortcut Test');

    // # Type text
    const editor = await getEditorAndWait(page);
    await editor.click();
    await page.keyboard.type('Normal ');

    // # Toggle bold on and type
    await pressModifierKey(page, 'b');
    await page.keyboard.type('bold text');
    await pressModifierKey(page, 'b');

    await page.keyboard.type(' normal again');

    // * Verify bold text is wrapped in strong tag
    await verifyTextHasFormatting(editor, 'strong', 'bold text');
});

/**
 * @objective Verify italic toggle via formatting bar button
 */
test('toggles italic via formatting bar button', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Italic Test Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Italic Format Test');

    // # Type text and select it
    await typeInEditor(page, 'Make this italic');
    await selectTextInEditor(page);

    // # Click italic button in formatting bar
    await clickFormattingButtonByIcon(page, 'icon-format-italic');

    // * Verify text has italic formatting
    const editor = await getEditorAndWait(page);
    await verifyTextHasFormatting(editor, 'em', 'Make this italic');
});

/**
 * @objective Verify italic toggle via keyboard shortcut Ctrl+I
 */
test('toggles italic via keyboard shortcut Ctrl+I', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Italic Shortcut Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Italic Shortcut Test');

    // # Type text with italic formatting via shortcut
    const editor = await getEditorAndWait(page);
    await editor.click();
    await page.keyboard.type('Normal ');

    // # Toggle italic on and type
    await pressModifierKey(page, 'i');
    await page.keyboard.type('italic text');
    await pressModifierKey(page, 'i');

    await page.keyboard.type(' normal again');

    // * Verify italic text is wrapped in em tag
    await verifyTextHasFormatting(editor, 'em', 'italic text');
});

/**
 * @objective Verify strikethrough toggle via formatting bar button
 */
test('toggles strikethrough via formatting bar button', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Strikethrough Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Strikethrough Test');

    // # Type text and select it
    await typeInEditor(page, 'Strike this out');
    await selectTextInEditor(page);

    // # Click strikethrough button in formatting bar
    await clickFormattingButtonByIcon(page, 'icon-format-strikethrough-variant');

    // * Verify text has strikethrough formatting (s tag)
    const editor = await getEditorAndWait(page);
    await verifyTextHasFormatting(editor, 's', 'Strike this out');
});

/**
 * @objective Verify combined formatting (bold + italic)
 */
test('applies combined formatting (bold + italic)', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Combined Format Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Combined Format Test');

    // # Type text first, then select and apply both formats
    await typeInEditor(page, 'combined text');
    await selectTextInEditor(page);

    // # Apply bold via formatting bar
    await clickFormattingButtonByIcon(page, 'icon-format-bold');

    // # Select again and apply italic
    await selectTextInEditor(page);
    await clickFormattingButtonByIcon(page, 'icon-format-italic');

    // * Verify the text has both formatting tags
    const editor = await getEditorAndWait(page);
    await expect(editor).toContainText('combined text');

    // Check that strong tag exists
    const strongTag = editor.locator('strong');
    await expect(strongTag).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // Check that em tag exists
    const emTag = editor.locator('em');
    await expect(emTag).toBeVisible({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify formatting is removed when toggled again
 */
test('removes formatting when toggled again', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Remove Format Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Remove Format Test');

    // # Type and select text
    await typeInEditor(page, 'Remove bold');
    await selectTextInEditor(page);

    // # Apply bold
    await clickFormattingButtonByIcon(page, 'icon-format-bold');
    const editor = await getEditorAndWait(page);
    await verifyTextHasFormatting(editor, 'strong', 'Remove bold');

    // # Select again and remove bold
    await selectTextInEditor(page);
    await clickFormattingButtonByIcon(page, 'icon-format-bold');

    // * Verify bold is removed
    await verifyTextNoFormatting(editor, 'strong', 'Remove bold');
});

/**
 * @objective Verify formatting persists after publish
 */
test('formatting persists after publish', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Persist Format Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Persist Format Test');

    // # Type text and apply bold via formatting bar (more reliable)
    await typeInEditor(page, 'bold text here');
    await selectTextInEditor(page);
    await clickFormattingButtonByIcon(page, 'icon-format-bold');

    // # Publish
    await publishPage(page);

    // * Verify formatting persists in published view
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // Verify bold text exists in strong tag
    const boldElement = pageContent.locator('strong');
    await expect(boldElement).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(boldElement).toContainText('bold text here');
});

// ============================================================================
// Block Formatting Tests - Headings, Quote, Code Block, Divider
// ============================================================================

/**
 * @objective Verify heading 1 via formatting bar
 */
test('inserts heading 1 via formatting bar', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `H1 Format Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'H1 Format Test');

    // # Type text and select it
    await typeInEditor(page, 'This is a heading');
    await selectTextInEditor(page);

    // # Click H1 button in formatting bar
    await clickFormattingButtonByIcon(page, 'icon-format-header-1');

    // * Verify text is now h1
    const editor = await getEditorAndWait(page);
    await verifyEditorElement(editor, 'h1', 'This is a heading');
});

/**
 * @objective Verify heading 2 via formatting bar
 */
test('inserts heading 2 via formatting bar', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `H2 Format Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'H2 Format Test');

    // # Type text and select it
    await typeInEditor(page, 'Subheading text');
    await selectTextInEditor(page);

    // # Click H2 button in formatting bar
    await clickFormattingButtonByIcon(page, 'icon-format-header-2');

    // * Verify text is now h2
    const editor = await getEditorAndWait(page);
    await verifyEditorElement(editor, 'h2', 'Subheading text');
});

/**
 * @objective Verify heading 3 via formatting bar
 */
test('inserts heading 3 via formatting bar', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `H3 Format Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'H3 Format Test');

    // # Type text and select it
    await typeInEditor(page, 'Small heading');
    await selectTextInEditor(page);

    // # Click H3 button in formatting bar
    await clickFormattingButtonByIcon(page, 'icon-format-header-3');

    // * Verify text is now h3
    const editor = await getEditorAndWait(page);
    await verifyEditorElement(editor, 'h3', 'Small heading');
});

/**
 * @objective Verify H4, H5, H6 headings via markdown input and persistence after publish
 */
test('inserts lower-level headings (H4-H6) via markdown input', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Lower Headings Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Lower Headings Test');

    // # Type H4, H5, H6 via markdown syntax
    const editor = await getEditorAndWait(page);
    await editor.click();
    await page.keyboard.type('#### H4 heading');
    await page.keyboard.press('Enter');
    await page.keyboard.type('##### H5 heading');
    await page.keyboard.press('Enter');
    await page.keyboard.type('###### H6 heading');

    // * Verify all headings are created in editor
    await verifyEditorElement(editor, 'h4', 'H4 heading');
    await verifyEditorElement(editor, 'h5', 'H5 heading');
    await verifyEditorElement(editor, 'h6', 'H6 heading');

    // # Publish
    await publishPage(page);

    // * Verify all headings persist after publish
    const pageContent = getPageViewerContent(page);
    await expect(pageContent.locator('h4')).toContainText('H4 heading');
    await expect(pageContent.locator('h5')).toContainText('H5 heading');
    await expect(pageContent.locator('h6')).toContainText('H6 heading');
});

/**
 * @objective Verify quote via formatting bar
 */
test('inserts quote via formatting bar', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Quote Format Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Quote Format Test');

    // # Type text and select it
    await typeInEditor(page, 'This is a quote');
    await selectTextInEditor(page);

    // # Click quote button in formatting bar
    await clickFormattingButtonByIcon(page, 'icon-format-quote-open');

    // * Verify text is in blockquote
    const editor = await getEditorAndWait(page);
    await verifyEditorElement(editor, 'blockquote', 'This is a quote');
});

/**
 * @objective Verify code block via formatting bar
 */
test('inserts code block via formatting bar', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Code Format Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Code Format Test');

    // # Type text and select it
    await typeInEditor(page, 'const code = true');
    await selectTextInEditor(page);

    // # Click code block button in formatting bar
    await clickFormattingButtonByIcon(page, 'icon-code-tags');

    // * Verify text is in code block (pre tag)
    const editor = await getEditorAndWait(page);
    const codeBlock = editor.locator('pre');
    await expect(codeBlock).toBeVisible();
    await expect(codeBlock).toContainText('const code = true');
});

/**
 * @objective Verify divider via slash command
 */
test('inserts divider via slash command', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Divider Format Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Divider Format Test');

    // # Insert divider via slash command
    await insertViaSlashCommand(page, 'Divider');

    // * Verify horizontal rule is inserted
    const editor = await getEditorAndWait(page);
    const hr = editor.locator('hr');
    await expect(hr).toBeVisible();
});

/**
 * @objective Verify quote via slash command
 */
test('converts text to quote via slash command', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Slash Quote Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Slash Quote Test');

    // # Insert quote via slash command
    await insertViaSlashCommand(page, 'Quote');

    // # Wait for slash menu to close and type in the quote
    await page.waitForTimeout(SHORT_WAIT);
    await page.keyboard.type('Quoted text');

    // * Verify blockquote exists with the text
    const editor = await getEditorAndWait(page);
    const blockquote = editor.locator('blockquote');
    await expect(blockquote).toBeVisible();
    await expect(blockquote).toContainText('Quoted text');
});

/**
 * @objective Verify code block via slash command
 */
test('converts text to code block via slash command', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Slash Code Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Slash Code Test');

    // # Insert code block via slash command
    await insertViaSlashCommand(page, 'Code block');

    // # Type in the code block
    await page.waitForTimeout(UI_MICRO_WAIT * 3);
    await page.keyboard.type('function test() {}');

    // * Verify pre/code block exists
    const editor = await getEditorAndWait(page);
    const codeBlock = editor.locator('pre');
    await expect(codeBlock).toBeVisible();
    await expect(codeBlock).toContainText('function test()');
});

// ============================================================================
// List Tests
// ============================================================================

/**
 * @objective Verify numbered list via formatting bar
 */
test('creates numbered list via formatting bar', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Numbered List Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Numbered List Test');

    // # Type text and select it
    await typeInEditor(page, 'First item');
    await selectTextInEditor(page);

    // # Click numbered list button in formatting bar
    await clickFormattingButtonByIcon(page, 'icon-format-list-numbered');

    // * Verify text is in ordered list
    const editor = await getEditorAndWait(page);
    const ol = editor.locator('ol');
    await expect(ol).toBeVisible();
    await expect(ol.locator('li')).toContainText('First item');
});

/**
 * @objective Verify bulleted list via formatting bar
 */
test('creates bulleted list via formatting bar', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Bullet List Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Bullet List Test');

    // # Type text and select it
    await typeInEditor(page, 'Bullet item');
    await selectTextInEditor(page);

    // # Click bulleted list button in formatting bar
    await clickFormattingButtonByIcon(page, 'icon-format-list-bulleted');

    // * Verify text is in unordered list
    const editor = await getEditorAndWait(page);
    const ul = editor.locator('ul');
    await expect(ul).toBeVisible();
    await expect(ul.locator('li')).toContainText('Bullet item');
});

/**
 * @objective Verify adding multiple list items with Enter key
 */
test('adds multiple list items with Enter key', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Multi Item List Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Multi Item List Test');

    // # Insert bulleted list via slash command
    await insertViaSlashCommand(page, 'Bulleted list');

    // # Type first item and press Enter for more items
    await page.waitForTimeout(UI_MICRO_WAIT * 3);
    await page.keyboard.type('Item 1');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Item 2');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Item 3');

    // * Verify three list items exist
    const editor = await getEditorAndWait(page);
    const listItems = editor.locator('ul li');
    await expect(listItems).toHaveCount(3);
    await expect(listItems.nth(0)).toContainText('Item 1');
    await expect(listItems.nth(1)).toContainText('Item 2');
    await expect(listItems.nth(2)).toContainText('Item 3');
});

/**
 * @objective Verify list formatting persists after publish
 */
test('list formatting persists after publish', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `List Persist Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'List Persist Test');

    // # Insert numbered list via slash command
    await insertViaSlashCommand(page, 'Numbered list');
    await page.waitForTimeout(UI_MICRO_WAIT * 3);
    await page.keyboard.type('First');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second');

    // # Publish
    await publishPage(page);

    // * Verify list persists in published view
    const pageContent = getPageViewerContent(page);
    const ol = pageContent.locator('ol');
    await expect(ol).toBeVisible();
    await expect(ol.locator('li').nth(0)).toContainText('First');
    await expect(ol.locator('li').nth(1)).toContainText('Second');
});

// ============================================================================
// Table Tests
// ============================================================================

/**
 * @objective Verify table can be inserted via slash command
 */
test('inserts table via slash command', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Table Insert Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Table Insert Test');

    // # Insert table via slash command
    await insertViaSlashCommand(page, 'Table');

    // * Verify table is inserted
    const editor = await getEditorAndWait(page);
    const table = editor.locator('table');
    await expect(table).toBeVisible({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify inserted table has correct 3x3 structure with header row
 */
test('inserts table with 3x3 grid structure', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Table Grid Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Table Grid Test');

    // # Insert table via slash command
    await insertViaSlashCommand(page, 'Table');

    // * Verify table structure
    const editor = await getEditorAndWait(page);
    const table = editor.locator('table');
    await expect(table).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify 3 rows (1 header + 2 body)
    const rows = table.locator('tr');
    await expect(rows).toHaveCount(3);

    // * Verify 3 columns in first row
    const headerCells = rows.first().locator('th, td');
    await expect(headerCells).toHaveCount(3);
});

/**
 * @objective Verify text can be typed into table cells
 */
test('allows typing in table cells', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Table Type Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Table Type Test');

    // # Insert table via slash command
    await insertViaSlashCommand(page, 'Table');

    const editor = await getEditorAndWait(page);
    const table = editor.locator('table');
    await expect(table).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Click on first cell and type
    const firstCell = table.locator('th, td').first();
    await firstCell.click();
    await page.keyboard.type('Header 1');

    // # Tab to next cell and type
    await page.keyboard.press('Tab');
    await page.keyboard.type('Header 2');

    // * Verify text was typed into cells
    await expect(table).toContainText('Header 1');
    await expect(table).toContainText('Header 2');
});

/**
 * @objective Verify table can be navigated with Tab and arrow keys
 */
test('navigates table cells with Tab key', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Table Nav Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Table Nav Test');

    // # Insert table via slash command
    await insertViaSlashCommand(page, 'Table');

    const editor = await getEditorAndWait(page);
    const table = editor.locator('table');
    await expect(table).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Click first cell
    const firstCell = table.locator('th, td').first();
    await firstCell.click();
    await page.keyboard.type('A1');

    // # Tab through cells and type in each
    await page.keyboard.press('Tab');
    await page.keyboard.type('A2');
    await page.keyboard.press('Tab');
    await page.keyboard.type('A3');
    await page.keyboard.press('Tab');
    await page.keyboard.type('B1');

    // * Verify all cells have content
    await expect(table).toContainText('A1');
    await expect(table).toContainText('A2');
    await expect(table).toContainText('A3');
    await expect(table).toContainText('B1');
});

/**
 * @objective Verify table persists after publish
 */
test('table persists after publish', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Table Persist Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Table Persist Test');

    // # Insert table via slash command
    await insertViaSlashCommand(page, 'Table');

    const editor = await getEditorAndWait(page);
    const table = editor.locator('table');
    await expect(table).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Add content to table
    const firstCell = table.locator('th, td').first();
    await firstCell.click();
    await page.keyboard.type('Published Cell');

    // # Publish the page
    await publishPage(page);

    // * Verify table persists in published view
    const pageContent = getPageViewerContent(page);
    const publishedTable = pageContent.locator('table');
    await expect(publishedTable).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(publishedTable).toContainText('Published Cell');
});

// ============================================================================
// Persistence Tests - Additional Coverage
// ============================================================================

/**
 * @objective Verify strikethrough formatting persists after publish
 */
test('strikethrough persists after publish', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Strike Persist Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Strike Persist Test');

    // # Type text and apply strikethrough
    await typeInEditor(page, 'crossed out text');
    await selectTextInEditor(page);
    await clickFormattingButtonByIcon(page, 'icon-format-strikethrough-variant');

    // # Publish
    await publishPage(page);

    // * Verify strikethrough persists
    const pageContent = getPageViewerContent(page);
    const strikeElement = pageContent.locator('s, del, strike');
    await expect(strikeElement).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(strikeElement).toContainText('crossed out text');
});

/**
 * @objective Verify heading formatting persists after publish
 */
test('headings persist after publish', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Heading Persist Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Heading Persist Test');

    // # Insert H1 via slash command
    await insertViaSlashCommand(page, 'Heading 1');
    await page.waitForTimeout(SHORT_WAIT);
    await page.keyboard.type('Main Title');
    await page.keyboard.press('Enter');

    // # Insert H2
    await insertViaSlashCommand(page, 'Heading 2');
    await page.waitForTimeout(SHORT_WAIT);
    await page.keyboard.type('Subtitle');

    // # Publish
    await publishPage(page);

    // * Verify headings persist
    const pageContent = getPageViewerContent(page);
    await expect(pageContent.locator('h1')).toContainText('Main Title');
    await expect(pageContent.locator('h2')).toContainText('Subtitle');
});

/**
 * @objective Verify quote formatting persists after publish
 */
test('quote persists after publish', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Quote Persist Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Quote Persist Test');

    // # Insert quote via slash command
    await insertViaSlashCommand(page, 'Quote');
    await page.waitForTimeout(SHORT_WAIT);
    await page.keyboard.type('Famous quote here');

    // # Publish
    await publishPage(page);

    // * Verify quote persists
    const pageContent = getPageViewerContent(page);
    const quoteElement = pageContent.locator('blockquote');
    await expect(quoteElement).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(quoteElement).toContainText('Famous quote here');
});

/**
 * @objective Verify callout can be inserted via formatting bar button
 */
test('inserts callout via formatting bar button', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Callout Button Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Callout Button Test');

    // # Type text and select it
    await typeInEditor(page, 'Important note');
    await selectTextInEditor(page);

    // # Click callout button in formatting bar
    await clickFormattingButtonByIcon(page, 'icon-information-outline');

    // * Verify callout is inserted
    const editor = await getEditorAndWait(page);
    const calloutElement = editor.locator('[data-type="callout"], .callout-block, [class*="callout"]');
    await expect(calloutElement.first()).toBeVisible({timeout: ELEMENT_TIMEOUT});
});

/**
 * @objective Verify callout persists after publish
 */
test('callout persists after publish', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Callout Persist Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Callout Persist Test');

    // # Insert callout via slash command
    await insertViaSlashCommand(page, 'Callout');
    await page.waitForTimeout(SHORT_WAIT);
    await page.keyboard.type('Important information');

    // # Publish
    await publishPage(page);

    // * Verify callout persists
    const pageContent = getPageViewerContent(page);
    const calloutElement = pageContent.locator('[data-type="callout"], .callout-block, [class*="callout"]');
    await expect(calloutElement.first()).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(calloutElement.first()).toContainText('Important information');
});

/**
 * @objective Verify code block persists after publish
 */
test('code block persists after publish', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Code Persist Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Code Persist Test');

    // # Insert code block via slash command
    await insertViaSlashCommand(page, 'Code block');
    await page.waitForTimeout(SHORT_WAIT);
    await page.keyboard.type('const hello = "world";');

    // # Publish
    await publishPage(page);

    // * Verify code block persists
    const pageContent = getPageViewerContent(page);
    const codeElement = pageContent.locator('pre');
    await expect(codeElement).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await expect(codeElement).toContainText('const hello');
});

/**
 * @objective Verify divider persists after publish
 */
test('divider persists after publish', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Divider Persist Wiki ${await pw.random.id()}`);
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Divider Persist Test');

    // # Type content, then insert divider
    const editor = await getEditorAndWait(page);
    await editor.click();
    await page.keyboard.type('Content above');
    await page.keyboard.press('Enter');

    // # Insert divider via slash command
    await insertViaSlashCommand(page, 'Divider');
    await page.waitForTimeout(SHORT_WAIT);

    // # Publish
    await publishPage(page);

    // * Verify divider persists
    const pageContent = getPageViewerContent(page);
    const hrElement = pageContent.locator('hr');
    await expect(hrElement).toBeVisible({timeout: ELEMENT_TIMEOUT});
});
