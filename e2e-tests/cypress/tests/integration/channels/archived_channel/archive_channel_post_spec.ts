// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Archived channels', () => {
    let testTeam;
    let testUser;
    let otherUser;

    before(() => {
        cy.apiUpdateConfig({
            TeamSettings: {
                ExperimentalViewArchivedChannels: true,
            },
        });

        // # Login as test user and visit created channel
        cy.apiInitSetup().then(({team, user}) => {
            testUser = user;
            testTeam = team;

            cy.apiCreateUser({prefix: 'second'}).then(({user: second}) => {
                cy.apiAddUserToTeam(testTeam.id, second.id);
                otherUser = second;

                cy.apiLogin(testUser);
                cy.apiCreateChannel(testTeam.id, 'channel', 'channel').then(({channel}) => {
                    cy.visit(`/${testTeam.name}/channels/${channel.name}`);
                });
            });
        });
    });

    it('MM-T1716 Text box in center channel and in RHS should not be visible', () => {
        // # Post a message in the channel
        cy.postMessage('Test archive reply');
        cy.getLastPostId().then((id) => {
            cy.clickPostCommentIcon(id);

            // * RHS should be visible
            cy.get('#rhsContainer').should('be.visible');

            // * RHS text box should be visible
            cy.uiGetReplyTextBox();

            // # Archive the channel
            cy.uiArchiveChannel();

            // * Post text box should not be visible
            cy.uiGetPostTextBox({exist: false});

            // * RHS should not be visible
            cy.get('#rhsContainer').should('not.exist');

            // # Open RHS
            cy.clickPostCommentIcon(id);

            cy.get('#rhsContainer').should('be.visible');

            // * RHS text box should not be visible
            cy.uiGetReplyTextBox({exist: false});
        });
    });

    it('MM-T1722 Can click reply arrow on a post from archived channel, from saved posts list', () => {
        // # Create a channel that will be archived
        cy.apiCreateChannel(testTeam.id, 'archived-channel', 'Archived Channel').then(({channel}) => {
            // # Visit the channel
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            // # Post message
            cy.postMessage('Test');

            // # Create permalink to post
            cy.getLastPostId().then((id) => {
                const permalink = `${Cypress.config('baseUrl')}/${testTeam.name}/pl/${id}`;

                // # Click on ... button of last post
                cy.clickPostDotMenu(id);

                // # Click on "Copy Link"
                cy.uiClickCopyLink(permalink, id);

                // # Post the message in another channel
                cy.get('#sidebarItem_off-topic').click();
                cy.postMessage(permalink).wait(TIMEOUTS.ONE_SEC);
            });

            // # Archive the channel
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);
            cy.uiArchiveChannel();
        });

        // # Change user
        cy.apiLogout();
        cy.reload();
        cy.apiLogin(otherUser);
        cy.visit(`/${testTeam.name}/channels/off-topic`);

        // # Read the message and save post
        cy.get('a.markdown__link').click();
        cy.getNthPostId(1).then((postId) => {
            cy.clickPostSaveIcon(postId);
        });

        // # View saved posts
        cy.uiGetSavedPostButton().click();
        cy.wait(TIMEOUTS.HALF_SEC);

        // * RHS should be visible
        cy.get('#searchContainer').should('be.visible');

        // * Should be able to click on reply
        cy.get('#search-items-container div.post-message__text-container > div').last().should('have.attr', 'id').and('not.include', ':').
            invoke('replace', 'rhsPostMessageText_', '').then((rhsPostId) => {
                cy.clickPostCommentIcon(rhsPostId, 'SEARCH');

                // * RHS text box should not be visible
                cy.uiGetReplyTextBox({exist: false});
            });
    });
});
