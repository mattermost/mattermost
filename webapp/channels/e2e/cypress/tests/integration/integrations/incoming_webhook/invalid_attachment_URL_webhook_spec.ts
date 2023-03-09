// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @incoming_webhook

describe('Integrations/Incoming Webhook', () => {
    let incomingWebhook;
    let testChannel;

    before(() => {
        // # Let the webhook have its own icon
        cy.apiUpdateConfig({
            ServiceSettings: {
                EnablePostIconOverride: true,
            },
        });

        // # Create and visit new channel and create incoming webhook
        cy.apiInitSetup().then(({team, channel}) => {
            testChannel = channel;

            const newIncomingHook = {
                channel_id: channel.id,
                channel_locked: true,
                description: 'Incoming webhook - Viewing attachments with invalid URL does not cause the application to crash',
                display_name: 'invalid_attachment_URL_webhook',
            };

            cy.apiCreateWebhook(newIncomingHook).then((hook) => {
                incomingWebhook = hook;
            });

            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });
    it('MM-T624 Viewing attachments with invalid URL does not cause the application to crash', () => {
        // # Post the incoming webhook with bad image URL
        const payload = {
            channel: testChannel.name,
            text: 'The image below should be broken due to the invalid URL in the payload text you just sent.',
            attachments: [{
                fallback: 'Testing viewing attachments with invalid URL does not cause the application to crash.',
                pretext: 'Testing viewing attachments with invalid URL does not cause the application to crash.',
                image_url: 'https://example.com',
            }],
            icon_url: 'http://www.mattermost.org/wp-content/uploads/2016/04/icon_WS.png',
        };
        cy.postIncomingWebhook({url: incomingWebhook.url, data: payload, waitFor: 'attachment-pretext'});

        // * Check that the message has sent and that the body is viewable
        cy.waitUntil(() => cy.getLastPost().then((el) => {
            const postedMessageEl = el.find('.post-message__text > p')[0];
            return Boolean(postedMessageEl && postedMessageEl.textContent.includes('The image below should be broken due to the invalid URL in the payload text you just sent.'));
        }));
        cy.getLastPostId().then((postId) => {
            const postMessageId = `#${postId}_message`;
            cy.get(postMessageId).within(() => {
                cy.get('.attachment__image').should('be.visible');
            });
        });
    });
});
