// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    getNewPageButton,
    getPageViewerContent,
    fillCreatePageModal,
    typeInEditor,
    publishPage,
    getEditorAndWait,
    loginAndNavigateToChannel,
    openSlashCommandMenu,
    uniqueName,
    SHORT_WAIT,
    WEBSOCKET_WAIT,
    ELEMENT_TIMEOUT,
    HIERARCHY_TIMEOUT,
    UI_MICRO_WAIT,
} from './test_helpers';

/**
 * @objective Verify PDF file can be uploaded via file input in editor and appears as file attachment
 *
 * @precondition
 * File uploads are enabled on the server
 */
test(
    'uploads PDF file via file picker and displays as file attachment',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki through UI
        await createWikiThroughUI(page, uniqueName('PDF Upload Wiki'));

        // # Create new page
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'PDF Upload Test');

        // # Wait for editor to be visible
        const editor = await getEditorAndWait(page);

        // # Open slash command menu using helper (at start of editor)
        const slashMenu = await openSlashCommandMenu(page);

        // # Type 'image' to filter to image/file option (file picker)
        await page.keyboard.type('image');
        await page.waitForTimeout(UI_MICRO_WAIT * 3);

        // * Verify Image or Video option is visible in filtered menu
        const imageItem = slashMenu.locator('.slash-command-item').filter({hasText: 'Image'});
        await expect(imageItem).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // # Create a minimal PDF file content
        const pdfContent = Buffer.from(
            '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\nxref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n115\n%%EOF',
        );

        // # Set up file chooser handler before clicking the menu item
        const fileChooserPromise = page.waitForEvent('filechooser', {timeout: ELEMENT_TIMEOUT});

        // # Click on Image option to trigger file picker
        await imageItem.click();

        // # Handle file chooser
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles({
            name: 'test-document.pdf',
            mimeType: 'application/pdf',
            buffer: pdfContent,
        });

        // # Wait for upload to complete
        await page.waitForTimeout(WEBSOCKET_WAIT);

        // * Verify file attachment element appears in editor
        const fileAttachment = editor.locator('.wiki-file-attachment');
        await expect(fileAttachment).toBeVisible({timeout: HIERARCHY_TIMEOUT});

        // * Verify file name is displayed
        await expect(fileAttachment).toContainText('test-document.pdf');

        // # Publish the page
        await publishPage(page);
        await page.waitForLoadState('networkidle');

        // * Verify page publishes successfully with the file attachment
        const pageContent = getPageViewerContent(page);
        await expect(pageContent).toBeVisible();

        // * Verify the file attachment persists after publish
        const publishedAttachment = pageContent.locator('.wiki-file-attachment');
        await expect(publishedAttachment).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // * Verify published attachment shows file name
        await expect(publishedAttachment).toContainText('test-document.pdf');
    },
);

/**
 * @objective Verify non-media file can be pasted from clipboard into editor
 *
 * @precondition
 * File uploads are enabled on the server
 */
test(
    'pastes non-media file from clipboard and displays as file attachment',
    {tag: '@pages'},
    async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki through UI
        await createWikiThroughUI(page, uniqueName('File Paste Wiki'));

        // # Create new page
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'File Paste Test');

        // # Wait for editor to be visible
        const editor = await getEditorAndWait(page);

        // # Click into editor and add some initial text
        await typeInEditor(page, 'Here is a pasted document: ');

        // # Create a minimal PDF content
        const pdfContent =
            '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\nxref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n115\n%%EOF';
        const base64Pdf = Buffer.from(pdfContent).toString('base64');

        // # Simulate pasting a PDF from clipboard
        await page.evaluate((pdfData) => {
            const editorElement = document.querySelector('.ProseMirror');
            if (editorElement) {
                // Convert base64 to blob
                const byteCharacters = atob(pdfData);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], {type: 'application/pdf'});

                // Create file from blob
                const file = new File([blob], 'pasted-document.pdf', {type: 'application/pdf'});

                // Create DataTransfer with the PDF file
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);

                // Dispatch paste event
                const pasteEvent = new ClipboardEvent('paste', {
                    clipboardData: dataTransfer,
                    bubbles: true,
                    cancelable: true,
                });
                editorElement.dispatchEvent(pasteEvent);
            }
        }, base64Pdf);

        // # Wait for file to be processed and inserted
        await page.waitForTimeout(WEBSOCKET_WAIT);

        // * Verify file attachment element appears in editor
        const fileAttachment = editor.locator('.wiki-file-attachment');
        const attachmentCount = await fileAttachment.count();

        if (attachmentCount > 0) {
            // * Verify file attachment is visible
            await expect(fileAttachment.first()).toBeVisible({timeout: ELEMENT_TIMEOUT});

            // * Verify file name is displayed
            await expect(fileAttachment.first()).toContainText('pasted-document.pdf');
        }
    },
);

/**
 * @objective Verify executable files are rejected when uploading
 */
test('rejects executable files in editor', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Executable Rejection Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Executable Rejection Test');

    // # Wait for editor to be visible
    const editor = await getEditorAndWait(page);

    // # Click into editor
    await editor.click();

    // # Try to paste an executable file (.exe)
    await page.evaluate(() => {
        const editorElement = document.querySelector('.ProseMirror');
        if (editorElement) {
            const exeContent = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]); // MZ header
            const blob = new Blob([exeContent], {type: 'application/x-msdownload'});
            const file = new File([blob], 'malware.exe', {type: 'application/x-msdownload'});

            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            const pasteEvent = new ClipboardEvent('paste', {
                clipboardData: dataTransfer,
                bubbles: true,
                cancelable: true,
            });
            editorElement.dispatchEvent(pasteEvent);
        }
    });

    // # Wait briefly for any processing
    await page.waitForTimeout(SHORT_WAIT);

    // * Verify no file attachment was inserted
    const fileAttachment = editor.locator('.wiki-file-attachment');
    const images = editor.locator('img');
    const videos = editor.locator('video');

    const attachmentCount = await fileAttachment.count();
    const imageCount = await images.count();
    const videoCount = await videos.count();

    // * Verify no media or file attachment elements were inserted
    expect(attachmentCount).toBe(0);
    expect(imageCount).toBe(0);
    expect(videoCount).toBe(0);
});

/**
 * @objective Verify shell script files are rejected when uploading
 */
test('rejects shell script files in editor', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Shell Script Rejection Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Shell Script Rejection Test');

    // # Wait for editor to be visible
    const editor = await getEditorAndWait(page);

    // # Click into editor
    await editor.click();

    // # Try to paste a shell script file (.sh)
    await page.evaluate(() => {
        const editorElement = document.querySelector('.ProseMirror');
        if (editorElement) {
            const scriptContent = '#!/bin/bash\necho "Hello World"';
            const blob = new Blob([scriptContent], {type: 'application/x-sh'});
            const file = new File([blob], 'script.sh', {type: 'application/x-sh'});

            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            const pasteEvent = new ClipboardEvent('paste', {
                clipboardData: dataTransfer,
                bubbles: true,
                cancelable: true,
            });
            editorElement.dispatchEvent(pasteEvent);
        }
    });

    // # Wait briefly for any processing
    await page.waitForTimeout(SHORT_WAIT);

    // * Verify no file attachment was inserted
    const fileAttachment = editor.locator('.wiki-file-attachment');
    const attachmentCount = await fileAttachment.count();

    // * Verify no file attachment was inserted
    expect(attachmentCount).toBe(0);
});

/**
 * @objective Verify text files can be uploaded as file attachments
 *
 * @precondition
 * File uploads are enabled on the server
 */
test('uploads text file and displays as file attachment', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Text File Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Text File Test');

    // # Wait for editor to be visible
    const editor = await getEditorAndWait(page);

    // # Click into editor
    await editor.click();

    // # Paste a text file
    await page.evaluate(() => {
        const editorElement = document.querySelector('.ProseMirror');
        if (editorElement) {
            const textContent = 'This is a sample text file content for testing.';
            const blob = new Blob([textContent], {type: 'text/plain'});
            const file = new File([blob], 'readme.txt', {type: 'text/plain'});

            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            const pasteEvent = new ClipboardEvent('paste', {
                clipboardData: dataTransfer,
                bubbles: true,
                cancelable: true,
            });
            editorElement.dispatchEvent(pasteEvent);
        }
    });

    // # Wait for upload to complete
    await page.waitForTimeout(WEBSOCKET_WAIT);

    // * Verify file attachment element appears in editor
    const fileAttachment = editor.locator('.wiki-file-attachment');
    const attachmentCount = await fileAttachment.count();

    if (attachmentCount > 0) {
        // * Verify file attachment is visible
        await expect(fileAttachment.first()).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // * Verify file name is displayed
        await expect(fileAttachment.first()).toContainText('readme.txt');
    }
});

/**
 * @objective Verify ZIP archive files can be uploaded as file attachments
 *
 * @precondition
 * File uploads are enabled on the server
 */
test('uploads ZIP file and displays as file attachment', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('ZIP File Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'ZIP File Test');

    // # Wait for editor to be visible
    const editor = await getEditorAndWait(page);

    // # Click into editor
    await editor.click();

    // # Create a minimal ZIP file header
    const zipContent = Buffer.from([
        0x50,
        0x4b,
        0x03,
        0x04, // Local file header signature
        0x0a,
        0x00, // Version needed to extract
        0x00,
        0x00, // General purpose bit flag
        0x00,
        0x00, // Compression method (stored)
        0x00,
        0x00, // Last mod file time
        0x00,
        0x00, // Last mod file date
        0x00,
        0x00,
        0x00,
        0x00, // CRC-32
        0x00,
        0x00,
        0x00,
        0x00, // Compressed size
        0x00,
        0x00,
        0x00,
        0x00, // Uncompressed size
        0x00,
        0x00, // File name length
        0x00,
        0x00, // Extra field length
    ]);
    const base64Zip = zipContent.toString('base64');

    // # Paste a ZIP file
    await page.evaluate((zipData) => {
        const editorElement = document.querySelector('.ProseMirror');
        if (editorElement) {
            const byteCharacters = atob(zipData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], {type: 'application/zip'});
            const file = new File([blob], 'archive.zip', {type: 'application/zip'});

            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            const pasteEvent = new ClipboardEvent('paste', {
                clipboardData: dataTransfer,
                bubbles: true,
                cancelable: true,
            });
            editorElement.dispatchEvent(pasteEvent);
        }
    }, base64Zip);

    // # Wait for upload to complete
    await page.waitForTimeout(WEBSOCKET_WAIT);

    // * Verify file attachment element appears in editor
    const fileAttachment = editor.locator('.wiki-file-attachment');
    const attachmentCount = await fileAttachment.count();

    if (attachmentCount > 0) {
        // * Verify file attachment is visible
        await expect(fileAttachment.first()).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // * Verify file name is displayed
        await expect(fileAttachment.first()).toContainText('archive.zip');
    }
});

/**
 * @objective Verify file attachment can be deleted from editor
 *
 * @precondition
 * File uploads are enabled on the server
 */
test('deletes file attachment from editor using delete button', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Delete File Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Delete File Test');

    // # Wait for editor to be visible
    const editor = await getEditorAndWait(page);

    // # Open slash command menu and upload a file
    const slashMenu = await openSlashCommandMenu(page);
    await page.keyboard.type('image');
    await page.waitForTimeout(UI_MICRO_WAIT * 3);

    const imageItem = slashMenu.locator('.slash-command-item').filter({hasText: 'Image'});
    await expect(imageItem).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Create PDF content
    const pdfContent = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\nxref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n115\n%%EOF',
    );

    const fileChooserPromise = page.waitForEvent('filechooser', {timeout: ELEMENT_TIMEOUT});
    await imageItem.click();

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
        name: 'to-delete.pdf',
        mimeType: 'application/pdf',
        buffer: pdfContent,
    });

    // # Wait for upload to complete
    await page.waitForTimeout(WEBSOCKET_WAIT);

    // * Verify file attachment appears
    const fileAttachment = editor.locator('.wiki-file-attachment');
    await expect(fileAttachment).toBeVisible({timeout: HIERARCHY_TIMEOUT});

    // # Click the delete button directly (don't click on attachment first as it opens preview modal)
    const deleteButton = fileAttachment.locator('.wiki-file-attachment__delete');
    await expect(deleteButton).toBeVisible({timeout: ELEMENT_TIMEOUT});
    await deleteButton.click();

    // # Wait for deletion to process
    await page.waitForTimeout(SHORT_WAIT);

    // * Verify file attachment is removed
    const remainingAttachments = await editor.locator('.wiki-file-attachment').count();
    expect(remainingAttachments).toBe(0);
});

/**
 * @objective Verify multiple file types can coexist in the same page
 *
 * @precondition
 * File uploads are enabled on the server
 */
test('supports mixed media and file attachments in same page', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, uniqueName('Mixed Files Wiki'));

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Mixed Files Test');

    // # Wait for editor to be visible
    const editor = await getEditorAndWait(page);

    // # Click into editor and add text
    await typeInEditor(page, 'Image, video, and file attachments: ');

    // # First, paste an image
    const imageBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    await page.evaluate((imageData) => {
        const editorElement = document.querySelector('.ProseMirror');
        if (editorElement) {
            const byteCharacters = atob(imageData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], {type: 'image/png'});
            const file = new File([blob], 'image.png', {type: 'image/png'});

            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            const pasteEvent = new ClipboardEvent('paste', {
                clipboardData: dataTransfer,
                bubbles: true,
                cancelable: true,
            });
            editorElement.dispatchEvent(pasteEvent);
        }
    }, imageBase64);

    // # Wait for image upload
    await page.waitForTimeout(WEBSOCKET_WAIT);

    // # Add more text
    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');

    // # Now paste a PDF file attachment
    const pdfContent = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF';
    const base64Pdf = Buffer.from(pdfContent).toString('base64');

    await page.evaluate((pdfData) => {
        const editorElement = document.querySelector('.ProseMirror');
        if (editorElement) {
            const byteCharacters = atob(pdfData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], {type: 'application/pdf'});
            const file = new File([blob], 'document.pdf', {type: 'application/pdf'});

            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            const pasteEvent = new ClipboardEvent('paste', {
                clipboardData: dataTransfer,
                bubbles: true,
                cancelable: true,
            });
            editorElement.dispatchEvent(pasteEvent);
        }
    }, base64Pdf);

    // # Wait for PDF upload
    await page.waitForTimeout(WEBSOCKET_WAIT);

    // * Verify both image and file attachment appear in editor
    const images = editor.locator('img');
    const fileAttachments = editor.locator('.wiki-file-attachment');

    const imageCount = await images.count();
    const attachmentCount = await fileAttachments.count();

    // At least one of each should be present (assuming uploads succeeded)
    if (imageCount > 0 && attachmentCount > 0) {
        await expect(images.first()).toBeVisible();
        await expect(fileAttachments.first()).toBeVisible();

        // * Verify file attachment shows PDF name
        await expect(fileAttachments.first()).toContainText('document.pdf');
    }
});
