// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @search @smoke

/**
 * create new DM channel
 * @param {String} text - DM channel name
 */
function createNewDMChannel(channelname) {
    cy.uiAddDirectMessage().scrollIntoView().click();

    cy.get('#selectItems input').typeWithForce(channelname);

    cy.contains('.more-modal__description', channelname).click({force: true});
    cy.get('#saveItems').click();
}

describe('Search in DMs', () => {
    let otherUser;

    before(() => {
        // # Log in as test user and visit test channel
        cy.apiInitSetup().then(({team, channel, user: testUser}) => {
            Cypress._.times(5, (i) => {
                cy.apiCreateUser().then(({user}) => {
                    if (i === 0) {
                        otherUser = user;
                    }

                    cy.apiAddUserToTeam(team.id, user.id).then(() => {
                        cy.apiAddUserToChannel(channel.id, user.id);
                    });
                });
            });

            cy.apiLogin(testUser);
            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });

    it('MM-T358 Search "in:[username]" returns results in DMs', () => {
        const message = 'Hello' + Date.now();

        // # Ensure Direct Message is visible in LHS sidebar
        cy.uiGetLhsSection('DIRECT MESSAGES').should('be.visible');

        // # Create new DM channel with user's email
        createNewDMChannel(otherUser.email);

        // # Post message to user
        cy.postMessage(message);

        // # Type `in:` in searchbox
        cy.get('#searchBox').type('in:');

        // # Select user from suggestion list
        cy.contains('.suggestion-list__item', `@${otherUser.username}`).scrollIntoView().click();

        // # Validate searchbox contains the username
        cy.get('#searchBox').should('have.value', 'in:@' + otherUser.username + ' ');

        // # Press Enter in searchbox
        cy.get('#searchBox').type(message).type('{enter}');

        // # Search message in each filtered result
        cy.get('#search-items-container').find('.search-highlight').each(($el) => {
            cy.wrap($el).should('have.text', message);
        });
    });
});
