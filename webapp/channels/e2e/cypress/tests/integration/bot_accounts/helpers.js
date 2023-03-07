// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getRandomId} from '../../utils';
import * as TIMEOUTS from '../../fixtures/timeouts';

export function createBotInteractive(team, username = `bot-${getRandomId()}`) {
    // # Visit the Integrations > Bot Accounts page
    cy.visit(`/${team.name}/integrations/bots`);

    // # Click add bot
    cy.get('#addBotAccount').click();

    // # Fill and submit form
    cy.get('#username').type(username);
    cy.get('#displayName').type('Test Bot');
    cy.get('#saveBot').click();

    // * Verify confirmation page
    cy.url({timeout: TIMEOUTS.ONE_MIN}).
        should('include', `/${team.name}/integrations/confirm`).
        should('match', /token=[a-zA-Z0-9]{26}/);

    // * Verify confirmation form/token
    cy.get('div.backstage-form').
        should('include.text', 'Setup Successful').
        should((confirmation) => {
            expect(confirmation.text()).to.match(/Token: [a-zA-Z0-9]{26}/);
        });

    return cy.get('div.backstage-form').invoke('text');
}
