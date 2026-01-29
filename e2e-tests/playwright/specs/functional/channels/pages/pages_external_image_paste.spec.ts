// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    getNewPageButton,
    fillCreatePageModal,
    getEditorAndWait,
    publishPage,
    EDITOR_LOAD_WAIT,
    ELEMENT_TIMEOUT,
    loginAndNavigateToChannel,
} from './test_helpers';

/**
 * Helper to paste HTML content into the editor using clipboard API
 */
async function pasteHtmlIntoEditor(page: any, html: string) {
    const editor = page.locator('.tiptap-editor-content');
    await editor.click();

    // Use Playwright's clipboard API to paste HTML
    await page.evaluate((htmlContent: string) => {
        const clipboardData = new DataTransfer();
        clipboardData.setData('text/html', htmlContent);

        const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData,
        });

        document.activeElement?.dispatchEvent(pasteEvent);
    }, html);
}

/**
 * @objective Verify that external images in pasted HTML are re-hosted to Mattermost
 *
 * @precondition
 * - Pages/Wiki feature is enabled on the server
 * - Image proxy is enabled (ImageProxySettings.Enable = true)
 */
test.describe('External Image Paste', () => {
    /**
     * @objective Verify that external images in pasted HTML are automatically
     * re-hosted to Mattermost file storage, replacing external URLs with
     * internal /api/v4/files/ URLs
     */
    test(
        're-hosts external images when pasting HTML with image URLs',
        {tag: '@pages'},
        async ({pw, sharedPagesSetup}) => {
            const {team, user, adminClient} = sharedPagesSetup;
            const channel = await adminClient.getChannelByName(team.id, 'town-square');

            // Ensure image proxy is enabled
            const config = await adminClient.getConfig();
            if (!config.ImageProxySettings?.Enable) {
                await adminClient.patchConfig({
                    ImageProxySettings: {
                        Enable: true,
                        ImageProxyType: 'local',
                    },
                });
            }

            const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

            // # Create wiki through UI
            await createWikiThroughUI(page, `External Image Test ${Date.now()}`);

            // # Create new page
            const newPageButton = getNewPageButton(page);
            await newPageButton.click();
            await fillCreatePageModal(page, 'External Image Paste Test');

            // # Wait for editor to be ready
            const editor = await getEditorAndWait(page);
            await page.waitForTimeout(EDITOR_LOAD_WAIT);

            // # Paste HTML with an external image (using Google's logo as a reliable external image)
            const externalImageUrl =
                'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png';
            const htmlWithImage = `<p>Text before image</p><img src="${externalImageUrl}" alt="External Image"><p>Text after image</p>`;

            await pasteHtmlIntoEditor(page, htmlWithImage);

            // # Wait for the re-hosting process to complete
            // The setTimeout is 100ms, plus fetch + upload time
            await page.waitForTimeout(5000);

            // * Verify the image src was changed to a Mattermost file URL
            const imageInEditor = editor.locator('img').first();
            await expect(imageInEditor).toBeVisible({timeout: ELEMENT_TIMEOUT});

            const imageSrc = await imageInEditor.getAttribute('src');
            expect(imageSrc).toMatch(/^\/api\/v4\/files\//);
            expect(imageSrc).not.toContain('google.com');

            // # Publish the page
            await publishPage(page);

            // * Verify the image is still using Mattermost file URL after publish
            const publishedImage = page.locator('.tiptap-editor-content img').first();
            await expect(publishedImage).toBeVisible({timeout: ELEMENT_TIMEOUT});

            const publishedImageSrc = await publishedImage.getAttribute('src');
            expect(publishedImageSrc).toMatch(/^\/api\/v4\/files\//);
        },
    );

    /**
     * @objective Verify that text content surrounding images is preserved
     * when pasting HTML that contains both text and external images
     */
    test('preserves text content when pasting HTML with images', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // Ensure image proxy is enabled
        const config = await adminClient.getConfig();
        if (!config.ImageProxySettings?.Enable) {
            await adminClient.patchConfig({
                ImageProxySettings: {
                    Enable: true,
                    ImageProxyType: 'local',
                },
            });
        }

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki and page
        await createWikiThroughUI(page, `Text Preservation Test ${Date.now()}`);
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Text Preservation Test');

        const editor = await getEditorAndWait(page);
        await page.waitForTimeout(EDITOR_LOAD_WAIT);

        // # Paste HTML with text and image
        const htmlWithImage = `
            <p>Introduction paragraph</p>
            <img src="https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png" alt="Logo">
            <p>Conclusion paragraph</p>
        `;

        await pasteHtmlIntoEditor(page, htmlWithImage);
        await page.waitForTimeout(5000);

        // * Verify text content is preserved
        const editorText = await editor.textContent();
        expect(editorText).toContain('Introduction paragraph');
        expect(editorText).toContain('Conclusion paragraph');
    });

    /**
     * @objective Verify that multiple external images in a single paste
     * operation are all re-hosted to Mattermost file storage
     */
    test('handles multiple external images in single paste', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        // Ensure image proxy is enabled
        const config = await adminClient.getConfig();
        if (!config.ImageProxySettings?.Enable) {
            await adminClient.patchConfig({
                ImageProxySettings: {
                    Enable: true,
                    ImageProxyType: 'local',
                },
            });
        }

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki and page
        await createWikiThroughUI(page, `Multiple Images Test ${Date.now()}`);
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Multiple Images Test');

        const editor = await getEditorAndWait(page);
        await page.waitForTimeout(EDITOR_LOAD_WAIT);

        // # Paste HTML with multiple external images
        const htmlWithMultipleImages = `
            <p>First image:</p>
            <img src="https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png" alt="Image 1">
            <p>Second image:</p>
            <img src="https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png" alt="Image 2">
        `;

        await pasteHtmlIntoEditor(page, htmlWithMultipleImages);

        // # Wait for re-hosting (longer timeout for multiple images)
        await page.waitForTimeout(10000);

        // * Verify all images were re-hosted
        const imagesInEditor = editor.locator('img');
        const imageCount = await imagesInEditor.count();
        expect(imageCount).toBeGreaterThanOrEqual(2);

        // Check each image has Mattermost file URL
        for (let i = 0; i < imageCount; i++) {
            const imageSrc = await imagesInEditor.nth(i).getAttribute('src');
            expect(imageSrc).toMatch(/^\/api\/v4\/files\//);
        }
    });

    /**
     * @objective Verify that images already using Mattermost file URLs
     * (/api/v4/files/) are not re-hosted, preserving the original URL
     */
    test('ignores already-hosted Mattermost images', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki and page
        await createWikiThroughUI(page, `Mattermost Image Test ${Date.now()}`);
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Mattermost Image Test');

        const editor = await getEditorAndWait(page);
        await page.waitForTimeout(EDITOR_LOAD_WAIT);

        // # Paste HTML with a Mattermost file URL (should not be re-hosted)
        const mmFileUrl = '/api/v4/files/existing-file-id';
        const htmlWithMmImage = `<p>Already hosted image:</p><img src="${mmFileUrl}" alt="MM Image">`;

        await pasteHtmlIntoEditor(page, htmlWithMmImage);
        await page.waitForTimeout(2000);

        // * Verify the Mattermost URL is preserved (not re-hosted)
        const imageInEditor = editor.locator('img').first();
        await expect(imageInEditor).toBeVisible({timeout: ELEMENT_TIMEOUT});

        const imageSrc = await imageInEditor.getAttribute('src');
        expect(imageSrc).toBe(mmFileUrl);
    });

    /**
     * @objective Verify that data URI images (base64 encoded) are not
     * re-hosted, preserving the original data URI format
     */
    test('ignores data URI images', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki and page
        await createWikiThroughUI(page, `Data URI Test ${Date.now()}`);
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Data URI Test');

        const editor = await getEditorAndWait(page);
        await page.waitForTimeout(EDITOR_LOAD_WAIT);

        // # Paste HTML with a data URI image (should not be re-hosted)
        // Small 1x1 red PNG as base64
        const dataUri =
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
        const htmlWithDataUri = `<p>Data URI image:</p><img src="${dataUri}" alt="Data URI">`;

        await pasteHtmlIntoEditor(page, htmlWithDataUri);
        await page.waitForTimeout(2000);

        // * Verify the data URI is preserved (not re-hosted)
        const imageInEditor = editor.locator('img').first();
        await expect(imageInEditor).toBeVisible({timeout: ELEMENT_TIMEOUT});

        const imageSrc = await imageInEditor.getAttribute('src');
        expect(imageSrc).toBe(dataUri);
    });
});
