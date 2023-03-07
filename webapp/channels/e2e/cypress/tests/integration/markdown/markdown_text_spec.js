// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @markdown @not_cloud

import * as TIMEOUTS from '../../fixtures/timeouts';

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

describe('Markdown message', () => {
    before(() => {
        // # Enable local image proxy so our expected URLs match
        const newSettings = {
            ImageProxySettings: {
                Enable: true,
                ImageProxyType: 'local',
                RemoteImageProxyURL: '',
                RemoteImageProxyOptions: '',
            },
        };
        cy.apiUpdateConfig(newSettings);

        // # Login as new user, create new team and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    testCases.forEach((testCase) => {
        it(testCase.name, () => {
            // #  Post markdown message
            cy.postMessageFromFile(`markdown/${testCase.fileKey}.md`).wait(TIMEOUTS.FIVE_SEC);

            // * Verify that HTML Content is correct
            cy.compareLastPostHTMLContentFromFile(`markdown/${testCase.fileKey}.html`);
        });
    });

    it('Markdown - block quotes 2', () => {
        const baseUrl = Cypress.config('baseUrl');
        const expectedHtml = `<h3 class="markdown__heading">Block Quotes</h3><p><strong>The following markdown should render within the block quote:</strong></p>
<blockquote>
<h4 class="markdown__heading">Heading 4</h4><p><em>Italics</em>, <em>Italics</em>, <strong>Bold</strong>, <strong><em>Bold-italics</em></strong>, <strong><em>Bold-italics</em></strong>, <del>Strikethrough</del>
<span data-emoticon="slightly_smiling_face"><span alt=":slightly_smiling_face:" class="emoticon" title=":slightly_smiling_face:" style="background-image: url(&quot;${baseUrl}/static/emoji/1f642.png&quot;);">:slightly_smiling_face:</span></span> <span data-emoticon="slightly_smiling_face"><span alt=":slightly_smiling_face:" class="emoticon" title=":slightly_smiling_face:" style="background-image: url(&quot;${baseUrl}/static/emoji/1f642.png&quot;);">:slightly_smiling_face:</span></span> <span data-emoticon="wink"><span alt=":wink:" class="emoticon" title=":wink:" style="background-image: url(&quot;${baseUrl}/static/emoji/1f609.png&quot;);">:wink:</span></span> <span data-emoticon="scream"><span alt=":scream:" class="emoticon" title=":scream:" style="background-image: url(&quot;${baseUrl}/static/emoji/1f631.png&quot;);">:scream:</span></span> <span data-emoticon="bamboo"><span alt=":bamboo:" class="emoticon" title=":bamboo:" style="background-image: url(&quot;${baseUrl}/static/emoji/1f38d.png&quot;);">:bamboo:</span></span> <span data-emoticon="gift_heart"><span alt=":gift_heart:" class="emoticon" title=":gift_heart:" style="background-image: url(&quot;${baseUrl}/static/emoji/1f49d.png&quot;);">:gift_heart:</span></span> <span data-emoticon="dolls"><span alt=":dolls:" class="emoticon" title=":dolls:" style="background-image: url(&quot;${baseUrl}/static/emoji/1f38e.png&quot;);">:dolls:</span></span></p>
</blockquote>`;

        // #  Post markdown message
        cy.postMessageFromFile('markdown/markdown_block_quotes_2.md').wait(TIMEOUTS.FIVE_SEC);

        // * Verify that HTML Content is correct
        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId}`, {timeout: TIMEOUTS.TEN_SEC}).should('have.html', expectedHtml);
        });
    });
});
