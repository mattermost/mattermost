// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from './pages_test_fixture';
import {
    createWikiThroughUI,
    getNewPageButton,
    fillCreatePageModal,
    getEditorAndWait,
    EDITOR_LOAD_WAIT,
    ELEMENT_TIMEOUT,
    loginAndNavigateToChannel,
    uniqueName,
} from './test_helpers';

/**
 * Helper to paste plain text (markdown) into the editor
 */
async function pasteMarkdownIntoEditor(page: any, markdown: string) {
    const editor = page.locator('.tiptap-editor-content');
    await editor.click();

    await page.evaluate((text: string) => {
        const clipboardData = new DataTransfer();
        clipboardData.setData('text/plain', text);

        const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData,
        });

        document.activeElement?.dispatchEvent(pasteEvent);
    }, markdown);
}

/**
 * Helper to paste HTML content into the editor
 */
async function pasteHtmlIntoEditor(page: any, html: string) {
    const editor = page.locator('.tiptap-editor-content');
    await editor.click();

    await page.evaluate((htmlContent: string) => {
        const clipboardData = new DataTransfer();
        clipboardData.setData('text/html', htmlContent);
        clipboardData.setData('text/plain', 'fallback text');

        const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData,
        });

        document.activeElement?.dispatchEvent(pasteEvent);
    }, html);
}

/**
 * @objective Verify markdown paste detection and conversion in TipTap editor
 *
 * When plain text markdown is pasted (without HTML), the editor should detect
 * markdown syntax and convert it to rich content automatically.
 *
 * @precondition
 * - Pages/Wiki feature is enabled on the server
 */
test.describe('Paste Markdown', () => {
    /**
     * @objective Verify fenced code blocks are converted to code block nodes
     */
    test('converts fenced code block to rich code block', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki and page
        await createWikiThroughUI(page, uniqueName('Markdown Paste Test'));
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Code Block Paste Test');

        const editor = await getEditorAndWait(page);
        await page.waitForTimeout(EDITOR_LOAD_WAIT);

        // # Paste markdown code block
        const markdown = '```javascript\nconst greeting = "Hello, World!";\nconsole.log(greeting);\n```';
        await pasteMarkdownIntoEditor(page, markdown);
        await page.waitForTimeout(500);

        // * Verify code block was created
        const codeBlock = editor.locator('pre code');
        await expect(codeBlock).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await expect(codeBlock).toContainText('const greeting');
        await expect(codeBlock).toContainText('console.log');
    });

    /**
     * @objective Verify markdown tables are converted to rich table nodes
     */
    test('converts markdown table to rich table', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki and page
        await createWikiThroughUI(page, uniqueName('Table Paste Test'));
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Table Paste Test');

        const editor = await getEditorAndWait(page);
        await page.waitForTimeout(EDITOR_LOAD_WAIT);

        // # Paste markdown table
        const markdown = '| Name | Role |\n|------|------|\n| Alice | Engineer |\n| Bob | Designer |';
        await pasteMarkdownIntoEditor(page, markdown);
        await page.waitForTimeout(500);

        // * Verify table was created
        const table = editor.locator('table');
        await expect(table).toBeVisible({timeout: ELEMENT_TIMEOUT});

        // * Verify table headers
        const headers = editor.locator('th');
        await expect(headers.first()).toContainText('Name');

        // * Verify table cells
        const cells = editor.locator('td');
        await expect(cells.first()).toContainText('Alice');
    });

    /**
     * @objective Verify headers + links (2 medium signals) trigger conversion
     */
    test('converts headers and links to rich content', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki and page
        await createWikiThroughUI(page, uniqueName('Header Link Test'));
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Header Link Test');

        const editor = await getEditorAndWait(page);
        await page.waitForTimeout(EDITOR_LOAD_WAIT);

        // # Paste markdown with header and link (2 medium signals = convert)
        const markdown = '# Getting Started\n\nCheck the [documentation](https://example.com/docs) for more info.';
        await pasteMarkdownIntoEditor(page, markdown);
        await page.waitForTimeout(500);

        // * Verify heading was created
        const heading = editor.locator('h1');
        await expect(heading).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await expect(heading).toContainText('Getting Started');

        // * Verify link was created
        const link = editor.locator('a[href="https://example.com/docs"]');
        await expect(link).toBeVisible();
        await expect(link).toContainText('documentation');
    });

    /**
     * @objective Verify @mentions in pasted markdown become mention nodes
     */
    test('converts @mentions to mention nodes', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki and page
        await createWikiThroughUI(page, uniqueName('Mention Paste Test'));
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Mention Paste Test');

        const editor = await getEditorAndWait(page);
        await page.waitForTimeout(EDITOR_LOAD_WAIT);

        // # Paste markdown with code block (strong signal) and mention
        const markdown = '```\ncode\n```\n\nHey @sysadmin, please review this.';
        await pasteMarkdownIntoEditor(page, markdown);
        await page.waitForTimeout(500);

        // * Verify mention node was created
        const mention = editor.locator('[data-type="mention"]');
        await expect(mention).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await expect(mention).toContainText('@sysadmin');
    });

    /**
     * @objective Verify ~channel mentions become channel mention nodes
     */
    test('converts ~channel to channel mention nodes', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki and page
        await createWikiThroughUI(page, uniqueName('Channel Mention Test'));
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Channel Mention Test');

        const editor = await getEditorAndWait(page);
        await page.waitForTimeout(EDITOR_LOAD_WAIT);

        // # Paste markdown with code block (strong signal) and channel mention
        const markdown = '```\ncode\n```\n\nDiscuss in ~town-square channel.';
        await pasteMarkdownIntoEditor(page, markdown);
        await page.waitForTimeout(500);

        // * Verify channel mention node was created
        const channelMention = editor.locator('[data-type="channelMention"]');
        await expect(channelMention).toBeVisible({timeout: ELEMENT_TIMEOUT});
    });

    /**
     * @objective Verify plain text without markdown signals stays as plain text
     */
    test('does not convert plain text without markdown', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki and page
        await createWikiThroughUI(page, uniqueName('Plain Text Test'));
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Plain Text Test');

        const editor = await getEditorAndWait(page);
        await page.waitForTimeout(EDITOR_LOAD_WAIT);

        // # Paste plain text without markdown
        const plainText = 'This is just regular text without any markdown formatting.';
        await pasteMarkdownIntoEditor(page, plainText);
        await page.waitForTimeout(500);

        // * Verify text was inserted as-is (in a paragraph, no special formatting)
        await expect(editor).toContainText(plainText);

        // * Verify no code blocks, tables, or headings were created
        const codeBlock = editor.locator('pre code');
        await expect(codeBlock).not.toBeVisible();

        const table = editor.locator('table');
        await expect(table).not.toBeVisible();

        const heading = editor.locator('h1, h2, h3');
        await expect(heading).not.toBeVisible();
    });

    /**
     * @objective Verify single weak signal does not trigger full markdown conversion
     *
     * Note: TipTap may still apply inline formatting (bold/italic) through its
     * own input rules. This test verifies our markdown extension doesn't trigger
     * for single weak signals (no code blocks, tables, etc. are created).
     */
    test('does not convert single weak signal to block elements', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki and page
        await createWikiThroughUI(page, uniqueName('Weak Signal Test'));
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Weak Signal Test');

        const editor = await getEditorAndWait(page);
        await page.waitForTimeout(EDITOR_LOAD_WAIT);

        // # Paste text with only a header (1 weak signal - should NOT convert)
        const markdown = '# This is a header';
        await pasteMarkdownIntoEditor(page, markdown);
        await page.waitForTimeout(500);

        // * Verify NO heading was created (single signal doesn't trigger conversion)
        const heading = editor.locator('h1');
        await expect(heading).not.toBeVisible();

        // * Verify text contains the hash (not converted)
        await expect(editor).toContainText('# This is a header');
    });

    /**
     * @objective Verify HTML paste is not affected by markdown conversion
     */
    test('HTML paste bypasses markdown conversion', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki and page
        await createWikiThroughUI(page, uniqueName('HTML Paste Test'));
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'HTML Paste Test');

        const editor = await getEditorAndWait(page);
        await page.waitForTimeout(EDITOR_LOAD_WAIT);

        // # Paste HTML (should use HTML, not markdown conversion)
        const html = '<h2>Already Formatted</h2><p>This is <strong>bold</strong> text.</p>';
        await pasteHtmlIntoEditor(page, html);
        await page.waitForTimeout(500);

        // * Verify HTML was used directly
        const heading = editor.locator('h2');
        await expect(heading).toBeVisible({timeout: ELEMENT_TIMEOUT});
        await expect(heading).toContainText('Already Formatted');

        const bold = editor.locator('strong');
        await expect(bold).toBeVisible();
        await expect(bold).toContainText('bold');
    });

    /**
     * @objective Verify email addresses are not converted to mentions
     */
    test('email addresses are not converted to mentions', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki and page
        await createWikiThroughUI(page, uniqueName('Email Test'));
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Email Test');

        const editor = await getEditorAndWait(page);
        await page.waitForTimeout(EDITOR_LOAD_WAIT);

        // # Paste markdown with code block and email address
        const markdown = '```\ncode\n```\n\nContact support@example.com for help.';
        await pasteMarkdownIntoEditor(page, markdown);
        await page.waitForTimeout(500);

        // * Verify email is displayed as plain text, not a mention
        await expect(editor).toContainText('support@example.com');

        // * Verify no mention node was created for the email
        const mentions = editor.locator('[data-type="mention"]');
        const mentionCount = await mentions.count();

        // Check that none of the mentions contain 'example.com'
        for (let i = 0; i < mentionCount; i++) {
            const mentionText = await mentions.nth(i).textContent();
            expect(mentionText).not.toContain('example.com');
        }
    });

    /**
     * @objective Verify markdown images are converted to image nodes
     */
    test('converts markdown images to image nodes', {tag: '@pages'}, async ({pw, sharedPagesSetup}) => {
        const {team, user, adminClient} = sharedPagesSetup;
        const channel = await adminClient.getChannelByName(team.id, 'town-square');

        const {page} = await loginAndNavigateToChannel(pw, user, team.name, channel.name);

        // # Create wiki and page
        await createWikiThroughUI(page, uniqueName('Image Paste Test'));
        const newPageButton = getNewPageButton(page);
        await newPageButton.click();
        await fillCreatePageModal(page, 'Image Paste Test');

        const editor = await getEditorAndWait(page);
        await page.waitForTimeout(EDITOR_LOAD_WAIT);

        // # Paste markdown with image (strong signal)
        const markdown = '![Logo](https://example.com/logo.png)';
        await pasteMarkdownIntoEditor(page, markdown);
        await page.waitForTimeout(500);

        // * Verify image was created
        const image = editor.locator('img');
        await expect(image).toBeVisible({timeout: ELEMENT_TIMEOUT});

        const src = await image.getAttribute('src');
        expect(src).toContain('example.com/logo.png');
    });
});
