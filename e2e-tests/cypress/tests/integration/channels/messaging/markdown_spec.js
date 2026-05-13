// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @not_cloud @messaging @markdown

import * as TIMEOUTS from '@/fixtures/timeouts';

const testCases = [
    {name: 'Markdown - typescript', fileKey: 'markdown_typescript'},
    {name: 'Markdown - postgres', fileKey: 'markdown_postgres'},
    {name: 'Markdown - latex', fileKey: 'markdown_latex'},
    {name: 'Markdown - python', fileKey: 'markdown_python'},
    {name: 'Markdown - shell', fileKey: 'markdown_shell'},
];

describe('Markdown', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();

        // # Enable latex
        cy.apiUpdateConfig({
            ServiceSettings: {
                EnableLatex: true,
                EnableTesting: true,
            },
        });

        // # Login as test user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
            cy.postMessage('hello');
        });
    });

    testCases.forEach((testCase, i) => {
        it(`MM-T1734_${i + 1} Code highlighting - ${testCase.name}`, () => {
            // #  Post markdown message
            cy.postMessageFromFile(`markdown/${testCase.fileKey}.md`).wait(TIMEOUTS.ONE_SEC);

            // * Verify that HTML Content is correct
            cy.compareLastPostHTMLContentFromFile(`markdown/${testCase.fileKey}.html`);
        });
    });

    it('MM-T2241 Markdown basics', () => {
        // # Post markdown message
        postMarkdownTest('/test url test-markdown-basics.md');

        let postId;
        let expectedHtml;
        cy.getNthPostId(-2).then((id) => {
            postId = id;
            return cy.fixture('markdown/markdown_test_basic.html', 'utf-8');
        }).then((html) => {
            expectedHtml = html;
            const postMessageTextId = `#postMessageText_${postId}`;
            return cy.get(postMessageTextId).invoke('html');
        }).then((res) => {
            // * Verify that HTML Content is correct
            assert(res === expectedHtml.replace(/\n$/, ''));
        });
    });

    it('MM-T2242 Markdown lists', () => {
        // # Post markdown message
        postMarkdownTest('/test url test-markdown-lists.md');

        let postId;
        let expectedHtml;
        cy.getNthPostId(-2).then((id) => {
            postId = id;
            return cy.fixture('markdown/markdown_list.html', 'utf-8');
        }).then((html) => {
            expectedHtml = html;
            const postMessageTextId = `#postMessageText_${postId}`;
            return cy.get(postMessageTextId).invoke('html');
        }).then((res) => {
            // * Verify that HTML Content is correct
            assert(res === expectedHtml.replace(/\n$/, ''));
        });
    });

    it('MM-T51016 Markdown list item paragraphs render with the right display mode', () => {
        // # Post the existing list fixture with loose-list items that render as a single paragraph
        postMarkdownTest('/test url test-markdown-lists.md');

        cy.getNthPostId(-2).then((postId) => {
            const postMessageTextId = `#postMessageText_${postId}`;

            // * Single-paragraph list items should stay inline so loose lists keep their original spacing
            cy.contains(`${postMessageTextId} li span > p`, 'Item B').should('have.css', 'display', 'inline');
            cy.contains(`${postMessageTextId} li span > p`, 'Item C').should('have.css', 'display', 'inline');
            cy.contains(`${postMessageTextId} li span > p`, 'One').should('have.css', 'display', 'inline');
        });

        // # Post a list item with two paragraphs
        cy.postMessage('- First paragraph\n\n  Second paragraph');

        cy.getLastPostId().then((postId) => {
            const postMessageTextId = `#postMessageText_${postId}`;

            // * Multiple paragraphs in the same list item should keep block layout
            cy.get(`${postMessageTextId} li span > p`).should('have.length', 2);
            cy.contains(`${postMessageTextId} li span > p`, 'First paragraph').should('have.css', 'display', 'block');
            cy.contains(`${postMessageTextId} li span > p`, 'Second paragraph').should('have.css', 'display', 'block');
        });
    });

    it('MM-T2244 Markdown tables', () => {
        // # Post markdown message
        postMarkdownTest('/test url test-tables.md');

        let postId;
        let expectedHtml;
        cy.getNthPostId(-2).then((id) => {
            postId = id;
            return cy.fixture('markdown/markdown_tables.html', 'utf-8');
        }).then((html) => {
            expectedHtml = html;
            const postMessageTextId = `#postMessageText_${postId}`;
            return cy.get(postMessageTextId).invoke('html');
        }).then((res) => {
            // * Verify that HTML Content is correct
            assert(res === expectedHtml.replace(/\n$/, ''));
        });
    });

    it('MM-T2246 Markdown code syntax', () => {
        // # Post markdown message
        postMarkdownTest('/test url test-syntax-highlighting');

        let postId;
        let expectedHtml;
        cy.getNthPostId(-2).then((id) => {
            postId = id;
            return cy.fixture('markdown/markdown_code_syntax.html', 'utf-8');
        }).then((html) => {
            expectedHtml = html;
            const postMessageTextId = `#postMessageText_${postId}`;
            return cy.get(postMessageTextId).invoke('html');
        }).then((res) => {
            // * Verify that HTML Content is correct
            assert(res === expectedHtml.replace(/\n$/, ''));
        });
    });
});

function postMarkdownTest(slashCommand) {
    // # Post markdown message
    cy.postMessage(slashCommand).wait(TIMEOUTS.ONE_SEC);
    cy.uiWaitUntilMessagePostedIncludes('Loaded data');
    cy.wait(TIMEOUTS.ONE_SEC);
}
