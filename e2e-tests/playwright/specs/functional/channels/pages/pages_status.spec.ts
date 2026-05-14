// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    buildWikiPageUrl,
    createPageThroughUI,
    createTestChannel,
    createWikiThroughUI,
    DEFAULT_PAGE_STATUS,
    enterEditMode,
    fillCreatePageModal,
    getEditor,
    getNewPageButton,
    HIERARCHY_TIMEOUT,
    loginAndNavigateToChannel,
    PAGE_LOAD_TIMEOUT,
    PAGE_STATUSES,
    publishCurrentPage,
    uniqueName,
    startWatchForAutoSave,
    waitForAutoSave,
} from './test_helpers';

/**
 * @objective Verify publishing a page without selecting a status does NOT auto-flip it to "In progress"
 * @bug EnrichPagesWithProperties defaults status="In progress" when no property value row exists (A11)
 */
test('does not auto-flip status to In progress on first publish', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Status Wiki'));

    // # Create and publish a page WITHOUT touching the status selector
    const pageName = 'Test Page';
    await createPageThroughUI(page, pageName, 'Test content');

    // * Verify status display is visible in page viewer
    const statusDisplay = page.locator('[data-testid="page-viewer-status"]');
    await expect(statusDisplay).toBeVisible();

    // * Verify status was NOT silently set to "In progress" by the server
    const statusText = await statusDisplay.textContent();
    expect(statusText?.trim()).not.toBe('In progress');

    // # Create a second page and explicitly set "Rough draft" before publishing
    await createWikiThroughUI(page, uniqueName('Rough Draft Wiki'));
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Rough Draft Page');
    await page.waitForLoadState('networkidle');

    const editor = getEditor(page);
    await editor.click();
    await editor.fill('Content with explicit rough draft status');

    await waitForAutoSave(page);

    // # Explicitly select "Rough draft" before publishing
    const statusSelector = page.locator('.page-status-wrapper .selectable-select-property__control');
    await expect(statusSelector).toBeVisible();
    await statusSelector.click();

    const statusMenu = page.locator('.selectable-select-property__menu');
    await expect(statusMenu).toBeVisible();

    const roughDraftOption = page.locator('.selectable-select-property__option', {hasText: 'Rough draft'});
    const autoSaveDone = startWatchForAutoSave(page);
    await roughDraftOption.click();
    await autoSaveDone;

    await publishCurrentPage(page);

    // * Verify status is still "Rough draft" after publish (not overwritten by server default)
    const roughDraftStatus = page.locator('[data-testid="page-viewer-status"]');
    await expect(roughDraftStatus).toBeVisible();
    const roughDraftText = await roughDraftStatus.textContent();
    expect(roughDraftText?.trim()).toBe('Rough draft');
});

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

    // # Click Edit button to enter draft mode
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    await editButton.click();
    await page
        .locator('[data-testid="wiki-page-publish-button"]')
        .waitFor({state: 'visible', timeout: PAGE_LOAD_TIMEOUT});

    // # Change status to 'in_review' in draft mode
    const statusSelector = page.locator('.page-status-wrapper .selectable-select-property__control');
    await expect(statusSelector).toBeVisible();
    await statusSelector.click();

    const statusMenu = page.locator('.selectable-select-property__menu');
    await expect(statusMenu).toBeVisible();

    const inReviewOption = page.locator('.selectable-select-property__option', {hasText: 'In review'});
    const autoSaveDone = startWatchForAutoSave(page);
    await inReviewOption.click();
    await autoSaveDone;

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
    const autoSaveDone = startWatchForAutoSave(page);
    await doneOption.click();
    await autoSaveDone;

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

    for (const status of PAGE_STATUSES) {
        // # Edit page
        const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
        await editButton.click();
        await page
            .locator('[data-testid="wiki-page-publish-button"]')
            .waitFor({state: 'visible', timeout: PAGE_LOAD_TIMEOUT});

        // # Click status selector to open dropdown
        const statusSelector = page.locator('.page-status-wrapper .selectable-select-property__control');
        await statusSelector.click();

        // # Wait for dropdown menu to appear
        const statusMenu = page.locator('.selectable-select-property__menu');
        await expect(statusMenu).toBeVisible();

        // # Select the status
        const statusOption = page.locator('.selectable-select-property__option', {hasText: status});
        await expect(statusOption).toBeVisible();
        const autoSaveDone = startWatchForAutoSave(page);
        await statusOption.click();
        await autoSaveDone;

        // # Update page
        await publishCurrentPage(page);

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

        await waitForAutoSave(page);

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

    // # Edit and set status to 'rough_draft'
    await enterEditMode(page);

    let statusSelector = page.locator('.page-status-wrapper .selectable-select-property__control');
    await statusSelector.click();
    let statusMenu = page.locator('.selectable-select-property__menu');
    await expect(statusMenu).toBeVisible();
    const roughDraftOption = page.locator('.selectable-select-property__option', {hasText: 'Rough draft'});
    let autoSaveDone = startWatchForAutoSave(page);
    await roughDraftOption.click();
    await autoSaveDone;

    await publishCurrentPage(page);

    // # Navigate back to wiki root
    await page.goto(buildWikiPageUrl(pw.url, team.name, wiki.id, undefined, channel.id));
    await page.locator('[data-testid="wiki-view"]').waitFor({state: 'visible', timeout: HIERARCHY_TIMEOUT});

    // # Create second page
    await createPageThroughUI(page, 'Page 2', 'Content 2');

    // # Edit and set status to 'done'
    await enterEditMode(page);

    statusSelector = page.locator('.page-status-wrapper .selectable-select-property__control');
    await statusSelector.click();
    statusMenu = page.locator('.selectable-select-property__menu');
    await expect(statusMenu).toBeVisible();
    const doneOption = page.locator('.selectable-select-property__option', {hasText: 'Done'});
    autoSaveDone = startWatchForAutoSave(page);
    await doneOption.click();
    await autoSaveDone;

    await publishCurrentPage(page);

    // * Verify page 2 has status 'Done'
    let statusDisplay = page.locator('[data-testid="page-viewer-status"]');
    let statusText = await statusDisplay.textContent();
    expect(statusText?.trim()).toBe('Done');

    // # Navigate back to page 1
    await page.goto(buildWikiPageUrl(pw.url, team.name, wiki.id, page1.id, channel.id));
    await page.locator('[data-testid="page-viewer-content"]').waitFor({state: 'visible', timeout: PAGE_LOAD_TIMEOUT});

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
    await enterEditMode(page);

    // # Change status to a different value
    const targetStatusLabel = initialLabel === DEFAULT_PAGE_STATUS ? 'Done' : DEFAULT_PAGE_STATUS;

    const statusSelector = page.locator('.page-status-wrapper .selectable-select-property__control');
    await statusSelector.click();

    const statusMenu = page.locator('.selectable-select-property__menu');
    await expect(statusMenu).toBeVisible();

    const targetOption = page.locator('.selectable-select-property__option', {hasText: targetStatusLabel});
    const autoSaveDone = startWatchForAutoSave(page);
    await targetOption.click();
    await autoSaveDone;

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
    await waitForAutoSave(page);

    // # Select status 'done' in draft mode
    const statusSelector = page.locator('.page-status-wrapper .selectable-select-property__control');
    await expect(statusSelector).toBeVisible();
    await statusSelector.click();

    const statusMenu = page.locator('.selectable-select-property__menu');
    await expect(statusMenu).toBeVisible();

    const doneOption = page.locator('.selectable-select-property__option', {hasText: 'Done'});
    const autoSaveDoneStatus = startWatchForAutoSave(page);
    await doneOption.click();
    await autoSaveDoneStatus;

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
    await waitForAutoSave(page);

    // # Select status 'in_review'
    const statusSelector = page.locator('.page-status-wrapper .selectable-select-property__control');
    await statusSelector.click();

    const statusMenu = page.locator('.selectable-select-property__menu');
    await expect(statusMenu).toBeVisible();

    const inReviewOption = page.locator('.selectable-select-property__option', {hasText: 'In review'});
    const autoSaveDone = startWatchForAutoSave(page);
    await inReviewOption.click();
    await autoSaveDone;

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
        await waitForAutoSave(page);

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
    await enterEditMode(page);

    // # Wait for editor to fully load (including status selector)
    await page.waitForSelector('[data-testid="wiki-page-editor"]', {state: 'visible', timeout: HIERARCHY_TIMEOUT});

    // # Change status to 'rough_draft' in draft mode
    const statusSelector = page.locator('.page-status-wrapper .selectable-select-property__control');
    await expect(statusSelector).toBeVisible({timeout: PAGE_LOAD_TIMEOUT});
    await statusSelector.click();

    const statusMenu = page.locator('.selectable-select-property__menu');
    await expect(statusMenu).toBeVisible();

    const roughDraftOption = page.locator('.selectable-select-property__option', {hasText: 'Rough draft'});
    const autoSaveDone = startWatchForAutoSave(page);
    await roughDraftOption.click();
    await autoSaveDone;

    // # Update the content
    const editor = getEditor(page);
    await editor.click();
    await page.keyboard.press('End');
    await editor.type(' Updated content');

    // # Wait for autosave (debounced — register after typing, fires 500ms later)
    await waitForAutoSave(page);

    // # Click Update button
    await publishCurrentPage(page);

    // * Verify updated page shows 'Rough draft' status
    const publishedStatus = page.locator('[data-testid="page-viewer-status"]');
    await expect(publishedStatus).toBeVisible();
    const statusText = await publishedStatus.textContent();
    const statusLabel = statusText?.trim();

    expect(statusLabel).toBe('Rough draft');
});

/**
 * @objective Verify that publishing a child page whose parent is still a draft shows a LOCAL error,
 *            not a global top-of-page error banner (A27)
 * @bug hooks.ts dispatches logError with LogErrorBarMode.Always, forcing a global banner instead of
 *      scoping the error to the page/editor area.
 */
test(
    'shows local error when publishing child of unpublished parent, not global banner',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Test Channel'));

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki through UI
        await createWikiThroughUI(page, uniqueName('Parent Draft Wiki'));

        // # Create a parent page but do NOT publish it — leave as draft
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Parent Draft Page');
        await page.waitForLoadState('networkidle');

        const editor = getEditor(page);
        await editor.click();
        await editor.fill('Parent page content — draft only');

        await waitForAutoSave(page);

        // # Without publishing the parent, create a child page via the hierarchy panel context menu
        // Right-click the parent node in the hierarchy panel and select "New subpage"
        const parentNode = page.locator('[data-testid="hierarchy-item"]', {hasText: 'Parent Draft Page'});
        await parentNode.hover();
        await parentNode.click({button: 'right'});

        const newSubpageOption = page.locator('[data-testid="context-menu-new-subpage"], [role="menuitem"]', {
            hasText: /new subpage|add subpage|create subpage/i,
        });
        await newSubpageOption.click();

        await fillCreatePageModal(page, 'Child Page');
        await page.waitForLoadState('networkidle');

        const childEditor = getEditor(page);
        await childEditor.click();
        await childEditor.fill('Child page content');

        await waitForAutoSave(page);

        // # Attempt to publish the child page (parent is still a draft — should fail)
        await publishCurrentPage(page);

        // * Assert: an error message is visible near the page/editor (local scope)
        // TODO: verify exact selector for inline error after fix ships — use broad selector for now
        const localError = page.locator('.page-error, [data-testid="page-publish-error"], .wiki-page-error');
        await expect(localError).toBeVisible({timeout: PAGE_LOAD_TIMEOUT});

        // * Assert: the global top-of-page error banner is NOT shown
        // The bug causes hooks.ts to dispatch logError with LogErrorBarMode.Always which renders this banner
        const globalErrorBar = page.locator('.error-bar, .alert-bar, [data-testid="error-bar"]');
        await expect(globalErrorBar).not.toBeVisible();
    },
);

/**
 * @objective Verify the status indicator dot reflects the selected status color, not always blue
 * @bug A26 — .PageViewer__status-indicator has background-color: var(--button-bg) hardcoded
 */
test(
    'status indicator color reflects selected status not always blue',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Status Color Channel'));

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki through UI
        await createWikiThroughUI(page, uniqueName('Color Wiki'));

        // # Create a page and enter edit mode
        const pageName = uniqueName('Color Test Page');
        await getNewPageButton(page).click();
        await fillCreatePageModal(page, pageName);
        await page.waitForLoadState('networkidle');

        const editor = getEditor(page);
        await editor.click();
        await editor.fill('Content for color test');

        // # Set status to "Done" (color: green)
        const statusSelector = page.locator('.page-status-wrapper, [data-testid="page-status-selector"]');
        await statusSelector.click();
        await page.locator('[role="option"], .PageStatus__option', {hasText: /^Done$/}).click();

        // # Publish the page
        await waitForAutoSave(page);
        await publishCurrentPage(page);
        await page.waitForLoadState('networkidle');

        // * Assert: status indicator dot is visible in page viewer
        const statusDot = page.locator('.PageViewer__status-indicator');
        await expect(statusDot).toBeVisible({timeout: PAGE_LOAD_TIMEOUT});

        // TODO: Verify exact assertion method after fix ships — if fix emits inline style.backgroundColor
        // instead of data-color attribute, adjust accordingly.

        // * Post-fix: the dot should carry data-color="green" for Done status
        // Currently the attribute won't exist — test documents the expected behavior and will fail until fixed
        const dataColor = await statusDot.getAttribute('data-color');
        expect(dataColor).toBe('green');

        // * The dot must NOT resolve to the blue brand color (var(--button-bg))
        // A different computed color means the fix is in place
        const bgColor = await statusDot.evaluate((el) => getComputedStyle(el).backgroundColor);
        const buttonBgColor = await page.evaluate(() =>
            getComputedStyle(document.documentElement).getPropertyValue('--button-bg').trim(),
        );
        // If the fix ships with a specific green hex/rgb, bgColor will differ from buttonBgColor
        expect(bgColor).not.toBe(buttonBgColor);
    },
);

/**
 * @objective Verify a new draft page shows only the status selector, not a separate hardcoded "Draft" badge
 * @bug B1 — wiki_page_editor.tsx renders a hardcoded "Draft" badge alongside PageStatusSelector simultaneously
 */
test(
    'new page shows only status selector not a separate Draft badge',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await createTestChannel(adminClient, team.id, uniqueName('Draft Badge Channel'));

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki through UI
        await createWikiThroughUI(page, uniqueName('Draft Badge Wiki'));

        // # Create a new page but do NOT publish it (leave as draft)
        await getNewPageButton(page).click();
        await fillCreatePageModal(page, uniqueName('Draft Badge Page'));
        await page.waitForLoadState('networkidle');

        const editor = getEditor(page);
        await editor.click();
        await editor.fill('Draft badge test content');

        // # Wait for auto-save so the page is persisted as a draft
        await waitForAutoSave(page);

        // * Assert: there is NO separate hardcoded "Draft" badge rendered alongside the status selector
        // This will FAIL currently because wiki_page_editor.tsx renders both simultaneously
        const separateDraftBadge = page.locator('.draft-badge, [data-testid="draft-badge"], .wiki-draft-badge');
        await expect(separateDraftBadge).toHaveCount(0);

        // * Assert: the status selector wrapper is visible (single source of draft state)
        const statusWrapper = page.locator('.page-status-wrapper, [data-testid="page-status-selector"]');
        await expect(statusWrapper).toBeVisible({timeout: PAGE_LOAD_TIMEOUT});

        // * Assert: the status selector shows "Rough draft" as the default draft state
        await expect(statusWrapper).toContainText('Rough draft');
    },
);
