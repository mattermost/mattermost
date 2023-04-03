// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Messaging - Opening a private channel using keyboard shortcuts', () => {
    let testTeam;

    before(() => {
        // # Create new team and new user and visit Off-Topic channel
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            testTeam = team;
            cy.visit(`/${testTeam.name}/channels/off-topic`);
        });
    });

    it('MM-T1225 CTRL/CMD+K - Open private channel using arrow keys and Enter', () => {
        cy.apiCreateChannel(testTeam.id, 'private-channel', 'Private channel', 'P').then(() => {
            // # Press CTRL+K (Windows) or CMD+K(Mac)
            cy.wait(TIMEOUTS.HALF_SEC);
            cy.typeCmdOrCtrl().type('K', {release: true});

            // # Type the first letter of a private channel in the "Switch Channels" modal message box
            // # Use up/down arrow keys to highlight a private channel
            // # Press ENTER
            cy.findByRole('textbox', {name: 'quick switch input'}).type('Pr').type('{downarrow}').type('{enter}');

            // * Private channel opens
            cy.get('#channelHeaderTitle').should('be.visible').should('contain', 'Private channel').wait(TIMEOUTS.HALF_SEC);

            // * Focus in the message box
            cy.uiGetPostTextBox().should('be.focused');
        });
    });
});
