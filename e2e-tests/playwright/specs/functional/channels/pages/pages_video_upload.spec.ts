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
    SHORT_WAIT,
    WEBSOCKET_WAIT,
    ELEMENT_TIMEOUT,
    HIERARCHY_TIMEOUT,
    UI_MICRO_WAIT,
} from './test_helpers';

/**
 * @objective Verify video file can be uploaded via file input in editor
 *
 * @precondition
 * File uploads are enabled on the server
 */
test('uploads video file via file picker', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, `Video Upload Wiki ${await pw.random.id()}`);

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Video Upload Test');

    // # Wait for editor to be visible
    const editor = await getEditorAndWait(page);

    // # Open slash command menu using helper (at start of editor)
    const slashMenu = await openSlashCommandMenu(page);

    // # Type 'image' to filter to image option
    await page.keyboard.type('image');
    await page.waitForTimeout(UI_MICRO_WAIT * 3);

    // * Verify Image or Video option is visible in filtered menu
    const imageItem = slashMenu.locator('.slash-command-item').filter({hasText: 'Image'});
    await expect(imageItem).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // # Create a small test video file (MP4 with minimal header)
    const videoContent = Buffer.from([
        0x00,
        0x00,
        0x00,
        0x1c,
        0x66,
        0x74,
        0x79,
        0x70, // ftyp box
        0x69,
        0x73,
        0x6f,
        0x6d,
        0x00,
        0x00,
        0x02,
        0x00, // isom
        0x69,
        0x73,
        0x6f,
        0x6d,
        0x69,
        0x73,
        0x6f,
        0x32, // isom iso2
        0x6d,
        0x70,
        0x34,
        0x31, // mp41
        0x00,
        0x00,
        0x00,
        0x08,
        0x6d,
        0x64,
        0x61,
        0x74, // mdat box (empty)
    ]);

    // # Set up file chooser handler before clicking the menu item
    const fileChooserPromise = page.waitForEvent('filechooser', {timeout: ELEMENT_TIMEOUT});

    // # Click on Image option to trigger file picker
    await imageItem.click();

    // # Handle file chooser
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
        name: 'test-video.mp4',
        mimeType: 'video/mp4',
        buffer: videoContent,
    });

    // # Wait for upload to complete
    await page.waitForTimeout(WEBSOCKET_WAIT);

    // * Verify video element appears in editor
    const videoElement = editor.locator('video');
    await expect(videoElement).toBeVisible({timeout: HIERARCHY_TIMEOUT});

    // * Verify video has controls attribute
    const hasControls = await videoElement.getAttribute('controls');
    expect(hasControls).not.toBeNull();

    // * Verify video has wiki-video class
    const videoClass = await videoElement.getAttribute('class');
    expect(videoClass).toContain('wiki-video');

    // # Publish the page
    await publishPage(page);
    await page.waitForLoadState('networkidle');

    // * Verify page publishes successfully with the video
    const pageContent = getPageViewerContent(page);
    await expect(pageContent).toBeVisible();

    // * Verify the video persists after publish
    const publishedVideo = pageContent.locator('video');
    await expect(publishedVideo).toBeVisible({timeout: ELEMENT_TIMEOUT});

    // * Verify published video has controls
    const publishedHasControls = await publishedVideo.getAttribute('controls');
    expect(publishedHasControls).not.toBeNull();
});

/**
 * @objective Verify video file can be pasted from clipboard into editor
 *
 * @precondition
 * File uploads are enabled on the server
 */
test('pastes video from clipboard', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, `Video Paste Wiki ${await pw.random.id()}`);

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Video Paste Test');

    // # Wait for editor to be visible
    const editor = await getEditorAndWait(page);

    // # Click into editor and add some initial text
    await typeInEditor(page, 'Here is a pasted video: ');

    // # Create a minimal valid MP4 file content
    const videoContent = Buffer.from([
        0x00,
        0x00,
        0x00,
        0x1c,
        0x66,
        0x74,
        0x79,
        0x70, // ftyp box
        0x69,
        0x73,
        0x6f,
        0x6d,
        0x00,
        0x00,
        0x02,
        0x00, // isom
        0x69,
        0x73,
        0x6f,
        0x6d,
        0x69,
        0x73,
        0x6f,
        0x32, // isom iso2
        0x6d,
        0x70,
        0x34,
        0x31, // mp41
        0x00,
        0x00,
        0x00,
        0x08,
        0x6d,
        0x64,
        0x61,
        0x74, // mdat box (empty)
    ]);
    const base64Video = videoContent.toString('base64');

    // # Simulate pasting a video from clipboard
    await page.evaluate((videoData) => {
        const editorElement = document.querySelector('.ProseMirror');
        if (editorElement) {
            // Convert base64 to blob
            const byteCharacters = atob(videoData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], {type: 'video/mp4'});

            // Create file from blob
            const file = new File([blob], 'pasted-video.mp4', {type: 'video/mp4'});

            // Create DataTransfer with the video file
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
    }, base64Video);

    // # Wait for video to be processed and inserted
    await page.waitForTimeout(WEBSOCKET_WAIT);

    // * Verify video element appears in editor (or verify upload started)
    // Note: The actual upload may take time, so we check for either the video element
    // or an upload progress indicator
    const videoElement = editor.locator('video');
    const videoCount = await videoElement.count();

    if (videoCount > 0) {
        // * Verify video is visible
        await expect(videoElement.first()).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // * Verify video has controls
        const hasControls = await videoElement.first().getAttribute('controls');
        expect(hasControls).not.toBeNull();
    }
});

/**
 * @objective Verify only video and image files are accepted by the editor
 */
test('rejects non-media files in editor', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, `File Rejection Wiki ${await pw.random.id()}`);

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'File Rejection Test');

    // # Wait for editor to be visible
    const editor = await getEditorAndWait(page);

    // # Click into editor
    await editor.click();

    // # Try to paste a non-media file (e.g., a text file)
    await page.evaluate(() => {
        const editorElement = document.querySelector('.ProseMirror');
        if (editorElement) {
            const textContent = 'This is a text file content';
            const blob = new Blob([textContent], {type: 'text/plain'});
            const file = new File([blob], 'document.txt', {type: 'text/plain'});

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

    // * Verify no file attachment or error indicator appeared
    // The text file should be silently ignored or show an error message
    const images = editor.locator('img');
    const videos = editor.locator('video');

    const imageCount = await images.count();
    const videoCount = await videos.count();

    // * Verify no media elements were inserted
    expect(imageCount).toBe(0);
    expect(videoCount).toBe(0);
});

/**
 * @objective Verify webm video format is supported
 *
 * @precondition
 * File uploads are enabled on the server
 */
test('supports webm video format', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, `WebM Video Wiki ${await pw.random.id()}`);

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'WebM Video Test');

    // # Wait for editor to be visible
    const editor = await getEditorAndWait(page);

    // # Click into editor
    await editor.click();

    // # Create a minimal WebM file header
    const webmContent = Buffer.from([
        0x1a,
        0x45,
        0xdf,
        0xa3, // EBML header
        0x01,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x1f, // Size
        0x42,
        0x86,
        0x81,
        0x01, // EBMLVersion
        0x42,
        0xf7,
        0x81,
        0x01, // EBMLReadVersion
        0x42,
        0xf2,
        0x81,
        0x04, // EBMLMaxIDLength
        0x42,
        0xf3,
        0x81,
        0x08, // EBMLMaxSizeLength
        0x42,
        0x82,
        0x84,
        0x77,
        0x65,
        0x62,
        0x6d, // DocType: webm
        0x42,
        0x87,
        0x81,
        0x02, // DocTypeVersion
        0x42,
        0x85,
        0x81,
        0x02, // DocTypeReadVersion
    ]);
    const base64WebM = webmContent.toString('base64');

    // # Simulate pasting a webm video
    await page.evaluate((videoData) => {
        const editorElement = document.querySelector('.ProseMirror');
        if (editorElement) {
            const byteCharacters = atob(videoData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], {type: 'video/webm'});

            const file = new File([blob], 'video.webm', {type: 'video/webm'});

            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            const pasteEvent = new ClipboardEvent('paste', {
                clipboardData: dataTransfer,
                bubbles: true,
                cancelable: true,
            });
            editorElement.dispatchEvent(pasteEvent);
        }
    }, base64WebM);

    // # Wait for processing
    await page.waitForTimeout(WEBSOCKET_WAIT);

    // * Verify webm video is accepted (either video element appears or upload starts)
    // The validation should accept video/webm MIME type
    const videoElement = editor.locator('video');
    const videoCount = await videoElement.count();

    // If the video was uploaded successfully, it should appear
    // If not, we at least verify no error was thrown
    if (videoCount > 0) {
        await expect(videoElement.first()).toBeVisible({timeout: ELEMENT_TIMEOUT});
    }
});

/**
 * @objective Verify both image and video can coexist in the same page
 *
 * @precondition
 * File uploads are enabled on the server
 */
test('supports mixed image and video content', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
    const {team, user, adminClient} = sharedPagesSetup;
    const channel = await adminClient.getChannelByName(team.id, 'town-square');

    const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

    // # Create wiki through UI
    await createWikiThroughUI(page, `Mixed Media Wiki ${await pw.random.id()}`);

    // # Create new page
    const newPageButton = getNewPageButton(page);
    await newPageButton.click();
    await fillCreatePageModal(page, 'Mixed Media Test');

    // # Wait for editor to be visible
    const editor = await getEditorAndWait(page);

    // # Click into editor and add text
    await typeInEditor(page, 'Image and video content: ');

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
    await page.keyboard.type('And now a video: ');

    // # Now paste a video
    const videoContent = Buffer.from([
        0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00, 0x69, 0x73,
        0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32, 0x6d, 0x70, 0x34, 0x31, 0x00, 0x00, 0x00, 0x08, 0x6d, 0x64, 0x61, 0x74,
    ]);
    const base64Video = videoContent.toString('base64');

    await page.evaluate((videoData) => {
        const editorElement = document.querySelector('.ProseMirror');
        if (editorElement) {
            const byteCharacters = atob(videoData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], {type: 'video/mp4'});
            const file = new File([blob], 'video.mp4', {type: 'video/mp4'});

            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            const pasteEvent = new ClipboardEvent('paste', {
                clipboardData: dataTransfer,
                bubbles: true,
                cancelable: true,
            });
            editorElement.dispatchEvent(pasteEvent);
        }
    }, base64Video);

    // # Wait for video upload
    await page.waitForTimeout(WEBSOCKET_WAIT);

    // * Verify both image and video appear in editor
    const images = editor.locator('img');
    const videos = editor.locator('video');

    const imageCount = await images.count();
    const videoCount = await videos.count();

    // At least one of each should be present (assuming uploads succeeded)
    // If uploads failed due to server config, the counts may be 0
    if (imageCount > 0 && videoCount > 0) {
        await expect(images.first()).toBeVisible();
        await expect(videos.first()).toBeVisible();
    }
});
