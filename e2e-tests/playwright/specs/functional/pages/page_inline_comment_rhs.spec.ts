// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '../channels/pages/pages_test_fixture';
import {
    buildWikiPageUrl,
    uniqueName,
    ELEMENT_TIMEOUT,
    HIERARCHY_TIMEOUT,
    MODAL_CLOSE_TIMEOUT,
} from '../channels/pages/test_helpers';

test.describe('Page Inline Comment via RHS', () => {
    /**
     * @objective Verify that selecting text and clicking Add Comment opens RHS with anchor context
     *
     * @precondition User has edit permissions on the page
     */
    test(
        'Selecting text and clicking Add Comment should open RHS with anchor context',
        {tag: '@pages'},
        async ({pw, sharedPagesSetup}) => {
            const {team, user, adminClient} = sharedPagesSetup;

            // # Get town-square channel
            const channel = await adminClient.getChannelByName(team.id, 'town-square');

            // # Create a wiki and page with some content
            const wiki = await adminClient.createWiki({
                channel_id: channel.id,
                title: uniqueName('Inline Comment Test Wiki'),
            });

            const pageContent = {
                type: 'doc' as const,
                content: [
                    {type: 'heading', attrs: {level: 1}, content: [{type: 'text', text: 'Test Page'}]},
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'text', text: 'This is some sample text that can be selected for inline comments.'},
                        ],
                    },
                ],
            };
            const testPage = await pw.createPageViaDraft(adminClient, wiki.id, 'Inline Comment Test Page', pageContent);

            // # Login and navigate to the page
            const {page} = await pw.testBrowser.login(user);
            const pageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, testPage.id);
            await page.goto(pageUrl);
            await page.waitForLoadState('networkidle');

            // # Click Edit button to enter edit mode
            const editButton = page.getByRole('button', {name: 'Edit'});
            await expect(editButton).toBeVisible({timeout: HIERARCHY_TIMEOUT});
            await editButton.click();

            // # Wait for the editor to load
            await page.waitForSelector('[data-testid="wiki-page-editor"]', {state: 'visible', timeout: HIERARCHY_TIMEOUT});
            const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
            await expect(editor).toBeVisible();

            // # Select some text - triple-click to select a paragraph
            const paragraph = editor.locator('p').first();
            await paragraph.click({clickCount: 3});

            // # Wait for bubble menu to appear and click Add Comment
            const addCommentButton = page.locator('[data-testid="inline-comment-submit"]');
            await expect(addCommentButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
            await addCommentButton.click();

            // * Verify RHS opens with new comment view
            const newCommentView = page.locator('.WikiNewCommentView');
            await expect(newCommentView).toBeVisible({timeout: ELEMENT_TIMEOUT});

            // * Verify anchor text is shown
            const anchorQuote = page.locator('.WikiNewCommentView__anchor');
            await expect(anchorQuote).toBeVisible();
            await expect(anchorQuote).toContainText('sample text');
        },
    );

    /**
     * @objective Verify RHS displays standard message input with @mention support
     *
     * @precondition User has edit permissions on the page
     */
    test(
        'RHS should show standard message input with @mention support',
        {tag: '@pages'},
        async ({pw, sharedPagesSetup}) => {
            const {team, user, adminClient} = sharedPagesSetup;

            // # Get channel
            const channel = await adminClient.getChannelByName(team.id, 'town-square');

            // # Create wiki
            const wiki = await adminClient.createWiki({
                channel_id: channel.id,
                title: uniqueName('Mention Test Wiki'),
            });

            const pageContent = {
                type: 'doc' as const,
                content: [{type: 'paragraph', content: [{type: 'text', text: 'Text for inline comment testing.'}]}],
            };
            const testPage = await pw.createPageViaDraft(adminClient, wiki.id, 'Mention Test Page', pageContent);

            // # Login and navigate to page
            const {page} = await pw.testBrowser.login(user);
            const pageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, testPage.id);
            await page.goto(pageUrl);
            await page.waitForLoadState('networkidle');

            // # Click Edit button to enter edit mode
            const editButton = page.getByRole('button', {name: 'Edit'});
            await expect(editButton).toBeVisible({timeout: HIERARCHY_TIMEOUT});
            await editButton.click();

            // # Select text and open RHS
            await page.waitForSelector('[data-testid="wiki-page-editor"]', {state: 'visible', timeout: HIERARCHY_TIMEOUT});
            const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
            await expect(editor).toBeVisible();
            const paragraph = editor.locator('p').first();
            await paragraph.click({clickCount: 3});

            // # Click Add Comment button
            const addCommentButton = page.locator('[data-testid="inline-comment-submit"]');
            await expect(addCommentButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
            await addCommentButton.click();

            // * Verify CreateComment component is rendered (standard message input)
            const createComment = page.locator('[data-testid="comment-create"]');
            await expect(createComment).toBeVisible({timeout: ELEMENT_TIMEOUT});
        },
    );

    /**
     * @objective Verify submitting a comment creates a thread and displays it in the RHS
     *
     * @precondition User has edit permissions on the page
     */
    test('Submitting comment should create thread and show in RHS', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;

        // # Get channel
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # Create wiki
        const wiki = await adminClient.createWiki({
            channel_id: channel.id,
            title: uniqueName('Submit Comment Wiki'),
        });

        const pageContent = {
            type: 'doc' as const,
            content: [{type: 'paragraph', content: [{type: 'text', text: 'Content for comment submission test.'}]}],
        };
        const testPage = await pw.createPageViaDraft(adminClient, wiki.id, 'Submit Comment Page', pageContent);

        // # Login and navigate to page
        const {page} = await pw.testBrowser.login(user);
        const pageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, testPage.id);
        await page.goto(pageUrl);
        await page.waitForLoadState('networkidle');

        // # Click Edit button to enter edit mode
        const editButton = page.getByRole('button', {name: 'Edit'});
        await expect(editButton).toBeVisible({timeout: HIERARCHY_TIMEOUT});
        await editButton.click();

        // # Select text and open RHS
        await page.waitForSelector('[data-testid="wiki-page-editor"]', {state: 'visible', timeout: HIERARCHY_TIMEOUT});
        const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
        await expect(editor).toBeVisible();
        const paragraph = editor.locator('p').first();
        await paragraph.click({clickCount: 3});

        // # Click Add Comment button
        const addCommentButton = page.locator('[data-testid="inline-comment-submit"]');
        await expect(addCommentButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await addCommentButton.click();

        // # Wait for create comment input
        const createComment = page.locator('[data-testid="comment-create"]');
        await expect(createComment).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Type a comment message
        const textArea = createComment.locator('textarea, [contenteditable="true"]').first();
        await textArea.fill('This is my test inline comment');

        // # Submit the comment (Ctrl+Enter or click send button)
        await textArea.press('Control+Enter');

        // * Wait for thread view to appear (after comment is created)
        // * The RHS should switch to showing the thread
        const threadViewer = page.locator('.WikiPageThreadViewer');
        await expect(threadViewer).toBeVisible({timeout: HIERARCHY_TIMEOUT});

        // * Verify the comment text appears in the thread
        await expect(page.getByText('This is my test inline comment')).toBeVisible({timeout: ELEMENT_TIMEOUT});
    });

    /**
     * @objective Verify that clicking cancel/back button closes the new comment view
     *
     * @precondition User has opened the new comment view
     */
    test('Cancel button should close new comment view', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;

        // # Get channel
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # Create wiki
        const wiki = await adminClient.createWiki({
            channel_id: channel.id,
            title: uniqueName('Cancel Comment Wiki'),
        });

        const pageContent = {
            type: 'doc' as const,
            content: [{type: 'paragraph', content: [{type: 'text', text: 'Content for cancel test.'}]}],
        };
        const testPage = await pw.createPageViaDraft(adminClient, wiki.id, 'Cancel Comment Page', pageContent);

        // # Login and navigate to page
        const {page} = await pw.testBrowser.login(user);
        const pageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, testPage.id);
        await page.goto(pageUrl);
        await page.waitForLoadState('networkidle');

        // # Click Edit button to enter edit mode
        const editButton = page.getByRole('button', {name: 'Edit'});
        await expect(editButton).toBeVisible({timeout: HIERARCHY_TIMEOUT});
        await editButton.click();

        // # Select text and open RHS
        await page.waitForSelector('[data-testid="wiki-page-editor"]', {state: 'visible', timeout: HIERARCHY_TIMEOUT});
        const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
        await expect(editor).toBeVisible();
        const paragraph = editor.locator('p').first();
        await paragraph.click({clickCount: 3});

        // # Click Add Comment button
        const addCommentButton = page.locator('[data-testid="inline-comment-submit"]');
        await expect(addCommentButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await addCommentButton.click();

        // * Verify new comment view is open
        const newCommentView = page.locator('.WikiNewCommentView');
        await expect(newCommentView).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Click the back button (cancel)
        const backButton = page.locator('[data-testid="wiki-rhs-back-button"]');
        await backButton.click();

        // * Verify new comment view is closed
        await expect(newCommentView).not.toBeVisible({timeout: MODAL_CLOSE_TIMEOUT});
    });

    /**
     * @objective Verify that clicking close button closes the RHS entirely
     *
     * @precondition User has opened the RHS with new comment view
     */
    test('Close button should close RHS entirely', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;

        // # Get channel
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // # Create wiki
        const wiki = await adminClient.createWiki({
            channel_id: channel.id,
            title: uniqueName('Close RHS Wiki'),
        });

        const pageContent = {
            type: 'doc' as const,
            content: [{type: 'paragraph', content: [{type: 'text', text: 'Content for close test.'}]}],
        };
        const testPage = await pw.createPageViaDraft(adminClient, wiki.id, 'Close RHS Page', pageContent);

        // # Login and navigate to page
        const {page} = await pw.testBrowser.login(user);
        const pageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, testPage.id);
        await page.goto(pageUrl);
        await page.waitForLoadState('networkidle');

        // # Click Edit button to enter edit mode
        const editButton = page.getByRole('button', {name: 'Edit'});
        await expect(editButton).toBeVisible({timeout: HIERARCHY_TIMEOUT});
        await editButton.click();

        // # Select text and open RHS
        await page.waitForSelector('[data-testid="wiki-page-editor"]', {state: 'visible', timeout: HIERARCHY_TIMEOUT});
        const editor = page.locator('[data-testid="tiptap-editor-content"] .ProseMirror').first();
        await expect(editor).toBeVisible();
        const paragraph = editor.locator('p').first();
        await paragraph.click({clickCount: 3});

        // # Click Add Comment button
        const addCommentButton = page.locator('[data-testid="inline-comment-submit"]');
        await expect(addCommentButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await addCommentButton.click();

        // * Verify RHS is open
        const wikiRhs = page.locator('[data-testid="wiki-rhs"]');
        await expect(wikiRhs).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Click the close button
        const closeButton = page.locator('[data-testid="wiki-rhs-close-button"]');
        await closeButton.click();

        // * Verify RHS is closed
        await expect(wikiRhs).not.toBeVisible({timeout: MODAL_CLOSE_TIMEOUT});
    });
});
