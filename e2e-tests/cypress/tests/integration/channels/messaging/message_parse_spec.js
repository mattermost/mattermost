// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// [#] indicates a test step (e.g. # Go to a page)
// [*] indicates an assertion (e.g. * Check the title)
// Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

describe('Messaging', () => {
    before(() => {
        // # Login as test user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            cy.visit(`/${team.name}/channels/off-topic`);
        });
    });

    it('MM-T196 Markdown correctly parses "://///" and doesn\'t break the channel', () => {
        // # Go to Off-topic as test channel
        cy.get('#sidebarItem_off-topic').click({force: true});

        // # Validate if the channel has been opened
        cy.url().should('include', '/channels/off-topic');

        // # type in the message "://///"
        const message = '://///';
        const textAfterParsed = `:confused:${message.substr(2)}`;
        cy.postMessage(message);

        // # check if message sent correctly, it should parse it as 😕////"
        cy.getLastPostId().then((postId) => {
            verifyPostedMessage(postId, textAfterParsed);

            // # check if message still correctly parses after reload
            cy.reload();
            verifyPostedMessage(postId, textAfterParsed);
        });
    });

    function verifyPostedMessage(postId, text) {
        cy.get(`#postMessageText_${postId}`).should('be.visible').within((el) => {
            cy.wrap(el).should('have.text', text);
            cy.get('.emoticon').should('be.visible').and('have.attr', 'title', ':confused:');
        });
    }
});
