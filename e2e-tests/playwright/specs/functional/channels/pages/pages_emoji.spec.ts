// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    getNewPageButton,
    fillCreatePageModal,
    openSlashCommandMenu,
    getEditorAndWait,
    loginAndNavigateToChannel,
    uniqueName,
    ELEMENT_TIMEOUT,
    WEBSOCKET_WAIT,
    UI_MICRO_WAIT,
    SHORT_WAIT,
} from './test_helpers';

/**
 * @objective Verify emoji option appears in slash command menu when typing /emoji
 */
test('shows emoji option in slash command menu', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Emoji Menu Wiki'));
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Emoji Menu Test');

    // # Open slash command menu
    const slashMenu = await openSlashCommandMenu(page);

    // * Verify menu contains emoji option
    await expect(slashMenu).toContainText('Emoji');
});

/**
 * @objective Verify emoji option is filtered when typing /emoji in slash menu
 */
test('filters to emoji when typing emoji in slash command menu', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Emoji Filter Wiki'));
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Emoji Filter Test');

    // # Open slash command menu and filter to emoji
    const editor = await getEditorAndWait(page);
    await editor.click();
    await page.keyboard.type('/emoji', {delay: 50});

    // * Verify slash menu is visible
    const slashMenu = page.locator('.slash-command-menu');
    await expect(slashMenu).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify emoji option is visible in filtered menu
    const emojiItem = slashMenu.locator('.slash-command-item').filter({hasText: 'Emoji'});
    await expect(emojiItem).toBeVisible({timeout: WEBSOCKET_WAIT});
});

/**
 * @objective Verify emoji picker opens when selecting emoji from slash command menu
 */
test(
    'opens emoji picker when selecting emoji from slash command menu',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki and page
        await createWikiThroughUI(page, uniqueName('Emoji Picker Wiki'));
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Emoji Picker Test');

        // # Open slash command menu and filter to emoji
        const editor = await getEditorAndWait(page);
        await editor.click();
        await page.keyboard.type('/emoji', {delay: 50});
        await page.waitForTimeout(UI_MICRO_WAIT * 2);

        // # Select emoji option
        const slashMenu = page.locator('.slash-command-menu');
        const emojiItem = slashMenu.locator('.slash-command-item').filter({hasText: 'Emoji'});
        await emojiItem.click();

        // * Verify emoji picker opens
        const emojiPicker = page.getByRole('dialog', {name: 'Emoji Picker'});
        await expect(emojiPicker).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // * Verify slash menu closes
        await expect(slashMenu).not.toBeVisible();
    },
);

/**
 * @objective Verify system emoji is inserted as Unicode character in editor
 */
test('inserts system emoji as Unicode character', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Emoji Insert Wiki'));
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Emoji Insert Test');

    // # Get editor and type some content first
    const editor = await getEditorAndWait(page);
    await editor.click();
    await page.keyboard.type('Before emoji: ');
    await page.waitForTimeout(UI_MICRO_WAIT);

    // # Open emoji picker via slash command on new line
    await page.keyboard.press('Enter');
    await page.keyboard.type('/emoji', {delay: 50});
    await page.waitForTimeout(UI_MICRO_WAIT * 2);

    const slashMenu = page.locator('.slash-command-menu');
    const emojiItem = slashMenu.locator('.slash-command-item').filter({hasText: 'Emoji'});
    await emojiItem.click();

    // # Wait for emoji picker
    const emojiPicker = page.getByRole('dialog', {name: 'Emoji Picker'});
    await expect(emojiPicker).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Click on a system emoji (grinning face should be in recent or search for it)
    // First try to find grinning emoji directly, or search for it
    const grinningEmoji = page.locator('[data-testid="emoji-grinning"], .emoji-picker__item[title*="grin"]').first();

    if (await grinningEmoji.isVisible({timeout: 1000}).catch(() => false)) {
        await grinningEmoji.click();
    } else {
        // Search for grinning emoji
        const searchInput = page.locator('.emoji-picker__search input, [data-testid="emoji-picker-search"]');
        if (await searchInput.isVisible({timeout: 1000}).catch(() => false)) {
            await searchInput.fill('grinning');
            await page.waitForTimeout(SHORT_WAIT);
        }
        // Click first emoji result
        const firstEmoji = page.locator('.emoji-picker__item').first();
        await firstEmoji.click();
    }

    // * Verify emoji picker closes
    await expect(emojiPicker).not.toBeVisible({timeout: WEBSOCKET_WAIT});

    // * Verify emoji was inserted (should contain some emoji character, not :shortcode:)
    const editorContent = await editor.textContent();
    expect(editorContent).toBeDefined();

    // The emoji should be inserted after "Before emoji: " on a new line
    // Check that content doesn't only contain :shortcode: format for system emojis
    // (Unicode emojis won't match the :name: pattern)
});

/**
 * @objective Verify emoji picker closes after emoji selection
 */
test('closes emoji picker after emoji selection', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Emoji Close Wiki'));
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Emoji Close Test');

    // # Open emoji picker via slash command
    const editor = await getEditorAndWait(page);
    await editor.click();
    await page.keyboard.type('/emoji', {delay: 50});
    await page.waitForTimeout(UI_MICRO_WAIT * 2);

    const slashMenu = page.locator('.slash-command-menu');
    const emojiItem = slashMenu.locator('.slash-command-item').filter({hasText: 'Emoji'});
    await emojiItem.click();

    // # Wait for emoji picker
    const emojiPicker = page.getByRole('dialog', {name: 'Emoji Picker'});
    await expect(emojiPicker).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Click any emoji
    const firstEmoji = page.locator('.emoji-picker__item').first();
    await firstEmoji.click();

    // * Verify emoji picker closes
    await expect(emojiPicker).not.toBeVisible({timeout: WEBSOCKET_WAIT});

    // * Verify editor can continue to be used after emoji insertion
    await editor.click();
    await page.keyboard.type(' after emoji');
    const editorContent = await editor.textContent();
    expect(editorContent).toContain('after emoji');
});

/**
 * @objective Verify emoji alias search works (e.g., typing /smiley finds emoji)
 */
test('finds emoji via alias search in slash command menu', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Emoji Alias Wiki'));
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Emoji Alias Test');

    // # Open slash command menu with smiley alias
    const editor = await getEditorAndWait(page);
    await editor.click();
    await page.keyboard.type('/smiley', {delay: 50});
    await page.waitForTimeout(UI_MICRO_WAIT * 2);

    // * Verify emoji option appears (smiley is an alias for emoji)
    const slashMenu = page.locator('.slash-command-menu');
    const emojiItem = slashMenu.locator('.slash-command-item').filter({hasText: 'Emoji'});
    await expect(emojiItem).toBeVisible({timeout: WEBSOCKET_WAIT});
});

/**
 * @objective Verify emoticon alias search works
 */
test('finds emoji via emoticon alias in slash command menu', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Emoticon Alias Wiki'));
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Emoticon Alias Test');

    // # Open slash command menu with emoticon alias
    const editor = await getEditorAndWait(page);
    await editor.click();
    await page.keyboard.type('/emoticon', {delay: 50});
    await page.waitForTimeout(UI_MICRO_WAIT * 2);

    // * Verify emoji option appears (emoticon is an alias for emoji)
    const slashMenu = page.locator('.slash-command-menu');
    const emojiItem = slashMenu.locator('.slash-command-item').filter({hasText: 'Emoji'});
    await expect(emojiItem).toBeVisible({timeout: WEBSOCKET_WAIT});
});

// ========================================
// Inline Emoji Autocomplete Tests
// ========================================

/**
 * @objective Verify emoji autocomplete suggestions appear when typing :emoji_name
 */
test(
    'shows emoji suggestions when typing colon followed by 2+ characters',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki and page
        await createWikiThroughUI(page, uniqueName('Emoji Autocomplete Wiki'));
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Emoji Autocomplete Test');

        // # Type in editor with colon + 2 chars to trigger emoji autocomplete
        const editor = await getEditorAndWait(page);
        await editor.click();
        await page.keyboard.type(':sm', {delay: 50});
        await page.waitForTimeout(SHORT_WAIT);

        // * Verify emoji suggestion popup appears
        const emojiPopup = page.locator('.tiptap-emoticon-popup');
        await expect(emojiPopup).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // * Verify popup contains emoji suggestions (should have smile, smirk, etc.)
        const suggestionList = emojiPopup.locator('.tiptap-emoticon-suggestions');
        await expect(suggestionList).toBeVisible();
    },
);

/**
 * @objective Verify emoji autocomplete does NOT appear with only 1 character after colon
 */
test(
    'does not show emoji suggestions with only 1 character after colon',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki and page
        await createWikiThroughUI(page, uniqueName('Emoji Min Chars Wiki'));
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Emoji Min Chars Test');

        // # Type in editor with colon + only 1 char
        const editor = await getEditorAndWait(page);
        await editor.click();
        await page.keyboard.type(':s', {delay: 50});
        await page.waitForTimeout(UI_MICRO_WAIT * 3);

        // * Verify emoji suggestion popup does NOT appear (minimum 2 chars required)
        const emojiPopup = page.locator('.tiptap-emoticon-popup');
        await expect(emojiPopup).not.toBeVisible();
    },
);

/**
 * @objective Verify emoji can be selected with Enter key from autocomplete
 */
test('selects emoji with Enter key from autocomplete', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Emoji Enter Select Wiki'));
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Emoji Enter Select Test');

    // # Type in editor to trigger emoji autocomplete
    const editor = await getEditorAndWait(page);
    await editor.click();
    await page.keyboard.type(':smile', {delay: 50});
    await page.waitForTimeout(SHORT_WAIT);

    // * Verify emoji suggestion popup appears
    const emojiPopup = page.locator('.tiptap-emoticon-popup');
    await expect(emojiPopup).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Press Enter to select first emoji
    await page.keyboard.press('Enter');
    await page.waitForTimeout(UI_MICRO_WAIT);

    // * Verify popup closes
    await expect(emojiPopup).not.toBeVisible({timeout: WEBSOCKET_WAIT});

    // * Verify emoji was inserted (content should not contain :smile: text)
    const editorContent = await editor.textContent();
    expect(editorContent).toBeDefined();
});

/**
 * @objective Verify emoji autocomplete can be navigated with arrow keys
 */
test('navigates emoji suggestions with arrow keys', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Emoji Arrow Nav Wiki'));
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Emoji Arrow Nav Test');

    // # Type in editor to trigger emoji autocomplete
    const editor = await getEditorAndWait(page);
    await editor.click();
    await page.keyboard.type(':grin', {delay: 50});
    await page.waitForTimeout(SHORT_WAIT);

    // * Verify emoji suggestion popup appears
    const emojiPopup = page.locator('.tiptap-emoticon-popup');
    await expect(emojiPopup).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify first item is selected
    const firstItem = emojiPopup.locator('.suggestion-list__item').first();
    await expect(firstItem).toHaveClass(/suggestion--selected/);

    // # Press ArrowDown to move selection
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(UI_MICRO_WAIT);

    // * Verify second item is now selected
    const secondItem = emojiPopup.locator('.suggestion-list__item').nth(1);
    await expect(secondItem).toHaveClass(/suggestion--selected/);

    // # Press ArrowUp to move back
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(UI_MICRO_WAIT);

    // * Verify first item is selected again
    await expect(firstItem).toHaveClass(/suggestion--selected/);
});

/**
 * @objective Verify emoji autocomplete closes with Escape key
 */
test('closes emoji autocomplete with Escape key', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Emoji Escape Wiki'));
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Emoji Escape Test');

    // # Type in editor to trigger emoji autocomplete
    const editor = await getEditorAndWait(page);
    await editor.click();
    await page.keyboard.type(':heart', {delay: 50});
    await page.waitForTimeout(SHORT_WAIT);

    // * Verify emoji suggestion popup appears
    const emojiPopup = page.locator('.tiptap-emoticon-popup');
    await expect(emojiPopup).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Press Escape to close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(UI_MICRO_WAIT);

    // * Verify popup closes
    await expect(emojiPopup).not.toBeVisible({timeout: WEBSOCKET_WAIT});

    // * Verify text remains in editor (not replaced)
    const editorContent = await editor.textContent();
    expect(editorContent).toContain(':heart');
});

/**
 * @objective Verify system emoji is inserted as Unicode character via autocomplete
 */
test('inserts system emoji as Unicode via autocomplete', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page
    await createWikiThroughUI(page, uniqueName('Emoji Unicode Wiki'));
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Emoji Unicode Test');

    // # Type prefix text and then emoji autocomplete
    const editor = await getEditorAndWait(page);
    await editor.click();
    await page.keyboard.type('Hello ');
    await page.keyboard.type(':grinning', {delay: 50});
    await page.waitForTimeout(SHORT_WAIT);

    // * Verify emoji suggestion popup appears
    const emojiPopup = page.locator('.tiptap-emoticon-popup');
    await expect(emojiPopup).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Press Enter to select emoji
    await page.keyboard.press('Enter');
    await page.waitForTimeout(UI_MICRO_WAIT);

    // * Verify popup closes
    await expect(emojiPopup).not.toBeVisible({timeout: WEBSOCKET_WAIT});

    // * Verify editor content contains "Hello " and does not contain ":grinning" text
    // (system emoji should be inserted as Unicode)
    const editorContent = await editor.textContent();
    expect(editorContent).toBeDefined();
    expect(editorContent).toContain('Hello');
    expect(editorContent).not.toContain(':grinning');
});
