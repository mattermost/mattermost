// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// # Indicates a test step (e.g. # Go to a page)
// [*] indicates an assertion (e.g. * Check the title)
// Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @toast

describe('Toast', () => {
    let testChannelDisplayName;
    let testChannelUrl;

    before(() => {
        // # Create new team and new user
        cy.apiInitSetup({loginAfter: true}).then(({channel, channelUrl}) => {
            testChannelDisplayName = channel.display_name;
            testChannelUrl = channelUrl;

            cy.visit(testChannelUrl);
        });
    });

    it('MM-T1791 Permalink \'Jump to\' in Search', () => {
        // # Search for a term e.g.test
        const searchTerm = 'test';
        cy.postMessage(searchTerm);
        cy.uiGetSearchBox().type(searchTerm).type('{enter}');

        // # Click on Jump to link in search results
        cy.get('.search-item__jump').first().click();

        cy.getLastPostId().then((postId) => {
            // # Jump to link opens on main channel view
            cy.url().should('include', `${testChannelUrl}/${postId}`);
            cy.get('#channelHeaderInfo').should('be.visible').and('contain', testChannelDisplayName);

            // # Post is highlighted then fades out.
            cy.get(`#post_${postId}`).should('have.class', 'post--highlight');
            cy.get(`#post_${postId}`).should('not.have.class', 'post--highlight');

            // # URL changes to channel url
            cy.url().should('include', testChannelUrl).and('not.include', postId);
        });
    });
});
