// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @incoming_webhook

describe('Integrations/Incoming Webhook', () => {
    let incomingWebhook: {data: unknown; url: string}; // apiCreateWebhook returns untyped body
    let testTeam: Cypress.Team;
    let testChannel: Cypress.Channel;

    before(() => {
        // # Create and visit new channel and create incoming webhook
        cy.apiInitSetup().then(({team, channel}) => {
            testTeam = team;
            testChannel = channel;

            const newIncomingHook = {
                channel_id: channel.id,
                channel_locked: true,
                description: 'Incoming webhook - attachment footer markdown',
                display_name: 'attachment-footer-markdown',
            };

            cy.apiCreateWebhook(newIncomingHook).then((hook) => {
                incomingWebhook = hook;
            });
        });
    });

    beforeEach(() => {
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
    });

    it('MM-67905 Attachment footer renders bold and italic markdown', () => {
        const payload = {
            channel: testChannel.name,
            attachments: [{
                text: 'Attachment with markdown footer',
                footer: 'Footer with **bold** and _italic_ text',
            }],
        };

        cy.postIncomingWebhook({url: incomingWebhook.url, data: payload});

        cy.getLastPost().within(() => {
            cy.get('.attachment__footer-container').within(() => {
                cy.get('strong').should('have.text', 'bold');
                cy.get('em').should('have.text', 'italic');
            });
        });
    });

    it('MM-67905 Attachment footer renders links in markdown', () => {
        const payload = {
            channel: testChannel.name,
            attachments: [{
                text: 'Attachment with link in footer',
                footer: 'Visit [Mattermost](https://mattermost.com) for more info',
            }],
        };

        cy.postIncomingWebhook({url: incomingWebhook.url, data: payload});

        cy.getLastPost().within(() => {
            cy.get('.attachment__footer-container').within(() => {
                cy.get('a.markdown__link[href="https://mattermost.com"]').should('have.text', 'Mattermost');
            });
        });
    });

    it('MM-67905 Attachment footer renders emoji in markdown', () => {
        const payload = {
            channel: testChannel.name,
            attachments: [{
                text: 'Attachment with emoji in footer',
                footer: 'All good :white_check_mark:',
            }],
        };

        cy.postIncomingWebhook({url: incomingWebhook.url, data: payload});

        cy.getLastPost().within(() => {
            cy.get('.attachment__footer-container').within(() => {
                cy.get('span[data-emoticon="white_check_mark"]').should('exist');
            });
        });
    });
});
