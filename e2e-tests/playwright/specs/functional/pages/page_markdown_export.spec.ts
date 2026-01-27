// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '../channels/pages/pages_test_fixture';
import {buildWikiPageUrl, openPageActionsMenu, clickPageContextMenuItem} from '../channels/pages/test_helpers';

test.describe('Page Markdown Export', () => {
    test('MM-PAGE-EXPORT-MD-1 Export to Markdown menu item should be visible in page actions', async ({
        pw,
        sharedPagesSetup,
    }) => {
        const {team, user, adminClient} = sharedPagesSetup;

        // Get town-square channel
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // Create a wiki and page
        const wiki = await adminClient.createWiki({
            channel_id: channel.id,
            title: `MD Export Test Wiki ${Date.now()}`,
        });

        const pageContent = {
            type: 'doc' as const,
            content: [
                {type: 'heading', attrs: {level: 1}, content: [{type: 'text', text: 'Test Page'}]},
                {type: 'paragraph', content: [{type: 'text', text: 'This is test content for markdown export.'}]},
            ],
        };
        const testPage = await pw.createPageViaDraft(adminClient, wiki.id, 'Export Test Page', pageContent);

        // Login and navigate to the page
        const {page} = await pw.testBrowser.login(user);
        const pageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, testPage.id);
        await page.goto(pageUrl);
        await page.waitForLoadState('networkidle');

        // Open the page actions menu
        await openPageActionsMenu(page);

        // Verify Export to Markdown menu item is visible
        const exportMarkdownItem = page.locator('[data-testid="page-context-menu-export-markdown"]');
        await expect(exportMarkdownItem).toBeVisible();
    });

    test('MM-PAGE-EXPORT-MD-2 Export to Markdown should call API and succeed', async ({pw, sharedPagesSetup}) => {
        test.slow();

        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // Create wiki and page with various content
        const wiki = await adminClient.createWiki({
            channel_id: channel.id,
            title: `MD Export Download ${Date.now()}`,
        });

        const pageContent = {
            type: 'doc' as const,
            content: [
                {type: 'heading', attrs: {level: 1}, content: [{type: 'text', text: 'Markdown Export Test'}]},
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
        const testPage = await pw.createPageViaDraft(adminClient, wiki.id, 'Download Test Page', pageContent);

        // Login and navigate
        const {page} = await pw.testBrowser.login(user);
        const pageUrl = buildWikiPageUrl(pw.url, team.name, channel.id, wiki.id, testPage.id);
        await page.goto(pageUrl);
        await page.waitForLoadState('networkidle');

        // Set up network interception to verify API call succeeds
        let apiCallSucceeded = false;
        let apiResponse: {status: number; contentType: string | null} | null = null;

        page.on('response', (response) => {
            if (response.url().includes('/export/markdown')) {
                apiResponse = {
                    status: response.status(),
                    contentType: response.headers()['content-type'],
                };
                if (response.status() === 200) {
                    apiCallSucceeded = true;
                }
            }
        });

        // Open actions menu and click Export to Markdown
        await openPageActionsMenu(page);
        await clickPageContextMenuItem(page, 'export-markdown');

        // Wait for the API call to complete
        await page.waitForTimeout(5000);

        // Verify the API call succeeded
        expect(apiCallSucceeded).toBe(true);
        expect(apiResponse).not.toBeNull();
        expect(apiResponse!.status).toBe(200);
        expect(apiResponse!.contentType).toBe('application/zip');
    });

    test('MM-PAGE-EXPORT-MD-3 Export to Markdown API should return ZIP', async ({pw, sharedPagesSetup}) => {
        const {team, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // Create wiki and page
        const wiki = await adminClient.createWiki({
            channel_id: channel.id,
            title: `MD API Test ${Date.now()}`,
        });

        const pageContent = {
            type: 'doc' as const,
            content: [
                {type: 'heading', attrs: {level: 1}, content: [{type: 'text', text: 'API Test'}]},
                {type: 'paragraph', content: [{type: 'text', text: 'Test content.'}]},
            ],
        };
        const testPage = await pw.createPageViaDraft(adminClient, wiki.id, 'API Test Page', pageContent);

        // Call the export API directly
        const token = adminClient.getToken();
        const response = await fetch(`${adminClient.getWikiPageRoute(wiki.id, testPage.id)}/export/markdown`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                markdown: '# API Test\n\nTest content.',
                filename: 'api-test-page',
                files: [],
            }),
        });

        expect(response.ok, `API Error: ${response.status} ${response.statusText}`).toBe(true);
        expect(response.headers.get('content-type')).toBe('application/zip');

        // Verify we got ZIP content
        const blob = await response.blob();
        expect(blob.size).toBeGreaterThan(0);
    });

    test('MM-PAGE-EXPORT-MD-4 Export to Markdown with image should include image in ZIP', async ({
        pw,
        sharedPagesSetup,
    }) => {
        test.slow();

        const {team, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // Create wiki and page
        const wiki = await adminClient.createWiki({
            channel_id: channel.id,
            title: `MD Image Export ${Date.now()}`,
        });

        // Create a page first
        const initialContent = {
            type: 'doc' as const,
            content: [{type: 'paragraph', content: [{type: 'text', text: 'Page with image attachment.'}]}],
        };
        const testPage = await pw.createPageViaDraft(adminClient, wiki.id, 'Image Export Test Page', initialContent);

        // Upload an image file to the channel
        const imageBase64 =
            'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVQYV2NkYGD4z0AEYBxVSF+FAG7xAbHSBPeEAAAAAElFTkSuQmCC';
        const imageBuffer = Buffer.from(imageBase64, 'base64');
        const imageName = 'test-export-image.png';

        const formData = new FormData();
        formData.set('channel_id', channel.id);
        formData.set('client_ids', await pw.random.id());
        formData.set('files', new Blob([imageBuffer], {type: 'image/png'}), imageName);

        const uploadResponse = await adminClient.uploadFile(formData);
        expect(uploadResponse.file_infos.length).toBe(1);
        const fileId = uploadResponse.file_infos[0].id;

        // Attach the file to the page
        await adminClient.patchPost({id: testPage.id, file_ids: [fileId]});

        // Verify file is attached
        const pageWithFile = await adminClient.getPage(wiki.id, testPage.id);
        expect(pageWithFile.file_ids).toContain(fileId);

        // Call the export API with the file reference using original filename
        const token = adminClient.getToken();
        const markdownContent = `# Image Export Test Page

Page with image attachment.

![${imageName}](attachments/${imageName})`;

        const response = await fetch(`${adminClient.getWikiPageRoute(wiki.id, testPage.id)}/export/markdown`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                markdown: markdownContent,
                filename: 'image-export-test-page',
                files: [
                    {
                        file_id: fileId,
                        local_path: `attachments/${imageName}`,
                    },
                ],
            }),
        });

        expect(response.ok, `API Error: ${response.status} ${response.statusText}`).toBe(true);
        expect(response.headers.get('content-type')).toBe('application/zip');

        // Get the ZIP content as ArrayBuffer
        const zipData = await response.arrayBuffer();
        const zipBytes = new Uint8Array(zipData);

        // Verify ZIP magic bytes (PK\x03\x04)
        expect(zipBytes[0]).toBe(0x50); // P
        expect(zipBytes[1]).toBe(0x4b); // K

        // Convert to string to search for file names in the ZIP central directory
        const decoder = new TextDecoder('utf-8', {fatal: false});
        const zipString = decoder.decode(zipBytes);

        // Verify the ZIP contains the markdown file
        expect(zipString).toContain('image-export-test-page.md');

        // Verify the ZIP contains the attachments directory with the original image filename
        expect(zipString).toContain(`attachments/${imageName}`);
    });

    test('MM-PAGE-EXPORT-MD-5 Export to Markdown with multiple files should include all files in ZIP', async ({
        pw,
        sharedPagesSetup,
    }) => {
        test.slow();

        const {team, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // Create wiki and page
        const wiki = await adminClient.createWiki({
            channel_id: channel.id,
            title: `MD Multi-File Export ${Date.now()}`,
        });

        const initialContent = {
            type: 'doc' as const,
            content: [{type: 'paragraph', content: [{type: 'text', text: 'Page with multiple file attachments.'}]}],
        };
        const testPage = await pw.createPageViaDraft(
            adminClient,
            wiki.id,
            'Multi-File Export Test Page',
            initialContent,
        );

        // Upload first image
        const image1Base64 =
            'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVQYV2NkYGD4z0AEYBxVSF+FAG7xAbHSBPeEAAAAAElFTkSuQmCC';
        const image1Buffer = Buffer.from(image1Base64, 'base64');

        const formData1 = new FormData();
        formData1.set('channel_id', channel.id);
        formData1.set('client_ids', await pw.random.id());
        formData1.set('files', new Blob([image1Buffer], {type: 'image/png'}), 'first-image.png');

        const upload1 = await adminClient.uploadFile(formData1);
        const fileId1 = upload1.file_infos[0].id;

        // Upload second file (PDF)
        const pdfContent =
            '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF';
        const pdfBuffer = Buffer.from(pdfContent);

        const formData2 = new FormData();
        formData2.set('channel_id', channel.id);
        formData2.set('client_ids', await pw.random.id());
        formData2.set('files', new Blob([pdfBuffer], {type: 'application/pdf'}), 'document.pdf');

        const upload2 = await adminClient.uploadFile(formData2);
        const fileId2 = upload2.file_infos[0].id;

        // Attach both files to the page
        await adminClient.patchPost({id: testPage.id, file_ids: [fileId1, fileId2]});

        // Verify files are attached
        const pageWithFiles = await adminClient.getPage(wiki.id, testPage.id);
        expect(pageWithFiles.file_ids).toContain(fileId1);
        expect(pageWithFiles.file_ids).toContain(fileId2);

        // Call the export API with both file references using original filenames
        const token = adminClient.getToken();
        const image1Name = 'first-image.png';
        const pdfName = 'document.pdf';
        const markdownContent = `# Multi-File Export Test Page

Page with multiple file attachments.

![${image1Name}](attachments/${image1Name})

[${pdfName}](attachments/${pdfName})`;

        const response = await fetch(`${adminClient.getWikiPageRoute(wiki.id, testPage.id)}/export/markdown`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                markdown: markdownContent,
                filename: 'multi-file-export-test',
                files: [
                    {
                        file_id: fileId1,
                        local_path: `attachments/${image1Name}`,
                    },
                    {
                        file_id: fileId2,
                        local_path: `attachments/${pdfName}`,
                    },
                ],
            }),
        });

        expect(response.ok, `API Error: ${response.status} ${response.statusText}`).toBe(true);
        expect(response.headers.get('content-type')).toBe('application/zip');

        // Get the ZIP content
        const zipData = await response.arrayBuffer();
        const zipBytes = new Uint8Array(zipData);

        // Verify ZIP magic bytes
        expect(zipBytes[0]).toBe(0x50); // P
        expect(zipBytes[1]).toBe(0x4b); // K

        // Convert to string to search for file names
        const decoder = new TextDecoder('utf-8', {fatal: false});
        const zipString = decoder.decode(zipBytes);

        // Verify the ZIP contains the markdown file
        expect(zipString).toContain('multi-file-export-test.md');

        // Verify the ZIP contains both attachments with original filenames
        expect(zipString).toContain(`attachments/${image1Name}`);
        expect(zipString).toContain(`attachments/${pdfName}`);
    });
});
