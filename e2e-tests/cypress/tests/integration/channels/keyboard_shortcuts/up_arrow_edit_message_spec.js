// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @keyboard_shortcuts

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

    it('MM-T1235 Arrow up key - no Edit modal open up if user has not posted any message yet', () => {
        const message2 = 'Test message from User 2';

        cy.apiLogin(otherUser);

        // # Visit the channel using the channel name
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Post message in the channel from User 2
        cy.postMessage(message2);
        cy.apiLogout();

        cy.apiLogin(testUser);
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Press UP arrow
        cy.uiGetPostTextBox().type('{uparrow}');

        // * Verify that Edit modal should not be visible
        cy.get('#edit_textbox').should('not.exist');
    });

    it('MM-T1236 Arrow up key - Edit Input opens up for own message of a user', () => {
        const message1 = 'Test message from User 1';
        const message2 = 'Test message from User 2';

        cy.apiLogin(testUser);

        // # Visit the channel using the channel name
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Post message in the channel from User 1
        cy.postMessage(message1);
        cy.apiLogout();

        cy.apiLogin(otherUser);

        // # Visit the channel using the channel name
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Post message in the channel from User 2
        cy.postMessage(message2);
        cy.apiLogout();

        cy.apiLogin(testUser);
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Press UP arrow
        cy.uiGetPostTextBox().type('{uparrow}');

        // * Verify that the Edit Post Input is visible
        cy.get('#edit_textbox').should('be.visible');

        // * Verify that the Edit textbox contains previously sent message by user 1
        cy.get('#edit_textbox').should('have.text', message1);
    });

    it('MM-T1264 Arrow up key - Ephemeral message does not open for edit; opens previous regular message', () => {
        // # Type user message
        const message = 'Hello World';
        cy.postMessage(message);

        // # Type "/code" with no text to receive ephemeral message
        cy.postMessage('/code ');

        // * Verify if an ephemeral message was received
        cy.findByText('(Only visible to you)').should('exist');
        cy.findByText('A message must be provided with the /code command.').should('exist');

        // # Press up arrow key
        cy.get('body').type('{uparrow}');

        // * Verify that the Edit Post Input is visible
        cy.get('#edit_textbox').should('be.visible');

        // * Verify that edit box have value of previous regular message
        cy.get('#edit_textbox').should('have.value', message);
    });
});
