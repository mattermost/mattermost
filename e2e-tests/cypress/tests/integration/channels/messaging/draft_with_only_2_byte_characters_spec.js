// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

describe('Messaging', () => {
    let testTeam;
    let testChannel;
    let receiver;
    let lastPostId;

    before(() => {
        // # Login as test user
        cy.apiInitSetup().then(({team, channel, user}) => {
            receiver = user;
            testTeam = team;
            testChannel = channel;

            cy.apiLogin(receiver);

            // # Visit a test channel and post a message
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
            cy.postMessage('휴');

            // # Assign lastPostId variable to the id of the last post
            cy.getLastPostId().then((postId) => {
                lastPostId = postId;
            });
        });
    });

    it('MM-T1667 - Post with only 2 byte characters shouldn\'t remain after posting', () => {
        testChannel.name = testChannel.name.replace(/\s+/g, '-').toLowerCase();

        // * Check that the Korean message got posted in the channel
        cy.get(`#postMessageText_${lastPostId}`).should('contain', '휴');

        // # Change channels to the Town Square channel
        cy.get('#sidebarItem_town-square').click();

        // * Check that the draft icon does not exist next to the Test Channel name
        cy.get(`#sidebarItem_${testChannel.name}`).findByTestId('draftIcon').should('not.exist');

        // # Return to the channel where the 2 byte character was posted
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // * Assert that the message textbox is empty
        cy.uiGetPostTextBox().should('have.value', '');
    });
});
