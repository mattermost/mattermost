// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @not_cloud @bot_accounts

import {Team} from '@mattermost/types/teams';

import {getRandomId} from '../../../utils';

import {createBotInteractive} from './helpers';

describe('Bot accounts - CRUD Testing', () => {
    let newTeam: Team;

    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.shouldHavePluginUploadEnabled();

        // # Set ServiceSettings to expected values
        const newSettings = {
            EmailSettings: {
                SMTPServer: '',
            },
            PluginSettings: {
                Enable: true,
            },
        };
        cy.apiUpdateConfig(newSettings);

        // # Create a test bot
        cy.apiCreateBot();

        // # Create and visit new channel
        cy.apiInitSetup().then(({team}) => {
            newTeam = team;

            // # Visit the integrations
            cy.visit(`/${newTeam.name}/integrations/bots`);
        });
    });

    it('MM-T1849 Create a Personal Access Token when email config is invalid', () => {
        // # Create a test bot and validate that token is created
        const botUsername = `bot-${getRandomId()}`;
        createBotInteractive(newTeam, botUsername);
        cy.get('#doneButton').click();

        // # Add a new token to the bot

        // * Check that the previously created bot is listed
        cy.findByText(`Test Bot (@${botUsername})`).then((el) => {
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
            cy.wrap(el[0].parentElement.parentElement).findAllByText(/Token ID:/).should('have.length', 2);
        });
    });
});
