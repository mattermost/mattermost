// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @account_setting

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Profile > Profile Settings', () => {
    let otherUser: Cypress.UserProfile;
    let testChannel: Cypress.Channel;

    before(() => {
        cy.apiInitSetup().then(({team, channel, offTopicUrl}) => {
            testChannel = channel;

            cy.apiCreateUser().then(({user}) => {
                otherUser = user;

                cy.apiAddUserToTeam(team.id, user.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, user.id);
                });
            });

            // # Go to off-topic
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T285 Status Menu stays open', () => {
        // # Click the hamburger button
        cy.uiGetSetStatusButton().click();

        // * Menu should be visible
        cy.uiGetStatusMenu();

        // # Post a message as other user
        cy.postMessageAs({sender: otherUser, message: 'abc', channelId: testChannel.id}).wait(TIMEOUTS.FIVE_SEC);

        // * Menu should still be visible
        cy.uiGetStatusMenu();
    });
});
