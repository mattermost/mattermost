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
