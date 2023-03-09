// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @integrations

import {getRandomId} from '../../../utils';

import {loginAndVisitChannel} from './helper';

describe('Integrations', () => {
    let testUser;
    const userGroup = [];
    let offTopicUrl;

    before(() => {
        cy.apiInitSetup().then(({team, user, offTopicUrl: url}) => {
            testUser = user;
            offTopicUrl = url;

            Cypress._.times(8, () => {
                cy.apiCreateUser().then(({user: otherUser}) => {
                    cy.apiAddUserToTeam(team.id, otherUser.id);
                    userGroup.push(otherUser);
                });
            });
        });
    });

    it('MM-T664 /groupmsg initial tests', () => {
        function verifyPostedMessage(message, usernames) {
            // * Verify that the channel header contains each group member
            usernames.forEach((username) => {
                cy.contains('.channel-header__top', username).should('be.visible');
            });

            // * Verify that the message is posted into the GM channel
            cy.uiWaitUntilMessagePostedIncludes(message);
            cy.getLastPostId().then((postId) => {
                cy.get(`#postMessageText_${postId}`).should('have.text', message);
            });

            // # Go back to off-topic channel
            cy.uiGetLhsSection('CHANNELS').findByText('Off-Topic').click();
        }

        loginAndVisitChannel(testUser, offTopicUrl);

        const usernames1 = Cypress._.map(userGroup, 'username').slice(0, 4);
        const usernames1Format = [
            `@${usernames1[0]},@${usernames1[1]},@${usernames1[2]},@${usernames1[3]}`, // Regular usernames format
            `${usernames1[0]}, @${usernames1[1]} , ${usernames1[2]} , @${usernames1[3]}`, // Irregular usernames format
        ];

        usernames1Format.forEach((users) => {
            const message = getRandomId();

            // # Use /groupmsg command to send group message - "/groupmsg [usernames] [message]"
            cy.postMessage(`/groupmsg ${users} ${message}`);

            // * Verify it redirects into the GM channel with new message posted.
            verifyPostedMessage(message, usernames1);

            // # Use /groupmsg command to send message to existing GM - "group msg [usernames]" (note: no message)
            cy.postMessage(`/groupmsg ${users} `);

            // * Verify it redirects into the GM channel without new message posted.
            verifyPostedMessage(message, usernames1);
        });

        const usernames2 = Cypress._.map(userGroup, 'username').slice(1, 5);
        const usernames2Format = [
            `@${usernames2[0]}, @${usernames2[1]}, @${usernames2[2]}, @${usernames2[3]}`, // Regular usernames format
            `${usernames2[0]}, @${usernames2[1]} , ${usernames2[2]} , @${usernames2[3]}`, // Irregular usernames format
        ];

        usernames2Format.forEach((users) => {
            // # Use /groupmsg command to create GM - "group msg [usernames]" (note: no message)
            cy.postMessage(`/groupmsg ${users} `);

            // * Verify that the channel header contains each group member
            usernames2.forEach((username) => {
                cy.contains('.channel-header__top', username).should('be.visible');
            });
        });
    });

    it('MM-T665 /groupmsg with users only and without message', () => {
        loginAndVisitChannel(testUser, offTopicUrl);

        // # Use /groupmsg command to open group message - "/groupmsg [usernames]"
        const usernames = Cypress._.map(userGroup, 'username').slice(0, 3);
        const message = '/groupmsg @' + usernames.join(', @') + ' ';
        cy.postMessage(message);

        // * Verify that the channel header contains each group member
        usernames.forEach((username) => {
            cy.contains('.channel-header__top', username).should('be.visible');
        });
    });

    it('MM-T666 /groupmsg error if messaging more than 7 users', () => {
        loginAndVisitChannel(testUser, offTopicUrl);

        // # Include more than 7 valid users in the command
        const usernames = Cypress._.map(userGroup, 'username');
        const message = '/groupmsg @' + usernames.join(', @') + ' hello';
        cy.postMessage(message);

        // * If adding more than 7 users (excluding current user), system message saying "Group messages are limited to a maximum of 7 users."
        cy.uiWaitUntilMessagePostedIncludes('Group messages are limited to a maximum of 7 users');
        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId}`).should('have.text', 'Group messages are limited to a maximum of 7 users.');
        });

        // # Include one invalid user in the command
        const message2 = '/groupmsg @' + usernames.slice(0, 2).join(', @') + ', @hello again';
        cy.postMessage(message2);

        // * If users cannot be found, returns error that user could not be found
        cy.uiWaitUntilMessagePostedIncludes('Unable to find the user: @hello');
        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId}`).should('have.text', 'Unable to find the user: @hello');
        });

        // # Include more than one invalid user in the command
        const message3 = '/groupmsg @' + usernames.slice(0, 2).join(', @') + ', @hello, @world again';
        cy.postMessage(message3);

        // * If users cannot be found, returns error that user could not be found
        cy.uiWaitUntilMessagePostedIncludes('Unable to find the users: @hello, @world');
        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId}`).should('have.text', 'Unable to find the users: @hello, @world');
        });
    });
});
