// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @messaging

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('Messaging', () => {
    let testTeam;
    let testChannel;
    let testUser;
    let userOne;

    before(() => {
        // # Wrap websocket to be able to connect and close connections on demand
        cy.mockWebsockets();

        // # Update config to enable "EnableReliableWebSockets"
        cy.apiUpdateConfig({ServiceSettings: {EnableReliableWebSockets: true}});

        // # Login as test user and go to town-square
        cy.apiInitSetup().then(({team, channel, user}) => {
            testUser = user;
            testTeam = team;
            testChannel = channel;

            cy.apiCreateUser().then(({user: user1}) => {
                userOne = user1;
                cy.apiAddUserToTeam(testTeam.id, userOne.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, userOne.id);
                });
            });

            cy.apiLogin(testUser);
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

            // # Post several messages to establish websocket connection
            Cypress._.times(5, (i) => {
                cy.postMessage(i);
            });
        });
    });

    it('MM-T94 RHS fetches messages on socket reconnect when a different channel is in center', () => {
        // # Connect all sockets
        window.mockWebsockets.forEach((value) => {
            value.connect();
        });

        // # Post a message as another user
        cy.postMessageAs({sender: userOne, message: 'abc', channelId: testChannel.id}).wait(TIMEOUTS.FIVE_SEC);

        // # Click "Reply"
        cy.getLastPostId().then((rootPostId) => {
            cy.clickPostCommentIcon(rootPostId);

            // # Post a message
            cy.postMessageReplyInRHS('def');

            // # Change channel
            cy.uiGetLhsSection('CHANNELS').findByText('Town Square').click().then(() => {
                // # Close all sockets
                window.mockWebsockets.forEach((value) => {
                    if (value.close) {
                        value.close();
                    }
                });

                // # Post message as a different user
                cy.postMessageAs({sender: userOne, message: 'ghi', channelId: testChannel.id, rootId: rootPostId});

                // # Wait a short time to check whether the message appears or not
                cy.wait(TIMEOUTS.FIVE_SEC);

                // * Verify that only "def" is posted and not "ghi"
                cy.get('#rhsContainer .post-right-comments-container').should('be.visible').children().should('have.length', 1);
                cy.get('#rhsContainer .post-right-comments-container').within(() => {
                    cy.findByText('def').should('be.visible');
                    cy.findByText('ghi').should('not.exist');
                }).then(() => {
                    // * Connect all sockets one more time
                    window.mockWebsockets.forEach((value) => {
                        value.connect();
                    });

                    // # Wait for sockets to be connected
                    cy.wait(TIMEOUTS.THREE_SEC);
                    cy.uiGetLhsSection('CHANNELS').findByText('Off-Topic').click();
                    cy.postMessage('any');
                    cy.uiGetLhsSection('CHANNELS').findByText('Town Square').click();
                    cy.postMessage('any');
                    cy.wait(TIMEOUTS.THREE_SEC);

                    // * Verify that both "def" and "ghi" are posted on websocket reconnect
                    cy.get('#rhsContainer .post-right-comments-container').should('be.visible').children().should('have.length', 2);
                    cy.get('#rhsContainer .post-right-comments-container').within(() => {
                        cy.findByText('def').should('be.visible');
                        cy.findByText('ghi').should('be.visible');
                    });
                });
            });
        });
    });
});
