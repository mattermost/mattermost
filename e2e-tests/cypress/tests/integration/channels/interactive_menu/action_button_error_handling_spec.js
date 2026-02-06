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

describe('Interactive Menu - Action Button Error Handling', () => {
    let incomingWebhook;

    before(() => {
        cy.requireWebhookServer();

        // # Create and visit new channel and create incoming webhook
        cy.apiInitSetup().then(({team, channel}) => {
            const newIncomingHook = {
                channel_id: channel.id,
                channel_locked: true,
                description: 'Incoming webhook for action button error testing',
                display_name: 'actionErrorTest' + Date.now(),
            };

            cy.apiCreateWebhook(newIncomingHook).then((hook) => {
                incomingWebhook = hook;
            });

            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });

    it('MM-65023 should display error message when action button fails', () => {
        const payload = getPayloadWithErrorAction();

        // # Post an incoming webhook with action button that will trigger an error
        cy.postIncomingWebhook({url: incomingWebhook.url, data: payload, waitFor: 'attachment-pretext'});

        // * Wait for the button to be available
        cy.findByText('Error Button 1').should('be.visible');

        // # Click on "Error Button 1" (invalid URL will cause error)
        cy.findByText('Error Button 1').should('be.visible').click({force: true});
        cy.wait(TIMEOUTS.HALF_SEC);

        // * Verify that error message is displayed
        cy.get('.has-error').should('be.visible');
        cy.get('.has-error .control-label').should('contain.text', 'Action integration error.');
    });

    it('MM-65023 should clear error message when successful action is triggered', () => {
        const payload = getPayloadWithErrorAndSuccess(Cypress.env().webhookBaseUrl);

        // # Post an incoming webhook with error and success buttons
        cy.postIncomingWebhook({url: incomingWebhook.url, data: payload, waitFor: 'attachment-pretext'});

        // * Wait for the buttons to be available
        cy.findByText('Error Button').should('be.visible');
        cy.findByText('Success Button').should('be.visible');

        // # Click on "Error Button" first
        cy.findByText('Error Button').should('be.visible').click({force: true});
        cy.wait(TIMEOUTS.HALF_SEC);

        // * Verify that error message is displayed for test2
        cy.get('.has-error').should('be.visible');
        cy.get('.has-error .control-label').should('contain.text', 'Action integration error.');

        // # Click on "Success Button" to trigger successful action
        cy.findByText('Success Button').should('be.visible').click({force: true});

        // * Wait for successful response and verify the specific error from this test is cleared
        cy.uiWaitUntilMessagePostedIncludes('a < a | b > a');

        // * Find the specific attachment container for this test and verify its error is cleared
        cy.contains('.attachment', 'Action Button Error Clear Test - Error and Success')
            .find('.has-error').should('not.exist');
    });

    it('MM-65023 should display tooltip on action button hover', () => {
        const payload = getPayloadWithTooltip();

        // # Post an incoming webhook with action button that has tooltip
        cy.postIncomingWebhook({url: incomingWebhook.url, data: payload, waitFor: 'attachment-pretext'});

        // * Wait for the tooltip button to be available
        cy.findByText('Button with Tooltip').should('be.visible');

        // # Hover over the action button
        cy.findByText('Button with Tooltip').should('be.visible').trigger('mouseenter', {force: true});

        // * Verify that tooltip is displayed with correct text using WithTooltip component
        cy.get('.tooltipContainer').should('be.visible').and('contain.text', 'This is a helpful tooltip');
    });
});

function getPayloadWithErrorAction() {
    return {
        attachments: [{
            pretext: 'Action Button Error Test - Single Button',
            actions: [{
                name: 'Error Button 1',
                tooltip: 'This button will trigger an error',
                integration: {
                    url: 'http://invalid-url-test1.example.com/fail',
                    context: {
                        action: 'trigger_error_test1',
                    },
                },
            }],
        }],
    };
}

function getPayloadWithErrorAndSuccess(webhookBaseUrl) {
    return {
        attachments: [{
            pretext: 'Action Button Error Clear Test - Error and Success',
            actions: [{
                name: 'Error Button',
                tooltip: 'This button will trigger an error',
                integration: {
                    url: 'http://invalid-url-test2.example.com/fail',
                    context: {
                        action: 'trigger_error_test2',
                    },
                },
            }, {
                name: 'Success Button',
                tooltip: 'This button will work',
                integration: {
                    url: `${webhookBaseUrl}/slack_compatible_message_response`,
                    context: {
                        action: 'show_spoiler',
                        spoiler: 'a < a | b > a',
                        skipSlackParsing: true,
                    },
                },
            }],
        }],
    };
}

function getPayloadWithTooltip() {
    return {
        attachments: [{
            pretext: 'Action Button Tooltip Test',
            actions: [{
                name: 'Button with Tooltip',
                tooltip: 'This is a helpful tooltip',
                integration: {
                    url: 'http://localhost:3000/success',
                    context: {
                        action: 'tooltip_test',
                    },
                },
            }],
        }],
    };
}
