// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';

import {
    createWikiThroughUI,
    getNewPageButton,
    fillCreatePageModal,
    createTestChannel,
    enterEditMode,
    selectTextInEditor,
    openInlineCommentModal,
    fillAndSubmitCommentModal,
    publishPage,
    closeWikiRHS,
    SHORT_WAIT,
    ELEMENT_TIMEOUT,
    EDITOR_LOAD_WAIT,
} from './test_helpers';

/**
 * DEBUG TEST: Verify adding two inline comments step-by-step
 */
test('DEBUG: add two inline comments with detailed logging', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, `Test Channel ${await pw.random.id()}`);

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // Create wiki
    const wiki = await createWikiThroughUI(page, `Debug Wiki ${await pw.random.id()}`);

    // Create page with two distinct paragraphs using Enter key
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Debug Page');

    const editor = page.locator('.ProseMirror').first();
    await editor.click();
    await editor.type('First paragraph for comment one.');
    await editor.press('Enter');
    await editor.type('Second paragraph for comment two.');

    await publishPage(page);

    // Enter edit mode
    console.log('=== STEP 1: Entering edit mode ===');
    await enterEditMode(page);
    await page.waitForTimeout(EDITOR_LOAD_WAIT);
    console.log('✓ Edit mode entered');

    // === FIRST COMMENT ===
    console.log('\n=== STEP 2: Adding first comment ===');

    // Select first text
    console.log('  2.1: Selecting text "First paragraph"');
    await selectTextInEditor(page, 'First paragraph');
    await page.waitForTimeout(SHORT_WAIT);

    const selection1 = await page.evaluate(() => window.getSelection()?.toString());
    console.log(`  ✓ Selection 1: "${selection1}"`);

    // Open modal for first comment
    console.log('  2.2: Opening comment modal');
    const commentModal1 = await openInlineCommentModal(page);
    const modal1Visible = await commentModal1.isVisible();
    console.log(`  ✓ Modal 1 visible: ${modal1Visible}`);

    // Fill and submit first comment
    console.log('  2.3: Filling and submitting comment');
    await fillAndSubmitCommentModal(page, commentModal1, 'First comment');

    // Check if modal closed
    await page.waitForTimeout(SHORT_WAIT * 2);
    const modal1AfterSubmit = await commentModal1.isVisible().catch(() => false);
    console.log(`  ✓ Modal 1 after submit (should be false): ${modal1AfterSubmit}`);

    // Check for inline comment marker in editor
    const markers1 = page.locator('[data-inline-comment-marker], .inline-comment-marker, [data-comment-id]');
    const count1 = await markers1.count();
    console.log(`  ✓ Markers after first comment: ${count1}`);

    // Close RHS if it opened after first comment
    console.log('  2.4: Closing RHS');
    await closeWikiRHS(page).catch(() => {}); // Ignore error if already closed
    await page.waitForTimeout(EDITOR_LOAD_WAIT);

    // === SECOND COMMENT ===
    console.log('\n=== STEP 3: Adding second comment ===');

    // Select second text
    console.log('  3.1: Selecting text "Second paragraph"');
    await selectTextInEditor(page, 'Second paragraph');
    await page.waitForTimeout(SHORT_WAIT);

    const selection2 = await page.evaluate(() => window.getSelection()?.toString());
    console.log(`  ✓ Selection 2: "${selection2}"`);

    // Try to open modal for second comment
    console.log('  3.2: Attempting to open comment modal');
    try {
        const commentModal2 = await openInlineCommentModal(page);
        const modal2Visible = await commentModal2.isVisible();
        console.log(`  ✓ Modal 2 visible: ${modal2Visible}`);

        // Fill and submit second comment
        console.log('  3.3: Filling and submitting second comment');
        await fillAndSubmitCommentModal(page, commentModal2, 'Second comment');

        // Check if modal closed
        await page.waitForTimeout(SHORT_WAIT * 2);
        const modal2AfterSubmit = await commentModal2.isVisible().catch(() => false);
        console.log(`  ✓ Modal 2 after submit (should be false): ${modal2AfterSubmit}`);

    } catch (error: any) {
        console.log(`  ✗ ERROR opening/filling second comment: ${error.message}`);
    }

    // Final marker count
    const markersFinal = page.locator('[data-inline-comment-marker], .inline-comment-marker, [data-comment-id]');
    const countFinal = await markersFinal.count();
    console.log(`\n=== FINAL: Markers in editor: ${countFinal} (expected: 2) ===`);

    // Close RHS before publishing
    console.log('  3.4: Closing RHS before publish');
    await closeWikiRHS(page).catch(() => {}); // Ignore error if already closed
    await page.waitForTimeout(SHORT_WAIT);

    // Publish to see if both comments persist
    console.log('\n=== STEP 4: Publishing page ===');
    await publishPage(page);
    await page.waitForTimeout(SHORT_WAIT);

    // Count markers after publish
    const markersPublished = page.locator('[data-inline-comment-marker], .inline-comment-marker, [data-comment-id]');
    const countPublished = await markersPublished.count();
    console.log(`✓ Markers after publish: ${countPublished}`);

    // Assertion
    expect(countPublished).toBeGreaterThanOrEqual(2);
});
