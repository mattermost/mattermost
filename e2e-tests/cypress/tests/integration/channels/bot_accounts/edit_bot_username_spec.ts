// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @bot_accounts

import {Team} from '@mattermost/types/teams';
import * as TIMEOUTS from '../../../fixtures/timeouts';
import {getRandomId} from '../../../utils';

describe('Edit bot username', () => {
    let team: Team;

    before(() => {
        cy.apiInitSetup().then((out) => {
            team = out.team;
        });
    });

    it('MM-T2923 Edit bot username.', () => {
        // # Visit bot config
        cy.visit('/admin_console/integrations/bot_accounts');

        // # Verify that the setting is enabled
        cy.findByTestId('ServiceSettings.EnableBotAccountCreationtrue', {timeout: TIMEOUTS.ONE_MIN}).should('be.checked');

        // # Visit the integrations
        goToCreateBot();

        const initialBotName = `bot-${getRandomId()}`;

        // # Fill and submit form
        cy.get('#username').clear().type(initialBotName);
        cy.get('#displayName').clear().type('Test Bot');
        cy.get('#saveBot').click();
        cy.get('#doneButton').click();

        // * Set alias for bot entry in bot list, this also checks that the bot entry exists
        cy.get('.backstage-list__item').contains('.backstage-list__item', initialBotName).as('botEntry');

        cy.get('@botEntry').then((el) => {
            // # Find the edit link for the bot
            const editLink = el.find('.item-actions>a');

            if (editLink.text() === 'Edit') {
                // # Click the edit link for the bot
                cy.wrap(editLink).click();

                // * Check that user name is as expected
                cy.get('#username').should('have.value', initialBotName);

                // * Check that the display name is correct
                cy.get('#displayName').should('have.value', 'Test Bot');

                // * Check that description is empty
                cy.get('#description').should('have.value', '');

                const newBotName = `bot-${getRandomId()}`;

                // * Enter the new user name
                cy.get('#username').clear().type(newBotName);

                // # Click update button
                cy.get('#saveBot').click();

                return cy.wrap(newBotName);
            }
            return cy.wrap(null);
        }).then((newBotName) => {
            // * Set alias for bot entry in bot list, this also checks that the bot entry exists
            cy.get('.backstage-list__item').contains('.backstage-list__item', newBotName).as('newbotEntry');

            // * Get bot entry in bot list by username
            cy.get('@newbotEntry').then((el) => {
                cy.wrap(el).scrollIntoView();
            });
        });
    });

    it('MM-T1838 Bot naming convention is enforced', () => {
        goToCreateBot();

        // # Attempt invalid bot usernames
        tryUsername('be', NAMING_WARNING_STANDARD);
        tryUsername('@be', NAMING_WARNING_STANDARD);
        tryUsername('abe.', NAMING_WARNING_ENDING_PERIOD);

        // # Attempt valid bot username
        const validBotName = `abe-the-bot-${getRandomId()}`;
        tryUsername(validBotName);
    });

    const NAMING_WARNING_STANDARD = 'Usernames have to begin with a lowercase letter and be 3-22 characters long. You can use lowercase letters, numbers, periods, dashes, and underscores.';
    const NAMING_WARNING_ENDING_PERIOD = 'Bot usernames cannot have a period as the last character';

    function tryUsername(name: string, warningMessage?: string) {
        cy.get('#username').clear().type(name);
        cy.get('#saveBot').click();

        if (warningMessage) {
            // * Verify expected warning
            cy.get('.backstage-form__footer .has-error').should('have.text', warningMessage);
        } else {
            // * Verify confirmation page
            cy.url().
                should('include', `/${team.name}/integrations/confirm`).
                should('match', /token=[a-zA-Z0-9]{26}/);

            // * Verify confirmation form/token
            cy.get('div.backstage-form').
                should('include.text', 'Setup Successful').
                and('include.text', name).
                and((confirmation) => {
                    expect(confirmation.text()).to.match(/Token: [a-zA-Z0-9]{26}/);
                });

            // # back to start
            goToCreateBot();
        }
    }

    function goToCreateBot() {
        cy.visit(`/${team.name}/integrations/bots`);

        // * Assert that adding bots possible
        cy.get('#addBotAccount', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').click();
    }
});
