// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @integrations

describe('Integrations', () => {
    let testUser;
    let testTeam;
    let testChannel;
    let newIncomingHook;
    let incomingWebhook;

    before(() => {
        // # Create new setup
        cy.apiInitSetup().then(({user}) => {
            testUser = user;

            // # Login as the new user
            cy.apiLogin(testUser).then(() => {
                // # Create a new team with the new user
                cy.apiCreateTeam('test-team', 'Team Testers').then(({team}) => {
                    testTeam = team;

                    // # Create a new test channel for the team
                    cy.apiCreateChannel(testTeam.id, 'test-channel', 'Testers Channel').then(({channel}) => {
                        testChannel = channel;

                        // # Declare web-hook values
                        newIncomingHook = {
                            channel_id: testChannel.id,
                            channel_locked: true,
                            description: 'Test Webhook Description',
                            display_name: 'Test Webhook Name',
                        };

                        //# Create a new webhook
                        cy.apiCreateWebhook(newIncomingHook).then((hook) => {
                            incomingWebhook = hook;
                        });

                        // # Visit the test channel
                        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
                    });
                });
            });
        });
    });

    it('MM-T643 Incoming webhook:Long URL for embedded image', () => {
        const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const queries = letters.split('').reduce((acc, letter) => {
            const newValue = acc + `&${letter}=${letters}`;
            return newValue;
        }, '');
        const url = `http://via.placeholder.com/300.png?expires=213134234234234234234234${queries}`;
        const payload = getPayload(testChannel, url);

        // # Post the webhook message
        cy.postIncomingWebhook({url: incomingWebhook.url, data: payload});

        // * Assert that the message was posted
        cy.uiWaitUntilMessagePostedIncludes('Hey attachments');
        cy.getLastPostId().then(() => {
            const baseUrl = Cypress.config('baseUrl');
            const encodedUrl = `${baseUrl}/api/v4/image?url=${encodeURIComponent(url)}`;

            // * Assert that file image is present
            cy.findByLabelText('file thumbnail').should('be.visible').and('have.attr', 'src', encodedUrl);

            // * Assert that the Show More button is visible
            cy.findByText('Show more').should('be.visible').click();

            // * Assert that the Show less button is visible
            cy.findByText('Show less').scrollIntoView().should('be.visible');
        });
    });
});

function getPayload(channel, url) {
    const text = `Hey attachments ![graph](${url}).${'Lorem ipsum dolor '.repeat(240)}.`;

    return {
        channel: channel.name,
        text,
    };
}
