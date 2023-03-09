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
    before(() => {
        cy.apiInitSetup().then(({team, channel, user: testUser}) => {
            cy.apiCreateUser().then(({user: otherUser}) => {
                cy.apiAddUserToTeam(team.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(channel.id, otherUser.id).then(() => {
                        // # Login as test user and visit town-square
                        cy.apiLogin(testUser);

                        // # Start DM with other user
                        cy.visit(`/${team.name}/messages/@${otherUser.username}`);

                        cy.get('#channelIntro').should('be.visible').
                            and('contain', `This is the start of your direct message history with ${otherUser.username}.`);

                        // # Post test message
                        cy.postMessage('Test');
                    });
                });
            });
        });
    });

    it('MM-T133 Visual verification of tooltips on post hover menu', () => {
        cy.getLastPostId().then((postId) => {
            verifyToolTip(postId, `#CENTER_button_${postId}`, 'More');

            verifyToolTip(postId, `#CENTER_reaction_${postId}`, 'Add Reaction');

            verifyToolTip(postId, `#CENTER_commentIcon_${postId}`, 'Reply');
        });
    });

    function verifyToolTip(postId, targetElement, label) {
        cy.get(`#post_${postId}`).trigger('mouseover');

        cy.get(targetElement).trigger('mouseover', {force: true});
        cy.findByText(label).should('be.visible');

        cy.get(targetElement).trigger('mouseout', {force: true});
        cy.findByText(label).should('not.exist');
    }
});
