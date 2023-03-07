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

describe('Messaging', () => {
    let testTeam;
    let testChannel;
    let testUser;
    let otherUser;

    before(() => {
        cy.apiInitSetup().then(({team, channel, user}) => {
            testTeam = team;
            testChannel = channel;
            testUser = user;

            cy.apiCreateUser().then(({user: user1}) => {
                otherUser = user1;

                cy.apiAddUserToTeam(testTeam.id, otherUser.id).then(() => {
                    cy.apiLogin(testUser);
                    cy.visit(`/${testTeam.name}/channels/town-square`);
                });
            });
        });
    });

    it('MM-T179 Channel is removed from Unreads section if user navigates out of it via permalink', () => {
        const message = 'Hello' + Date.now();
        let permalink;
        let postId;

        // # Create new DM channel
        cy.apiCreateDirectChannel([testUser.id, otherUser.id]).then(() => {
            cy.visit(`/${testTeam.name}/messages/@${otherUser.username}`);

            // # Post message to use
            cy.postMessage(message);

            cy.getLastPostId().then((id) => {
                postId = id;
                permalink = `${Cypress.config('baseUrl')}/${testTeam.name}/pl/${postId}`;

                // # Check if ... button is visible in last post right side
                cy.get(`#CENTER_button_${postId}`).should('not.be.visible');

                // # Click on ... button of last post
                cy.clickPostDotMenu(postId);

                // # Click on "Copy Link"
                cy.uiClickCopyLink(permalink, postId);

                // # Post the message on the channel
                postMessageOnChannel(testChannel, otherUser, permalink);

                // # Change user
                cy.apiLogout();
                cy.reload();
                cy.apiLogin(otherUser);
                cy.apiSaveSidebarSettingPreference();
                cy.visit(`/${testTeam.name}/channels/town-square`);

                // # Check Message is in Unread List
                cy.uiGetLhsSection('UNREADS').find('#sidebarItem_' + testChannel.name).
                    should('be.visible').
                    and('have.attr', 'aria-label', `${testChannel.display_name.toLowerCase()} public channel 1 mention`);

                // # Read the message and click the permalink
                clickLink(testChannel);

                // * Check if url include the permalink
                cy.url().should('include', `/${testTeam.name}/messages/@${testUser.username}/${postId}`);

                // * Check if url redirects back to parent path eventually
                cy.wait(TIMEOUTS.FIVE_SEC).url().should('include', `/${testTeam.name}/messages/@${testUser.username}`).and('not.include', `/${postId}`);

                // # Channel should still be visible
                cy.findAllByRole('button', {name: 'CHANNELS'}).first().parent().next().should('be.visible').within(() => {
                    cy.get('#sidebarItem_' + testChannel.name).
                        should('be.visible').
                        and('have.attr', 'aria-label', `${testChannel.display_name.toLowerCase()} public channel`);
                });

                // * Check the channel is not under the unread channel list
                cy.uiGetLhsSection('UNREADS').findByText(testChannel.name).should('not.exist');

                // * Check the channel is not marked as unread
                cy.uiGetLhsSection('CHANNELS').find('#sidebarItem_' + testChannel.name).invoke('attr', 'aria-label').should('not.include', 'unread');
            });
        });
    });
});

function postMessageOnChannel(channel, user, linkText) {
    // # Click on test public channel
    cy.get('#sidebarItem_' + channel.name).click({force: true});
    cy.wait(TIMEOUTS.HALF_SEC);

    // # Paste link on postlist area and mention the other user
    cy.postMessage(`@${user.username} ${linkText}`);

    // # We add the mentioned user to the channel
    cy.findByText('add them to the channel').should('be.visible').click();
}

function clickLink(channel) {
    // # Click on test public channel
    cy.get('#sidebarItem_' + channel.name).click({force: true});
    cy.wait(TIMEOUTS.HALF_SEC);

    // # Since the last message is the system message telling us we joined the channel, we take the one previous
    cy.getNthPostId(1).then((postId) => {
        // # Click on permalink
        cy.get(`#postMessageText_${postId} > p > .markdown__link`).scrollIntoView().click();
    });
}
