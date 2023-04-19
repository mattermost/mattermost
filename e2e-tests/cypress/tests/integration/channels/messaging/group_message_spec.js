// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @messaging

import * as TIMEOUTS from '../../../fixtures/timeouts';
import {spyNotificationAs} from '../../../support/notification';

describe('Group Message', () => {
    let testTeam;
    let testUser;
    let townsquareLink;
    var users = [];

    const groupUsersCount = 3;

    before(() => {
        cy.apiInitSetup({}).then(({team, user, townSquareUrl}) => {
            testTeam = team;
            testUser = user;
            townsquareLink = townSquareUrl;
        });
    });

    beforeEach(() => {
        cy.apiAdminLogin();

        // Add users on the testTeam
        Cypress._.times(groupUsersCount, (i) => {
            cy.apiCreateUser().then(({user: newUser}) => {
                cy.apiAddUserToTeam(testTeam.id, newUser.id);
                users.push(newUser);
                if (i === groupUsersCount - 1) {
                    cy.apiLogin(testUser);
                    cy.visit(townsquareLink);
                }
            });
        });
    });

    it('MM-T3319 Add GM', () => {
        const otherUser1 = users[0];
        const otherUser2 = users[1];

        // # Click on '+' sign to open DM modal
        cy.uiAddDirectMessage().click();

        // * Verify that the DM modal is open
        cy.get('#moreDmModal').should('be.visible').contains('Direct Messages');

        // # Search for the user otherA
        cy.get('#selectItems input').should('be.enabled').typeWithForce(`@${otherUser1.username}`);

        // * Verify that the user is found and add to GM
        cy.get('#moreDmModal .more-modal__row').should('be.visible').and('contain', otherUser1.username).click({force: true});

        // # Search for the user otherB
        cy.get('#selectItems input').should('be.enabled').typeWithForce(`@${otherUser2.username}`);

        // * Verify that the user is found and add to GM
        cy.get('#moreDmModal .more-modal__row').should('be.visible').and('contain', otherUser2.username).click({force: true});

        // # Search for the current user
        cy.get('#selectItems input').should('be.enabled').typeWithForce(`@${testUser.username}`);

        // * Assert that it's not found
        cy.get('.no-channel-message').should('be.visible').and('contain', 'No results found matching');

        // # Start GM
        cy.findByText('Go').click();

        // # Post something to create a GM
        cy.uiGetPostTextBox().type('Hi!').type('{enter}');

        // # Click on '+' sign to open DM modal
        cy.uiAddDirectMessage().click();

        // * Verify that the DM modal is open
        cy.get('#moreDmModal').should('be.visible').contains('Direct Messages');

        // # Search for the user otherB
        cy.get('#selectItems input').should('be.enabled').typeWithForce(`@${otherUser2.username}`);

        // * Verify that the user is found and is part of the GM together with the other user
        cy.get('#moreDmModal .more-modal__row').should('be.visible').and('contain', otherUser2.username).and('contain', otherUser1.username);
    });

    it('MM-T460 - Add and Remove users whilst creating a group message', () => {
        // # Create a group message with two other users
        createGroupMessageWith(users.slice(0, 2));

        // # Open channel menu and click Add Members
        cy.uiOpenChannelMenu('Add Members');

        // # Filter user by username
        cy.get('#selectItems input').typeWithForce(users[2].username).wait(TIMEOUTS.HALF_SEC);

        // # Click the first user on a filtered list
        cy.get('#multiSelectList .clickable').first().click();

        // * Assert that member info updates to reflect the new addition
        cy.get('#multiSelectHelpMemberInfo').should('contain', 'You can add 4 more people');

        // # Click the first user on an unfiltered list
        cy.get('#multiSelectList .clickable').first().click();

        // * Assert that member info updates to reflect the new addition
        cy.get('#multiSelectHelpMemberInfo').should('contain', 'You can add 3 more people');

        // # Remove user by clicking the remove(x) button
        cy.get('#selectItems .react-select__multi-value__remove').first().click();

        // * Assert that member info updates to reflect the new addition
        cy.get('#multiSelectHelpMemberInfo').should('contain', 'You can add 4 more people');

        // # Remove last user on the list by typing backspace
        cy.get('#selectItems input').typeWithForce('{backspace}').wait(TIMEOUTS.HALF_SEC);

        // * Assert that member info updates to reflect the new addition
        cy.get('#multiSelectHelpMemberInfo').should('contain', 'You can add 5 more people');
    });

    it('MM-T465 - Assert that group message participant sees', () => {
        // # Create a group message with two other users
        const participants = users.slice(0, 2);
        createGroupMessageWith(participants);
        cy.wait(TIMEOUTS.HALF_SEC);

        const sortedParticipants = participants.sort((a, b) => {
            return a.username > b.username ? 1 : -1;
        });

        // * Assert that intro message includes the right copy
        const expectedChannelInfo = `This is the start of your group message history with ${sortedParticipants[0].username}, ${sortedParticipants[1].username}.Messages and files shared here are not shown to people outside this area.`;
        cy.get('#channelIntro p.channel-intro-text').first().should('contain', expectedChannelInfo);
        cy.get('#channelIntro .profile-icon').should('have.length', '2');

        cy.location().then((loc) => {
            const channelId = loc.pathname.split('/').slice(-1)[0];

            // * Assert that sidebar displays the group channel
            cy.get(`#sidebarItem_${channelId}`).should('contain', `${sortedParticipants[0].username}, ${sortedParticipants[1].username}`);

            // * Assert that member count shows next to the channel name
            cy.get(`#sidebarItem_${channelId} .status`).eq(0).should('contain', '2');
        });
    });

    it('MM-T469 - Post an @mention on a group channel', () => {
        spyNotificationAs('withNotification', 'granted');

        // # Create a group message with two other users
        const participants = users.slice(0, 2);
        createGroupMessageWith(participants);
        cy.wait(TIMEOUTS.HALF_SEC);

        // # Post a message as a different user
        cy.getCurrentChannelId().then((channelId) => {
            cy.postMessageAs({sender: participants[0], message: `@${testUser.username} Hello!!!`, channelId});

            // * Assert that user receives notification
            cy.wait(TIMEOUTS.HALF_SEC);
            cy.get('@withNotification').should('have.been.called');
        });
    });

    it('MM-T475 - Channel preferences, mute channel', () => {
        spyNotificationAs('withNotification', 'granted');

        // # Create a group message with two other users
        const participants = users.slice(0, 2);
        createGroupMessageWith(participants);
        cy.wait(TIMEOUTS.HALF_SEC);

        // # Clicks on Mute Channel through Notification Preferences
        cy.uiOpenChannelMenu().within(() => {
            // # Set Mute Channel to On
            cy.get('#markUnreadEdit').click();
            cy.get('#channelNotificationUnmute').click();
            cy.get('#saveSetting').click();

            // * Assert that channel is muted
            cy.get('#toggleMute').should('be.visible');
        });

        // # Post a message as a different user
        cy.getCurrentChannelId().then((channelId) => {
            let channelName;

            cy.location().then((loc) => {
                channelName = loc.pathname.split('/').slice(-1)[0];
            });

            cy.postMessageAs({sender: participants[0], message: 'Hello all', channelId}).then(() => {
                cy.visit(townsquareLink);

                // * Assert that user does not receives a notification
                cy.get('@withNotification').should('not.have.been.called');

                // * Should not have unread mentions indicator.

                cy.get(`#sidebarItem_${channelName}`).
                    scrollIntoView().
                    find('#unreadMentions').
                    should('not.exist');
            });

            cy.postMessageAs({sender: participants[0], message: `@${testUser.username} Hello!!!`, channelId}).then(() => {
                cy.apiLogin(testUser);
                cy.visit(townsquareLink);

                // * Assert that user does not receives a notification
                cy.get('@withNotification').should('not.have.been.called');

                // * Should have unread mentions indicator.

                cy.get(`#sidebarItem_${channelName}`).
                    scrollIntoView().
                    get('#unreadMentions').
                    should('exist');
            });
        });
    });

    it('MM-T478 - Open existing group message from More... section', () => {
        // # Create a group message with two other users
        const participants = users.slice(0, 2);
        const sortedParticipants = participants.sort((a, b) => {
            return a.username > b.username ? 1 : -1;
        });

        createGroupMessageWith(participants);
        cy.wait(TIMEOUTS.HALF_SEC);

        cy.location().then((loc) => {
            const channelName = loc.pathname.split('/').slice(-1)[0];

            // # Remove GM from the LHS
            cy.uiGetChannelSidebarMenu(channelName).within(() => {
                cy.findByText('Close Conversation').click();
            });

            // # Open DM modal
            cy.uiAddDirectMessage().click().wait(TIMEOUTS.HALF_SEC);

            // # Open previously closed group message
            cy.get('#selectItems input').typeWithForce(participants[0].username).wait(TIMEOUTS.HALF_SEC);
            cy.get('#multiSelectList .suggestion-list__item').last().click().wait(TIMEOUTS.HALF_SEC);

            // * Verify that participants are listed in the input field
            cy.get('#selectItems').should('contain', `${sortedParticipants[0].username}${sortedParticipants[1].username}`);

            // # Open group message
            cy.get('#saveItems').click().wait(TIMEOUTS.HALF_SEC);

            // * Verify that page renders with the right information
            cy.get('#channelHeaderTitle').should('contain', `${sortedParticipants[0].username}, ${sortedParticipants[1].username}`);
        });
    });
});

const createGroupMessageWith = (users) => {
    const defaultUserLimit = 7;
    cy.uiAddDirectMessage().click().wait(TIMEOUTS.HALF_SEC);
    cy.get('#multiSelectHelpMemberInfo').should('contain', 'You can add 7 more people');

    users.forEach((user, index) => {
        cy.get('#selectItems input').typeWithForce(user.username).type('{enter}').wait(TIMEOUTS.HALF_SEC);

        // * Assert that member info updates whilst adding new members
        cy.get('#multiSelectHelpMemberInfo').should('contain', `You can add ${defaultUserLimit - (index + 1)} more people`);
    });

    // # Save group message member changes
    cy.get('#saveItems').click().wait(TIMEOUTS.HALF_SEC);
};
