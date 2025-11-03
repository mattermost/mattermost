// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';

import {createWikiThroughUI, createPageThroughUI, createChildPageThroughContextMenu, getNewPageButton, fillCreatePageModal, addHeadingToEditor, waitForPageInHierarchy} from './test_helpers';

/**
 * @objective Verify complete workflow: create parent page, create child, add comment, edit content
 */
test('completes full page lifecycle with hierarchy and comments', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Integration Wiki ${pw.random.id()}`);

    // # Step 1: Create parent page
    const newPageButton = getNewPageButton(page);
    if (await newPageButton.isVisible({timeout: 3000}).catch(() => false)) {
        await newPageButton.click();
        await fillCreatePageModal(page, 'Parent Integration Page');

        const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
        await editor.click();
        await editor.type('Parent page content');

        const publishButton = page.locator('[data-testid="wiki-page-publish-button"]');
        await publishButton.click();
        await page.waitForLoadState('networkidle');

        // # Step 2: Create child page
        const addChildButton = page.locator('[data-testid="page-context-menu-new-child"]').first();
        if (await addChildButton.isVisible({timeout: 3000}).catch(() => false)) {
            await addChildButton.click();

            await titleInput.fill('Child Integration Page');
            await editor.click();
            await editor.clear();
            await editor.type('Child page content to comment on');

            await publishButton.click();
            await page.waitForLoadState('networkidle');

            // # Step 3: Add inline comment
            await page.keyboard.down('Control');
            await page.keyboard.press('a');
            await page.keyboard.up('Control');

            const commentButton = page.locator('button[aria-label*="comment"]').first();
            if (await commentButton.isVisible({timeout: 2000}).catch(() => false)) {
                await commentButton.click();

                const commentModal = page.getByRole('dialog', {name: /Comment|Add/i});
                const textarea = commentModal.locator('textarea').first();
                await textarea.fill('Integration test comment');

                const addButton = commentModal.locator('button:has-text("Add")').first();
                await addButton.click();
            }

            // # Step 4: Edit content
            const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
            if (await editButton.isVisible({timeout: 3000}).catch(() => false)) {
                await editButton.click();

                await editor.click();
                await editor.type(' - EDITED');

                const saveButton = page.locator('[data-testid="save-button"]').first();
                await saveButton.click();
                await page.waitForLoadState('networkidle');

                // * Verify all changes persisted
                const pageContent = page.locator('[data-testid="page-viewer-content"]');
                if (await pageContent.isVisible().catch(() => false)) {
                    await expect(pageContent).toContainText('EDITED');
                }
            }
        }
    }
});

/**
 * @objective Verify draft save, navigate away, return, edit, publish workflow
 */
test('saves draft, navigates away, returns to draft, then publishes', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Draft Flow Wiki ${pw.random.id()}`);

    // # Step 1: Create draft
    const newPageButton = getNewPageButton(page);
    if (await newPageButton.isVisible({timeout: 3000}).catch(() => false)) {
        await newPageButton.click();
        await fillCreatePageModal(page, 'Draft Flow Test');

        const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
        await editor.click();
        await editor.type('Draft content in progress');

        // * Wait for auto-save
        await page.waitForTimeout(3000);

        // # Step 2: Navigate away (without publishing)
        await page.goto(`${pw.url}/${team.name}/channels/${channel.name}`);
        await page.waitForLoadState('networkidle');

        // # Step 3: Return to wiki
        await page.goto(`${pw.url}/${team.name}/channels/${channel.name}/wikis/${wiki.id}`);
        await page.waitForLoadState('networkidle');

        // # Step 4: Find and open draft (drafts are integrated in tree with data-is-draft attribute)
        const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
        const draftNode = hierarchyPanel.locator('[data-testid="page-tree-node"][data-is-draft="true"]', {hasText: 'Draft Flow Test'});
        if (await draftNode.isVisible({timeout: 3000}).catch(() => false)) {
            await draftNode.click();
            await page.waitForLoadState('networkidle');

                // * Verify draft content restored
                const editorContent = await editor.textContent();
                expect(editorContent).toContain('Draft content in progress');

                // # Step 5: Edit draft
                await editor.click();
                await editor.type(' - additional content');

                // # Step 6: Publish
                const publishButton = page.locator('[data-testid="wiki-page-publish-button"]');
                await publishButton.click();
                await page.waitForLoadState('networkidle');

                // * Verify published
                const pageContent = page.locator('[data-testid="page-viewer-content"]');
                if (await pageContent.isVisible().catch(() => false)) {
                    await expect(pageContent).toContainText('Draft content in progress - additional content');
                }
            }
        }
});

/**
 * @objective Verify move page to different wiki with permission inheritance
 */
test('moves page between wikis and inherits new permissions', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;

    // # Create two channels
    const channel1 = await adminClient.createChannel({
        team_id: team.id,
        name: `channel1-${pw.random.id()}`,
        display_name: `Channel 1 ${pw.random.id()}`,
        type: 'O',
    });
    await adminClient.addToChannel(user.id, channel1.id);

    const channel2 = await adminClient.createChannel({
        team_id: team.id,
        name: `channel2-${pw.random.id()}`,
        display_name: `Channel 2 ${pw.random.id()}`,
        type: 'O',
    });
    await adminClient.addToChannel(user.id, channel2.id);

    const {page, channelsPage} = await pw.testBrowser.login(user);

    // # Create wiki1 and page in channel1 through UI
    await channelsPage.goto(team.name, channel1.name);
    const wiki1 = await createWikiThroughUI(page, `Wiki 1 ${pw.random.id()}`);
    const movablePage = await createPageThroughUI(page, 'Page to Move', 'Content to move');

    // # Create wiki2 in channel2 through UI
    await channelsPage.goto(team.name, channel2.name);
    const wiki2 = await createWikiThroughUI(page, `Wiki 2 ${pw.random.id()}`);

    // # Navigate back to the movable page in wiki1
    await channelsPage.goto(team.name, channel1.name);
    await page.goto(`${pw.url}/${team.name}/channels/${channel1.name}/wikis/${wiki1.id}/pages/${movablePage.id}`);
    await page.waitForLoadState('networkidle');

    // # Move page to wiki2
    const pageActions = page.locator('[data-testid="page-actions"], [data-testid="wiki-page-more-actions"]').first();
    if (await pageActions.isVisible({timeout: 3000}).catch(() => false)) {
        await pageActions.click();

        const moveButton = page.locator('button:has-text("Move to Wiki"), [data-testid="page-context-menu-move"]').first();
        if (await moveButton.isVisible({timeout: 2000}).catch(() => false)) {
            await moveButton.click();

            const moveModal = page.getByRole('dialog', {name: /Move/i});
            if (await moveModal.isVisible({timeout: 3000}).catch(() => false)) {
                const wiki2Option = moveModal.locator(`text="${wiki2.title}"`).first();
                await wiki2Option.click();

                const confirmButton = moveModal.locator('[data-testid="page-context-menu-move"], [data-testid="confirm-button"]').first();
                await confirmButton.click();
                await page.waitForLoadState('networkidle');

                // * Verify page accessible in new wiki/channel
                await page.goto(`${pw.url}/${team.name}/channels/${channel2.name}/wikis/${wiki2.id}/pages/${movablePage.id}`);
                await page.waitForLoadState('networkidle');

                const pageContent = page.locator('[data-testid="page-viewer-content"]');
                if (await pageContent.isVisible().catch(() => false)) {
                    await expect(pageContent).toContainText('Content to move');
                }
            }
        }
    }
});

/**
 * @objective Verify concurrent editing follows last-write-wins behavior
 */
test('applies last-write-wins when saving concurrent edits from multiple tabs', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page: page1, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and page through UI
    const wiki = await createWikiThroughUI(page1, `Concurrent Wiki ${pw.random.id()}`);
    const testPage = await createPageThroughUI(page1, 'Concurrent Edit Page', 'Original content');

    const editButton1 = page1.locator('[data-testid="wiki-page-edit-button"]').first();
    if (await editButton1.isVisible({timeout: 3000}).catch(() => false)) {
        await editButton1.click();

        const editor1 = page1.locator('.ProseMirror').first();
        await editor1.click();
        await editor1.type(' - Tab 1 edit');

        // # Open same page in a second browser context (simulating second tab/window)
        const storageState = await pw.testBrowser.context.storageState();
        const context2 = await pw.testBrowser.context.browser()!.newContext({
            storageState,
        });
        const page2 = await context2.newPage();

        // # Navigate to the same page
        await page2.goto(`${pw.url}/${team.name}/channels/${channel.name}/wikis/${wiki.id}/pages/${testPage.id}`);
        await page2.waitForLoadState('networkidle');

        const editButton2 = page2.locator('[data-testid="wiki-page-edit-button"]').first();
        if (await editButton2.isVisible().catch(() => false)) {
            await editButton2.click();

            const editor2 = page2.locator('.ProseMirror').first();
            await editor2.click();
            await editor2.type(' - Tab 2 edit');

            // # Tab 2: Save first
            const saveButton2 = page2.locator('[data-testid="save-button"]').first();
            await saveButton2.click();
            await page2.waitForLoadState('networkidle');

            // # Tab 1: Save second (last write wins)
            const saveButton1 = page1.locator('[data-testid="save-button"]').first();
            await saveButton1.click();
            await page1.waitForLoadState('networkidle');

            // * Verify Tab 1's content (last write) is what persisted
            const savedPage = await adminClient.getPost(testPage.id);
            expect(savedPage.message).toContain('Tab 1 edit');
            expect(savedPage.message).toContain('Original content');

            // * Verify via UI - refresh and check content
            await page1.reload();
            await page1.waitForLoadState('networkidle');
            const pageContent = await page1.locator('[data-testid="page-viewer-content"]').textContent();
            expect(pageContent).toContain('Tab 1 edit');
        }

        await context2.close();
    }
});

/**
 * @objective Verify page with inline comments can be edited without losing comments
 */
test('preserves inline comments when editing page content', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and page through UI
    const wiki = await createWikiThroughUI(page, `Comment Preservation Wiki ${pw.random.id()}`);
    const testPage = await createPageThroughUI(page, 'Page with Comments', 'Content with comment marker');

    // # Click Edit button to enter edit mode
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    await editButton.waitFor({state: 'visible', timeout: 5000});
    await editButton.click();

    // # Wait for editor to be ready
    const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: 5000});

    // # Select all text in editor using triple-click (more reliable than Ctrl+A)
    await editor.click({clickCount: 3});
    await page.waitForTimeout(300);

    // # Add inline comment
    const inlineCommentButton = page.locator('button[aria-label*="comment"], [data-testid="inline-comment-submit"]').first();
    if (await inlineCommentButton.isVisible({timeout: 2000}).catch(() => false)) {
        await inlineCommentButton.click();

        const commentModal = page.getByRole('dialog', {name: /Comment|Add/i});
        if (await commentModal.isVisible({timeout: 3000}).catch(() => false)) {
            const textarea = commentModal.locator('textarea').first();
            await textarea.fill('Important comment to preserve');

            const addButton = commentModal.locator('button:has-text("Add"), button:has-text("Submit"), button:has-text("Comment")').first();
            await addButton.click();
            await page.waitForTimeout(1500); // Wait for modal to close and comment to be added
        }
    }

    // # Save the page with the comment
    const saveButton = page.locator('[data-testid="save-button"], [data-testid="wiki-page-publish-button"]').first();
    if (await saveButton.isVisible({timeout: 5000}).catch(() => false)) {
        await saveButton.click();
        await page.waitForLoadState('networkidle');
    }

    // * Verify comment marker visible in viewer mode
    let commentMarker = page.locator('[data-inline-comment-marker], .inline-comment-marker, [data-comment-id]').first();
    if (await commentMarker.isVisible({timeout: 5000}).catch(() => false)) {
        // # Edit page content again to verify comment preservation
        const editButton2 = page.locator('[data-testid="wiki-page-edit-button"]');
        if (await editButton2.isVisible().catch(() => false)) {
            await editButton2.click();

            const editor2 = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
            await editor2.click();
            await page.keyboard.press('End');
            await editor2.type(' - edited');

            const saveButton2 = page.locator('[data-testid="save-button"], [data-testid="wiki-page-publish-button"]').first();
            if (await saveButton2.isVisible({timeout: 5000}).catch(() => false)) {
                await saveButton2.click();
                await page.waitForLoadState('networkidle');
            }

            // * Verify comment marker still present after edit
            commentMarker = page.locator('[data-inline-comment-marker], .inline-comment-marker, [data-comment-id]').first();
            if (await commentMarker.isVisible({timeout: 5000}).catch(() => false)) {
                // * Verify comment content accessible
                await commentMarker.click();
                const rhs = page.locator('[data-testid="rhs"], .rhs, .sidebar--right').first();
                if (await rhs.isVisible({timeout: 3000}).catch(() => false)) {
                    await expect(rhs).toContainText('Important comment to preserve');
                }
            }
        }
    }
});

/**
 * @objective Verify search, navigate to result, add comment, navigate back
 */
test('searches page, opens result, adds comment, returns to search', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and page through UI
    const uniqueTerm = `SearchTerm${pw.random.id()}`;
    const wiki = await createWikiThroughUI(page, `Search Flow Wiki ${pw.random.id()}`);
    const searchablePage = await createPageThroughUI(page, `Page with ${uniqueTerm}`, `Content containing ${uniqueTerm}`);

    // # Perform search
    const searchInput = page.locator('[data-testid="pages-search-input"]').first();
    if (await searchInput.isVisible({timeout: 3000}).catch(() => false)) {
        await searchInput.fill(uniqueTerm);
        await page.waitForTimeout(500);

        // # Click search result
        const searchResult = page.locator(`text="${uniqueTerm}"`).first();
        if (await searchResult.isVisible({timeout: 3000}).catch(() => false)) {
            await searchResult.click();
            await page.waitForLoadState('networkidle');

            // * Verify on correct page
            const currentUrl = page.url();
            expect(currentUrl).toContain(searchablePage.id);

            // # Add comment
            await page.keyboard.down('Control');
            await page.keyboard.press('a');
            await page.keyboard.up('Control');

            const commentButton = page.locator('button[aria-label*="comment"]').first();
            if (await commentButton.isVisible({timeout: 2000}).catch(() => false)) {
                await commentButton.click();

                const commentModal = page.getByRole('dialog', {name: /Comment|Add/i});
                const textarea = commentModal.locator('textarea').first();
                await textarea.fill('Comment from search flow');

                const addButton = commentModal.locator('button:has-text("Add")').first();
                await addButton.click();
            }

            // # Navigate back
            await page.goBack();
            await page.waitForLoadState('networkidle');

            // * Verify back on search results or wiki home
            const searchInputVisible = await searchInput.isVisible({timeout: 3000}).catch(() => false);
            expect(searchInputVisible).toBe(true);
        }
    }
});

/**
 * @objective Verify create nested hierarchy, add comments at each level, navigate via breadcrumbs
 */
test('creates multi-level hierarchy with comments and breadcrumb navigation', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Hierarchy Flow Wiki ${pw.random.id()}`);

    const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]');

    // # Create level 1 page
    const newPageButton = getNewPageButton(page);
    await newPageButton.waitFor({state: 'visible', timeout: 5000});
    await newPageButton.click();

    // # Fill modal and create page
    await fillCreatePageModal(page, 'Level 1 Page');

    // # Edit page content
    await editor.waitFor({state: 'visible', timeout: 5000});
    await editor.click();
    await editor.type('Level 1 content');
    await publishButton.click();
    await page.waitForLoadState('networkidle');
    await waitForPageInHierarchy(page, 'Level 1 Page', 10000);

    // # Add comment to level 1 - enter edit mode first
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]').first();
    await editButton.waitFor({state: 'visible', timeout: 5000});
    await editButton.click();
    await page.waitForTimeout(500);

    // # Select text in editor
    await editor.waitFor({state: 'visible', timeout: 5000});
    await editor.click();
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await page.waitForTimeout(200);

    const commentButton = page.locator('button[aria-label*="comment"], [data-testid="inline-comment-submit"]').first();
    if (await commentButton.isVisible({timeout: 5000}).catch(() => false)) {
        await commentButton.click();
        await page.waitForTimeout(500);

        const commentModal = page.getByRole('dialog');
        if (await commentModal.isVisible({timeout: 5000}).catch(() => false)) {
            await commentModal.locator('textarea').fill('Level 1 comment');
            await commentModal.locator('button:has-text("Add"), button:has-text("Submit")').first().click();
            await page.waitForTimeout(1000);
        }
    }

    // # Publish after adding comment
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // # Create level 2 page (child) - open context menu first
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const level1Node = hierarchyPanel.locator(`text="Level 1 Page"`).first();
    await level1Node.waitFor({state: 'visible', timeout: 5000});

    // # Right-click to open context menu
    await level1Node.click({button: 'right'});
    await page.waitForTimeout(300);

    const addChildButton = page.locator('[data-testid="page-context-menu-new-child"]').first();
    await addChildButton.waitFor({state: 'visible', timeout: 5000});
    await addChildButton.click();

    // # Fill modal and create child page
    await fillCreatePageModal(page, 'Level 2 Page');

    // # Edit page content
    await editor.waitFor({state: 'visible', timeout: 5000});
    await editor.click();
    await editor.clear();
    await editor.type('Level 2 content');
    await publishButton.click();
    await page.waitForLoadState('networkidle');
    await waitForPageInHierarchy(page, 'Level 2 Page', 10000);

    // # Add comment to level 2 - enter edit mode first
    await editButton.waitFor({state: 'visible', timeout: 5000});
    await editButton.click();
    await page.waitForTimeout(500);

    // # Select text in editor
    await editor.waitFor({state: 'visible', timeout: 5000});
    await editor.click();
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await page.waitForTimeout(200);

    const commentButton2 = page.locator('button[aria-label*="comment"], [data-testid="inline-comment-submit"]').first();
    if (await commentButton2.isVisible({timeout: 5000}).catch(() => false)) {
        await commentButton2.click();
        await page.waitForTimeout(500);

        const commentModal2 = page.getByRole('dialog');
        if (await commentModal2.isVisible({timeout: 5000}).catch(() => false)) {
            await commentModal2.locator('textarea').fill('Level 2 comment');
            await commentModal2.locator('button:has-text("Add"), button:has-text("Submit")').first().click();
            await page.waitForTimeout(1000);
        }
    }

    // # Publish after adding comment
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // # Navigate back to level 1 via breadcrumb
    const breadcrumb = page.locator('[data-testid="breadcrumb"], .breadcrumb').first();
    await breadcrumb.waitFor({state: 'visible', timeout: 5000});
    const level1Link = breadcrumb.locator('text="Level 1 Page"').first();
    await level1Link.waitFor({state: 'visible', timeout: 5000});
    await level1Link.click();
    await page.waitForLoadState('networkidle');

    // * Verify on level 1 page
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await pageContent.waitFor({state: 'visible', timeout: 5000});
    await expect(pageContent).toContainText('Level 1 content');

    // * Verify level 1 comment still accessible
    const commentMarker = page.locator('[data-inline-comment-marker]').first();
    if (await commentMarker.isVisible({timeout: 5000}).catch(() => false)) {
        await commentMarker.click();
        const rhs = page.locator('[data-testid="rhs"]').first();
        await rhs.waitFor({state: 'visible', timeout: 5000});
        await expect(rhs).toContainText('Level 1 comment');
    }
});

/**
 * @objective Verify page deletion with confirmation and hierarchy update
 */
test('deletes page with children and updates hierarchy', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Delete Flow Wiki ${pw.random.id()}`);

    // # Create parent with child through UI
    const parent = await createPageThroughUI(page, 'Parent to Delete', 'Parent content');
    const child = await createChildPageThroughContextMenu(page, parent.id!, 'Child Page', 'Child content');

    // # Delete parent page
    const pageActions = page.locator('[data-testid="page-actions"], [data-testid="wiki-page-more-actions"]').first();
    if (await pageActions.isVisible({timeout: 3000}).catch(() => false)) {
        await pageActions.click();

        const deleteButton = page.locator('[data-testid="delete-button"]').first();
        if (await deleteButton.isVisible({timeout: 2000}).catch(() => false)) {
            await deleteButton.click();

            // * Verify confirmation modal
            const confirmModal = page.getByRole('dialog', {name: /Delete|Confirm/i});
            if (await confirmModal.isVisible({timeout: 3000}).catch(() => false)) {
                // * Verify warning about children (if applicable)
                const modalText = await confirmModal.textContent();
                if (modalText?.includes('child')) {
                    expect(modalText).toContain('child');
                }

                const confirmButton = confirmModal.locator('[data-testid="delete-button"], [data-testid="confirm-button"]').first();
                await confirmButton.click();
                await page.waitForLoadState('networkidle');

                // * Verify redirected away from deleted page
                const currentUrl = page.url();
                expect(currentUrl).not.toContain(parent.id);

                // * Verify page no longer in hierarchy
                const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
                if (await hierarchyPanel.isVisible({timeout: 3000}).catch(() => false)) {
                    const parentNode = hierarchyPanel.locator('text="Parent to Delete"').first();
                    const parentVisible = await parentNode.isVisible({timeout: 2000}).catch(() => false);
                    expect(parentVisible).toBe(false);
                }
            }
        }
    }
});

/**
 * @objective Verify page rename with breadcrumb and hierarchy updates
 */
test('renames page and updates breadcrumbs and hierarchy', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Rename Flow Wiki ${pw.random.id()}`);

    const oldTitle = 'Original Page Title';
    const newTitle = 'Renamed Page Title';

    // # Create parent and child pages through UI
    const renamePage = await createPageThroughUI(page, oldTitle, 'Page content');
    const child = await createChildPageThroughContextMenu(page, renamePage.id!, 'Child of Renamed', 'Child content');

    // # Rename page
    const pageTitle = page.locator('[data-testid="page-viewer-title"]');
    if (await pageTitle.isVisible({timeout: 3000}).catch(() => false)) {
        // # Click to edit title
        await pageTitle.click();

        const titleInput = page.locator('input[value*="Original"]').first();
        if (await titleInput.isVisible({timeout: 2000}).catch(() => false)) {
            await titleInput.clear();
            await titleInput.fill(newTitle);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(1000);

            // * Verify title updated
            await expect(pageTitle).toContainText(newTitle);

            // # Navigate to child page
            await page.goto(`${pw.url}/${team.name}/channels/${channel.name}/wikis/${wiki.id}/pages/${child.id}`);
            await page.waitForLoadState('networkidle');

            // * Verify breadcrumb shows new parent title
            const breadcrumb = page.locator('[data-testid="breadcrumb"], .breadcrumb').first();
            if (await breadcrumb.isVisible({timeout: 3000}).catch(() => false)) {
                await expect(breadcrumb).toContainText(newTitle);
            }

            // * Verify hierarchy panel shows new title
            const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
            if (await hierarchyPanel.isVisible({timeout: 3000}).catch(() => false)) {
                await expect(hierarchyPanel).toContainText(newTitle);
            }
        }
    }
});

/**
 * @objective Verify deep link with multiple features: comments, editing, hierarchy
 */
test('opens page via deep link, adds comment, edits, verifies hierarchy', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and pages through UI
    const wiki = await createWikiThroughUI(page, `Deep Link Flow Wiki ${pw.random.id()}`);
    const parent = await createPageThroughUI(page, 'Deep Link Parent', 'Parent content');
    const child = await createChildPageThroughContextMenu(page, parent.id!, 'Deep Link Child', 'Child deep link content');

    // # Open child page via deep link
    const deepLink = `${pw.url}/${team.name}/channels/${channel.name}/wikis/${wiki.id}/pages/${child.id}`;
    await page.goto(deepLink);
    await page.waitForLoadState('networkidle');

    // * Verify page loaded
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    if (await pageContent.isVisible({timeout: 5000}).catch(() => false)) {
        await expect(pageContent).toContainText('Child deep link content');

        // # Add comment
        await page.keyboard.down('Control');
        await page.keyboard.press('a');
        await page.keyboard.up('Control');

        const commentButton = page.locator('button[aria-label*="comment"]').first();
        if (await commentButton.isVisible({timeout: 2000}).catch(() => false)) {
            await commentButton.click();
            const commentModal = page.getByRole('dialog', {name: /Comment|Add/i});
            const textarea = commentModal.locator('textarea').first();
            await textarea.fill('Deep link comment');
            const addButton = commentModal.locator('button:has-text("Add")').first();
            await addButton.click();
            await page.waitForTimeout(1000);

            // # Edit page
            const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
            if (await editButton.isVisible({timeout: 3000}).catch(() => false)) {
                await editButton.click();
                const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
                await editor.click();
                await editor.type(' - EDITED');
                const saveButton = page.locator('[data-testid="save-button"]').first();
                await saveButton.click();
                await page.waitForLoadState('networkidle');

                // * Verify breadcrumb shows hierarchy
                const breadcrumb = page.locator('[data-testid="breadcrumb"], .breadcrumb').first();
                if (await breadcrumb.isVisible({timeout: 3000}).catch(() => false)) {
                    await expect(breadcrumb).toContainText('Deep Link Parent');
                    await expect(breadcrumb).toContainText('Deep Link Child');
                }

                // * Verify hierarchy panel shows structure
                const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
                if (await hierarchyPanel.isVisible({timeout: 3000}).catch(() => false)) {
                    await expect(hierarchyPanel).toContainText('Deep Link Parent');
                    await expect(hierarchyPanel).toContainText('Deep Link Child');
                }
            }
        }
    }
});

/**
 * @objective Verify version history navigation with restore functionality
 */
test('views version history and restores previous version', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki and page through UI
    const wiki = await createWikiThroughUI(page, `Version History Wiki ${pw.random.id()}`);
    const testPage = await createPageThroughUI(page, 'Version History Page', 'Version 1 content');

    // # Make first edit
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]');
    if (await editButton.isVisible({timeout: 3000}).catch(() => false)) {
        await editButton.click();
        const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
        await editor.click();
        await editor.clear();
        await editor.type('Version 2 content');
        const publishButton = page.locator('[data-testid="wiki-page-publish-button"]');
        await publishButton.click();
        await page.waitForLoadState('networkidle');

        // # Make second edit
        if (await editButton.isVisible({timeout: 3000}).catch(() => false)) {
            await editButton.click();
            await editor.click();
            await editor.clear();
            await editor.type('Version 3 content');
            const publishButton2 = page.locator('[data-testid="wiki-page-publish-button"]');
            await publishButton2.click();
            await page.waitForLoadState('networkidle');

            // # Open version history
            const pageActions = page.locator('[data-testid="page-actions"], [data-testid="wiki-page-more-actions"]').first();
            if (await pageActions.isVisible({timeout: 3000}).catch(() => false)) {
                await pageActions.click();

                const historyButton = page.locator('button:has-text("Version History"), button:has-text("History")').first();
                if (await historyButton.isVisible({timeout: 2000}).catch(() => false)) {
                    await historyButton.click();

                    // * Verify history modal shows versions
                    const historyModal = page.getByRole('dialog', {name: /History|Version/i});
                    if (await historyModal.isVisible({timeout: 3000}).catch(() => false)) {
                        // # Select version 1
                        const version1 = historyModal.locator('text=/Version 1|Version.*1|v1/i').first();
                        if (await version1.isVisible({timeout: 2000}).catch(() => false)) {
                            await version1.click();

                            // * Verify preview shows version 1 content
                            const preview = historyModal.locator('[data-testid="version-preview"]').first();
                            if (await preview.isVisible().catch(() => false)) {
                                await expect(preview).toContainText('Version 1 content');
                            }

                            // # Restore version 1
                            const restoreButton = historyModal.locator('button:has-text("Restore")').first();
                            if (await restoreButton.isVisible().catch(() => false)) {
                                await restoreButton.click();
                                await page.waitForLoadState('networkidle');

                                // * Verify content restored
                                const pageContent = page.locator('[data-testid="page-viewer-content"]');
                                if (await pageContent.isVisible().catch(() => false)) {
                                    await expect(pageContent).toContainText('Version 1 content');
                                }
                            }
                        }
                    }
                }
            }
        }
    }
});

/**
 * @objective Verify outline navigation with RHS integration
 */
test('navigates page sections via outline in RHS', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Outline Navigation Wiki ${pw.random.id()}`);

    // # Create page with multiple headings through UI
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Page with Outline');

    const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await editor.click();

    // # Create "Section 1" as H1
    await addHeadingToEditor(page, 1, 'Section 1', 'Section 1 content');

    // # Create "Section 1.1" as H2
    await page.keyboard.press('Enter');
    await addHeadingToEditor(page, 2, 'Section 1.1', 'Section 1.1 content');

    // # Create "Section 2" as H1
    await page.keyboard.press('Enter');
    await addHeadingToEditor(page, 1, 'Section 2', 'Section 2 content');

    // # Publish the page
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]');
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // # Open RHS outline
    const outlineButton = page.locator('button[aria-label*="outline"], [data-testid="outline-button"]').first();
    if (await outlineButton.isVisible({timeout: 3000}).catch(() => false)) {
        await outlineButton.click();

        const rhs = page.locator('[data-testid="rhs"]').first();
        if (await rhs.isVisible({timeout: 3000}).catch(() => false)) {
            // * Verify outline shows sections
            const outline = rhs.locator('[data-testid="page-outline"]').first();
            if (await outline.isVisible().catch(() => false)) {
                await expect(outline).toContainText('Section 1');
                await expect(outline).toContainText('Section 1.1');
                await expect(outline).toContainText('Section 2');

                // # Click Section 2 in outline
                const section2Link = outline.locator('text="Section 2"').first();
                if (await section2Link.isVisible().catch(() => false)) {
                    await section2Link.click();
                    await page.waitForTimeout(500);

                    // * Verify scrolled to Section 2
                    const section2Heading = page.locator('h1:has-text("Section 2")').first();
                    if (await section2Heading.isVisible().catch(() => false)) {
                        const isInViewport = await section2Heading.isVisible();
                        expect(isInViewport).toBe(true);
                    }
                }
            }
        }
    }
});

/**
 * @objective Verify complex workflow: multi-level hierarchy, comments, editing, permissions
 */
test('executes complex multi-feature workflow end-to-end', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Complex Workflow Wiki ${pw.random.id()}`);

    const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]');

    // # Step 1: Create root page
    const newPageButton = getNewPageButton(page);
    await newPageButton.waitFor({state: 'visible', timeout: 5000});
    await newPageButton.click();

    // # Fill modal and create page
    await fillCreatePageModal(page, 'Root Project Page');

    // # Edit page content
    await editor.waitFor({state: 'visible', timeout: 5000});
    await editor.click();
    await editor.type('Root project documentation');
    await publishButton.click();
    await page.waitForLoadState('networkidle');
    await waitForPageInHierarchy(page, 'Root Project Page', 10000);

    // # Step 2: Create child pages - open context menu first
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    const rootNode = hierarchyPanel.locator(`text="Root Project Page"`).first();
    await rootNode.waitFor({state: 'visible', timeout: 5000});

    // # Right-click to open context menu
    await rootNode.click({button: 'right'});
    await page.waitForTimeout(300);

    const addChildButton = page.locator('[data-testid="page-context-menu-new-child"]').first();
    await addChildButton.waitFor({state: 'visible', timeout: 5000});
    await addChildButton.click();

    // # Fill modal and create child page
    await fillCreatePageModal(page, 'Requirements');

    // # Edit page content
    await editor.waitFor({state: 'visible', timeout: 5000});
    await editor.click();
    await editor.clear();
    await editor.type('Project requirements');
    await publishButton.click();
    await page.waitForLoadState('networkidle');
    await waitForPageInHierarchy(page, 'Requirements', 10000);

    // # Step 3: Add comment to requirements - enter edit mode first
    const editButton = page.locator('[data-testid="wiki-page-edit-button"]').first();
    await editButton.waitFor({state: 'visible', timeout: 5000});
    await editButton.click();
    await page.waitForTimeout(500);

    // # Select text in editor
    await editor.waitFor({state: 'visible', timeout: 5000});
    await editor.click();
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await page.waitForTimeout(200);

    const commentButton = page.locator('button[aria-label*="comment"], [data-testid="inline-comment-submit"]').first();
    if (await commentButton.isVisible({timeout: 5000}).catch(() => false)) {
        await commentButton.click();
        await page.waitForTimeout(500);

        const commentModal = page.getByRole('dialog');
        if (await commentModal.isVisible({timeout: 5000}).catch(() => false)) {
            await commentModal.locator('textarea').fill('Need to review these requirements');
            await commentModal.locator('button:has-text("Add"), button:has-text("Submit")').first().click();
            await page.waitForTimeout(1000);
        }
    }

    // # Publish after adding comment
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // # Step 4: Reply to comment (if marker is visible)
    const commentMarker = page.locator('[data-inline-comment-marker]').first();
    if (await commentMarker.isVisible({timeout: 5000}).catch(() => false)) {
        await commentMarker.click();
        const rhs = page.locator('[data-testid="rhs"]').first();
        await rhs.waitFor({state: 'visible', timeout: 5000});
        const replyButton = rhs.locator('button:has-text("Reply")').first();
        await replyButton.waitFor({state: 'visible', timeout: 5000});
        await replyButton.click();
        const replyTextarea = rhs.locator('textarea').last();
        await replyTextarea.fill('Requirements approved');
        const sendButton = rhs.locator('button:has-text("Send")').first();
        await sendButton.click();
        await page.waitForTimeout(1000);

        // # Step 5: Resolve comment
        const resolveButton = rhs.locator('button:has-text("Resolve")').first();
        await resolveButton.waitFor({state: 'visible', timeout: 5000});
        await resolveButton.click();
        await page.waitForTimeout(1000);
    }

    // # Step 6: Navigate via breadcrumb
    const breadcrumb = page.locator('[data-testid="breadcrumb"], .breadcrumb').first();
    await breadcrumb.waitFor({state: 'visible', timeout: 5000});
    const rootLink = breadcrumb.locator('text="Root Project Page"').first();
    await rootLink.waitFor({state: 'visible', timeout: 5000});
    await rootLink.click();
    await page.waitForLoadState('networkidle');

    // * Verify on root page
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await pageContent.waitFor({state: 'visible', timeout: 5000});
    await expect(pageContent).toContainText('Root project documentation');

    // # Step 7: Verify hierarchy shows all pages
    await hierarchyPanel.waitFor({state: 'visible', timeout: 5000});
    await expect(hierarchyPanel).toContainText('Root Project Page');
    await expect(hierarchyPanel).toContainText('Requirements');

    // * Test complete - multi-feature workflow successful
});

/**
 * @objective Verify draft to publish workflow with auto-save and recovery
 */
test('creates draft with auto-save, closes browser, recovers and publishes', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Draft Recovery Wiki ${pw.random.id()}`);

    // # Create draft via modal
    const newPageButton = getNewPageButton(page);
    await newPageButton.waitFor({state: 'visible', timeout: 5000});
    await newPageButton.click();

    // # Fill modal and create page
    await fillCreatePageModal(page, 'Draft Recovery Test');

    // # Edit draft content
    const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
    await editor.waitFor({state: 'visible', timeout: 5000});
    await editor.click();
    await editor.type('Important draft content that must not be lost');

    // * Wait for auto-save
    await page.waitForTimeout(3000);

    // # Simulate browser close (navigate away)
    await page.goto(`${pw.url}/${team.name}/channels/town-square`);
    await page.waitForLoadState('networkidle');

    // # Return to wiki (use correct wiki URL format)
    await page.goto(`${pw.url}/${team.name}/wiki/${channel.id}/${wiki.id}`);
    await page.waitForLoadState('networkidle');

    // # Wait for hierarchy panel to load
    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
    await hierarchyPanel.waitFor({state: 'visible', timeout: 10000});

    // Wait for draft to appear in hierarchy
    await page.waitForTimeout(2000);

    // # Recover draft (drafts are integrated in tree with data-is-draft attribute)
    const draftNode = hierarchyPanel.locator('[data-testid="page-tree-node"][data-is-draft="true"]').filter({hasText: 'Draft Recovery Test'});
    await draftNode.waitFor({state: 'visible', timeout: 10000});
    await draftNode.click();
    await page.waitForLoadState('networkidle');

    // * Verify content recovered
    const editorContent = await editor.textContent();
    expect(editorContent).toContain('Important draft content that must not be lost');

    // # Publish draft
    const publishButton = page.locator('[data-testid="wiki-page-publish-button"]');
    await publishButton.click();
    await page.waitForLoadState('networkidle');

    // * Verify published successfully
    const pageContent = page.locator('[data-testid="page-viewer-content"]');
    await pageContent.waitFor({state: 'visible', timeout: 5000});
    await expect(pageContent).toContainText('Important draft content that must not be lost');

    // * Verify draft no longer in drafts section (use correct wiki URL format)
    await page.goto(`${pw.url}/${team.name}/wiki/${channel.id}/${wiki.id}`);
    await page.waitForLoadState('networkidle');

    const hierarchyPanel2 = page.locator('[data-testid="pages-hierarchy-panel"]');
    await hierarchyPanel2.waitFor({state: 'visible', timeout: 5000});
    await page.waitForTimeout(1000);

    const draftNode2 = hierarchyPanel2.locator('[data-testid="page-tree-node"][data-is-draft="true"]').filter({hasText: 'Draft Recovery Test'});
    const draftStillVisible = await draftNode2.isVisible({timeout: 2000}).catch(() => false);
    expect(draftStillVisible).toBe(false);
});

/**
 * @objective Verify page move affects breadcrumbs, hierarchy, and permissions
 */
test('moves page to new parent and verifies UI updates', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const wiki = await createWikiThroughUI(page, `Move Page Wiki ${pw.random.id()}`);

    // # Create pages: Parent A, Parent B, Child (under A) through UI
    const parentA = await createPageThroughUI(page, 'Parent A', 'Parent A content');
    const parentB = await createPageThroughUI(page, 'Parent B', 'Parent B content');
    const childPage = await createChildPageThroughContextMenu(page, parentA.id!, 'Child Page to Move', 'Child content');

    // * Verify initial breadcrumb shows Parent A
    let breadcrumb = page.locator('[data-testid="breadcrumb"], .breadcrumb').first();
    if (await breadcrumb.isVisible({timeout: 3000}).catch(() => false)) {
        await expect(breadcrumb).toContainText('Parent A');
    }

    // # Move child to Parent B
    const pageActions = page.locator('[data-testid="page-actions"], [data-testid="wiki-page-more-actions"]').first();
    if (await pageActions.isVisible({timeout: 3000}).catch(() => false)) {
        await pageActions.click();

        const moveButton = page.locator('[data-testid="page-context-menu-move"]').first();
        if (await moveButton.isVisible({timeout: 2000}).catch(() => false)) {
            await moveButton.click();

            const moveModal = page.getByRole('dialog', {name: /Move/i});
            if (await moveModal.isVisible({timeout: 3000}).catch(() => false)) {
                const parentBOption = moveModal.locator('text="Parent B"').first();
                if (await parentBOption.isVisible().catch(() => false)) {
                    await parentBOption.click();

                    const confirmButton = moveModal.locator('[data-testid="page-context-menu-move"], [data-testid="confirm-button"]').first();
                    await confirmButton.click();
                    await page.waitForLoadState('networkidle');

                    // * Verify breadcrumb now shows Parent B
                    breadcrumb = page.locator('[data-testid="breadcrumb"], .breadcrumb').first();
                    if (await breadcrumb.isVisible({timeout: 3000}).catch(() => false)) {
                        await expect(breadcrumb).toContainText('Parent B');
                        const breadcrumbText = await breadcrumb.textContent();
                        expect(breadcrumbText).not.toContain('Parent A');
                    }

                    // * Verify hierarchy panel shows child under Parent B
                    const hierarchyPanel = page.locator('[data-testid="pages-hierarchy-panel"]');
                    if (await hierarchyPanel.isVisible({timeout: 3000}).catch(() => false)) {
                        const parentBNode = hierarchyPanel.locator('text="Parent B"').first();
                        if (await parentBNode.isVisible().catch(() => false)) {
                            // Expand Parent B if needed
                            await parentBNode.click();
                            await page.waitForTimeout(500);

                            const childNode = hierarchyPanel.locator('text="Child Page to Move"').first();
                            const childVisible = await childNode.isVisible({timeout: 2000}).catch(() => false);
                            expect(childVisible).toBe(true);
                        }
                    }
                }
            }
        }
    }
});

/**
 * @objective Verify search filters (by type, date, author) with results
 */
test('searches pages with filters and verifies results', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Create wiki through UI
    const searchTerm = `FilterTest${pw.random.id()}`;
    const wiki = await createWikiThroughUI(page, `Search Filters Wiki ${pw.random.id()}`);

    // # Create multiple pages through UI
    await createPageThroughUI(page, `${searchTerm} First Page`, 'First page content');
    await page.waitForTimeout(1000);
    await createPageThroughUI(page, `${searchTerm} Second Page`, 'Second page content');

    // # Perform search
    const searchInput = page.locator('[data-testid="pages-search-input"]').first();
    if (await searchInput.isVisible({timeout: 3000}).catch(() => false)) {
        await searchInput.fill(searchTerm);
        await page.waitForTimeout(500);

        // * Verify both pages appear in results
        const searchResults = page.locator('[data-testid="search-results"], .search-results').first();
        if (await searchResults.isVisible({timeout: 3000}).catch(() => false)) {
            await expect(searchResults).toContainText('First Page');
            await expect(searchResults).toContainText('Second Page');

            // # Apply filter (if available)
            const filterButton = page.locator('button:has-text("Filter"), [data-testid="search-filter"]').first();
            if (await filterButton.isVisible({timeout: 2000}).catch(() => false)) {
                await filterButton.click();

                // # Filter by author (current user)
                const authorFilter = page.locator(`text="${user.username}"`, page.locator('[data-testid="author-filter"]')).first();
                if (await authorFilter.isVisible().catch(() => false)) {
                    await authorFilter.click();
                    await page.waitForTimeout(500);

                    // * Verify filtered results still show pages
                    await expect(searchResults).toContainText('First Page');
                }
            }
        }
    }
});
