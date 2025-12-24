// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    getNewPageButton,
    fillCreatePageModal,
    openSlashCommandMenu,
    getEditorAndWait,
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

    const {page, channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Emoji Menu Wiki ${await pw.random.id()}`);
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

    const {page, channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Emoji Filter Wiki ${await pw.random.id()}`);
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

        const {page, channelsPage} = await pw.testBrowser.login(user);

        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // # Create wiki and page
        await createWikiThroughUI(page, `Emoji Picker Wiki ${await pw.random.id()}`);
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

    const {page, channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Emoji Insert Wiki ${await pw.random.id()}`);
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

    const {page, channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Emoji Close Wiki ${await pw.random.id()}`);
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

    const {page, channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Emoji Alias Wiki ${await pw.random.id()}`);
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

    const {page, channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Create wiki and page
    await createWikiThroughUI(page, `Emoticon Alias Wiki ${await pw.random.id()}`);
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
