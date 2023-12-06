// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Messaging', () => {
    let offtopiclink;

    before(() => {
        // # Login as test user and visit town-square
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            offtopiclink = `/${team.name}/channels/off-topic`;
            cy.visit(offtopiclink);
        });
    });

    it('MM-T99 Edit Post with attachment, paste text in middle', () => {
        // # Got to a test channel on the side bar
        cy.get('#sidebarItem_off-topic').click({force: true});

        // * Validate if the channel has been opened
        cy.url().should('include', offtopiclink);

        // # Upload a file on center view
        cy.get('#fileUploadInput').attachFile('mattermost-icon.png');

        // # Type 'This is sample text' and submit
        cy.postMessage('This is sample text');

        // # Get last post ID
        cy.getLastPostId().then((postID) => {
            // # click  dot menu button
            cy.clickPostDotMenu();

            // # click edit post
            cy.get(`#edit_post_${postID}`).click();

            // # Edit message and finish by hitting `enter`
            cy.get('#edit_textbox').
                should('be.visible').
                and('be.focused').
                wait(TIMEOUTS.HALF_SEC).
                type('{leftarrow}{leftarrow}{leftarrow}{leftarrow}').type('add ').type('{enter}');

            // * Assert post message should contain 'This is sample add text'
            cy.get(`#postMessageText_${postID}`).should('have.text', 'This is sample add text Edited');

            cy.get(`#${postID}_message`).within(() => {
                // * Assert file attachment should still exist
                cy.get('.file-view--single').should('be.visible');
            });
        });
    });
});
