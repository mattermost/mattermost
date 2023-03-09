// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @integrations

import {getRandomId} from '../../utils';
import * as MESSAGES from '../../fixtures/messages';
import * as TIMEOUTS from '../../fixtures/timeouts';

describe('Integrations page', () => {
    let testTeam;

    before(() => {
        // # Set ServiceSettings to expected values
        const newSettings = {
            ServiceSettings: {
                EnableOAuthServiceProvider: true,
                EnableIncomingWebhooks: true,
                EnableOutgoingWebhooks: true,
                EnableCommands: true,
            },
        };
        cy.apiUpdateConfig(newSettings);

        cy.apiInitSetup().then(({team}) => {
            testTeam = team;

            // # Go to integrations
            cy.visit(`/${team.name}/integrations`);

            // * Validate that all sections are enabled
            cy.get('#incomingWebhooks').should('be.visible');
            cy.get('#outgoingWebhooks').should('be.visible');
            cy.get('#slashCommands').should('be.visible');
            cy.get('#botAccounts').should('be.visible');
            cy.get('#oauthApps').should('be.visible');
        });
    });

    it('should display correct message when incoming webhook not found', () => {
        // # Open incoming web hooks page
        cy.get('#incomingWebhooks').click();

        // # Add web 'include', '/newPage'hook
        cy.get('#addIncomingWebhook').click();

        // # Pick the channel
        cy.get('#channelSelect').select('Town Square');

        // # Save
        cy.get('#saveWebhook').click();

        // * Validate that save succeeded
        cy.get('#formTitle').should('have.text', 'Setup Successful');

        // # Close the Add dialog
        cy.get('#doneButton').click();

        // # Type random stuff into the search box
        const searchString = `some random stuff ${Date.now()}`;
        cy.get('#searchInput').type(`${searchString}{enter}`);

        // * Validate that the correct empty message is shown
        cy.get('#emptySearchResultsMessage').should('be.visible').and('have.text', `No incoming webhooks match ${searchString}`);
    });

    it('should display correct message when outgoing webhook not found', () => {
        // # Open outgoing web hooks page
        cy.get('#outgoingWebhooks').click();

        // # Add web hook
        cy.get('#addOutgoingWebhook').click();

        // # Pick the channel and dummy callback
        cy.get('#channelSelect').select('Town Square');
        cy.get('#callbackUrls').type('https://dummy');

        // # Save
        cy.get('#saveWebhook').click();

        // * Validate that save succeeded
        cy.get('#formTitle').should('have.text', 'Setup Successful');

        // # Close the Add dialog
        cy.get('#doneButton').click();

        // # Type random stuff into the search box
        const searchString = `some random stuff ${Date.now()}`;
        cy.get('#searchInput').type(`${searchString}{enter}`);

        // * Validate that the correct empty message is shown
        cy.get('#emptySearchResultsMessage').should('be.visible').and('have.text', `No outgoing webhooks match ${searchString}`);
    });

    it('should display correct message when slash command not found', () => {
        // # Open slash command page
        cy.get('#slashCommands').click();

        // # Add new command
        cy.get('#addSlashCommand').click();

        // # Pick a dummy trigger and callback
        cy.get('#trigger').type(`test-trigger${Date.now()}`);
        cy.get('#url').type('https://dummy');

        // # Save
        cy.get('#saveCommand').click();

        // * Validate that save succeeded
        cy.get('#formTitle').should('have.text', 'Setup Successful');

        // # Close the Add dialog
        cy.get('#doneButton').click();

        // # Type random stuff into the search box
        const searchString = `some random stuff ${Date.now()}`;
        cy.get('#searchInput').type(`${searchString}{enter}`);

        // * Validate that the correct empty message is shown
        cy.get('#emptySearchResultsMessage').should('be.visible').and('have.text', `No commands match ${searchString}`);
    });

    it('should display correct message when OAuth app not found', () => {
        // # Open OAuth apps page
        cy.get('#oauthApps').click();

        // # Add new command
        cy.get('#addOauthApp').click();

        // # Fill in dummy details
        cy.get('#name').type(`test-name${getRandomId()}`);
        cy.get('#description').type(`test-descr${getRandomId()}`);
        cy.get('#homepage').type(`https://dummy${getRandomId()}`);
        cy.get('#callbackUrls').type('https://dummy');

        // # Save
        cy.get('#saveOauthApp').click();

        // * Validate that save succeeded
        cy.get('#formTitle').should('have.text', 'Setup Successful');

        // # Close the Add dialog
        cy.get('#doneButton').click();

        // # Type random stuff into the search box
        const searchString = `some random stuff ${Date.now()}`;
        cy.get('#searchInput').type(`${searchString}{enter}`);

        // * Validate that the correct empty message is shown
        cy.get('#emptySearchResultsMessage').should('be.visible').and('have.text', `No OAuth 2.0 Applications match ${searchString}`);
    });

    it('should display correct message when bot account not found', () => {
        // # Open  bot account page
        cy.get('#botAccounts').click();

        // # Add new bot
        cy.get('#addBotAccount').click();

        // # Fill in dummy details
        cy.get('#username').type(`test-bot${getRandomId()}`);

        // # Save
        cy.get('#saveBot').click();

        // # Click done button
        cy.get('#doneButton').click();

        // * Make sure we are done saving
        cy.url().should('contain', '/integrations/bots');

        // # Type random stuff into the search box
        const searchString = `some random stuff ${Date.now()}`;
        cy.get('#searchInput').type(`${searchString}{enter}`);

        // * Validate that the correct empty message is shown
        cy.get('#emptySearchResultsMessage').should('be.visible').and('have.text', `No bot accounts match ${searchString}`);
    });

    it('MM-T570 Integration Page titles are bolded', () => {
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Open product menu and click 'Integrations'
        cy.uiOpenProductMenu('Integrations');

        cy.get('.integration-option__title').contains('Incoming Webhooks').click();

        integrationPageTitleIsBold('Incoming Webhooks');
        integrationPageTitleIsBold('Outgoing Webhooks');
        integrationPageTitleIsBold('Slash Commands');
        integrationPageTitleIsBold('OAuth 2.0 Applications');
        integrationPageTitleIsBold('Bot Accounts');
    });

    it('MM-T572 Copy icon for Slash Command', () => {
        // # Visit home channel
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Click 'Integrations' at product menu
        cy.uiOpenProductMenu('Integrations');

        // * Verify we are at integrations page URL
        cy.url().should('include', '/integrations');

        // # Scan the area of integrations list
        cy.get('.integrations-list').should('exist').within(() => {
            // # Open Slash commands directory
            cy.findByText('Slash Commands').should('exist').and('be.visible').click({force: true});
        });

        // * Verify we are at slash commands URL
        cy.url().should('include', '/integrations/commands');

        // # Hit create slash command button
        cy.findByText('Add Slash Command').should('exist').and('be.visible').click();

        // * Verify we are at slash commands add URL
        cy.url().should('include', '/integrations/commands/add');

        const customSlashName = MESSAGES.SMALL;

        // # Enter a title for custom slash command
        cy.findByLabelText('Title').should('exist').scrollIntoView().type(customSlashName);

        // # Enter a trigger word for custom slash command
        cy.findByLabelText('Command Trigger Word').should('exist').scrollIntoView().type('example');

        // # Enter a request url for custom slash command
        cy.findByLabelText('Request URL').should('exist').scrollIntoView().type('https://example.com');

        // # Hit save to save the custom slash command
        cy.findByText('Save').should('exist').scrollIntoView().click();

        // * Verify we are at setup successful URL
        cy.url().should('include', '/integrations/commands/confirm');

        // * Verify slash was successfully created
        cy.findByText('Setup Successful').should('exist').and('be.visible');

        // * Verify token was created
        cy.findByText('Token').should('exist').and('be.visible');

        // * Verify copy icon is shown
        cy.get('.fa.fa-copy').should('exist').and('be.visible').
            trigger('mouseover').and('have.attr', 'aria-describedby', 'copy');

        // # Hit done to move from confirm screen
        cy.findByText('Done').should('exist').and('be.visible').click();

        // * Verify we are back to installed slash commands screen
        cy.url().should('include', '/integrations/commands/installed');

        // * Verify our created command is in the list
        cy.findByText(customSlashName).should('exist').and('be.visible').scrollIntoView();

        // # Loop over all custom slash commands
        cy.get('.backstage-list').children().each((el) => {
            // # For each custom slash command was created
            cy.wrap(el).within(() => {
                // Verify copy icon for token is present
                cy.get('.fa.fa-copy').should('exist').and('be.visible').
                    trigger('mouseover').and('have.attr', 'aria-describedby', 'copy');
            });
        });
    });

    it('MM-T702 Edit to invalid URL', () => {
        // # Visit home channel
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Click 'Integrations' at product menu
        cy.uiOpenProductMenu('Integrations');

        // * Verify we are at integrations page URL
        cy.url().should('include', '/integrations');

        // # Scan the area of integrations list
        cy.get('.integrations-list').should('exist').within(() => {
            // # Open Slash commands directory
            cy.findByText('Slash Commands').should('exist').and('be.visible').click({force: true});
        });

        // * Verify we are at slash commands URL
        cy.url().should('include', '/integrations/commands');

        // # Hit create slash command button
        cy.findByText('Add Slash Command').should('exist').and('be.visible').click();

        // * Verify we are at slash commands add URL
        cy.url().should('include', '/integrations/commands/add');

        const customSlashName = `customSlash-${Date.now()}`;

        // # Enter a title for custom slash command
        cy.findByLabelText('Title').should('exist').scrollIntoView().type(customSlashName);

        // # Enter a trigger word for custom slash command
        cy.findByLabelText('Command Trigger Word').should('exist').scrollIntoView().type(customSlashName);

        // # Enter a request url for custom slash command
        cy.findByLabelText('Request URL').should('exist').scrollIntoView().type('https://example.com');

        // # Hit save to save the custom slash command
        cy.findByText('Save').should('exist').scrollIntoView().click();

        // * Verify we are at setup successful URL
        cy.url().should('include', '/integrations/commands/confirm');

        // * Verify slash was successfully created
        cy.findByText('Setup Successful').should('exist').and('be.visible');

        // * Verify token was created
        cy.findByText('Token').should('exist').and('be.visible');

        // # Hit done to move from confirm screen
        cy.findByText('Done').should('exist').and('be.visible').click();

        // * Verify we are back to installed slash commands screen
        cy.url().should('include', '/integrations/commands/installed');

        // * Verify our created command is in the list
        cy.findByText(customSlashName).should('exist').and('be.visible').scrollIntoView().
            parents('.backstage-list__item').within(() => {
                // # Click on the edit of slash command
                cy.findByText('Edit').should('exist').and('be.visible').click();
            });

        // * Verify that we are on edit slash command page
        cy.url().should('include', '/integrations/commands/edit');

        // # Edit the request url field
        cy.findByLabelText('Request URL').should('exist').and('be.visible').scrollIntoView().
            clear().type('mattermost.com');

        // # Hit save to save edited custom slash command
        cy.findByText('Update').should('exist').scrollIntoView().click();

        // * Verify that confirm modal is displayed to save the changes
        cy.get('#confirmModal').should('exist').and('be.visible').within(() => {
            // * Confirm that caution text is visible
            cy.findByText('Your changes may break the existing slash command. Are you sure you would like to update it?').
                should('exist').and('be.visible');

            // # Press update button to confirm
            cy.findByText('Update').should('exist').and('be.visible').click();
        });

        // * Verify that we get the error message
        cy.findByText('Invalid URL. Must be a valid URL and start with http:// or https://.').
            should('exist').and('be.visible').scrollIntoView();

        // # Go back to home channel
        cy.visit(`/${testTeam.name}/channels/town-square`);
    });

    it('MM-T580 Custom slash command auto-complete displays trigger word and not command name', () => {
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Click 'Integrations' at product menu
        cy.uiOpenProductMenu('Integrations');

        // * Verify we are at integrations page URL
        cy.url().should('include', '/integrations');

        // # Scan the area of integrations list
        cy.get('.integrations-list').should('exist').within(() => {
            // # Open Slash commands directory
            cy.findByText('Slash Commands').should('exist').and('be.visible').click({force: true});
        });

        // * Verify we are at slash commands directory URL
        cy.url().should('include', '/integrations/commands');

        // # Hit create slash command button
        cy.findByText('Add Slash Command').should('exist').and('be.visible').click();

        // * Verify we are at slash commands add URL
        cy.url().should('include', '/integrations/commands/add');

        const commandTitle = `abc-${Date.now()}`;
        const commandTrigger = `xyz-${Date.now()}`;

        // # Enter a title for custom slash command
        cy.findByLabelText('Title').should('exist').scrollIntoView().type(commandTitle);

        // # Enter a trigger word for custom slash command different from slash title
        cy.findByLabelText('Command Trigger Word').should('exist').scrollIntoView().type(commandTrigger);

        // # Enter a request url for custom slash command
        cy.findByLabelText('Request URL').should('exist').scrollIntoView().type('https://example.com');

        // # Check the option of autocomplete
        cy.findByLabelText('Autocomplete').should('exist').scrollIntoView().click();

        // # Hit save to save the custom slash command
        cy.findByText('Save').should('exist').scrollIntoView().click();

        // * Verify we are at setup successful URL
        cy.url().should('include', '/integrations/commands/confirm');

        // * Verify slash was successfully created
        cy.findByText('Setup Successful').should('exist').and('be.visible');

        // * Verify token was created
        cy.findByText('Token').should('exist').and('be.visible');

        // # Hit done to move from confirm screen
        cy.findByText('Done').should('exist').and('be.visible').click();

        // * Verify we are back to installed slash commands screen
        cy.url().should('include', '/integrations/commands/installed');

        // * Verify our created command is in the list
        cy.findByText(commandTitle).should('exist').and('be.visible').scrollIntoView();

        // # Return to channels
        cy.visit(`${testTeam.name}/channels/town-square`);

        const first2LettersOfCommandTrigger = commandTrigger.slice(0, 2);

        // # Type first 2 letters of the command trigger word
        cy.uiGetPostTextBox().should('be.visible').clear().type(`/${first2LettersOfCommandTrigger}`);

        // # Scan inside of suggestion list
        cy.get('#suggestionList').should('exist').and('be.visible').within(() => {
            // * Verify that commands trigger is suggested
            cy.findByText(commandTrigger).should('exist').and('be.visible');

            // * Verify that commands title is not suggested
            cy.findByText(commandTitle).should('not.exist');
        });

        // # Append Hello to custom slash command and hit enter
        cy.uiGetPostTextBox().type('{enter}').wait(TIMEOUTS.HALF_SEC).type('Hello{enter}').wait(TIMEOUTS.HALF_SEC);
        cy.uiGetPostTextBox().invoke('text').should('be.empty');
    });
});

function integrationPageTitleIsBold(title) {
    cy.get('.section-title__text').contains(title).click();
    cy.get('.item-details__name').should('be.visible').and('have.css', 'font-weight', '600');
}
