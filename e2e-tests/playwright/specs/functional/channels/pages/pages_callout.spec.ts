// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    setupWikiPageInEditMode,
    insertBlockViaSlashCommand,
    typeInsideBlock,
    verifyBlockAttributes,
    publishPage,
    getPageViewerContent,
    openSlashCommandMenu,
    waitForFormattingBar,
    clickFormattingButton,
    typeInEditor,
    selectTextInEditor,
    SHORT_WAIT,
} from './test_helpers';

/**
 * @objective Verify callout block can be inserted via slash command
 */
test('inserts callout block via slash command', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {page, editor} = await setupWikiPageInEditMode(pw, sharedPagesSetup, 'Callout Wiki', 'Callout Test Page');

    // # Insert callout via slash command
    const callout = await insertBlockViaSlashCommand(page, editor, 'Callout', '.callout', 'callout');

    // * Verify it has the info type by default
    await expect(callout).toHaveClass(/callout-info/);
});

/**
 * @objective Verify callout block defaults to info type with correct styling
 */
test('callout block defaults to info type with correct styling', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {page, editor} = await setupWikiPageInEditMode(
        pw,
        sharedPagesSetup,
        'Callout Styling Wiki',
        'Callout Styling Test',
    );

    // # Insert callout via slash command
    const callout = await insertBlockViaSlashCommand(page, editor, 'Callout', '.callout');

    // * Verify data attributes and CSS class
    await verifyBlockAttributes(callout, {
        dataType: 'callout',
        classPattern: /callout callout-info/,
    });
    await expect(callout).toHaveAttribute('data-callout-type', 'info');
});

/**
 * @objective Verify content can be typed inside callout block
 */
test('allows typing content inside callout block', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {page, editor} = await setupWikiPageInEditMode(
        pw,
        sharedPagesSetup,
        'Callout Content Wiki',
        'Callout Content Test',
    );

    // # Insert callout via slash command
    const callout = await insertBlockViaSlashCommand(page, editor, 'Callout', '.callout');

    // # Click inside the callout and type content
    await typeInsideBlock(page, callout, 'This is important information inside the callout.');

    // * Verify content is inside the callout
    await expect(callout).toContainText('This is important information inside the callout.');

    // # Press Enter to create a new paragraph inside callout
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second paragraph in callout.');

    // * Verify both paragraphs are inside the callout
    await expect(callout).toContainText('This is important information inside the callout.');
    await expect(callout).toContainText('Second paragraph in callout.');
});

/**
 * @objective Verify callout has correct accessibility attributes
 */
test('callout has correct accessibility attributes', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {page, editor} = await setupWikiPageInEditMode(
        pw,
        sharedPagesSetup,
        'Callout A11y Wiki',
        'Callout Accessibility Test',
    );

    // # Insert callout via slash command
    const callout = await insertBlockViaSlashCommand(page, editor, 'Callout', '.callout');

    // * Verify accessibility attributes (role="note" and aria-label for info type)
    await verifyBlockAttributes(callout, {
        role: 'note',
        ariaLabel: 'Information callout',
    });
});

/**
 * @objective Verify callout content persists after publish and reload
 */
test('callout content persists after publish and reload', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {page, editor} = await setupWikiPageInEditMode(
        pw,
        sharedPagesSetup,
        'Callout Persist Wiki',
        'Callout Persistence Test',
    );

    // # Insert callout via slash command
    const callout = await insertBlockViaSlashCommand(page, editor, 'Callout', '.callout');

    // # Click inside callout and type content
    await typeInsideBlock(page, callout, 'This callout should persist after publish.');

    // # Publish the page
    await publishPage(page);

    // * Verify callout is visible in published view
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toBeVisible();

    const publishedCallout = pageContent.locator('.callout');
    await expect(publishedCallout).toBeVisible();
    await expect(publishedCallout).toContainText('This callout should persist after publish.');
    await expect(publishedCallout).toHaveClass(/callout-info/);

    // # Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // * Verify callout still appears after reload
    const reloadedContent = getPageViewerContent(page);
    await expect(reloadedContent).toBeVisible();

    const reloadedCallout = reloadedContent.locator('.callout');
    await expect(reloadedCallout).toBeVisible();
    await expect(reloadedCallout).toContainText('This callout should persist after publish.');
    await expect(reloadedCallout).toHaveClass(/callout-info/);
});

/**
 * @objective Verify callout appears in slash command menu with correct description
 */
test('callout appears in slash command menu with description', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {page} = await setupWikiPageInEditMode(pw, sharedPagesSetup, 'Callout Menu Wiki', 'Callout Menu Test');

    // # Open slash command menu
    const slashMenu = await openSlashCommandMenu(page);

    // * Verify callout item is in the menu
    await expect(slashMenu).toContainText('Callout');
});

/**
 * @objective Verify formatting bar appears when selecting text inside callout
 */
test('shows formatting bar when selecting text inside callout', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {page, editor} = await setupWikiPageInEditMode(
        pw,
        sharedPagesSetup,
        'Callout Format Wiki',
        'Callout Formatting Test',
    );

    // # Insert callout via slash command
    const callout = await insertBlockViaSlashCommand(page, editor, 'Callout', '.callout');

    // # Type some text inside the callout
    await typeInsideBlock(page, callout, 'Select this text');

    // # Select all text inside the callout using keyboard
    await page.keyboard.press('Home');
    for (let i = 0; i < 16; i++) {
        await page.keyboard.press('Shift+ArrowRight');
    }

    // * Verify formatting bar appears
    const formattingBar = page.locator('.formatting-bar-bubble');
    await expect(formattingBar).toBeVisible({timeout: 5000});
});

/**
 * @objective Verify callout can be deleted by pressing Backspace at the start
 */
test(
    'deletes callout when pressing Backspace at start of empty callout',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {page, editor} = await setupWikiPageInEditMode(
            pw,
            sharedPagesSetup,
            'Callout Delete Wiki',
            'Callout Delete Test',
        );

        // # Insert callout via slash command
        const callout = await insertBlockViaSlashCommand(page, editor, 'Callout', '.callout');

        // * Verify callout exists
        await expect(callout).toBeVisible();

        // # Click inside the callout to position cursor
        await callout.click();
        await page.waitForTimeout(100);

        // # Press Backspace to delete the empty callout
        await page.keyboard.press('Backspace');

        // * Verify callout is removed
        await expect(editor.locator('.callout')).toHaveCount(0);
    },
);

/**
 * @objective Verify callout with content can be removed while preserving content
 */
test(
    'removes callout wrapper when pressing Backspace at start with content',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {page, editor} = await setupWikiPageInEditMode(
            pw,
            sharedPagesSetup,
            'Callout Unwrap Wiki',
            'Callout Unwrap Test',
        );

        // # Insert callout via slash command
        const callout = await insertBlockViaSlashCommand(page, editor, 'Callout', '.callout');

        // # Type content inside callout
        await typeInsideBlock(page, callout, 'Content to preserve');

        // # Click inside the callout and move cursor to the very beginning
        await callout.click();
        await page.waitForTimeout(100);
        await page.keyboard.press('Home');

        // # Press Backspace to unwrap/lift the content out of callout
        await page.keyboard.press('Backspace');

        // * Verify callout wrapper is removed
        await expect(editor.locator('.callout')).toHaveCount(0);

        // * Verify content is preserved in the editor
        await expect(editor).toContainText('Content to preserve');
    },
);

/**
 * @objective Verify callout can be toggled off using toolbar button
 * This tests the fix for: clicking callout button when inside a callout should remove the callout
 */
test(
    'toggles callout off when clicking callout button inside existing callout',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {page, editor} = await setupWikiPageInEditMode(
            pw,
            sharedPagesSetup,
            'Callout Toggle Wiki',
            'Callout Toggle Test',
        );

        // # Insert callout via slash command
        const callout = await insertBlockViaSlashCommand(page, editor, 'Callout', '.callout');

        // # Type content inside callout
        const testContent = 'Text inside callout to toggle off';
        await typeInsideBlock(page, callout, testContent);

        // # Select all text inside the callout using keyboard
        await page.keyboard.press('Home');
        for (let i = 0; i < testContent.length; i++) {
            await page.keyboard.press('Shift+ArrowRight');
        }

        // # Wait for formatting bar to appear
        const formattingBar = await waitForFormattingBar(page);

        // * Verify the callout button shows as active (we're inside a callout)
        const calloutButton = formattingBar.locator('button[title="Callout"]');
        await expect(calloutButton).toHaveClass(/is-active/);

        // # Click the callout button to toggle it off
        await clickFormattingButton(page, formattingBar, 'Callout');

        // * Verify callout is removed
        await expect(editor.locator('.callout')).toHaveCount(0);

        // * Verify content is preserved in the editor
        await expect(editor).toContainText(testContent);
    },
);

/**
 * @objective Verify clicking callout button does NOT create nested callouts
 * This tests the fix for: prevent nesting callouts when clicking callout button inside callout
 */
test(
    'does not create nested callouts when clicking callout button inside callout',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {page, editor} = await setupWikiPageInEditMode(
            pw,
            sharedPagesSetup,
            'Callout Nesting Wiki',
            'Callout Nesting Test',
        );

        // # Insert callout via slash command
        const callout = await insertBlockViaSlashCommand(page, editor, 'Callout', '.callout');

        // # Type content inside callout
        const testContent = 'Content that should not be double-wrapped';
        await typeInsideBlock(page, callout, testContent);

        // # Select all text inside the callout
        await page.keyboard.press('Home');
        for (let i = 0; i < testContent.length; i++) {
            await page.keyboard.press('Shift+ArrowRight');
        }

        // # Wait for formatting bar to appear
        const formattingBar = await waitForFormattingBar(page);

        // # Click the callout button (this used to create nested callouts)
        await clickFormattingButton(page, formattingBar, 'Callout');

        // * Verify there are NO nested callouts (should have 0 callouts after toggle off)
        const callouts = editor.locator('.callout');
        const calloutCount = await callouts.count();

        // After toggling off, there should be 0 callouts (not 2 nested callouts)
        expect(calloutCount).toBe(0);

        // * Verify no nested callout structure exists
        const nestedCallouts = editor.locator('.callout .callout');
        await expect(nestedCallouts).toHaveCount(0);

        // * Verify content is preserved
        await expect(editor).toContainText(testContent);
    },
);

/**
 * @objective Verify callout toggle behavior matches blockquote toggle behavior
 * Consistency check: callout should work like blockquote when toggling
 */
test(
    'callout toggle behavior is consistent with blockquote toggle',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {page, editor} = await setupWikiPageInEditMode(
            pw,
            sharedPagesSetup,
            'Callout Consistency Wiki',
            'Callout Consistency Test',
        );

        // # Type some text using helper
        const testContent = 'Text to wrap and unwrap';
        await typeInEditor(page, testContent);

        // # Select all the text using robust triple-click selection
        await selectTextInEditor(page, testContent);

        // # Wait for formatting bar
        let formattingBar = await waitForFormattingBar(page);

        // # Click callout button to wrap text in callout
        await clickFormattingButton(page, formattingBar, 'Callout');

        // * Verify callout was created
        await expect(editor.locator('.callout')).toHaveCount(1);
        await expect(editor.locator('.callout')).toContainText(testContent);

        // # Select the text inside the callout using keyboard (matching passing test pattern)
        const callout = editor.locator('.callout');
        await callout.click();
        await page.waitForTimeout(SHORT_WAIT / 2);

        // # Use keyboard to select text inside callout
        await page.keyboard.press('Home');
        await page.waitForTimeout(100);
        for (let i = 0; i < testContent.length; i++) {
            await page.keyboard.press('Shift+ArrowRight');
        }
        await page.waitForTimeout(SHORT_WAIT);

        // # Wait for formatting bar again
        formattingBar = await waitForFormattingBar(page);

        // # Click callout button again to toggle off
        await clickFormattingButton(page, formattingBar, 'Callout');

        // * Verify callout was removed (toggle off worked)
        await expect(editor.locator('.callout')).toHaveCount(0);

        // * Verify content is still there
        await expect(editor).toContainText(testContent);
    },
);
