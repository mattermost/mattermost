// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

describe('Messaging', () => {
    let testTeam;
    let testChannel;
    let receiver;
    let sender;

    before(() => {
        // # Login as test user
        cy.apiInitSetup().then(({team, channel, user}) => {
            receiver = user;
            testTeam = team;
            testChannel = channel;

            cy.apiCreateUser().then(({user: user1}) => {
                sender = user1;
                cy.apiAddUserToTeam(testTeam.id, sender.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, sender.id);
                });
            });

            cy.apiLogin(receiver);

            // # Visit a test channel and post a message
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
            cy.postMessage('Hello');
        });
    });

    it('MM-T123 Pinned parent post: reply count remains in center channel and is correct', () => {
        // # Login as the other user
        cy.apiLogin(sender);

        // # Reload the page
        cy.reload();

        cy.getLastPostId().then((postId) => {
            // # Click the reply button, and post a reply four times and close the thread rhs tab
            cy.get(`#post_${postId}`).trigger('mouseover');
            cy.get(`#CENTER_commentIcon_${postId}`).click({force: true});
            for (let i = 0; i < 5; i++) {
                cy.uiGetReplyTextBox().click().should('be.visible').type(`Hello to you too ${i}`);
                cy.uiGetReply().should('be.enabled').click();
            }
            cy.get('#rhsCloseButton').click();

            // # Pin the post to the channel
            cy.uiClickPostDropdownMenu(postId, 'Pin to Channel');

            // # Find the 'Pinned' span in the post pre-header to verify that the post was actually pinned
            cy.get(`#post_${postId}`).findByText('Pinned').should('exist');

            // * Assert that the reply count exists and is correct
            cy.get(`#CENTER_commentIcon_${postId}`).find('span').eq(0).find('span').eq(1).should('have.text', '5');
        });
    });
});
