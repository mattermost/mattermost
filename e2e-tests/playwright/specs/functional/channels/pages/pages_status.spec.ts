// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    AUTOSAVE_WAIT,
    buildWikiPageUrl,
    createPageThroughUI,
    createTestChannel,
    createWikiThroughUI,
    DEFAULT_PAGE_STATUS,
    fillCreatePageModal,
    getEditor,
    getNewPageButton,
    HIERARCHY_TIMEOUT,
    loginAndNavigateToChannel,
    PAGE_LOAD_TIMEOUT,
    PAGE_STATUSES,
    publishCurrentPage,
    uniqueName,
} from './test_helpers';

/**
 * @objective Verify default page status is set to 'in_progress' when creating a new page without selecting status
 */
test(
    'displays default in_progress status for newly published pages',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki through UI
        await createWikiThroughUI(page, uniqueName('Status Wiki'));

        // # Create and publish a page
        const pageName = 'Test Page';
        await createPageThroughUI(page, pageName, 'Test content');

        // # Wait for page to load
        await page.waitForLoadState('networkidle');

        // * Verify status is visible in page viewer
        const statusDisplay = page.locator('[data-testid="page-viewer-status"]');
        await expect(statusDisplay).toBeVisible();

        // * Verify default status
        const statusText = await statusDisplay.textContent();
        expect(statusText?.trim()).toBe(DEFAULT_PAGE_STATUS);
    },
);

/**
 * @objective Verify user can change page status in draft mode and it persists after publishing
 */
test('changes page status from in_progress to in_review', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page through UI
    await createWikiThroughUI(page, uniqueName('Status Change Wiki'));
    const pageName = 'Test Page';
    await createPageThroughUI(page, pageName, 'Test content');

    await page.waitForLoadState('networkidle');

    // # Click Edit button to enter draft mode
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    await editButton.click();
    await page.waitForLoadState('networkidle');

    // # Change status to 'in_review' in draft mode
    const statusSelector = page.locator('.page-status-wrapper .selectable-select-property__control');
    await expect(statusSelector).toBeVisible();
    await statusSelector.click();

    const statusMenu = page.locator('.selectable-select-property__menu');
    await expect(statusMenu).toBeVisible();

    const inReviewOption = page.locator('.selectable-select-property__option', {hasText: 'In review'});
    await inReviewOption.click();

    // # Wait for autosave
    await page.waitForTimeout(AUTOSAVE_WAIT);

    // # Click Update button
    await publishCurrentPage(page);

    // * Verify status changed to 'In review' in view mode
    const statusDisplay = page.locator('[data-testid="page-viewer-status"]');
    await expect(statusDisplay).toBeVisible();
    const statusText = await statusDisplay.textContent();

    expect(statusText?.trim()).toBe('In review');
});

/**
 * @objective Verify page status persists after browser refresh
 */
test('persists page status after browser refresh', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page through UI
    await createWikiThroughUI(page, uniqueName('Persist Wiki'));
    const pageName = 'Test Page';
    await createPageThroughUI(page, pageName, 'Test content');

    await page.waitForLoadState('networkidle');

    // # Edit page to change status
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    await editButton.click();
    await page.waitForLoadState('networkidle');

    // # Change status to 'done'
    const statusSelector = page.locator('.page-status-wrapper .selectable-select-property__control');
    await statusSelector.click();

    const statusMenu = page.locator('.selectable-select-property__menu');
    await expect(statusMenu).toBeVisible();

    const doneOption = page.locator('.selectable-select-property__option', {hasText: 'Done'});
    await doneOption.click();

    // # Wait for autosave
    await page.waitForTimeout(AUTOSAVE_WAIT);

    // # Update page
    await publishCurrentPage(page);

    // * Verify status is 'Done'
    let statusDisplay = page.locator('[data-testid="page-viewer-status"]');
    await expect(statusDisplay).toBeVisible();
    let statusText = await statusDisplay.textContent();
    expect(statusText?.trim()).toBe('Done');

    // # Refresh browser
    await page.reload();
    await page.waitForLoadState('networkidle');

    // * Verify status is still 'Done' after refresh
    statusDisplay = page.locator('[data-testid="page-viewer-status"]');
    await expect(statusDisplay).toBeVisible();
    statusText = await statusDisplay.textContent();
    expect(statusText?.trim()).toBe('Done');
});

/**
 * @objective Verify all valid status values can be selected
 */
test('allows selection of all valid status values', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page through UI
    await createWikiThroughUI(page, uniqueName('All Status Wiki'));
    const pageName = 'Test Page';
    await createPageThroughUI(page, pageName, 'Test content');

    await page.waitForLoadState('networkidle');

    for (const status of PAGE_STATUSES) {
        // # Edit page
        const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
        await editButton.click();
        await page.waitForLoadState('networkidle');

        // # Click status selector to open dropdown
        const statusSelector = page.locator('.page-status-wrapper .selectable-select-property__control');
        await statusSelector.click();

        // # Wait for dropdown menu to appear
        const statusMenu = page.locator('.selectable-select-property__menu');
        await expect(statusMenu).toBeVisible();

        // # Select the status
        const statusOption = page.locator('.selectable-select-property__option', {hasText: status});
        await expect(statusOption).toBeVisible();
        await statusOption.click();

        // # Wait for autosave
        await page.waitForTimeout(AUTOSAVE_WAIT);

        // # Update page
        await publishCurrentPage(page);
        await page.waitForLoadState('networkidle');

        // * Verify status changed to expected value
        const statusDisplay = page.locator('[data-testid="page-viewer-status"]');
        await expect(statusDisplay).toBeVisible();
        const statusText = await statusDisplay.textContent();
        expect(statusText?.trim()).toBe(status);
    }
});

/**
 * @objective Verify status selector is visible in draft mode but not in view mode
 */
test(
    'shows status selector in draft mode and status badge in view mode',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki through UI
        await createWikiThroughUI(page, uniqueName('Draft Status Wiki'));

        // # Click "New Page" to create a new draft
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Test Page');
        await page.waitForLoadState('networkidle');

        // * Verify status selector IS visible in draft mode
        const statusSelector = page.locator('.page-status-wrapper .selectable-select-property__control');
        await expect(statusSelector).toBeVisible();

        // # Fill in page content and publish

        const editor = getEditor(page);
        await editor.click();
        await editor.fill('Test content');

        await page.waitForTimeout(AUTOSAVE_WAIT);

        await publishCurrentPage(page);

        // * Verify status is visible in view mode as a read-only display
        const statusDisplay = page.locator('[data-testid="page-viewer-status"]');
        await expect(statusDisplay).toBeVisible();

        // * Verify the editable selector is no longer visible
        const statusSelectorAfter = page.locator('.page-status-wrapper .selectable-select-property__control');
        await expect(statusSelectorAfter).not.toBeVisible();
    },
);

/**
 * @objective Verify multiple pages can have different status values independently
 */
test('maintains independent status for multiple pages', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, uniqueName('Multi Page Wiki'));

    // # Create first page
    const page1 = await createPageThroughUI(page, 'Page 1', 'Content 1');
    await page.waitForLoadState('networkidle');

    // # Edit and set status to 'rough_draft'
    let editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    await editButton.click();
    await page.waitForLoadState('networkidle');

    let statusSelector = page.locator('.page-status-wrapper .selectable-select-property__control');
    await statusSelector.click();
    let statusMenu = page.locator('.selectable-select-property__menu');
    await expect(statusMenu).toBeVisible();
    const roughDraftOption = page.locator('.selectable-select-property__option', {hasText: 'Rough draft'});
    await roughDraftOption.click();
    await page.waitForTimeout(AUTOSAVE_WAIT);

    await publishCurrentPage(page);

    // # Navigate back to wiki root
    await page.goto(buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id));
    await page.waitForLoadState('networkidle');

    // # Create second page
    await createPageThroughUI(page, 'Page 2', 'Content 2');
    await page.waitForLoadState('networkidle');

    // # Edit and set status to 'done'
    editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    await editButton.click();
    await page.waitForLoadState('networkidle');

    statusSelector = page.locator('.page-status-wrapper .selectable-select-property__control');
    await statusSelector.click();
    statusMenu = page.locator('.selectable-select-property__menu');
    await expect(statusMenu).toBeVisible();
    const doneOption = page.locator('.selectable-select-property__option', {hasText: 'Done'});
    await doneOption.click();
    await page.waitForTimeout(AUTOSAVE_WAIT);

    await publishCurrentPage(page);

    // * Verify page 2 has status 'Done'
    let statusDisplay = page.locator('[data-testid="page-viewer-status"]');
    let statusText = await statusDisplay.textContent();
    expect(statusText?.trim()).toBe('Done');

    // # Navigate back to page 1
    await page.goto(buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, page1.id));
    await page.waitForLoadState('networkidle');

    // * Verify page 1 still has status 'Rough draft'
    statusDisplay = page.locator('[data-testid="page-viewer-status"]');
    await expect(statusDisplay).toBeVisible();
    statusText = await statusDisplay.textContent();
    expect(statusText?.trim()).toBe('Rough draft');
});

/**
 * @objective Verify status change is saved and reflected after edit/update cycle
 */
test('updates status display after edit and update', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and page through UI
    await createWikiThroughUI(page, uniqueName('Update Wiki'));
    const pageName = 'Test Page';
    await createPageThroughUI(page, pageName, 'Test content');

    await page.waitForLoadState('networkidle');

    // # Get initial status
    let statusDisplay = page.locator('[data-testid="page-viewer-status"]');
    await expect(statusDisplay).toBeVisible();
    const initialStatus = await statusDisplay.textContent();
    const initialLabel = initialStatus?.trim();

    // # Edit page
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    await editButton.click();
    await page.waitForLoadState('networkidle');

    // # Change status to a different value
    const targetStatusLabel = initialLabel === DEFAULT_PAGE_STATUS ? 'Done' : DEFAULT_PAGE_STATUS;

    const statusSelector = page.locator('.page-status-wrapper .selectable-select-property__control');
    await statusSelector.click();

    const statusMenu = page.locator('.selectable-select-property__menu');
    await expect(statusMenu).toBeVisible();

    const targetOption = page.locator('.selectable-select-property__option', {hasText: targetStatusLabel});
    await targetOption.click();

    // # Wait for autosave
    await page.waitForTimeout(AUTOSAVE_WAIT);

    // # Update page
    await publishCurrentPage(page);

    // * Verify status changed
    statusDisplay = page.locator('[data-testid="page-viewer-status"]');
    const newStatus = await statusDisplay.textContent();
    expect(newStatus?.trim()).toBe(targetStatusLabel);
    expect(newStatus?.trim()).not.toBe(initialLabel);
});

/**
 * @objective Verify status selected in draft mode persists after publishing
 */
test('persists status selected in draft mode after publishing', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Draft Status Wiki'));

    // # Click "New Page" to create a new draft
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Draft with Status');
    await page.waitForLoadState('networkidle');

    // # Enter page content

    const editor = getEditor(page);
    await editor.click();
    await editor.fill('This is draft content');

    // # Wait for autosave
    await page.waitForTimeout(AUTOSAVE_WAIT);

    // # Select status 'done' in draft mode
    const statusSelector = page.locator('.page-status-wrapper .selectable-select-property__control');
    await expect(statusSelector).toBeVisible();
    await statusSelector.click();

    const statusMenu = page.locator('.selectable-select-property__menu');
    await expect(statusMenu).toBeVisible();

    const doneOption = page.locator('.selectable-select-property__option', {hasText: 'Done'});
    await doneOption.click();

    // # Wait for autosave to persist status
    await page.waitForTimeout(AUTOSAVE_WAIT);

    // # Publish the page
    await publishCurrentPage(page);

    // * Verify status is 'Done' in the published page viewer
    const publishedStatus = page.locator('[data-testid="page-viewer-status"]');
    await expect(publishedStatus).toBeVisible();
    const statusText = await publishedStatus.textContent();
    expect(statusText?.trim()).toBe('Done');
});

/**
 * @objective Verify status persists through draft autosave and browser refresh
 */
test('persists status through draft autosave and browser refresh', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Autosave Status Wiki'));

    // # Click "New Page" to create a new draft
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Autosave Status Test');
    await page.waitForLoadState('networkidle');

    // # Enter content
    const editor = getEditor(page);
    await editor.click();
    await editor.fill('Content with status');

    // # Wait for autosave
    await page.waitForTimeout(AUTOSAVE_WAIT);

    // # Select status 'in_review'
    const statusSelector = page.locator('.page-status-wrapper .selectable-select-property__control');
    await statusSelector.click();

    const statusMenu = page.locator('.selectable-select-property__menu');
    await expect(statusMenu).toBeVisible();

    const inReviewOption = page.locator('.selectable-select-property__option', {hasText: 'In review'});
    await inReviewOption.click();

    // # Wait for autosave to persist status
    await page.waitForTimeout(AUTOSAVE_WAIT);

    // # Capture current URL before refresh
    const currentUrl = page.url();

    // # Refresh browser (simulating crash/reload scenario)
    await page.reload();
    await page.waitForLoadState('networkidle');

    // * Verify we're still on the same draft
    expect(page.url()).toBe(currentUrl);

    // * Verify status selector still shows 'In review'
    const statusValue = page.locator('.page-status-wrapper .selectable-select-property__single-value');
    await expect(statusValue).toBeVisible();
    const statusText = await statusValue.textContent();
    expect(statusText).toBe('In review');

    // # Now publish to verify status transfers correctly
    await publishCurrentPage(page);

    // * Verify published page shows 'In review' status
    const publishedStatus = page.locator('[data-testid="page-viewer-status"]');
    await expect(publishedStatus).toBeVisible();
    const publishedStatusText = await publishedStatus.textContent();
    expect(publishedStatusText?.trim()).toBe('In review');
});

/**
 * @objective Verify status persists when publishing immediately after changing status (no autosave wait)
 */
test(
    'persists status when publishing immediately after status change',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki through UI
        await createWikiThroughUI(page, uniqueName('Immediate Publish Wiki'));

        // # Click "New Page" to create a new draft
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Immediate Status Test');
        await page.waitForLoadState('networkidle');

        // # Enter page content
        const editor = getEditor(page);
        await editor.click();
        await editor.fill('Testing immediate publish after status change');

        // # Wait for content autosave only
        await page.waitForTimeout(AUTOSAVE_WAIT);

        // # Select status 'Done' in draft mode
        const statusSelector = page.locator('.page-status-wrapper .selectable-select-property__control');
        await expect(statusSelector).toBeVisible();
        await statusSelector.click();

        const statusMenu = page.locator('.selectable-select-property__menu');
        await expect(statusMenu).toBeVisible();

        const doneOption = page.locator('.selectable-select-property__option', {hasText: 'Done'});
        await doneOption.click();

        // # IMMEDIATELY publish - NO autosave wait after status change
        // This tests the race condition where status might not persist
        await publishCurrentPage(page);

        // * Verify status is 'Done' in the published page viewer
        const publishedStatus = page.locator('[data-testid="page-viewer-status"]');
        await expect(publishedStatus).toBeVisible();
        const statusText = await publishedStatus.textContent();
        expect(statusText?.trim()).toBe('Done');
    },
);

/**
 * @objective Verify status selected in draft mode for existing page update persists after update
 */
test('persists status when updating existing page through draft', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    // This test involves creating wiki, page, editing, changing status, and publishing - can take longer under load
    test.slow();

    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki and initial page
    await createWikiThroughUI(page, uniqueName('Update Status Wiki'));
    await createPageThroughUI(page, 'Page to Update', 'Initial content');
    await page.waitForLoadState('networkidle');

    // # Click Edit button to enter draft mode
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    await editButton.click();
    await page.waitForLoadState('networkidle');

    // # Wait for editor to fully load (including status selector)
    await page.waitForSelector('[data-testid="wiki-page-editor"]', {state: 'visible', timeout: HIERARCHY_TIMEOUT});

    // # Change status to 'rough_draft' in draft mode
    const statusSelector = page.locator('.page-status-wrapper .selectable-select-property__control');
    await expect(statusSelector).toBeVisible({timeout: PAGE_LOAD_TIMEOUT});
    await statusSelector.click();

    const statusMenu = page.locator('.selectable-select-property__menu');
    await expect(statusMenu).toBeVisible();

    const roughDraftOption = page.locator('.selectable-select-property__option', {hasText: 'Rough draft'});
    await roughDraftOption.click();

    // # Wait for autosave
    await page.waitForTimeout(AUTOSAVE_WAIT);

    // # Update the content
    const editor = getEditor(page);
    await editor.click();
    await page.keyboard.press('End');
    await editor.type(' Updated content');

    // # Wait for autosave
    await page.waitForTimeout(AUTOSAVE_WAIT);

    // # Click Update button
    await publishCurrentPage(page);

    // * Verify updated page shows 'Rough draft' status
    const publishedStatus = page.locator('[data-testid="page-viewer-status"]');
    await expect(publishedStatus).toBeVisible();
    const statusText = await publishedStatus.textContent();
    const statusLabel = statusText?.trim();

    expect(statusLabel).toBe('Rough draft');
});
