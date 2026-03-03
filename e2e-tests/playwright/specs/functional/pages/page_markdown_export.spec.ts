// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '../channels/pages/pages_test_fixture';
import {buildWikiPageUrl, openPageActionsMenu, clickPageContextMenuItem} from '../channels/pages/test_helpers';

test.describe('Page Copy as Markdown', () => {
    test('MM-PAGE-COPY-MD-1 Copy as Markdown menu item should be visible in page actions', async ({
        pw,
        sharedPagesSetup,
    }) => {
        const {team, user, adminClient} = sharedPagesSetup;

        // Get town-square channel
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // Create a wiki and page
        const wiki = await adminClient.createWiki({
            channel_id: channel.id,
            title: `MD Copy Test Wiki ${Date.now()}`,
        });

        const pageContent = {
            type: 'doc' as const,
            content: [
                {type: 'heading', attrs: {level: 1}, content: [{type: 'text', text: 'Test Page'}]},
                {type: 'paragraph', content: [{type: 'text', text: 'This is test content for markdown copy.'}]},
            ],
        };
        const testPage = await pw.createPageViaDraft(adminClient, wiki.id, 'Copy Test Page', pageContent);

        // Login and navigate to the page
        const {page} = await pw.testBrowser.login(user);
        const pageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, testPage.id);
        await page.goto(pageUrl);
        await page.waitForLoadState('networkidle');

        // Open the page actions menu
        await openPageActionsMenu(page);

        // Verify Copy as Markdown menu item is visible
        const copyMarkdownItem = page.locator('[data-testid="page-context-menu-copy-markdown"]');
        await expect(copyMarkdownItem).toBeVisible();
    });

    test('MM-PAGE-COPY-MD-2 Copy as Markdown should copy content to clipboard', async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // Create wiki and page with various content
        const wiki = await adminClient.createWiki({
            channel_id: channel.id,
            title: `MD Copy Clipboard ${Date.now()}`,
        });

        const pageContent = {
            type: 'doc' as const,
            content: [
                {type: 'heading', attrs: {level: 1}, content: [{type: 'text', text: 'Markdown Copy Test'}]},
                {
                    type: 'paragraph',
                    content: [
                        {type: 'text', marks: [{type: 'bold'}], text: 'bold'},
                        {type: 'text', text: ' and '},
                        {type: 'text', marks: [{type: 'italic'}], text: 'italic'},
                        {type: 'text', text: ' text.'},
                    ],
                },
                {
                    type: 'bulletList',
                    content: [
                        {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'Item 1'}]}]},
                        {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'Item 2'}]}]},
                    ],
                },
            ],
        };
        const testPage = await pw.createPageViaDraft(adminClient, wiki.id, 'Clipboard Test Page', pageContent);

        // Login and navigate
        const {page} = await pw.testBrowser.login(user);

        // Grant clipboard permissions
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

        const pageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, testPage.id);
        await page.goto(pageUrl);
        await page.waitForLoadState('networkidle');

        // Open actions menu and click Copy as Markdown
        await openPageActionsMenu(page);
        await clickPageContextMenuItem(page, 'copy-markdown');

        // Wait for the copy to complete
        await page.waitForTimeout(500);

        // Read clipboard content
        const clipboardContent = await page.evaluate(async () => {
            return navigator.clipboard.readText();
        });

        // Verify the markdown content
        expect(clipboardContent).toContain('# Clipboard Test Page');
        expect(clipboardContent).toContain('**bold**');
        expect(clipboardContent).toContain('*italic*');
        expect(clipboardContent).toContain('- Item 1');
        expect(clipboardContent).toContain('- Item 2');
    });

    test('MM-PAGE-COPY-MD-4 Copy as Markdown with image should preserve file URLs', async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // Create wiki and page
        const wiki = await adminClient.createWiki({
            channel_id: channel.id,
            title: `MD Image Copy ${Date.now()}`,
        });

        // Upload an image file to the channel first
        const imageBase64 =
            'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVQYV2NkYGD4z0AEYBxVSF+FAG7xAbHSBPeEAAAAAElFTkSuQmCC';
        const imageBuffer = Buffer.from(imageBase64, 'base64');
        const imageName = 'test-copy-image.png';

        const formData = new FormData();
        formData.set('channel_id', channel.id);
        formData.set('client_ids', await pw.random.id());
        formData.set('files', new Blob([imageBuffer], {type: 'image/png'}), imageName);

        const uploadResponse = await adminClient.uploadFile(formData);
        expect(uploadResponse.file_infos.length).toBe(1);
        const fileId = uploadResponse.file_infos[0].id;

        // Create page with image content that references the uploaded file
        const contentWithImage = {
            type: 'doc' as const,
            content: [
                {type: 'paragraph', content: [{type: 'text', text: 'Page with image.'}]},
                {
                    type: 'paragraph',
                    content: [
                        {
                            type: 'image',
                            attrs: {
                                src: `/api/v4/files/${fileId}`,
                                alt: imageName,
                                filename: imageName,
                            },
                        },
                    ],
                },
            ],
        };
        const testPage = await pw.createPageViaDraft(adminClient, wiki.id, 'Image Copy Test Page', contentWithImage);

        // Attach the file to the page
        await adminClient.patchPost({id: testPage.id, file_ids: [fileId]});

        // Login and navigate
        const {page} = await pw.testBrowser.login(user);
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

        const pageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, testPage.id);
        await page.goto(pageUrl);
        await page.waitForLoadState('networkidle');

        // Open actions menu and click Copy as Markdown
        await openPageActionsMenu(page);
        await clickPageContextMenuItem(page, 'copy-markdown');

        // Wait for the copy to complete
        await page.waitForTimeout(500);

        // Read clipboard content
        const clipboardContent = await page.evaluate(async () => {
            return navigator.clipboard.readText();
        });

        // Verify the markdown contains the preserved file URL (not attachments/ path)
        expect(clipboardContent).toContain(`/api/v4/files/${fileId}`);
        expect(clipboardContent).not.toContain('attachments/');
    });
});
