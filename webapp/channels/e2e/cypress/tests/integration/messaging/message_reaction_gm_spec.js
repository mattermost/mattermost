// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

describe('Emoji reactions to posts/messages in GM channels', () => {
    let userOne;
    let userTwo;
    let testTeam;
    let testGroupChannel;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            userOne = user;

            cy.apiCreateUser().then((data) => {
                userTwo = data.user;

                cy.apiAddUserToTeam(testTeam.id, userTwo.id);

                cy.apiCreateGroupChannel([userOne.id, userTwo.id]).then(({channel}) => {
                    testGroupChannel = channel;
                });

                // # Login as userOne and town-square
                cy.apiLogin(userOne);
                cy.visit(`/${testTeam.name}/channels/town-square`);
            });
        });
    });

    it('MM-T471 add a reaction to a message in a GM', () => {
        // # Switch to the GM
        cy.visit(`/${testTeam.name}/messages/${testGroupChannel.name}`);

        // # Post a message
        cy.postMessage('This is a post');

        // * Verify that the Add a Reaction button works
        cy.getLastPostId().then((postId) => {
            // # Click the add reaction icon
            cy.clickPostReactionIcon(postId);

            // # Choose "slightly_frowning_face" emoji
            cy.clickEmojiInEmojiPicker('slightly_frowning_face');

            // * The number shown on the reaction is incremented by 1
            cy.get(`#postReaction-${postId}-slightly_frowning_face .Reaction__number--display`).
                should('have.text', '1').
                should('be.visible');
        });

        // * Verify that the Add Reaction button is visible at the right times
        cy.getLastPostId().then((postId) => {
            // * Verify that the Add Reaction button isn't visible
            cy.findByLabelText('Add a reaction').should('not.be.visible');

            // # Focus on the post since we can't hover with Cypress
            cy.get(`#post_${postId}`).focus().tab().tab();

            // * Verify that the Add Reaction button is now visible
            cy.findByLabelText('Add a reaction').should('be.visible');

            // # Click somewhere to clear the focus
            cy.get('#channelIntro').click();

            // * Verify that the Add Reaction button is no longer visible
            cy.findByLabelText('Add a reaction').should('not.be.visible');

            // # Resize window to mobile view
            cy.viewport('iphone-6');

            // * Verify that the Add Reaction button is once again visible
            cy.findByLabelText('Add a reaction').should('be.visible');
        });
    });
});
