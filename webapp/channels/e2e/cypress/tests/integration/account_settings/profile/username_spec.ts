// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @account_setting

import {getRandomId} from '../../../utils';

describe('Settings > Sidebar > General > Edit', () => {
    let testTeam;
    let testUser;
    let testChannel;
    let otherUser;
    let offTopicUrl;

    before(() => {
        // # Login as admin and visit off-topic
        cy.apiInitSetup().then(({user, team, channel, offTopicUrl: url}) => {
            testUser = user;
            testTeam = team;
            testChannel = channel;
            offTopicUrl = url;

            cy.apiCreateUser({prefix: 'other'}).then(({user: user1}) => {
                otherUser = user1;

                cy.apiAddUserToTeam(testTeam.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, otherUser.id);
                });
            });

            cy.visit(offTopicUrl);
        });
    });

    beforeEach(() => {
        // # Go to Profile
        cy.uiOpenProfileModal();
    });

    it('MM-T2050 Username cannot be blank', () => {
        // # Clear the username textfield contents
        cy.get('#usernameEdit').click();
        cy.get('#username').clear();
        cy.uiSave();

        // * Check if element is present and contains expected text values
        cy.get('#clientError').should('be.visible').should('contain', 'Username must begin with a letter, and contain between 3 to 22 lowercase characters made up of numbers, letters, and the symbols \'.\', \'-\', and \'_\'.');

        // # Click "x" button to close Profile modal
        cy.uiClose();
    });

    it('MM-T2051 Username min 3 characters', () => {
        // # Edit the username field
        cy.get('#usernameEdit').click();

        // # Add the username to textfield contents
        cy.get('#username').clear().type('te');
        cy.uiSave();

        // * Check if element is present and contains expected text values
        cy.get('#clientError').should('be.visible').should('contain', 'Username must begin with a letter, and contain between 3 to 22 lowercase characters made up of numbers, letters, and the symbols \'.\', \'-\', and \'_\'.');

        // # Click "x" button to close Profile modal
        cy.uiClose();
    });

    it('MM-T2052 Username already taken', () => {
        // # Edit the username field
        cy.get('#usernameEdit').click();

        // # Add the username to textfield contents
        cy.get('#username').clear().type(otherUser.username);
        cy.uiSave();

        // * Check if element is present and contains expected text values
        cy.get('#serverError').should('be.visible').should('contain', 'An account with that username already exists.');

        // # Click "x" button to close Profile modal
        cy.uiClose();
    });

    it('MM-T2053 Username w/ dot, dash, underscore still searches', () => {
        let tempUser;

        // # Create a temporary user
        cy.apiCreateUser({prefix: 'temp'}).then(({user: user1}) => {
            tempUser = user1;

            cy.apiAddUserToTeam(testTeam.id, tempUser.id).then(() => {
                cy.apiAddUserToChannel(testChannel.id, tempUser.id);
            });

            // # Login the temporary user
            cy.apiLogin(tempUser);
            cy.visit(offTopicUrl);
            cy.uiOpenProfileModal();

            // # Step 1
            // # Edit the username field
            cy.get('#usernameEdit').click();

            // # Step 2
            // # Add the username to textfield contents
            const newTempUserName = 'a-' + tempUser.username;
            cy.get('#username').clear().type(newTempUserName);
            cy.uiSaveAndClose();

            // # Step 3
            // * Verify that we've logged in as the temp user
            cy.visit(offTopicUrl);
            cy.uiOpenUserMenu().findByText(`@${newTempUserName}`);
            cy.uiGetSetStatusButton().click();

            // # Step 4
            const text = `${newTempUserName} test message!`;

            // # Post the user name mention declared earlier
            cy.postMessage(text);

            // # Click on the @ button
            cy.uiGetRecentMentionButton().should('be.visible').click();

            cy.get('#search-items-container').should('be.visible').within(() => {
                // * Ensure that the mentions are visible in the RHS
                cy.findByText(newTempUserName);
                cy.findByText(`${newTempUserName} test message!`);
            });

            // # Click on the @ button to toggle off
            cy.uiGetRecentMentionButton().should('be.visible').click();
        });
    });

    it('MM-T2054 Username cannot start with dot, dash, or underscore', () => {
        // # Edit the username field
        cy.get('#usernameEdit').click();

        const prefixes = [
            '.',
            '-',
            '_',
        ];

        for (const prefix of prefixes) {
            // # Add  username to textfield contents
            cy.get('#username').clear().type(prefix).type('{backspace}.').type(otherUser.username);
            cy.uiSave();

            // * Check if element is present and contains expected text values
            cy.get('#clientError').should('be.visible').should('contain', 'Username must begin with a letter, and contain between 3 to 22 lowercase characters made up of numbers, letters, and the symbols \'.\', \'-\', and \'_\'.');
        }

        // # Click "x" button to close Profile modal
        cy.uiClose();
    });

    it('MM-T2055 Usernames that are reserved', () => {
        // # Edit the username field
        cy.get('#usernameEdit').click();

        const usernames = [
            'all',
            'channel',
            'here',
            'matterbot',
        ];

        for (const username of usernames) {
            // # Add  username to textfield contents
            cy.get('#username').clear().type(username);
            cy.uiSave();

            // * Check if element is present and contains expected text values
            cy.get('#clientError').should('be.visible').should('contain', 'This username is reserved, please choose a new one.');
        }

        // # Click "x" button to close Profile modal
        cy.uiClose();
    });

    it('MM-T2056 Username changes when viewed by other user', () => {
        cy.apiLogin(testUser);
        cy.visit(offTopicUrl);

        // # Post a message in off-topic
        cy.postMessage('Testing username update');

        // # Login as other user
        cy.apiLogin(otherUser);
        cy.visit(offTopicUrl);

        // # Get last post in off-topic for verifying username
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).within(() => {
                // # Open profile popover
                cy.get('.user-popover').click();
            });

            // * Verify username in profile popover
            cy.get('#user-profile-popover').within(() => {
                cy.get('#userPopoverUsername').should('be.visible').and('contain', `${testUser.username}`);
            });
        });

        // # Login as test user
        cy.apiLogin(testUser);
        cy.visit(offTopicUrl);

        // # Open account settings modal
        cy.uiOpenProfileModal();

        // # Open Full Name section
        cy.get('#usernameDesc').click();

        const randomId = getRandomId();

        // # Save username with a randomId
        cy.get('#username').clear().type(`${otherUser.username}-${randomId}`);

        // # save form
        cy.uiSave();

        cy.apiLogin(otherUser);
        cy.visit(offTopicUrl);

        // # Get last post in off-topic for verifying username
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).within(() => {
                cy.get('.user-popover').click();
            });

            // * Verify that new username is in profile popover
            cy.get('#user-profile-popover').within(() => {
                cy.get('#userPopoverUsername').should('be.visible').and('contain', `${otherUser.username}-${randomId}`);
            });
        });
    });
});
