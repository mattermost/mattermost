// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

import * as TIMEOUTS from '../../fixtures/timeouts';
import {spyNotificationAs} from '../../support/notification';

describe('Direct Message', () => {
    let testTeam;
    let testUser;
    let otherUser;
    let townsquareLink;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
            townsquareLink = `/${team.name}/channels/town-square`;
            cy.apiCreateUser().then(({user: user1}) => {
                otherUser = user1;
                cy.apiAddUserToTeam(testTeam.id, otherUser.id);
            });
        });
    });

    beforeEach(() => {
        cy.apiLogin(testUser);
        cy.visit(townsquareLink);
    });

    it('MM-T449 - Edit a direct message body', () => {
        const originalMessage = 'Hello';
        const editedMessage = 'Hello World';

        // Sent a DM that can be edited
        cy.apiCreateDirectChannel([testUser.id, otherUser.id]).then(({channel}) => {
            // Have another user send you a DM
            cy.postMessageAs({sender: testUser, message: originalMessage, channelId: channel.id}).wait(TIMEOUTS.HALF_SEC);
        }).apiLogout().wait(TIMEOUTS.HALF_SEC);

        cy.apiLogin(otherUser).then(() => {
            // # Visit the DM channel
            cy.visit(`/${testTeam.name}/messages/@${testUser.username}`);

            // * Verify message is sent and not pending
            cy.getLastPostId().then((postId) => {
                const postText = `#postMessageText_${postId}`;
                cy.get(postText).should('have.text', originalMessage);
            });
        }).apiLogout().wait(TIMEOUTS.HALF_SEC);

        cy.apiLogin(testUser).then(() => {
            // # Visit the DM channel
            cy.visit(`/${testTeam.name}/messages/@${otherUser.username}`);

            // # Edit the last post
            cy.uiGetPostTextBox();
            cy.uiGetPostTextBox().clear().type('{uparrow}');

            // * Edit post Input should appear, and edit the post
            cy.get('#edit_textbox').should('be.visible');
            cy.get('#edit_textbox').should('have.text', originalMessage).type(' World{enter}');
            cy.get('#edit_textbox').should('not.exist');

            // * Verify that last post does contain "Edited"
            cy.getLastPostId().then((postId) => {
                const postEdited = `#postEdited_${postId}`;
                cy.get(postEdited).should('be.visible').and('have.text', 'Edited');
            });
        }).apiLogout().wait(TIMEOUTS.HALF_SEC);

        cy.apiLogin(otherUser).then(() => {
            // # Visit the DM channel
            cy.visit(`/${testTeam.name}/messages/@${testUser.username}`);

            // * Should not have unread mentions indicator.
            cy.get('#sidebarItem_off-topic').
                scrollIntoView().
                find('#unreadMentions').
                should('not.exist');

            // * Verify message is sent and not pending
            cy.getLastPostId().then((postId) => {
                const postText = `#postMessageText_${postId}`;
                const postEdited = `#postEdited_${postId}`;

                // * Check the post and verify that it contains new edited message.
                cy.get(postText).should('have.text', `${editedMessage} Edited`);
                cy.get(postEdited).should('be.visible');
            });
        }).apiLogout().wait(TIMEOUTS.HALF_SEC);
    });

    it('MM-T457 - Self direct message', () => {
        // # Stub notifications API
        spyNotificationAs('withNotification', 'granted');

        // # Open DM modal
        cy.uiAddDirectMessage().click().wait(TIMEOUTS.HALF_SEC);

        // # Search for your username
        cy.get('#selectItems input').
            typeWithForce(testUser.username).
            wait(TIMEOUTS.HALF_SEC);

        // * Verify username shows up on search
        cy.get(`#displayedUserName${testUser.username}`).should('be.visible');

        // # Click on username
        cy.get(`#displayedUserName${testUser.username}`).click().wait(TIMEOUTS.HALF_SEC);

        // * Verify top header
        cy.get('#channelHeaderTitle').should('contain', `${testUser.username} (you)`);

        // # Post a message
        cy.postMessage('todo list for today: 1,2,3');

        // * Desktop notification is not received
        cy.wait(TIMEOUTS.HALF_SEC);
        cy.get('@withNotification').should('not.have.been.called');
    });

    it('MM-T458 - Edit direct message channel header', () => {
        // # Create a DM channel
        cy.apiCreateDirectChannel([testUser.id, otherUser.id]).then(({channel}) => {
            // Have another user send you a DM.
            cy.postMessageAs({sender: otherUser, message: 'Hello', channelId: channel.id}).wait(TIMEOUTS.HALF_SEC);
        });

        // # Visit the DM channel
        cy.visit(`/${testTeam.name}/messages/@${otherUser.username}`);

        // # Click on the channel header
        cy.get('#channelHeaderTitle').click().wait(TIMEOUTS.HALF_SEC);

        // # Click on 'Edit Channel Header'
        cy.get('#channelEditHeader').click().wait(TIMEOUTS.HALF_SEC);

        // # Fill and save channel header changes
        const message = 'This is a line{shift}{enter}{shift}{enter}This is another line';
        const expectedMessage = 'This is a line\n\nThis is another line';
        cy.get('#edit_textbox').type(message).type('{enter}').wait(TIMEOUTS.HALF_SEC);

        // # Hover on channel header
        cy.get('#channelHeaderDescription .header-description__text').trigger('mouseover');

        // * Verify changes have been applied on header
        cy.wait(TIMEOUTS.HALF_SEC);
        cy.get('#header-popover .popover-content').should('be.visible');
        cy.get('#header-popover').find('.popover-content').should(($el) => {
            expect($el.get(0).innerText).to.eq(expectedMessage);
        });
    });

    it('MM-T1536 - Mute & Unmute', () => {
        // # Create a DM channel
        cy.apiCreateDirectChannel([testUser.id, otherUser.id]).then(({channel}) => {
            // Have another user send you a DM.
            cy.postMessageAs({sender: otherUser, message: 'Hello', channelId: channel.id}).wait(TIMEOUTS.HALF_SEC);
        });

        // # Visit the DM channel
        cy.visit(`/${testTeam.name}/messages/@${otherUser.username}`);

        // # Open channel menu and click Mute Conversation
        cy.uiOpenChannelMenu('Mute Conversation');

        // * Assert that channel appears as muted on the LHS
        cy.uiGetLhsSection('DIRECT MESSAGES').find('.muted').first().should('contain', otherUser.username);

        // # Open channel menu and click Unmute Conversation
        cy.uiOpenChannelMenu('Unmute Conversation');

        // * Assert that channel does not appear as muted on the LHS
        cy.uiGetLhsSection('DIRECT MESSAGES').find('.muted').should('not.exist');
    });
});
