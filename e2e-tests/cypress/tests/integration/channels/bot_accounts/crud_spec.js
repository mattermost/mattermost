// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @bot_accounts

import {getRandomId} from '../../../utils';

import {createBotInteractive} from './helpers';

describe('Bot accounts - CRUD Testing', () => {
    let newTeam;
    let testBot;

    before(() => {
        // # Create and visit new channel
        cy.apiInitSetup().then(({team}) => {
            newTeam = team;
        });
        cy.apiAdminLogin();
    });

    beforeEach(() => {
        // # Create a test bot
        cy.apiCreateBot().then(({bot}) => {
            testBot = bot;
        });
    });

    it('MM-T1841 Long description text', () => {
        // # Visit the integrations
        cy.visit(`/${newTeam.name}/integrations/bots`);

        // * Check that the previously created bot is listed
        cy.findByText(testBot.fullDisplayName).then((el) => {
            // # Make sure it's on the screen
            cy.wrap(el[0].parentElement.parentElement).scrollIntoView();

            // # Click the edit button
            cy.wrap(el[0].parentElement.parentElement).findByText('Edit').should('be.visible').click();

            // * Validate redirect to edit screen
            cy.url().should('include', `/${newTeam.name}/integrations/bots/edit`);

            // # type long string
            const longDescription = 'A'.repeat(1020); // 1024 is the limit
            cy.get('#description').clear().type(longDescription);

            // * Validate that it's fully typed
            cy.get('#description').should('have.value', longDescription);

            // # type some more characters
            cy.get('#description').type('{end}12345');

            // * Validate that it's partially updated
            cy.get('#description').should('have.value', longDescription + '1234');

            // # Update the bot
            cy.get('#saveBot').click();

            // * Validate that bot saved correctly
            cy.url().should('include', `/${newTeam.name}/integrations/bots`);

            // * Validate that the description exists
            cy.findAllByText(longDescription + '1234').should('exist');
        });
    });

    it('MM-T1842 Change BOT role', () => {
        // # Visit the integrations
        cy.visit(`/${newTeam.name}/integrations/bots`);

        // * Check that the previously created bot is listed
        cy.findByText(testBot.fullDisplayName).then((el) => {
            // # Make sure it's on the screen
            cy.wrap(el[0].parentElement.parentElement).scrollIntoView();

            // # Click the edit button
            cy.wrap(el[0].parentElement.parentElement).findByText('Edit').should('be.visible').click();

            // * Validate redirect to edit screen
            cy.url().should('include', `/${newTeam.name}/integrations/bots/edit`);

            // # Select sysadmin
            cy.get('select').select('System Admin');

            // * Validate that permissions are set and read only
            cy.get('#postChannels').should('be.checked').should('be.disabled');
            cy.get('#postAll').should('be.checked').should('be.disabled');

            // # Update the bot
            cy.get('#saveBot').click();

            // * Validate that bot saved correctly
            cy.url().should('include', `/${newTeam.name}/integrations/bots`);
        });
    });

    it('MM-T1843 ID along with actual token is created', () => {
        // # Create the bot and validate token is visible
        createBotInteractive(newTeam);
        cy.get('#doneButton').click();
    });

    it('MM-T1844 Token is hidden when you return to the page but ID is still visible', () => {
        // # Create the bot and validate token is visible

        const botUsername = `bot-${getRandomId()}`;

        createBotInteractive(newTeam, botUsername).then((text) => {
            // # Close the Add dialog
            cy.get('#doneButton').click();

            // * Check that the previously created bot is listed
            cy.findByText(`Test Bot (@${botUsername})`).then((el) => {
                cy.wrap(el[0].parentElement.parentElement).scrollIntoView();

                // * Validate that token is NOT visible on the next page
                const token = text.substr(text.indexOf('Token: ') + 7, 26);
                cy.findByText(new RegExp(token)).should('not.exist');
            });
        });
    });

    it('MM-T1845 Create a new token via the UI', () => {
        // # Visit the integrations
        cy.visit(`/${newTeam.name}/integrations/bots`);

        // * Check that the previously created bot is listed
        cy.findByText(testBot.fullDisplayName).then((el) => {
            // # Make sure it's on the screen
            cy.wrap(el[0].parentElement.parentElement).scrollIntoView();

            // # Click the 'Create token' button
            cy.wrap(el[0].parentElement.parentElement).findByText('Create New Token').should('be.visible').click();

            // # Try saving without description
            cy.findByTestId('saveSetting').click();
            cy.wrap(el[0].parentElement.parentElement).find('input').scrollIntoView();

            // * Check for error message
            cy.get('#clientError').should('be.visible');

            // # Add description
            cy.wrap(el[0].parentElement.parentElement).find('input').click().type(testBot.username + 'description!');

            // # Save and check that no error is visible
            cy.findByTestId('saveSetting').click();

            cy.get('#clientError').should('not.exist');

            cy.findAllByText(testBot.username + 'description!').should('exist');
        });
    });

    it('MM-T1848 Delete Token', () => {
        // # Visit the integrations
        cy.visit(`/${newTeam.name}/integrations/bots`);

        // * Check that the previously created bot is listed
        cy.findByText(testBot.fullDisplayName).then((el) => {
            // # Make sure it's on the screen
            cy.wrap(el[0].parentElement.parentElement).scrollIntoView();

            // # Click the 'Create token' button
            cy.wrap(el[0].parentElement.parentElement).findByText('Create New Token').should('be.visible').click();

            // # Add description
            cy.wrap(el[0].parentElement.parentElement).find('input').click().type('description!');

            // # Save
            cy.findByTestId('saveSetting').click();

            // # Click Close button
            cy.wrap(el[0].parentElement.parentElement).findByText('Close').should('be.visible').click();

            cy.wrap(el[0].parentElement.parentElement).scrollIntoView();

            // * Check that token is visible
            cy.wrap(el[0].parentElement.parentElement).findByText(/Token ID:/).should('be.visible');

            // # Click Delete button
            cy.wrap(el[0].parentElement.parentElement).findByText('Delete').should('be.visible').click();

            // * Validate that confirmation dialog is visible and click the delete button
            cy.get('#confirmModalButton').should('be.visible').click();

            // * Check that token is not visible
            cy.wrap(el[0].parentElement.parentElement).findByText(/Token ID:/).should('not.exist');
        });
    });
});
