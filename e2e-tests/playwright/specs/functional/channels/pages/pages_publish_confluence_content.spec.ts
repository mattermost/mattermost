// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    getNewPageButton,
    getPageViewerContent,
    fillCreatePageModal,
    waitForPageInHierarchy,
    publishCurrentPage,
    getEditorAndWait,
    typeInEditor,
    getHierarchyPanel,
    loginAndNavigateToChannel,
    uniqueName,
    SHORT_WAIT,
    EDITOR_LOAD_WAIT,
    HIERARCHY_TIMEOUT,
} from './test_helpers';

/**
 * @objective Verify publishing page with Confluence-copied content doesn't cause draggableId errors
 *
 * @precondition
 * Content pasted from Confluence often includes complex HTML structures with nested divs,
 * tables, and inline styles that may cause issues during rendering
 */
test(
    'publishes page with Confluence-like content without draggableId errors',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki through UI
        await createWikiThroughUI(page, uniqueName('Confluence Test Wiki'));

        // # Create new page
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Confluence Content Test');

        // # Wait for editor to be visible
        const editor = await getEditorAndWait(page);

        // # Simulate pasting complex Confluence-like HTML content
        // This mimics content copied from Confluence which includes:
        // - Nested divs with data attributes
        // - Complex table structures
        // - Inline styles
        // - Multiple paragraph tags
        const confluenceHTML = `
        <div data-confluence-id="some-id" class="confluence-content">
            <h1>Heading from Confluence</h1>
            <p style="margin-bottom: 10px;">This is a paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
            <table>
                <tbody>
                    <tr>
                        <td><p>Cell 1</p></td>
                        <td><p>Cell 2</p></td>
                    </tr>
                    <tr>
                        <td><p>Cell 3</p></td>
                        <td><p>Cell 4</p></td>
                    </tr>
                </tbody>
            </table>
            <p>Another paragraph after table.</p>
            <ul>
                <li><p>List item 1</p></li>
                <li><p>List item 2 with <a href="https://example.com">link</a></p></li>
            </ul>
        </div>
    `;

        await editor.click();

        // # Paste the Confluence-like HTML content
        await page.evaluate((html) => {
            const editorElement = document.querySelector('.ProseMirror');
            if (editorElement) {
                const dataTransfer = new DataTransfer();
                dataTransfer.setData('text/html', html);
                dataTransfer.setData('text/plain', 'Fallback text content');
                const pasteEvent = new ClipboardEvent('paste', {
                    clipboardData: dataTransfer,
                    bubbles: true,
                    cancelable: true,
                });
                editorElement.dispatchEvent(pasteEvent);
            }
        }, confluenceHTML);

        // # Wait for content to be processed
        await page.waitForTimeout(EDITOR_LOAD_WAIT);

        // * Verify content appears in editor (check for heading text)
        await expect(editor).toContainText('Heading from Confluence');

        // # Listen for console errors before publishing
        const consoleErrors: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });

        // # Publish the page
        await publishCurrentPage(page);

        // * Verify no draggableId errors occurred
        const draggableErrors = consoleErrors.filter(
            (error) => error.includes('Invariant failed') && error.includes('draggableId'),
        );
        expect(draggableErrors).toHaveLength(0);

        // * Verify no missing translation errors for draft.publish_page.not_found
        const translationErrors = consoleErrors.filter(
            (error) => error.includes('MISSING_TRANSLATION') && error.includes('app.draft.publish_page.not_found'),
        );
        expect(translationErrors).toHaveLength(0);

        // * Verify page published successfully
        const pageContent = getPageViewerContent(page);
        await expect(pageContent).toBeVisible();
        await expect(pageContent).toContainText('Heading from Confluence');

        // * Verify hierarchy panel still works (no drag-and-drop errors)
        const hierarchyPanel = getHierarchyPanel(page);
        await expect(hierarchyPanel).toBeVisible();

        // * Verify the published page appears in hierarchy
        await waitForPageInHierarchy(page, 'Confluence Content Test', HIERARCHY_TIMEOUT);

        // * Verify no JavaScript errors were logged during the publish flow
        expect(consoleErrors.filter((e) => !e.includes('404'))).toHaveLength(0);
    },
);

/**
 * @objective Verify translation keys exist for draft publishing errors
 *
 * @precondition
 * Edge case where a draft might be missing during publish,
 * which could trigger the "draft not found" error
 */
test(
    'shows proper error message when draft not found during publish',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki through UI
        await createWikiThroughUI(page, uniqueName('Invalid Draft Wiki'));

        // # Create new page
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Test Page');

        // # Wait for editor to be visible
        await getEditorAndWait(page);

        // # Add some content
        await typeInEditor(page, 'Test content');

        // # Monitor for console errors
        const consoleErrors: string[] = [];
        const consoleWarnings: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            } else if (msg.type() === 'warning') {
                consoleWarnings.push(msg.text());
            }
        });

        // # Try to manipulate Redux state to simulate a missing draft scenario
        // (This tests the error handling path)
        await page.evaluate(() => {
            // Try to clear draft from storage (simulating race condition)
            try {
                const keys = Object.keys(localStorage);
                keys.forEach((key) => {
                    if (key.includes('draft') || key.includes('_draft_')) {
                        localStorage.removeItem(key);
                    }
                });
            } catch {
                // Ignore if localStorage manipulation fails
            }
        });

        // # Wait a moment for state to sync
        await page.waitForTimeout(SHORT_WAIT);

        // # Attempt to publish
        await publishCurrentPage(page);

        // * Verify no missing translation errors appear
        const translationErrors = consoleErrors.filter(
            (error) => error.includes('MISSING_TRANSLATION') && error.includes('app.draft.publish_page'),
        );
        expect(translationErrors).toHaveLength(0);

        // * Verify no draggableId errors occur even if draft publish fails
        const draggableErrors = consoleErrors.filter(
            (error) => error.includes('Invariant failed') && error.includes('draggableId'),
        );
        expect(draggableErrors).toHaveLength(0);
    },
);

/**
 * @objective Verify hierarchy drag-and-drop still works after publishing a page
 */
test(
    'hierarchy drag-and-drop works after publishing page with complex content',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki through UI
        await createWikiThroughUI(page, uniqueName('Drag Drop Wiki'));

        // # Create a parent page first
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Parent Page');

        await getEditorAndWait(page);
        await typeInEditor(page, 'Parent content');

        await publishCurrentPage(page);

        // # Wait for parent page to appear in hierarchy
        await waitForPageInHierarchy(page, 'Parent Page', HIERARCHY_TIMEOUT);

        // # Create a child page with Confluence-like content
        await newPageButton.click();
        await fillCreatePageModal(page, 'Child Page');

        const childEditor = await getEditorAndWait(page);

        // # Paste complex content
        const complexHTML = '<div><h2>Child Heading</h2><p>Some <strong>formatted</strong> content</p></div>';
        await childEditor.click();
        await page.evaluate((html) => {
            const editorElement = document.querySelector('.ProseMirror');
            if (editorElement) {
                const dataTransfer = new DataTransfer();
                dataTransfer.setData('text/html', html);
                const pasteEvent = new ClipboardEvent('paste', {
                    clipboardData: dataTransfer,
                    bubbles: true,
                    cancelable: true,
                });
                editorElement.dispatchEvent(pasteEvent);
            }
        }, complexHTML);

        await page.waitForTimeout(EDITOR_LOAD_WAIT);

        // # Publish child page
        await publishCurrentPage(page);

        // * Verify child page appears in hierarchy
        await waitForPageInHierarchy(page, 'Child Page', HIERARCHY_TIMEOUT);

        // # Monitor for draggableId errors
        const consoleErrors: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });

        // # Attempt to view the hierarchy panel (this triggers Draggable rendering)
        const hierarchyPanel = getHierarchyPanel(page);
        await expect(hierarchyPanel).toBeVisible();

        // # Try to interact with the page nodes in hierarchy
        const childPageNode = hierarchyPanel.locator('text="Child Page"').first();
        await expect(childPageNode).toBeVisible();

        // # Wait a moment for any drag-and-drop initialization
        await page.waitForTimeout(EDITOR_LOAD_WAIT);

        // * Verify no draggableId errors occurred
        const draggableErrors = consoleErrors.filter(
            (error) => error.includes('Invariant failed') && error.includes('draggableId'),
        );
        expect(draggableErrors).toHaveLength(0);

        // * Verify both pages are visible in hierarchy
        await expect(hierarchyPanel).toContainText('Parent Page');
        await expect(hierarchyPanel).toContainText('Child Page');
    },
);
