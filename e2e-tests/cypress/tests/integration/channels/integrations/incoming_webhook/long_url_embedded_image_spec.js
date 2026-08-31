// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @integrations

describe('Integrations', () => {
    let testUser;
    let testTeam;
    let testChannel;
    let newIncomingHook;
    let incomingWebhook;
    const oldSettings = {};

    before(() => {
        const newSettings = {
            ServiceSettings: {
                MaximumURLLength: 8192,
            },
        };

        // # Raise the maximum URL length so the long image proxy URL used in this
        // test is not rejected by the server's URL length security check.
        cy.apiGetConfig((config) => {
            Object.entries(newSettings).forEach(([key]) => {
                oldSettings[key] = config[key];
            });
        });
        cy.apiUpdateConfig(newSettings);

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

    after(() => {
        cy.apiAdminLogin().apiUpdateConfig(oldSettings);
    });

    it('MM-T643 Incoming webhook:Long URL for embedded image', () => {
        const baseUrl = Cypress.config('baseUrl');
        const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const queries = letters.split('').reduce((acc, letter) => {
            const newValue = acc + `&${letter}=${letters}`;
            return newValue;
        }, '');

        // Point at an image served by the Mattermost server itself so the test does not
        // depend on an external placeholder service, while keeping the URL long.
        const url = `${baseUrl}/static/icon_152x152.png?expires=213134234234234234234234${queries}`;
        const payload = getPayload(testChannel, url);

        // # Post the webhook message
        cy.postIncomingWebhook({url: incomingWebhook.url, data: payload});

        // * Assert that the message was posted
        cy.uiWaitUntilMessagePostedIncludes('Hey attachments');
        cy.getLastPostId().then((postId) => {
            const encodedUrl = `${baseUrl}/api/v4/image?url=${encodeURIComponent(url)}`;
            const postSelector = `#post_${postId}`;

            // * Assert that the embedded image renders through the image proxy and actually loads
            cy.get(postSelector).findByLabelText('file thumbnail').
                should('be.visible').
                and('have.attr', 'src', encodedUrl).
                and(($img) => {
                    expect($img[0].naturalWidth).to.be.greaterThan(0);
                });

            // * Assert that the Show more button is visible, then expand the post
            cy.get(postSelector).find('#showMoreButton').
                scrollIntoView().should('be.visible').and('contain', 'Show more').click();

            // * Assert that the button now shows Show less
            cy.get(postSelector).find('#showMoreButton').
                scrollIntoView().should('be.visible').and('contain', 'Show less');
        });
    });
});

function getPayload(channel, url) {
    // The repeated text makes the post tall enough to overflow and surface the
    // Show more/Show less control regardless of the embedded image's height.
    const text = `Hey attachments ![graph](${url}).${'Lorem ipsum dolor '.repeat(500)}.`;

    return {
        channel: channel.name,
        text,
    };
}
