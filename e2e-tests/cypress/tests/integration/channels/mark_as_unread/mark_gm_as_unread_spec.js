// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @mark_as_unread

import * as TIMEOUTS from '../../../fixtures/timeouts';

import {verifyPostNextToNewMessageSeparator} from './helpers';

describe('Mark as Unread', () => {
    let testUser;
    let otherUser1;
    let otherUser2;

    before(() => {
        // # Create testUser added to channel
        cy.apiInitSetup().then(({team, user}) => {
            testUser = user;

            // # Create second user and add to the team
            cy.apiCreateUser({prefix: 'otherA'}).then(({user: newUser}) => {
                otherUser1 = newUser;

                cy.apiAddUserToTeam(team.id, newUser.id);
            });

            // # Create third user and add to the team
            cy.apiCreateUser({prefix: 'otherB'}).then(({user: newUser}) => {
                otherUser2 = newUser;

                cy.apiAddUserToTeam(team.id, newUser.id);
            });

            // # Login as test user and go to town square
            cy.apiLogin(testUser);
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T249 Mark GM post as unread', () => {
        const userGroupIds = [testUser.id, otherUser1.id, otherUser2.id];

        // # Create a group channel for 3 users
        cy.apiCreateGroupChannel(userGroupIds).then(({channel: gmChannel}) => {
            // # Visit the channel using the name using the channels route
            for (let index = 0; index < 8; index++) {
                // # Post Message as otherUser1
                cy.postMessageAs({sender: otherUser1, message: `this is from user: ${otherUser1.id}, ${index}`, channelId: gmChannel.id});

                // # Post Message as otherUser2
                cy.postMessageAs({sender: otherUser2, message: `this is from user: ${otherUser2.id}, ${index}`, channelId: gmChannel.id});
            }

            // # Go to the group message channel
            cy.get(`#sidebarItem_${gmChannel.name}`).click();
            cy.reload();

            // # Mark the post to be unread
            cy.getNthPostId(-2).then((postId) => {
                cy.uiClickPostDropdownMenu(postId, 'Mark as Unread');
            });

            // * Verify the notification separator line exists and present before the unread message
            verifyPostNextToNewMessageSeparator(`this is from user: ${otherUser1.id}, 7`);

            // * Verify the group message in LHS is unread
            cy.get(`#sidebarItem_${gmChannel.name}`).should('have.attr', 'aria-label', `${otherUser1.username}, ${otherUser2.username} 2 mentions`);

            // # Leave the group message channel
            cy.get('#sidebarItem_town-square').click();

            // * Verify the group message in LHS is unread
            cy.get(`#sidebarItem_${gmChannel.name}`).should('have.attr', 'aria-label', `${otherUser1.username}, ${otherUser2.username} 2 mentions`);

            // # Go to the group message channel
            cy.get(`#sidebarItem_${gmChannel.name}`).click().wait(TIMEOUTS.ONE_SEC);

            // * Verify the group message in LHS is read
            cy.get(`#sidebarItem_${gmChannel.name}`).should('exist').should('not.have.attr', 'aria-label', `${otherUser1.username}, ${otherUser2.username} 2 mentions`);

            // * Verify the notification separator line exists and present before the unread message
            verifyPostNextToNewMessageSeparator(`this is from user: ${otherUser1.id}, 7`);
        });
    });
});
