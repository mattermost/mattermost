// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

describe('Markdown list item paragraph spacing', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();

        // # Login as test user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
            cy.postMessage('hello');
        });
    });

    it('MM-T51016 keeps single-paragraph loose list items inline', () => {
        // # Post a loose list that renders paragraph tags inside list items
        cy.postMessageFromFile('markdown/markdown_list_loose_items.md');

        cy.getLastPostId().then((postId) => {
            const postMessageTextId = `#postMessageText_${postId}`;

            // * Loose-list paragraphs should stay inline
            cy.contains(`${postMessageTextId} li span > p`, 'Item B').should('have.css', 'display', 'inline');
            cy.contains(`${postMessageTextId} li span > p`, 'Item C').should('have.css', 'display', 'inline');
            cy.get(`${postMessageTextId} li`).then(($listItems) => {
                const topDeltas = Array.from($listItems).slice(1).map((item, index) => {
                    return item.getBoundingClientRect().top - $listItems[index].getBoundingClientRect().top;
                });
                const minDelta = Math.min(...topDeltas);
                const maxDelta = Math.max(...topDeltas);

                topDeltas.forEach((delta) => expect(delta).to.be.lessThan(30));
                expect(maxDelta - minDelta).to.be.lessThan(4);
            });
        });

        // # Post a loose ordered list with a nested list in the same item
        cy.postMessageFromFile('markdown/markdown_list_nested_loose_item.md');

        cy.getLastPostId().then((postId) => {
            const postMessageTextId = `#postMessageText_${postId}`;

            // * A single paragraph followed by a nested list should also stay inline
            cy.contains(`${postMessageTextId} li span > p`, 'One').should('have.css', 'display', 'inline');
        });
    });

    it('MM-T51016 keeps multi-paragraph list items as block paragraphs', () => {
        // # Post a list item with two paragraphs
        cy.postMessageFromFile('markdown/markdown_list_multi_paragraph.md');

        cy.getLastPostId().then((postId) => {
            const postMessageTextId = `#postMessageText_${postId}`;

            // * Multiple paragraphs in the same list item should keep block layout
            cy.get(`${postMessageTextId} li span > p`).should('have.length', 2);
            cy.contains(`${postMessageTextId} li span > p`, 'First paragraph').should('have.css', 'display', 'block');
            cy.contains(`${postMessageTextId} li span > p`, 'Second paragraph').should('have.css', 'display', 'block');
            cy.contains(`${postMessageTextId} li span > p`, 'First paragraph').then(($firstParagraph) => {
                cy.contains(`${postMessageTextId} li span > p`, 'Second paragraph').then(($secondParagraph) => {
                    const gap = $secondParagraph[0].getBoundingClientRect().top - $firstParagraph[0].getBoundingClientRect().bottom;
                    expect(gap).to.be.greaterThan(8);
                });
            });
        });
    });

    it('MM-T51016 keeps list item paragraph spacing correct in preview', () => {
        cy.fixture('markdown/markdown_list_loose_items.md', 'utf-8').then((text) => {
            cy.get('#post_textbox').invoke('val', text).trigger('input');
        });

        cy.get('#PreviewInputTextButton').click();

        cy.contains('.textbox-preview-area li span > p', 'Item B').should('have.css', 'display', 'inline');
        cy.contains('.textbox-preview-area li span > p', 'Item C').should('have.css', 'display', 'inline');
        cy.get('.textbox-preview-area li').then(($listItems) => {
            const topDeltas = Array.from($listItems).slice(1).map((item, index) => {
                return item.getBoundingClientRect().top - $listItems[index].getBoundingClientRect().top;
            });
            const minDelta = Math.min(...topDeltas);
            const maxDelta = Math.max(...topDeltas);

            topDeltas.forEach((delta) => expect(delta).to.be.lessThan(30));
            expect(maxDelta - minDelta).to.be.lessThan(4);
        });

        cy.get('#PreviewInputTextButton').click();

        cy.fixture('markdown/markdown_list_nested_loose_item.md', 'utf-8').then((text) => {
            cy.get('#post_textbox').invoke('val', text).trigger('input');
        });

        cy.get('#PreviewInputTextButton').click();

        cy.contains('.textbox-preview-area li span > p', 'One').should('have.css', 'display', 'inline');

        cy.get('#PreviewInputTextButton').click();

        cy.fixture('markdown/markdown_list_multi_paragraph.md', 'utf-8').then((text) => {
            cy.get('#post_textbox').invoke('val', text).trigger('input');
        });

        cy.get('#PreviewInputTextButton').click();

        cy.get('.textbox-preview-area li span > p').should('have.length', 2);
        cy.contains('.textbox-preview-area li span > p', 'First paragraph').should('have.css', 'display', 'block');
        cy.contains('.textbox-preview-area li span > p', 'Second paragraph').should('have.css', 'display', 'block');
        cy.contains('.textbox-preview-area li span > p', 'First paragraph').then(($firstParagraph) => {
            cy.contains('.textbox-preview-area li span > p', 'Second paragraph').then(($secondParagraph) => {
                const gap = $secondParagraph[0].getBoundingClientRect().top - $firstParagraph[0].getBoundingClientRect().bottom;
                expect(gap).to.be.greaterThan(8);
            });
        });
    });
});
