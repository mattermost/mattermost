// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel
import {getRandomId} from '../../../utils';

describe('Create work template', () => {
    let testTeam: Cypress.Team;

    before(() => {
        cy.apiInitSetup().then(({team}) => {
            testTeam = team;
        });

        cy.apiCreateCustomAdmin().then(({sysadmin}) => {
            cy.apiLogin(sysadmin);
            cy.visit(`/${testTeam.name}/channels/town-square`);
        });
    });

    it('works in happy path', () => {
        // # Open work template modal
        cy.uiBrowseOrCreateChannel('Create new channel').click();

        // # Dismiss tourtip, if it exists
        cy.dismissWorkTemplateTip();

        // * Check modal visible
        cy.get('#work-template-modal').should('be.visible');

        // # Go to template tab
        cy.findByText('Try a template').click();

        // # Pick leadership category
        cy.findByText('Leadership').click();

        // # Pick template
        cy.findByText("Set goals and OKR's").click();

        // * Check modal visible
        cy.findByText("Here's what you'll get:");

        // # Proceed to name template
        cy.findByText('Next').click();

        // # Name template
        const channelName = `test-work-template-${getRandomId()}`;
        cy.findByTestId('work-template-customize-channel-name').should('be.visible').clear().type(channelName);

        // # Create template
        cy.findByText('Create').click();

        // * Assert template was created
        cy.findByText('Linked boards').should('be.visible');
        cy.get('#searchResultsCloseButton').click();
        cy.findByText(`Beginning of ${channelName}`).should('be.visible');
    });
});
