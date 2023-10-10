// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @collapsed_reply_threads

describe('Collapsed Reply Threads', () => {
    let testTeam;
    let testUser;
    let otherUser;

    before(() => {
        cy.apiUpdateConfig({
            ServiceSettings: {
                ThreadAutoFollow: true,
                CollapsedThreads: 'default_off',
                EnableTutorial: false,
            },
        });

        // # Create new channel and other user, and add other user to channel
        cy.apiInitSetup({loginAfter: true, promoteNewUserAsAdmin: true}).then(({team, user}) => {
            testTeam = team;
            testUser = user;

            cy.apiSaveCRTPreference(testUser.id, 'on');
            cy.apiCreateUser({prefix: 'other'}).then(({user: user1}) => {
                otherUser = user1;

                cy.apiAddUserToTeam(testTeam.id, otherUser.id);
            });
        });
    });

    beforeEach(() => {
        // # Visit the channel
        cy.visit(`/${testTeam.name}/messages/@${otherUser.username}`);
    });

    it('should open thread when thread footer reply button is clicked in a DM/GM channel', () => {
        // # Post a message
        const msg = 'Root post';
        cy.postMessage(msg);

        cy.getLastPostId().then((rootId) => {
            // # Thread with replies
            cy.clickPostCommentIcon(rootId);
            cy.uiGetReplyTextBox().type('reply{enter}');
            cy.uiGetReplyTextBox().type('reply2{enter}');
            cy.uiCloseRHS();

            // * Check that the RHS is closed
            cy.get('#rhsContainer').should('not.exist');

            // # Get thread footer of last post and find reply button
            cy.uiGetPostThreadFooter(rootId).find('button.ReplyButton').click();

            // * Thread should be visible in RHS
            cy.get(`#rhsPost_${rootId}`).within(() => {
                cy.get(`#rhsPostMessageText_${rootId}`).should('be.visible').and('have.text', msg);
            });
        });
    });
});
