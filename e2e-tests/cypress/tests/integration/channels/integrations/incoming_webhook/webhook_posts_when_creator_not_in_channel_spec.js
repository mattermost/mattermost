// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @integrations

import {getRandomId} from '../../../../utils';

describe('Integrations', () => {
    let testUser;
    let secondUser;
    let testTeam;
    let testChannel;
    let incomingWebhook;

    before(() => {
        // # Create new setup
        cy.apiInitSetup().then(({user}) => {
            testUser = user;

            // # Create a second user
            cy.apiCreateUser().then(({user: user2}) => {
                secondUser = user2;
            });

            // # Login as the new user
            cy.apiLogin(testUser).then(() => {
                // # Create a new team with the new user
                cy.apiCreateTeam('test-team', 'Team Testers').then(({team}) => {
                    testTeam = team;

                    // # Add second user to the test team
                    cy.apiAddUserToTeam(testTeam.id, secondUser.id);

                    // # Create a new test channel for the team
                    cy.apiCreateChannel(testTeam.id, 'test-channel', 'Testers Channel').then(({channel}) => {
                        testChannel = channel;

                        const newIncomingHook = {
                            channel_id: testChannel.id,
                            channel_locked: true,
                            description: 'Test Webhook Description',
                            display_name: 'Test Webhook Name',
                        };

                        //# Create a new webhook
                        cy.apiCreateWebhook(newIncomingHook).then((hook) => {
                            incomingWebhook = hook;
                        });

                        // # Add second user to the test channel
                        cy.apiAddUserToChannel(testChannel.id, secondUser.id).then(() => {
                            // # Remove the first user from the channel
                            cy.apiDeleteUserFromTeam(testTeam.id, testUser.id).then(({data}) => {
                                expect(data.status).to.equal('OK');
                            });

                            // # Login as the second user
                            cy.apiLogin(secondUser);

                            // # Visit the test channel
                            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
                        });
                    });
                });
            });
        });
    });

    it('MM-T638 Webhook posts when webhook creator is not a member of the channel', () => {
        const payload = getPayload(testChannel);

        // # Post the webhook message
        cy.postIncomingWebhook({url: incomingWebhook.url, data: payload});

        // * Assert that the message was posted even though webhook author has been removed
        cy.uiWaitUntilMessagePostedIncludes(payload.text);
        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId}`).should('have.text', `${payload.text}`);
        });
    });
});

function getPayload(testChannel) {
    return {
        channel: testChannel.name,
        text: `${getRandomId()} - this webhook was set up by a user that is no longer in this channel`,
    };
}
