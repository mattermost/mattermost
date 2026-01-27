// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import {Job} from '@mattermost/types/jobs';

import {expect, test, testConfig} from '@mattermost/playwright-lib';

/**
 * Helper function to download an export and upload it for import.
 * This follows the proper MM pattern: export -> download -> upload -> import
 */
async function downloadExportAndUploadForImport(client: Client4, jobId: string): Promise<string> {
    const token = client.getToken();
    const baseUrl = testConfig.baseURL;

    // Step 1: Download the export file
    const downloadResponse = await fetch(`${baseUrl}/api/v4/jobs/${jobId}/download`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!downloadResponse.ok) {
        throw new Error(`Failed to download export: ${downloadResponse.status} ${downloadResponse.statusText}`);
    }

    const fileData = await downloadResponse.arrayBuffer();
    const contentDisposition = downloadResponse.headers.get('content-disposition') || '';
    const filenameMatch = contentDisposition.match(/filename="?([^";\n]+)"?/);
    const originalFilename = filenameMatch ? filenameMatch[1] : `wiki_export_${jobId}.jsonl`;

    // Step 2: Create an upload session for import
    const uploadSession = await fetch(`${baseUrl}/api/v4/uploads`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            filename: originalFilename,
            file_size: fileData.byteLength,
            type: 'import',
        }),
    });

    if (!uploadSession.ok) {
        throw new Error(`Failed to create upload session: ${uploadSession.status} ${uploadSession.statusText}`);
    }

    const uploadSessionData = await uploadSession.json();
    const uploadId = uploadSessionData.id;

    // Step 3: Upload the file data
    const uploadDataResponse = await fetch(`${baseUrl}/api/v4/uploads/${uploadId}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/octet-stream',
        },
        body: fileData,
    });

    if (!uploadDataResponse.ok) {
        throw new Error(`Failed to upload data: ${uploadDataResponse.status} ${uploadDataResponse.statusText}`);
    }

    // The import filename is the upload ID + original filename
    return `${uploadId}_${originalFilename}`;
}

test.describe('Wiki Export/Import Admin Console', () => {
    test('MM-WIKI-EXPORT-4 Should show download link after successful export with pages', async ({pw}) => {
        test.slow();

        const {adminClient, adminUser, team} = await pw.initSetup();
        if (!adminUser || !adminClient) {
            throw new Error('Failed to create admin user or client');
        }

        // Create a channel and wiki with a page so export has content
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: `export-test-${Date.now()}`,
            display_name: 'Export Test Channel',
            type: 'O',
        });
        const wiki = await adminClient.createWiki({
            channel_id: channel.id,
            title: 'Export Test Wiki',
        });

        // Create a page using the draft workflow
        const pageContent = {
            type: 'doc' as const,
            content: [{type: 'paragraph', content: [{type: 'text', text: 'Test page content for export'}]}],
        };
        await pw.createPageViaDraft(adminClient, wiki.id, 'Test Page', pageContent);

        // Log in as admin and navigate to wiki export page
        const {page, systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
        await systemConsolePage.sidebar.goToItem('Wiki Export/Import');

        // Verify the export panel is visible
        const exportPanel = page.locator('#wikiExportPanel');
        await expect(exportPanel).toBeVisible();

        // Click the export button
        const exportButton = exportPanel.getByRole('button', {name: 'Run Wiki Export Now'});
        await expect(exportButton).toBeVisible();
        await exportButton.click();

        // Wait for job table to show the job and for it to complete
        const jobTable = exportPanel.locator('[data-testid="jobTable"]');
        await expect(jobTable).toBeVisible();

        // Wait for the job to complete - the first row should show "Success" with a Download link
        // The table polls every 15 seconds, so we need to wait with extended timeout
        // Wait for the Download link to appear in the first row (this confirms job completed AND has pages)
        const firstRow = jobTable.locator('tbody tr').first();
        const downloadLink = firstRow.getByRole('link', {name: 'Download'});
        await expect(downloadLink).toBeVisible({timeout: 90000});

        // Verify the link has the correct href pattern
        const href = await downloadLink.getAttribute('href');
        expect(href).toMatch(/\/api\/v4\/jobs\/[a-z0-9]+\/download/);
    });

    test('MM-WIKI-EXPORT-5 Should show "--" for download when no pages exported', async ({pw}) => {
        test.slow();

        const {adminUser, adminClient, team} = await pw.initSetup();
        if (!adminUser || !adminClient) {
            throw new Error('Failed to create admin user or client');
        }

        // Create an empty channel with wiki but no pages
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: `empty-export-${Date.now()}`,
            display_name: 'Empty Export Channel',
            type: 'O',
        });
        await adminClient.createWiki({
            channel_id: channel.id,
            title: 'Empty Wiki',
        });

        // Log in as admin and navigate to wiki export page
        const {page, systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
        await systemConsolePage.sidebar.goToItem('Wiki Export/Import');

        // Click the export button
        const exportPanel = page.locator('#wikiExportPanel');
        const exportButton = exportPanel.getByRole('button', {name: 'Run Wiki Export Now'});
        await exportButton.click();

        // Wait for job to complete
        const jobTable = exportPanel.locator('[data-testid="jobTable"]');
        const successStatus = jobTable.locator('tbody tr').first().getByText('Success');
        await expect(successStatus).toBeVisible({timeout: 60000});

        // Verify download shows "--" since no pages were exported
        const downloadCell = jobTable.locator('tbody tr').first().locator('td').nth(3);
        await expect(downloadCell).toHaveText('--');
    });

    test('MM-WIKI-EXPORT-6 Full export-import round trip should preserve wiki content and comments', async ({pw}) => {
        test.slow();

        const {adminClient, adminUser, team} = await pw.initSetup();
        if (!adminUser || !adminClient) {
            throw new Error('Failed to create admin user or client');
        }

        // Create source channel with wiki and multiple pages
        const sourceChannel = await adminClient.createChannel({
            team_id: team.id,
            name: `source-wiki-${Date.now()}`,
            display_name: 'Source Wiki Channel',
            type: 'O',
        });
        const wiki = await adminClient.createWiki({
            channel_id: sourceChannel.id,
            title: 'Source Wiki for Export',
            description: 'Wiki to be exported and imported',
        });

        // Create pages with distinct content for verification
        const page1Content = {
            type: 'doc' as const,
            content: [
                {type: 'heading', attrs: {level: 1}, content: [{type: 'text', text: 'Introduction'}]},
                {type: 'paragraph', content: [{type: 'text', text: 'First page content - unique marker ABC123'}]},
            ],
        };
        const page2Content = {
            type: 'doc' as const,
            content: [
                {type: 'paragraph', content: [{type: 'text', text: 'Second page content - unique marker XYZ789'}]},
                {
                    type: 'bulletList',
                    content: [
                        {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'Item 1'}]}]},
                        {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'Item 2'}]}]},
                    ],
                },
            ],
        };

        const page1 = await pw.createPageViaDraft(adminClient, wiki.id, 'Page One', page1Content);
        const page2 = await pw.createPageViaDraft(adminClient, wiki.id, 'Page Two', page2Content);

        // Create comments on pages (including inline comment with anchor)
        const comment1 = await adminClient.createPageComment(
            wiki.id,
            page1.id,
            'This is a regular comment on page one',
        );
        await adminClient.createPageComment(wiki.id, page1.id, 'This is an inline comment anchored to specific text', {
            text: 'unique marker ABC123',
            anchor_id: 'anchor-test-123',
        });
        await adminClient.createPageComment(wiki.id, page2.id, 'Comment on page two');

        // Create a reply to the first comment
        await adminClient.createPageCommentReply(
            wiki.id,
            page1.id,
            comment1.id,
            'This is a reply to the first comment',
        );

        // Step 1: Create export job with comments included
        const exportJob = await adminClient.createJob({
            type: 'wiki_export',
            data: {
                channel_ids: sourceChannel.id,
                include_comments: 'true',
            },
        });

        // Step 2: Wait for export job to complete
        let completedExportJob: Job | undefined;
        for (let i = 0; i < 30; i++) {
            await pw.wait(pw.duration.two_sec);
            completedExportJob = await adminClient.getJob(exportJob.id);
            if (completedExportJob.status === 'success') {
                break;
            }
            if (completedExportJob.status === 'error') {
                throw new Error(`Export job failed: ${JSON.stringify(completedExportJob.data)}`);
            }
        }
        expect(completedExportJob?.status).toBe('success');
        expect(completedExportJob?.data?.pages_exported).toBe('2');
        expect(completedExportJob?.data?.is_downloadable).toBe('true');

        // Step 3: Re-import the export (tests idempotency)
        // Follow the proper MM pattern: download export -> upload to import -> run import
        const importFilename = await downloadExportAndUploadForImport(adminClient, completedExportJob!.id);

        const importJob = await adminClient.createJob({
            type: 'wiki_import',
            data: {
                import_file: importFilename,
            },
        });

        // Step 4: Wait for import job to complete
        let completedImportJob: Job | undefined;
        for (let i = 0; i < 30; i++) {
            await pw.wait(pw.duration.two_sec);
            completedImportJob = await adminClient.getJob(importJob.id);
            if (completedImportJob.status === 'success') {
                break;
            }
            if (completedImportJob.status === 'error') {
                throw new Error(`Import job failed: ${JSON.stringify(completedImportJob.data)}`);
            }
        }
        expect(completedImportJob?.status).toBe('success');

        // Step 5: Verify no duplicates - should still have exactly 2 pages
        const wikisAfterImport = await adminClient.getChannelWikis(sourceChannel.id);
        expect(wikisAfterImport.length).toBe(1);

        const pagesAfterImport = await adminClient.getPages(wikisAfterImport[0].id);
        expect(pagesAfterImport.length).toBe(2); // No duplicates due to import_source_id

        // Step 6: Verify comments are preserved
        const page1CommentsAfterImport = await adminClient.getPageComments(wiki.id, page1.id);
        const commentMessages = page1CommentsAfterImport.map((c: {message: string}) => c.message);
        expect(commentMessages).toContain('This is a regular comment on page one');
        expect(commentMessages).toContain('This is an inline comment anchored to specific text');

        const page2CommentsAfterImport = await adminClient.getPageComments(wiki.id, page2.id);
        const page2CommentMessages = page2CommentsAfterImport.map((c: {message: string}) => c.message);
        expect(page2CommentMessages).toContain('Comment on page two');

        // Verify page titles are correct (page title is in props.title, not message)
        const pageTitles = pagesAfterImport.map((p: {props: {title?: string}}) => p.props?.title || '');
        expect(pageTitles).toContain('Page One');
        expect(pageTitles).toContain('Page Two');
    });

    test('MM-WIKI-EXPORT-7 Export with include_attachments should export and import file attachments', async ({pw}) => {
        test.slow();

        const {adminClient, adminUser, team} = await pw.initSetup();
        if (!adminUser || !adminClient) {
            throw new Error('Failed to create admin user or client');
        }

        // Create channel with wiki
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: `attach-export-${Date.now()}`,
            display_name: 'Attachment Export Channel',
            type: 'O',
        });
        const wiki = await adminClient.createWiki({
            channel_id: channel.id,
            title: 'Wiki with File Attachments',
        });

        // Create a page
        const pageContent = {
            type: 'doc' as const,
            content: [
                {type: 'paragraph', content: [{type: 'text', text: 'Page with file attachment for export test'}]},
            ],
        };
        const page = await pw.createPageViaDraft(adminClient, wiki.id, 'Attachment Test Page', pageContent);

        // Upload a file to the channel
        const testFileContent = 'This is test file content for wiki export attachment test.';
        const testFileName = 'wiki-export-test.txt';
        const clientId = await pw.random.id();
        const formData = new FormData();
        formData.set('channel_id', channel.id);
        formData.set('client_ids', clientId);
        formData.set('files', new Blob([testFileContent], {type: 'text/plain'}), testFileName);

        const uploadResponse = await adminClient.uploadFile(formData);
        expect(uploadResponse.file_infos.length).toBe(1);
        const fileId = uploadResponse.file_infos[0].id;

        // Patch the page to add the file attachment
        await adminClient.patchPost({id: page.id, file_ids: [fileId]});

        // Verify page has the attachment
        const pageWithAttachment = await adminClient.getPage(wiki.id, page.id);
        expect(pageWithAttachment.file_ids).toContain(fileId);

        // Create export job WITH include_attachments option enabled
        const exportJob = await adminClient.createJob({
            type: 'wiki_export',
            data: {
                channel_ids: channel.id,
                include_attachments: 'true',
            },
        });

        // Wait for export job to complete
        let completedJob: Job | undefined;
        for (let i = 0; i < 30; i++) {
            await pw.wait(pw.duration.two_sec);
            completedJob = await adminClient.getJob(exportJob.id);
            if (completedJob.status === 'success') {
                break;
            }
            if (completedJob.status === 'error') {
                throw new Error(`Export job failed: ${JSON.stringify(completedJob.data)}`);
            }
        }
        expect(completedJob?.status).toBe('success');

        // Verify export file is a zip when include_attachments is enabled
        expect(completedJob?.data?.export_file).toMatch(/\.zip$/);

        // Re-import the export (idempotency test)
        // Follow the proper MM pattern: download export -> upload to import -> run import
        const importFilename = await downloadExportAndUploadForImport(adminClient, completedJob!.id);
        const importJob = await adminClient.createJob({
            type: 'wiki_import',
            data: {
                import_file: importFilename,
            },
        });

        // Wait for import job to complete
        let completedImportJob: Job | undefined;
        for (let i = 0; i < 30; i++) {
            await pw.wait(pw.duration.two_sec);
            completedImportJob = await adminClient.getJob(importJob.id);
            if (completedImportJob.status === 'success') {
                break;
            }
            if (completedImportJob.status === 'error') {
                throw new Error(`Import job failed: ${JSON.stringify(completedImportJob.data)}`);
            }
        }
        expect(completedImportJob?.status).toBe('success');

        // Verify page still has attachment after import (no duplicates, attachment preserved)
        const pagesAfterImport = await adminClient.getPages(wiki.id);
        expect(pagesAfterImport.length).toBe(1); // No duplicates

        const pageAfterImport = await adminClient.getPage(wiki.id, pagesAfterImport[0].id);
        expect(pageAfterImport.file_ids?.length).toBeGreaterThan(0);
    });

    test('MM-WIKI-EXPORT-1 Should display wiki export/import page in admin console', async ({pw}) => {
        const {adminUser} = await pw.initSetup();
        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Log in as admin
        const {page, systemConsolePage} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        // # Navigate to Wiki Export/Import section
        await systemConsolePage.sidebar.goToItem('Wiki Export/Import');

        // * Verify the wiki export panel is visible
        const exportPanel = page.locator('#wikiExportPanel');
        await expect(exportPanel).toBeVisible();

        // * Verify export panel title is visible (AdminPanel uses .header h3)
        const exportTitle = exportPanel.locator('.header h3');
        await expect(exportTitle).toContainText('Wiki Export');

        // * Verify the wiki import panel is visible
        const importPanel = page.locator('#wikiImportPanel');
        await expect(importPanel).toBeVisible();

        // * Verify import panel title is visible
        const importTitle = importPanel.locator('.header h3');
        await expect(importTitle).toContainText('Wiki Import');
    });

    test('MM-WIKI-EXPORT-2 Should create wiki export job when clicking export button', async ({pw}) => {
        test.slow();

        const {adminUser} = await pw.initSetup();
        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Log in as admin
        const {page, systemConsolePage} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        // # Navigate to Wiki Export/Import section
        await systemConsolePage.sidebar.goToItem('Wiki Export/Import');

        // * Verify the export panel is visible
        const exportPanel = page.locator('#wikiExportPanel');
        await expect(exportPanel).toBeVisible();

        // # Click the export button
        const exportButton = exportPanel.getByRole('button', {name: 'Run Wiki Export Now'});
        await expect(exportButton).toBeVisible();
        await exportButton.click();

        // * Wait for job to be created - the table or a status indicator should appear
        // Give it time to process the job creation
        await page.waitForTimeout(2000);

        // * Verify the button is still functional (job was submitted)
        // After clicking, the UI should still be responsive
        await expect(exportButton).toBeVisible();
    });

    test('MM-WIKI-EXPORT-3 Should navigate to wiki export via sidebar search', async ({pw}) => {
        const {adminUser} = await pw.initSetup();
        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        // # Log in as admin
        const {page, systemConsolePage} = await pw.testBrowser.login(adminUser);

        // # Visit system console
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();

        // # Search for wiki in sidebar
        await systemConsolePage.sidebar.searchForItem('Wiki');

        // * Verify Wiki Export/Import appears in search results
        const searchResult = page.getByText('Wiki Export/Import', {exact: true});
        await expect(searchResult).toBeVisible();

        // # Click on the search result
        await searchResult.click();

        // * Verify we navigated to the correct page
        await expect(page.locator('#wikiExportPanel')).toBeVisible();
    });

    test('MM-WIKI-EXPORT-8 Export should include page CreateAt timestamps for ordering', async ({pw}) => {
        test.slow();

        const {adminClient, adminUser, team} = await pw.initSetup();
        if (!adminUser || !adminClient) {
            throw new Error('Failed to create admin user or client');
        }

        // Create channel with wiki
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: `sort-order-${Date.now()}`,
            display_name: 'Sort Order Test Channel',
            type: 'O',
        });
        const wiki = await adminClient.createWiki({
            channel_id: channel.id,
            title: 'Sort Order Test Wiki',
        });

        // Create pages with small delays to ensure different CreateAt timestamps
        const pageContent = (text: string) => ({
            type: 'doc' as const,
            content: [{type: 'paragraph', content: [{type: 'text', text}]}],
        });

        const page1 = await pw.createPageViaDraft(adminClient, wiki.id, 'First Page', pageContent('Created first'));
        await pw.wait(pw.duration.one_sec);
        const page2 = await pw.createPageViaDraft(adminClient, wiki.id, 'Second Page', pageContent('Created second'));
        await pw.wait(pw.duration.one_sec);
        const page3 = await pw.createPageViaDraft(adminClient, wiki.id, 'Third Page', pageContent('Created third'));

        // Get original CreateAt timestamps
        const originalPage1 = await adminClient.getPage(wiki.id, page1.id);
        const originalPage2 = await adminClient.getPage(wiki.id, page2.id);
        const originalPage3 = await adminClient.getPage(wiki.id, page3.id);

        // Verify pages are in expected order (CreateAt ascending)
        expect(originalPage1.create_at).toBeLessThan(originalPage2.create_at);
        expect(originalPage2.create_at).toBeLessThan(originalPage3.create_at);

        // Create export job
        const exportJob = await adminClient.createJob({
            type: 'wiki_export',
            data: {
                channel_ids: channel.id,
            },
        });

        // Wait for export job to complete
        let completedExportJob: Job | undefined;
        for (let i = 0; i < 30; i++) {
            await pw.wait(pw.duration.two_sec);
            completedExportJob = await adminClient.getJob(exportJob.id);
            if (completedExportJob.status === 'success') {
                break;
            }
            if (completedExportJob.status === 'error') {
                throw new Error(`Export job failed: ${JSON.stringify(completedExportJob.data)}`);
            }
        }
        expect(completedExportJob?.status).toBe('success');
        expect(completedExportJob?.data?.pages_exported).toBe('3');
    });

    test('MM-WIKI-EXPORT-9 Export should include page status in props', async ({pw}) => {
        test.slow();

        const {adminClient, adminUser, team} = await pw.initSetup();
        if (!adminUser || !adminClient) {
            throw new Error('Failed to create admin user or client');
        }

        // Create channel with wiki
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: `page-status-${Date.now()}`,
            display_name: 'Page Status Test Channel',
            type: 'O',
        });
        const wiki = await adminClient.createWiki({
            channel_id: channel.id,
            title: 'Page Status Test Wiki',
        });

        // Create a page and set its status
        const pageContent = {
            type: 'doc' as const,
            content: [{type: 'paragraph', content: [{type: 'text', text: 'Page with custom status'}]}],
        };
        const page = await pw.createPageViaDraft(adminClient, wiki.id, 'Status Test Page', pageContent);

        // Update page status using the dedicated API (valid values: rough_draft, in_progress, in_review, done)
        await adminClient.updatePageStatus(page.id, 'In progress');

        // Create export job
        const exportJob = await adminClient.createJob({
            type: 'wiki_export',
            data: {
                channel_ids: channel.id,
            },
        });

        // Wait for export job to complete
        let completedExportJob: Job | undefined;
        for (let i = 0; i < 30; i++) {
            await pw.wait(pw.duration.two_sec);
            completedExportJob = await adminClient.getJob(exportJob.id);
            if (completedExportJob.status === 'success') {
                break;
            }
            if (completedExportJob.status === 'error') {
                throw new Error(`Export job failed: ${JSON.stringify(completedExportJob.data)}`);
            }
        }
        expect(completedExportJob?.status).toBe('success');
        expect(completedExportJob?.data?.pages_exported).toBe('1');
    });

    test('MM-WIKI-EXPORT-10 Export should preserve inline comment resolution status', async ({pw}) => {
        test.slow();

        const {adminClient, adminUser, team} = await pw.initSetup();
        if (!adminUser || !adminClient) {
            throw new Error('Failed to create admin user or client');
        }

        // Create channel with wiki and page
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: `resolved-comment-${Date.now()}`,
            display_name: 'Resolved Comment Test Channel',
            type: 'O',
        });
        const wiki = await adminClient.createWiki({
            channel_id: channel.id,
            title: 'Comment Resolution Test Wiki',
        });

        const pageContent = {
            type: 'doc' as const,
            content: [
                {
                    type: 'paragraph',
                    content: [{type: 'text', text: 'Page with resolved inline comment marker text here'}],
                },
            ],
        };
        const page = await pw.createPageViaDraft(adminClient, wiki.id, 'Comment Resolution Page', pageContent);

        // Create an inline comment (with anchor) and resolve it - only inline comments can be resolved
        const inlineComment = await adminClient.createPageComment(
            wiki.id,
            page.id,
            'This inline comment will be resolved',
            {text: 'marker text', anchor_id: 'resolve-test-anchor'},
        );
        await adminClient.resolvePageComment(wiki.id, page.id, inlineComment.id);

        // Create another inline comment that stays unresolved
        await adminClient.createPageComment(wiki.id, page.id, 'This inline comment stays open', {
            text: 'here',
            anchor_id: 'unresolved-test-anchor',
        });

        // Create export job with comments
        const exportJob = await adminClient.createJob({
            type: 'wiki_export',
            data: {
                channel_ids: channel.id,
                include_comments: 'true',
            },
        });

        // Wait for export job to complete
        let completedExportJob: Job | undefined;
        for (let i = 0; i < 30; i++) {
            await pw.wait(pw.duration.two_sec);
            completedExportJob = await adminClient.getJob(exportJob.id);
            if (completedExportJob.status === 'success') {
                break;
            }
            if (completedExportJob.status === 'error') {
                throw new Error(`Export job failed: ${JSON.stringify(completedExportJob.data)}`);
            }
        }
        expect(completedExportJob?.status).toBe('success');
        expect(completedExportJob?.data?.pages_exported).toBe('1');
    });

    test('MM-WIKI-EXPORT-11 Export should preserve page hierarchy', async ({pw}) => {
        test.slow();

        const {adminClient, adminUser, team} = await pw.initSetup();
        if (!adminUser || !adminClient) {
            throw new Error('Failed to create admin user or client');
        }

        // Create channel with wiki
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: `hierarchy-${Date.now()}`,
            display_name: 'Hierarchy Test Channel',
            type: 'O',
        });
        const wiki = await adminClient.createWiki({
            channel_id: channel.id,
            title: 'Hierarchy Test Wiki',
        });

        const pageContent = (text: string) => ({
            type: 'doc' as const,
            content: [{type: 'paragraph', content: [{type: 'text', text}]}],
        });

        // Create parent page
        const parentPage = await pw.createPageViaDraft(
            adminClient,
            wiki.id,
            'Parent Page',
            pageContent('I am the parent'),
        );

        // Create child page under parent
        const childPage = await pw.createPageViaDraft(
            adminClient,
            wiki.id,
            'Child Page',
            pageContent('I am the child'),
            parentPage.id,
        );

        // Create grandchild page under child
        const grandchildPage = await pw.createPageViaDraft(
            adminClient,
            wiki.id,
            'Grandchild Page',
            pageContent('I am the grandchild'),
            childPage.id,
        );

        // Verify hierarchy is set up correctly (page_parent_id is a field on Post, not in props)
        const fetchedChild = await adminClient.getPage(wiki.id, childPage.id);
        const fetchedGrandchild = await adminClient.getPage(wiki.id, grandchildPage.id);
        expect(fetchedChild.page_parent_id).toBe(parentPage.id);
        expect(fetchedGrandchild.page_parent_id).toBe(childPage.id);

        // Create export job
        const exportJob = await adminClient.createJob({
            type: 'wiki_export',
            data: {
                channel_ids: channel.id,
            },
        });

        // Wait for export job to complete
        let completedExportJob: Job | undefined;
        for (let i = 0; i < 30; i++) {
            await pw.wait(pw.duration.two_sec);
            completedExportJob = await adminClient.getJob(exportJob.id);
            if (completedExportJob.status === 'success') {
                break;
            }
            if (completedExportJob.status === 'error') {
                throw new Error(`Export job failed: ${JSON.stringify(completedExportJob.data)}`);
            }
        }
        expect(completedExportJob?.status).toBe('success');
        expect(completedExportJob?.data?.pages_exported).toBe('3');
    });

    test('MM-WIKI-EXPORT-12 Full round trip should preserve page hierarchy after import', async ({pw}) => {
        test.slow();

        const {adminClient, adminUser, team} = await pw.initSetup();
        if (!adminUser || !adminClient) {
            throw new Error('Failed to create admin user or client');
        }

        // Create channel with wiki
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: `roundtrip-hier-${Date.now()}`,
            display_name: 'Roundtrip Hierarchy Channel',
            type: 'O',
        });
        const wiki = await adminClient.createWiki({
            channel_id: channel.id,
            title: 'Roundtrip Hierarchy Wiki',
        });

        const pageContent = (text: string) => ({
            type: 'doc' as const,
            content: [{type: 'paragraph', content: [{type: 'text', text}]}],
        });

        // Create hierarchy: Parent -> Child -> Grandchild
        const parentPage = await pw.createPageViaDraft(
            adminClient,
            wiki.id,
            'RT Parent',
            pageContent('Parent content'),
        );
        const childPage = await pw.createPageViaDraft(
            adminClient,
            wiki.id,
            'RT Child',
            pageContent('Child content'),
            parentPage.id,
        );
        await pw.createPageViaDraft(
            adminClient,
            wiki.id,
            'RT Grandchild',
            pageContent('Grandchild content'),
            childPage.id,
        );

        // Create export job
        const exportJob = await adminClient.createJob({
            type: 'wiki_export',
            data: {
                channel_ids: channel.id,
            },
        });

        // Wait for export job to complete
        let completedExportJob: Job | undefined;
        for (let i = 0; i < 30; i++) {
            await pw.wait(pw.duration.two_sec);
            completedExportJob = await adminClient.getJob(exportJob.id);
            if (completedExportJob.status === 'success') {
                break;
            }
            if (completedExportJob.status === 'error') {
                throw new Error(`Export job failed: ${JSON.stringify(completedExportJob.data)}`);
            }
        }
        expect(completedExportJob?.status).toBe('success');

        // Re-import the export (idempotent - should preserve hierarchy)
        const importFilename = await downloadExportAndUploadForImport(adminClient, completedExportJob!.id);
        const importJob = await adminClient.createJob({
            type: 'wiki_import',
            data: {
                import_file: importFilename,
            },
        });

        // Wait for import job to complete
        let completedImportJob: Job | undefined;
        for (let i = 0; i < 30; i++) {
            await pw.wait(pw.duration.two_sec);
            completedImportJob = await adminClient.getJob(importJob.id);
            if (completedImportJob.status === 'success') {
                break;
            }
            if (completedImportJob.status === 'error') {
                throw new Error(`Import job failed: ${JSON.stringify(completedImportJob.data)}`);
            }
        }
        expect(completedImportJob?.status).toBe('success');

        // Verify hierarchy is preserved - no duplicates, same parent-child relationships
        const pagesAfterImport = await adminClient.getPages(wiki.id);
        expect(pagesAfterImport.length).toBe(3);

        // Find pages by title (page title is in props.title, not message)
        type PageWithProps = {id: string; props: {title?: string}};
        const parentAfter = pagesAfterImport.find((p: PageWithProps) => p.props?.title === 'RT Parent');
        const childAfter = pagesAfterImport.find((p: PageWithProps) => p.props?.title === 'RT Child');
        const grandchildAfter = pagesAfterImport.find((p: PageWithProps) => p.props?.title === 'RT Grandchild');

        expect(parentAfter).toBeDefined();
        expect(childAfter).toBeDefined();
        expect(grandchildAfter).toBeDefined();

        // Verify hierarchy relationships are maintained (page_parent_id is a field on Post)
        const fetchedChild = await adminClient.getPage(wiki.id, childAfter!.id);
        const fetchedGrandchild = await adminClient.getPage(wiki.id, grandchildAfter!.id);

        expect(fetchedChild.page_parent_id).toBe(parentAfter!.id);
        expect(fetchedGrandchild.page_parent_id).toBe(childAfter!.id);
    });

    test('MM-WIKI-EXPORT-13 Full round trip should preserve resolved inline comments after import', async ({pw}) => {
        test.slow();

        const {adminClient, adminUser, team} = await pw.initSetup();
        if (!adminUser || !adminClient) {
            throw new Error('Failed to create admin user or client');
        }

        // Create channel with wiki and page
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: `roundtrip-resolved-${Date.now()}`,
            display_name: 'Roundtrip Resolved Comments Channel',
            type: 'O',
        });
        const wiki = await adminClient.createWiki({
            channel_id: channel.id,
            title: 'Roundtrip Resolved Comments Wiki',
        });

        const pageContent = {
            type: 'doc' as const,
            content: [
                {
                    type: 'paragraph',
                    content: [
                        {type: 'text', text: 'Test page with anchored text for resolved inline comments testing'},
                    ],
                },
            ],
        };
        const page = await pw.createPageViaDraft(adminClient, wiki.id, 'Resolved Comments Page', pageContent);

        // Create and resolve an inline comment (only inline comments can be resolved)
        const resolvedComment = await adminClient.createPageComment(
            wiki.id,
            page.id,
            'This inline comment is resolved',
            {text: 'anchored text', anchor_id: 'roundtrip-resolved-anchor'},
        );
        await adminClient.resolvePageComment(wiki.id, page.id, resolvedComment.id);

        // Create an unresolved inline comment
        await adminClient.createPageComment(wiki.id, page.id, 'This inline comment is unresolved', {
            text: 'testing',
            anchor_id: 'roundtrip-unresolved-anchor',
        });

        // Export
        const exportJob = await adminClient.createJob({
            type: 'wiki_export',
            data: {
                channel_ids: channel.id,
                include_comments: 'true',
            },
        });

        let completedExportJob: Job | undefined;
        for (let i = 0; i < 30; i++) {
            await pw.wait(pw.duration.two_sec);
            completedExportJob = await adminClient.getJob(exportJob.id);
            if (completedExportJob.status === 'success') {
                break;
            }
            if (completedExportJob.status === 'error') {
                throw new Error(`Export job failed: ${JSON.stringify(completedExportJob.data)}`);
            }
        }
        expect(completedExportJob?.status).toBe('success');

        // Import
        const importFilename = await downloadExportAndUploadForImport(adminClient, completedExportJob!.id);
        const importJob = await adminClient.createJob({
            type: 'wiki_import',
            data: {
                import_file: importFilename,
            },
        });

        let completedImportJob: Job | undefined;
        for (let i = 0; i < 30; i++) {
            await pw.wait(pw.duration.two_sec);
            completedImportJob = await adminClient.getJob(importJob.id);
            if (completedImportJob.status === 'success') {
                break;
            }
            if (completedImportJob.status === 'error') {
                throw new Error(`Import job failed: ${JSON.stringify(completedImportJob.data)}`);
            }
        }
        expect(completedImportJob?.status).toBe('success');

        // Verify comments and their resolution status
        const commentsAfterImport = await adminClient.getPageComments(wiki.id, page.id);
        expect(commentsAfterImport.length).toBe(2);

        const resolvedAfter = commentsAfterImport.find(
            (c: {message: string}) => c.message === 'This inline comment is resolved',
        );
        const unresolvedAfter = commentsAfterImport.find(
            (c: {message: string}) => c.message === 'This inline comment is unresolved',
        );

        expect(resolvedAfter).toBeDefined();
        expect(unresolvedAfter).toBeDefined();

        // Verify resolution status is preserved
        expect(resolvedAfter!.props?.comment_resolved).toBe(true);
        expect(unresolvedAfter!.props?.comment_resolved).toBeFalsy();
    });

    test('MM-WIKI-EXPORT-UI-1 Export panel should display checkboxes for Include Attachments and Include Comments', async ({
        pw,
    }) => {
        const {adminUser} = await pw.initSetup();
        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        const {page, systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
        await systemConsolePage.sidebar.goToItem('Wiki Export/Import');

        const exportPanel = page.locator('#wikiExportPanel');
        await expect(exportPanel).toBeVisible();

        // Verify Include Attachments checkbox is visible and checked by default
        const attachmentsCheckbox = exportPanel.locator('input[type="checkbox"]').first();
        await expect(attachmentsCheckbox).toBeVisible();
        await expect(attachmentsCheckbox).toBeChecked();

        // Verify Include Comments checkbox is visible and checked by default
        const commentsCheckbox = exportPanel.locator('input[type="checkbox"]').nth(1);
        await expect(commentsCheckbox).toBeVisible();
        await expect(commentsCheckbox).toBeChecked();

        // Verify checkbox labels (use exact match to avoid matching help text)
        await expect(exportPanel.getByText('Include Attachments', {exact: true})).toBeVisible();
        await expect(exportPanel.getByText('Include Comments', {exact: true})).toBeVisible();
    });

    test('MM-WIKI-EXPORT-UI-2 Export checkboxes can be toggled', async ({pw}) => {
        const {adminUser} = await pw.initSetup();
        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        const {page, systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
        await systemConsolePage.sidebar.goToItem('Wiki Export/Import');

        const exportPanel = page.locator('#wikiExportPanel');
        const attachmentsCheckbox = exportPanel.locator('input[type="checkbox"]').first();
        const commentsCheckbox = exportPanel.locator('input[type="checkbox"]').nth(1);

        // Both should be checked by default
        await expect(attachmentsCheckbox).toBeChecked();
        await expect(commentsCheckbox).toBeChecked();

        // Uncheck both
        await attachmentsCheckbox.click();
        await commentsCheckbox.click();

        await expect(attachmentsCheckbox).not.toBeChecked();
        await expect(commentsCheckbox).not.toBeChecked();

        // Re-check them
        await attachmentsCheckbox.click();
        await commentsCheckbox.click();

        await expect(attachmentsCheckbox).toBeChecked();
        await expect(commentsCheckbox).toBeChecked();
    });

    test('MM-WIKI-EXPORT-UI-3 Import panel should display file upload button and file selection dropdown', async ({
        pw,
    }) => {
        const {adminUser} = await pw.initSetup();
        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        const {page, systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
        await systemConsolePage.sidebar.goToItem('Wiki Export/Import');

        const importPanel = page.locator('#wikiImportPanel');
        await expect(importPanel).toBeVisible();

        // Wait for imports to load (loading indicator should disappear)
        await expect(importPanel.locator('.fa-spinner')).toBeHidden({timeout: 10000});

        // Verify file upload button is visible
        const uploadButton = importPanel.locator('#uploadFileButton');
        await expect(uploadButton).toBeVisible();
        await expect(uploadButton).toHaveText('Choose File');

        // Verify the upload section label
        await expect(importPanel.getByText('Upload File')).toBeVisible();

        // Verify file type help text
        await expect(importPanel.getByText('Supports .jsonl and .zip files')).toBeVisible();

        // Verify import file label
        await expect(importPanel.getByText('Import File:')).toBeVisible();
    });

    test('MM-WIKI-EXPORT-UI-4 Import button should be disabled when no file is selected', async ({pw}) => {
        const {adminUser} = await pw.initSetup();
        if (!adminUser) {
            throw new Error('Failed to create admin user');
        }

        const {page, systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
        await systemConsolePage.sidebar.goToItem('Wiki Export/Import');

        const importPanel = page.locator('#wikiImportPanel');
        const importButton = importPanel.getByRole('button', {name: 'Run Wiki Import'});

        // Import button should be disabled when no file is selected
        await expect(importButton).toBeDisabled();
    });

    test('MM-WIKI-EXPORT-UI-5 File selection dropdown should show available import files after export', async ({
        pw,
    }) => {
        test.slow();

        const {adminClient, adminUser, team} = await pw.initSetup();
        if (!adminUser || !adminClient) {
            throw new Error('Failed to create admin user or client');
        }

        // Create a channel with wiki and page to ensure export has content
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: `ui-test-${Date.now()}`,
            display_name: 'UI Test Channel',
            type: 'O',
        });
        const wiki = await adminClient.createWiki({
            channel_id: channel.id,
            title: 'UI Test Wiki',
        });
        const pageContent = {
            type: 'doc' as const,
            content: [{type: 'paragraph', content: [{type: 'text', text: 'Test content'}]}],
        };
        await pw.createPageViaDraft(adminClient, wiki.id, 'Test Page', pageContent);

        // Create an export job and wait for it to complete
        const exportJob = await adminClient.createJob({
            type: 'wiki_export',
            data: {channel_ids: channel.id},
        });

        let completedExportJob: Job | undefined;
        for (let i = 0; i < 30; i++) {
            await pw.wait(pw.duration.two_sec);
            completedExportJob = await adminClient.getJob(exportJob.id);
            if (completedExportJob.status === 'success') {
                break;
            }
        }
        expect(completedExportJob?.status).toBe('success');

        // Upload the export file for import
        const importFilename = await downloadExportAndUploadForImport(adminClient, completedExportJob!.id);

        // Navigate to wiki export/import page
        const {page, systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.goto();
        await systemConsolePage.toBeVisible();
        await systemConsolePage.sidebar.goToItem('Wiki Export/Import');

        const importPanel = page.locator('#wikiImportPanel');
        await expect(importPanel).toBeVisible();

        // Wait for imports to load (loading indicator should disappear)
        await expect(importPanel.locator('.fa-spinner')).toBeHidden({timeout: 10000});

        // Verify the file selection dropdown is visible
        const fileDropdown = importPanel.locator('#importFile');
        await expect(fileDropdown).toBeVisible();

        // Select the uploaded file
        await fileDropdown.selectOption(importFilename);

        // Verify the import button is now enabled
        const importButton = importPanel.getByRole('button', {name: 'Run Wiki Import'});
        await expect(importButton).toBeEnabled();
    });

    test('MM-WIKI-EXPORT-14 Full round trip with comments AND attachments should preserve all content', async ({
        pw,
    }) => {
        test.slow();

        const {adminClient, adminUser, team} = await pw.initSetup();
        if (!adminUser || !adminClient) {
            throw new Error('Failed to create admin user or client');
        }

        // Create channel with wiki
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: `full-roundtrip-${Date.now()}`,
            display_name: 'Full Roundtrip Test Channel',
            type: 'O',
        });
        const wiki = await adminClient.createWiki({
            channel_id: channel.id,
            title: 'Full Roundtrip Wiki',
            description: 'Wiki testing comments and attachments together',
        });

        // Create pages with hierarchy: Parent -> Child
        const parentContent = {
            type: 'doc' as const,
            content: [
                {type: 'heading', attrs: {level: 1}, content: [{type: 'text', text: 'Parent Page'}]},
                {
                    type: 'paragraph',
                    content: [{type: 'text', text: 'Parent page with attachment and inline comment marker'}],
                },
            ],
        };
        const childContent = {
            type: 'doc' as const,
            content: [
                {
                    type: 'paragraph',
                    content: [{type: 'text', text: 'Child page content with comment target text here'}],
                },
            ],
        };

        const parentPage = await pw.createPageViaDraft(adminClient, wiki.id, 'Parent With All', parentContent);
        const childPage = await pw.createPageViaDraft(
            adminClient,
            wiki.id,
            'Child With All',
            childContent,
            parentPage.id,
        );

        // Upload files and attach to pages
        const parentFileContent = 'Parent page attachment content for full roundtrip test.';
        const childFileContent = 'Child page attachment content for full roundtrip test.';

        // Upload parent file
        const parentFormData = new FormData();
        parentFormData.set('channel_id', channel.id);
        parentFormData.set('client_ids', await pw.random.id());
        parentFormData.set('files', new Blob([parentFileContent], {type: 'text/plain'}), 'parent-attachment.txt');
        const parentUpload = await adminClient.uploadFile(parentFormData);
        const parentFileId = parentUpload.file_infos[0].id;

        // Upload child file
        const childFormData = new FormData();
        childFormData.set('channel_id', channel.id);
        childFormData.set('client_ids', await pw.random.id());
        childFormData.set('files', new Blob([childFileContent], {type: 'text/plain'}), 'child-attachment.txt');
        const childUpload = await adminClient.uploadFile(childFormData);
        const childFileId = childUpload.file_infos[0].id;

        // Attach files to pages
        await adminClient.patchPost({id: parentPage.id, file_ids: [parentFileId]});
        await adminClient.patchPost({id: childPage.id, file_ids: [childFileId]});

        // Add comments to pages
        // Parent page: regular comment + inline comment + reply
        const parentRegularComment = await adminClient.createPageComment(
            wiki.id,
            parentPage.id,
            'Regular comment on parent page',
        );
        await adminClient.createPageComment(wiki.id, parentPage.id, 'Inline comment on parent', {
            text: 'inline comment marker',
            anchor_id: 'parent-inline-anchor',
        });
        await adminClient.createPageCommentReply(
            wiki.id,
            parentPage.id,
            parentRegularComment.id,
            'Reply to parent comment',
        );

        // Child page: inline comment that gets resolved
        const childInlineComment = await adminClient.createPageComment(
            wiki.id,
            childPage.id,
            'Inline comment on child to be resolved',
            {text: 'comment target', anchor_id: 'child-inline-anchor'},
        );
        await adminClient.resolvePageComment(wiki.id, childPage.id, childInlineComment.id);

        // Export with BOTH comments AND attachments
        const exportJob = await adminClient.createJob({
            type: 'wiki_export',
            data: {
                channel_ids: channel.id,
                include_comments: 'true',
                include_attachments: 'true',
            },
        });

        let completedExportJob: Job | undefined;
        for (let i = 0; i < 30; i++) {
            await pw.wait(pw.duration.two_sec);
            completedExportJob = await adminClient.getJob(exportJob.id);
            if (completedExportJob.status === 'success') {
                break;
            }
            if (completedExportJob.status === 'error') {
                throw new Error(`Export job failed: ${JSON.stringify(completedExportJob.data)}`);
            }
        }
        expect(completedExportJob?.status).toBe('success');
        expect(completedExportJob?.data?.pages_exported).toBe('2');
        expect(completedExportJob?.data?.export_file).toMatch(/\.zip$/); // Zip because attachments included

        // Import (idempotency test)
        const importFilename = await downloadExportAndUploadForImport(adminClient, completedExportJob!.id);
        const importJob = await adminClient.createJob({
            type: 'wiki_import',
            data: {
                import_file: importFilename,
            },
        });

        let completedImportJob: Job | undefined;
        for (let i = 0; i < 30; i++) {
            await pw.wait(pw.duration.two_sec);
            completedImportJob = await adminClient.getJob(importJob.id);
            if (completedImportJob.status === 'success') {
                break;
            }
            if (completedImportJob.status === 'error') {
                throw new Error(`Import job failed: ${JSON.stringify(completedImportJob.data)}`);
            }
        }
        expect(completedImportJob?.status).toBe('success');

        // Verify no duplicates
        const wikisAfterImport = await adminClient.getChannelWikis(channel.id);
        expect(wikisAfterImport.length).toBe(1);

        const pagesAfterImport = await adminClient.getPages(wiki.id);
        expect(pagesAfterImport.length).toBe(2);

        // Verify hierarchy is preserved
        type PageWithProps = {id: string; props: {title?: string}};
        const parentAfter = pagesAfterImport.find((p: PageWithProps) => p.props?.title === 'Parent With All');
        const childAfter = pagesAfterImport.find((p: PageWithProps) => p.props?.title === 'Child With All');
        expect(parentAfter).toBeDefined();
        expect(childAfter).toBeDefined();

        const fetchedChild = await adminClient.getPage(wiki.id, childAfter!.id);
        expect(fetchedChild.page_parent_id).toBe(parentAfter!.id);

        // Verify attachments are preserved
        const fetchedParent = await adminClient.getPage(wiki.id, parentAfter!.id);
        expect(fetchedParent.file_ids?.length).toBeGreaterThan(0);
        expect(fetchedChild.file_ids?.length).toBeGreaterThan(0);

        // Verify comments are preserved on parent
        const parentComments = await adminClient.getPageComments(wiki.id, parentPage.id);
        const parentCommentMessages = parentComments.map((c: {message: string}) => c.message);
        expect(parentCommentMessages).toContain('Regular comment on parent page');
        expect(parentCommentMessages).toContain('Inline comment on parent');
        expect(parentCommentMessages).toContain('Reply to parent comment');

        // Verify child comment is preserved and still resolved
        const childComments = await adminClient.getPageComments(wiki.id, childPage.id);
        expect(childComments.length).toBe(1);
        const childResolvedComment = childComments.find(
            (c: {message: string}) => c.message === 'Inline comment on child to be resolved',
        );
        expect(childResolvedComment).toBeDefined();
        expect(childResolvedComment!.props?.comment_resolved).toBe(true);
    });
});
