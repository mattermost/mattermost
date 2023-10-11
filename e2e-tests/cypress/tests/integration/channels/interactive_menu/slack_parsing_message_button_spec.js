// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @interactive_menu

/**
* Note: This test requires webhook server running. Initiate `npm run start:webhook` to start.
*/

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Interactive Menu', () => {
    let incomingWebhook;

    before(() => {
        cy.requireWebhookServer();

        // # Create and visit new channel and create incoming webhook
        cy.apiInitSetup().then(({team, channel}) => {
            const newIncomingHook = {
                channel_id: channel.id,
                channel_locked: true,
                description: 'Incoming webhook interactive menu',
                display_name: 'menuIn' + Date.now(),
            };

            cy.apiCreateWebhook(newIncomingHook).then((hook) => {
                incomingWebhook = hook;
            });

            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });

    it('should parse text into Slack-compatible markdown depending on "skip_slack_parsing" property on response', () => {
        const payload = getPayload(Cypress.env().webhookBaseUrl);

        // # Post an incoming webhook
        cy.postIncomingWebhook({url: incomingWebhook.url, data: payload, waitFor: 'attachment-pretext'});
        cy.waitUntil(() => cy.findAllByTestId('postContent').then((el) => {
            if (el.length > 0) {
                return el[1].innerText.includes(payload.attachments[0].actions[0].name);
            }
            return false;
        }));

        // # Click on "Skip Parsing" button
        cy.findByText(payload.attachments[0].actions[0].name).should('be.visible').click({force: true});
        cy.wait(TIMEOUTS.HALF_SEC);

        // * Verify that it renders original "spoiler" text
        cy.uiWaitUntilMessagePostedIncludes('a < a | b > a');
        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId}`).should('have.html', '<p>a &lt; a | b &gt; a</p>');
        });

        // # Click on "Do Parsing" button
        cy.findByText(payload.attachments[0].actions[1].name).should('be.visible').click({force: true});
        cy.wait(TIMEOUTS.HALF_SEC);

        // * Verify that it renders markdown with link
        cy.uiWaitUntilMessagePostedIncludes('a  b  a');
        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId}`).should('have.html', '<p>a <a class="theme markdown__link" href="http://a" rel="noreferrer" target="_blank"><span> b </span></a> a</p>');
        });
    });
});

function getPayload(webhookBaseUrl) {
    return {
        attachments: [{
            pretext: 'Slack-compatible interactive message response',
            actions: [{
                name: 'Skip Parsing',
                integration: {
                    url: `${webhookBaseUrl}/slack_compatible_message_response`,
                    context: {
                        action: 'show_spoiler',
                        spoiler: 'a < a | b > a',
                        skipSlackParsing: true,
                    },
                },
            }, {
                name: 'Do Parsing',
                integration: {
                    url: `${webhookBaseUrl}/slack_compatible_message_response`,
                    context: {
                        action: 'show_spoiler',
                        spoiler: 'a < a | b > a',
                        skipSlackParsing: false,
                    },
                },
            }],
        }],
    };
}
