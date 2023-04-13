// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel

function verifyNoChannelToJoinMessage(isVisible) {
    cy.findByText('No more channels to join').should(isVisible ? 'be.visible' : 'not.exist');
    cy.findByText('Click \'Create New Channel\' to make a new one').should(isVisible ? 'be.visible' : 'not.exist');
}

describe('more public channels', () => {
    let testUser;
    let otherUser;
    let testTeam;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testUser = user;
            testTeam = team;

            cy.apiCreateUser().then(({user: user1}) => {
                otherUser = user1;
                cy.apiAddUserToTeam(testTeam.id, otherUser.id);
            });

            cy.apiLogin(testUser).then(() => {
                // # create 30 channels
                for (let i = 0; i < 30; i++) {
                    cy.apiCreateChannel(testTeam.id, 'public-channel', 'public-channel');
                }

                // # Go to town square
                cy.visit(`/${team.name}/channels/town-square`);
            });
        });
    });

    it('MM-T1664 Channels do not disappear from More Channels modal', () => {
        // # Login as other user
        cy.apiLogin(otherUser);

        // # Go to town square
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Go to LHS and click 'Browse channels'
        cy.uiBrowseOrCreateChannel('Browse channels').click();

        // * Assert that the moreChannelsModel is visible
        cy.findByRole('dialog', {name: 'More Channels'}).should('be.visible').within(() => {
            // * Assert that the moreChannelsList is visible and the number of channels is 31
            cy.get('#moreChannelsList').should('be.visible').children().should('have.length', 31);

            // # scroll to the middle channel
            cy.get('#moreChannelsList .more-modal__row').eq(15).scrollIntoView();

            // * Assert that the "No more channels to join" message does not exist
            verifyNoChannelToJoinMessage(false);

            // # scroll to the last channel
            cy.get('#moreChannelsList .more-modal__row').last().scrollIntoView();

            // * Assert that the "No more channels to join" message does not exist
            verifyNoChannelToJoinMessage(false);

            // # scroll to the first channel
            cy.get('#moreChannelsList .more-modal__row').first().scrollIntoView();

            // * Assert that the "No more channels to join" message does not exist
            verifyNoChannelToJoinMessage(false);
        });

        // # Login as testUser
        cy.apiLogin(testUser);

        // # Go to town square
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Go to LHS and click 'Browse channels'
        cy.uiBrowseOrCreateChannel('Browse channels').click();

        // * Assert the moreChannelsModel is visible
        cy.findByRole('dialog', {name: 'More Channels'}).should('be.visible').within(() => {
            // * Assert the moreChannelsList does have one child
            cy.get('#moreChannelsList').should('be.visible').children().should('have.length', 1);

            // * Assert that the "No more channels to join" message is visible
            verifyNoChannelToJoinMessage(true);
        });
    });
});
