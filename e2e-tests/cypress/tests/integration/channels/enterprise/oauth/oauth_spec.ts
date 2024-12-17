// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @enterprise @integrations

import {getRandomId} from '../../../../utils';
import {checkboxesTitleToIdMap} from '../system_console/channel_moderation/constants';

import {enablePermission, goToSystemScheme, saveConfigForScheme} from '../system_console/channel_moderation/helpers';

describe('Integrations page', () => {
    const webhookBaseUrl = Cypress.env('webhookBaseUrl');

    let user1;
    let user2;
    let testChannelUrl1;
    let oauthClientID;
    let oauthClientSecret;
    const testApp = `Test${getRandomId()}`;

    before(() => {
        cy.apiRequireLicense();
        cy.requireWebhookServer();

        // # Set ServiceSettings to expected values
        cy.apiUpdateConfig({ServiceSettings: {EnableOAuthServiceProvider: true}});

        cy.apiInitSetup().then(({team, user}) => {
            user1 = user;
            testChannelUrl1 = `/${team.name}/channels/town-square`;

            cy.apiCreateUser().then(({user: otherUser}) => {
                user2 = otherUser;
                cy.apiAddUserToTeam(team.id, user2.id);
            });
        });

        goToSystemScheme();
        enablePermission(checkboxesTitleToIdMap.ALL_USERS_MANAGE_OAUTH_APPLICATIONS);
        saveConfigForScheme();
    });

    it('MM-T646 OAuth 2.0 trusted', () => {
        cy.apiLogin(user1);
        cy.visit(testChannelUrl1);

        // # Navigate to OAuthApps in integrations menu
        cy.uiOpenProductMenu('Integrations');
        cy.get('#oauthApps').click();

        // # Click on the Add button
        cy.get('#addOauthApp').click();

        // * Should not find is trusted
        cy.findByText('Is Trusted').should('not.exist');

        // * First child should be Display Name
        cy.get('div.backstage-form > form > div:first').should('contain', 'Display Name');
    });

    it('MM-T647 Copy icon for OAuth 2.0 Applications', () => {
        cy.apiLogin(user1);
        cy.visit(testChannelUrl1);

        // # Navigate to OAuthApps in integrations menu
        cy.uiOpenProductMenu('Integrations');
        cy.get('#oauthApps').click();

        // # Click on the Add button
        cy.get('#addOauthApp').click();

        // # Fill all fields
        const randomApp = `Random${getRandomId()}`;
        cy.get('#name').type(randomApp);
        cy.get('#description').type(randomApp);
        cy.get('#homepage').type('https://www.test.com/');
        cy.get('#callbackUrls').type('https://www.test.com/');

        // # Save
        cy.get('#saveOauthApp').click();

        // * Copy button should be visible
        cy.get('.fa-copy').should('exist');

        // # Store client ID
        cy.findByText('Client ID').parent().invoke('text').then((text) => {
            cy.wrap(text.substring(3)).as('clientID');
        });

        // # Click Done
        cy.get('#doneButton').click();

        cy.get('@clientID').then((clientID) => {
            const cId = clientID as unknown as string;
            cy.contains('.item-details', cId).within(() => {
                // * Copy button should exist for Client ID
                cy.contains('.item-details__token', 'Client ID').should('exist').within(() => {
                    cy.get('.fa-copy').should('exist');
                });

                cy.contains('.item-details__token', 'Client Secret').should('exist').within(() => {
                    // * Client secret should not show
                    cy.contains('***************').should('exist');

                    // * Copy button should not exist
                    cy.get('.fa-copy').should('not.exist');
                });

                // # Show secret
                cy.findByText('Show Secret').click();

                // * Show secret text should have changed to Hide Secret
                cy.findByText('Hide Secret').should('exist');
                cy.findByText('Show Secret').should('not.exist');

                cy.contains('.item-details__token', 'Client Secret').should('exist').within(() => {
                    // * Token should not be obscured
                    cy.contains('***************').should('not.exist');

                    // * Copy button should exist
                    cy.get('.fa-copy').should('exist');
                });
            });
        });
    });

    it('MM-T648_1 OAuth 2.0 Application - Setup', () => {
        cy.apiLogin(user1);
        cy.visit(testChannelUrl1);

        // # Navigate to OAuthApps in integrations menu
        cy.uiOpenProductMenu('Integrations');
        cy.get('#oauthApps').click();

        // # Click on the Add button
        cy.get('#addOauthApp').click();

        // # Fill all fields
        cy.get('#name').type(testApp);
        cy.get('#description').type(testApp);
        cy.get('#homepage').type('https://www.test.com/');
        cy.get('#callbackUrls').type(`${webhookBaseUrl}/complete_oauth`);

        // # Save
        cy.get('#saveOauthApp').click();

        // * Copy button should be visible
        cy.get('.fa-copy').should('exist');

        // # Store client ID
        cy.findByText('Client ID').parent().invoke('text').then((text) => {
            cy.wrap(text.substring(11)).as('clientID');
        });

        // # Store client secret
        cy.findByText('Client Secret').parent().invoke('text').then((text) => {
            cy.wrap(text.substring(15)).as('clientSecret');
        });

        cy.get('@clientID').then((clientID) => {
            oauthClientID = clientID;
            cy.get('@clientSecret').then((clientSecret) => {
                oauthClientSecret = clientSecret;

                // # Send credentials
                cy.postIncomingWebhook({
                    url: `${webhookBaseUrl}/send_oauth_credentials`,
                    data: {
                        appID: clientID,
                        appSecret: clientSecret,
                    }});
            });
        });

        // # Click Done
        cy.get('#doneButton').click();
    });

    it('MM-T648_2 OAuth 2.0 Application - Exchange tokens', () => {
        cy.apiLogin(user1);

        // # Visit the webhook url to start the OAuth handshake
        cy.visit(`${webhookBaseUrl}/start_oauth`);

        // # Click on the allow button
        cy.findByText('Allow').click();

        // * Exchange successful
        cy.findByText('OK').should('exist');
    });

    it('MM-T648_3 OAuth 2.0 Application - Post message using OAuth credentials', () => {
        // # Visit a channel
        cy.visit(testChannelUrl1);

        cy.getCurrentChannelId().then((channelId) => {
            const message = 'OAuth test 01';

            // # Post message using OAuth credentials
            cy.postIncomingWebhook({
                url: `${webhookBaseUrl}/post_oauth_message`,
                data: {
                    channelId,
                    message,
                }});

            // * The message should be posted
            cy.findByText(message).should('exist');
        });
    });

    it('MM-T649 Edit Oauth 2.0 Application', () => {
        cy.apiLogin(user2);
        cy.visit(testChannelUrl1);

        // # Navigate to OAuthApps in integrations menu
        cy.uiOpenProductMenu('Integrations');
        cy.get('#oauthApps').click();

        // # Other users should not see the apps from other users
        cy.get('.item-details').should('not.exist');

        // # Login as sysadmin
        cy.apiAdminLogin();
        cy.visit(testChannelUrl1);

        // # Navigate to OAuthApps in integrations menu
        cy.uiOpenProductMenu('Integrations');
        cy.get('#oauthApps').click();

        // * Sysadmin should see the app
        cy.get('.item-details').should('be.visible');
        cy.contains('.item-details', oauthClientID).should('exist').within(() => {
            cy.get('.item-details__token').should('contain', oauthClientID);

            // * Sysadmin should see the Edit button
            // # Click on the edit button
            cy.findByText('Edit').should('exist').click();
        });

        // # Update description
        cy.get('#description').invoke('val').then(($text) => {
            if (!$text.match('Edited$')) {
                cy.get('#description').type('Edited');
            }
        });

        // # Save
        cy.get('#saveOauthApp').click({force: true});

        cy.contains('.item-details', oauthClientID).should('exist').within(() => {
            // * Description should be edited
            cy.findByText(`${testApp}Edited`).should('exist');
        });

        // # Visit a channel
        cy.visit(testChannelUrl1);

        cy.getCurrentChannelId().then((channelId) => {
            const message = 'OAuth test 02';

            // # Post message using OAuth credentials
            cy.postIncomingWebhook({
                url: `${webhookBaseUrl}/post_oauth_message`,
                data: {
                    channelId,
                    message,
                }});

            // * The message should be posted
            cy.findByText(message).should('exist');
        });
    });

    it('MM-T650 Deauthorize OAuth 2.0 Application', () => {
        cy.apiLogin(user1);
        cy.visit(testChannelUrl1);

        // # Go to OAuth apps settings
        cy.uiGetSetStatusButton().click();
        cy.get('#accountSettings').click();
        cy.get('#securityButton').click();
        cy.get('#appsEdit').click();

        // * The app we created should be present
        // # Click deauthorize
        cy.get(`[data-app="${oauthClientID}"]`).should('exist').click();

        // * The app should no longer exist
        cy.get(`[data-app="${oauthClientID}"]`).should('not.exist');

        // # Close the profile settings modal
        cy.get('#accountSettingsHeader').within(() => {
            cy.get('button.close').click();
        });

        cy.getCurrentChannelId().then((channelId) => {
            const message = 'OAuth test 03';

            // # Post message using OAuth credentials
            cy.postIncomingWebhook({
                url: `${webhookBaseUrl}/post_oauth_message`,
                data: {
                    channelId,
                    message,
                }});

            // * The message should not be posted
            cy.findByText(message).should('not.exist');
        });
    });

    it('MM-T651_1 Reconnect OAuth 2.0 Application - Connect application', () => {
        cy.apiLogin(user1);

        // # Visit the webhook url to start the OAuth handshake
        cy.visit(`${webhookBaseUrl}/start_oauth`);

        // # Click on the allow button
        cy.findByText('Allow').click();

        // * Exchange successful
        cy.findByText('OK').should('exist');
    });

    it('MM-T651_2 Reconnect OAuth 2.0 Application - Post message using OAuth credentials', () => {
        cy.apiLogin(user1);

        // # Visit a channel
        cy.visit(testChannelUrl1);

        cy.getCurrentChannelId().then((channelId) => {
            const message = 'OAuth test 04';

            // # Post message using OAuth credentials
            cy.postIncomingWebhook({
                url: `${webhookBaseUrl}/post_oauth_message`,
                data: {
                    channelId,
                    message,
                }});

            // * The message should be posted
            cy.findByText(message).should('exist');
        });
    });

    it('MM-T652 Regenerate Secret', () => {
        cy.apiLogin(user1);
        cy.visit(testChannelUrl1);

        // # Navigate to OAuthApps in integrations menu
        cy.uiOpenProductMenu('Integrations');
        cy.get('#oauthApps').click();

        cy.contains('.item-details', oauthClientID).within(() => {
            // # Regenerate secret
            cy.findByText('Regenerate Secret').click();
            cy.contains('.item-details__token', 'Client Secret').within(() => {
                cy.get('strong').invoke('text').then((clientSecret) => {
                    // * Secret should be different to previous secret
                    expect(clientSecret).to.not.equal(oauthClientSecret);

                    // # Save secret for later
                    oauthClientSecret = clientSecret;
                });
            });
        });

        // # Visit a channel
        cy.visit(testChannelUrl1);

        cy.getCurrentChannelId().then((channelId) => {
            const message = 'OAuth test 05';

            // # Post message using OAuth credentials
            cy.postIncomingWebhook({
                url: `${webhookBaseUrl}/post_oauth_message`,
                data: {
                    channelId,
                    message,
                }});

            // * The message should be posted
            cy.findByText(message).should('exist');
        });
    });

    it('MM-T653 Unsuccessful reconnect with incorrect secret', () => {
        cy.apiLogin(user2);

        // # Visit the webhook url to start the OAuth handshake
        cy.visit(`${webhookBaseUrl}/start_oauth`, {failOnStatusCode: false});

        // # Click on the allow button
        cy.findByText('Allow').click();

        // * Exchange not unsuccessful
        cy.contains('Invalid client credentials.').should('exist');
    });

    it('MM-T654 Successful reconnect with updated secret', () => {
        cy.apiAdminLogin();

        // # Send new credentials
        cy.postIncomingWebhook({
            url: `${webhookBaseUrl}/send_oauth_credentials`,
            data: {
                appID: oauthClientID,
                appSecret: oauthClientSecret,
            }});

        // # Visit the webhook url to start the OAuth handshake
        cy.visit(`${webhookBaseUrl}/start_oauth`, {failOnStatusCode: false});

        // # Click on the allow button
        cy.findByText('Allow').click();

        // * Exchange successful
        cy.findByText('OK').should('exist');
    });

    it('MM-T655 Delete OAuth 2.0 Application', () => {
        cy.apiLogin(user1);
        cy.visit(testChannelUrl1);

        // # Navigate to OAuthApps in integrations menu
        cy.uiOpenProductMenu('Integrations');
        cy.get('#oauthApps').click();

        cy.contains('.item-details', oauthClientID).within(() => {
            // # Click Delete
            cy.findByText('Delete').click();
        });

        // # Confirm Delete
        cy.contains('#confirmModalButton', 'Yes, delete it').click();

        // # Go back to channels
        cy.visit(testChannelUrl1);
        cy.getCurrentChannelId().then((channelId) => {
            const message = 'OAuth test 06';

            // # Post message using OAuth credentials
            cy.postIncomingWebhook({
                url: `${webhookBaseUrl}/post_oauth_message`,
                data: {
                    channelId,
                    message,
                }});

            // * The message should not be posted
            cy.findByText(message).should('not.exist');
        });
    });
});
