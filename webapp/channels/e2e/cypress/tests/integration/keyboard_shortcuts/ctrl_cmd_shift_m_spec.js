// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @keyboard_shortcuts

describe('Keyboard Shortcuts', () => {
    let testTeam;
    let testChannel;
    let testUser;
    let otherUser;

    before(() => {
        cy.apiInitSetup().then(({team, channel, user}) => {
            testTeam = team;
            testChannel = channel;
            testUser = user;

            cy.apiCreateUser({prefix: 'other'}).then(({user: user1}) => {
                otherUser = user1;

                cy.apiAddUserToTeam(testTeam.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, otherUser.id);
                });
            });
        });
    });

    it('MM-T1253 - CTRL/CMD+SHIFT+M', () => {
        const message1 = ' from DM channel';
        const message2 = ' from channel';
        const message3 = ' using suggestion';
        const messagePrefix = `mention @${testUser.username}`;

        cy.apiLogin(testUser);

        // # Create DM channel with the second user
        cy.apiCreateDirectChannel([testUser.id, otherUser.id]).then(() => {
            // # Visit the channel using the channel name
            cy.visit(`/${testTeam.name}/channels/${testUser.id}__${otherUser.id}`);

            // # Post in DM channel
            cy.postMessage(messagePrefix + message1);
        });

        // # Post user name mention in this channel
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
        cy.postMessage(messagePrefix + message2);

        // # Type user name mention and post it to the channel
        cy.uiGetPostTextBox().clear().type(messagePrefix + message3).type('{enter}{enter}');

        // # Type "words that trigger mentions"
        cy.postMessage('mention @here ');
        cy.postMessage('mention @all ');
        cy.postMessage('mention @channel ');

        // # Type CTRL/CMD+SHIFT+M to open search
        cy.get('body').cmdOrCtrlShortcut('{shift}M');

        cy.get('.sidebar--right__title').should('contain', 'Recent Mentions');

        // # Verify that the correct number of mentions are returned
        cy.findAllByTestId('search-item-container').should('be.visible').should('have.length', 3);
        cy.get('#search-items-container').within(() => {
            // * Ensure that the mentions are visible in the RHS
            cy.findAllByText(`@${testUser.username}`).should('be.visible');
        });
    });
});
