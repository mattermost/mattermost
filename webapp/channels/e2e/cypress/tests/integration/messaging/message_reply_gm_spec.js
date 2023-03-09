// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

import {getRandomId} from '../../utils';
import * as TIMEOUTS from '../../fixtures/timeouts';

describe('Reply in existing GM', () => {
    let testUser;
    let otherUser1;
    let otherUser2;
    let testTeam;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiCreateUser({prefix: 'otherA'}).then(({user: newUser}) => {
                otherUser1 = newUser;

                cy.apiAddUserToTeam(team.id, newUser.id);
            });

            cy.apiCreateUser({prefix: 'otherB'}).then(({user: newUser}) => {
                otherUser2 = newUser;

                cy.apiAddUserToTeam(team.id, newUser.id);
            });

            // # Login as test user and go to town square
            cy.apiLogin(testUser);
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T470 Reply in existing GM', () => {
        const userGroupIds = [testUser.id, otherUser1.id, otherUser2.id];

        // # Create a group channel for 3 users
        cy.apiCreateGroupChannel(userGroupIds).then(({channel: gmChannel}) => {
            // # Go to the group message channel
            cy.visit(`/${testTeam.name}/channels/${gmChannel.name}`);
            const rootPostMessage = `this is test message from user: ${otherUser1.id}`;

            // # Post message as otherUser1
            cy.postMessageAs({sender: otherUser1, message: rootPostMessage, channelId: gmChannel.id}).then((post) => {
                cy.uiWaitUntilMessagePostedIncludes(rootPostMessage);

                const rootPostId = post.id;
                const rootPostMessageId = `#rhsPostMessageText_${rootPostId}`;

                // # Click comment icon to open RHS
                cy.clickPostCommentIcon(rootPostId);

                // * Check that the RHS is open
                cy.get('#rhsContainer').should('be.visible');

                // * Verify that the original message is in the RHS
                cy.get('#rhsContainer').find(rootPostMessageId).should('have.text', `${rootPostMessage}`);
                const replyMessage = `A reply ${getRandomId()}`;

                // # Post a reply
                cy.postMessageReplyInRHS(replyMessage);
                cy.getLastPostId().then((replyId) => {
                    // * Verify that the reply is in the RHS with matching text
                    cy.wait(TIMEOUTS.TWO_SEC);
                    cy.get(`#rhsPostMessageText_${replyId}`).should('be.visible').and('have.text', replyMessage);

                    // * Verify that the reply is in the center channel with matching text
                    cy.get(`#postMessageText_${replyId}`).should('be.visible').should('have.text', replyMessage);

                    // # Login as otherUser
                    cy.apiLogin(otherUser1);

                    // # Go to the group message channel
                    cy.visit(`/${testTeam.name}/channels/${gmChannel.name}`);

                    // * Verify that the reply is in the center channel with matching text
                    cy.get(`#postMessageText_${replyId}`).should('be.visible').should('have.text', replyMessage);
                });
            });
        });
    });
});
