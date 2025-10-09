// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '@mattermost/playwright-lib';
import {readFileSync} from 'fs';
import {join} from 'path';

const testCases = [
    {name: 'Markdown - basic', fileKey: 'markdown_basic'},
    {name: 'Markdown - text style', fileKey: 'markdown_text_style'},
    {name: 'Markdown - carriage return', fileKey: 'markdown_carriage_return'},
    {name: 'Markdown - code block', fileKey: 'markdown_code_block'},
    {name: 'Markdown - should not render inside the code block', fileKey: 'markdown_not_in_code_block'},
    {name: 'Markdown - should not auto-link or generate previews', fileKey: 'markdown_not_autolink'},
    {name: 'Markdown - should appear as a carriage return separating two lines of text', fileKey: 'markdown_carriage_return_two_lines'},
    {name: 'Markdown - in-line code', fileKey: 'markdown_inline_code'},
    {name: 'Markdown - lines', fileKey: 'markdown_lines'},
    {name: 'Markdown - headings', fileKey: 'markdown_headings'},
    {name: 'Markdown - escape characters', fileKey: 'markdown_escape_characters'},
    {name: 'Markdown - block quotes 1', fileKey: 'markdown_block_quotes_1'},
];

test.describe('Markdown message', () => {
    test.beforeEach(async ({pw}) => {
        // Enable local image proxy so our expected URLs match
        const newSettings = {
            ImageProxySettings: {
                Enable: true,
                ImageProxyType: 'local',
                RemoteImageProxyURL: '',
                RemoteImageProxyOptions: '',
            },
        };
        const {adminClient} = await pw.initSetup();
        await adminClient.updateConfig(newSettings as any);
    });

    for (const testCase of testCases) {
        test(testCase.name, async ({pw}) => {
            const {adminUser} = await pw.initSetup();
            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto();
            await channelsPage.toBeVisible();
            
            // Read markdown content from file
            const markdownPath = join(__dirname, '../../../../fixtures/markdown', `${testCase.fileKey}.md`);
            console.log('Reading from markdownPath', markdownPath);
            const markdownContent = readFileSync(markdownPath, 'utf-8');
            
            // Post markdown message
            await channelsPage.postMessage(markdownContent);
            
            // Wait for the message to be posted
            await channelsPage.centerView.waitUntilLastPostContains(markdownContent.split('\n')[0]);
            
            // Read expected HTML content from file
            const htmlPath = join(__dirname, '../../../../fixtures/markdown', `${testCase.fileKey}.html`);
            const expectedHtml = readFileSync(htmlPath, 'utf-8').replace(/\n$/, '');
            
            // Get the last post and verify HTML content
            const lastPost = await channelsPage.getLastPost();
            
            // Verify that HTML Content is correct using POM method
            const actualHtml = await lastPost.getMessageHtml();
            expect(actualHtml).toBe(expectedHtml);
        });
    }

    test('Markdown - block quotes 2', async ({pw}) => {
        const {adminUser} = await pw.initSetup();
        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto();
        await channelsPage.toBeVisible();
        
        const baseUrl = channelsPage.page.url().split('/').slice(0, 3).join('/');
        const expectedHtml = `<h3 class="markdown__heading">Block Quotes</h3><p><strong>The following markdown should render within the block quote:</strong></p>\n<blockquote>\n<h4 class="markdown__heading">Heading 4</h4><p><em>Italics</em>, <em>Italics</em>, <strong>Bold</strong>, <strong><em>Bold-italics</em></strong>, <strong><em>Bold-italics</em></strong>, <del>Strikethrough</del>\n<span data-emoticon="slightly_smiling_face"><span alt=":slightly_smiling_face:" class="emoticon" data-testid="postEmoji.:slightly_smiling_face:" style="background-image: url(&quot;${baseUrl}/static/emoji/1f642.png&quot;);">:slightly_smiling_face:</span></span> <span data-emoticon="slightly_smiling_face"><span alt=":slightly_smiling_face:" class="emoticon" data-testid="postEmoji.:slightly_smiling_face:" style="background-image: url(&quot;${baseUrl}/static/emoji/1f642.png&quot;);">:slightly_smiling_face:</span></span> <span data-emoticon="wink"><span alt=":wink:" class="emoticon" data-testid="postEmoji.:wink:" style="background-image: url(&quot;${baseUrl}/static/emoji/1f609.png&quot;);">:wink:</span></span> <span data-emoticon="scream"><span alt=":scream:" class="emoticon" data-testid="postEmoji.:scream:" style="background-image: url(&quot;${baseUrl}/static/emoji/1f631.png&quot;);">:scream:</span></span> <span data-emoticon="bamboo"><span alt=":bamboo:" class="emoticon" data-testid="postEmoji.:bamboo:" style="background-image: url(&quot;${baseUrl}/static/emoji/1f38d.png&quot;);">:bamboo:</span></span> <span data-emoticon="gift_heart"><span alt=":gift_heart:" class="emoticon" data-testid="postEmoji.:gift_heart:" style="background-image: url(&quot;${baseUrl}/static/emoji/1f49d.png&quot;);">:gift_heart:</span></span> <span data-emoticon="dolls"><span alt=":dolls:" class="emoticon" data-testid="postEmoji.:dolls:" style="background-image: url(&quot;${baseUrl}/static/emoji/1f38e.png&quot;);">:dolls:</span></span></p>\n</blockquote>`;

        // Read markdown content from file
        const markdownPath = join(__dirname, '../../../../fixtures/markdown', 'markdown_block_quotes_2.md');
        const markdownContent = readFileSync(markdownPath, 'utf-8');
        
        // Post markdown message
        await channelsPage.postMessage(markdownContent);
        
        // Wait for the message to be posted
        await channelsPage.centerView.waitUntilLastPostContains('Block Quotes');
        
        // Get the last post and verify HTML content
        const lastPost = await channelsPage.getLastPost();
        
        // Verify that HTML Content is correct using POM method
        const actualHtml = await lastPost.getMessageHtml();
        expect(actualHtml).toBe(expectedHtml);
    });
});