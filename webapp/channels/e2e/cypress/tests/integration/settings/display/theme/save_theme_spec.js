// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @account_setting

import * as TIMEOUTS from '../../../../fixtures/timeouts';

describe('Settings > Display > Theme > Save', () => {
    before(() => {
        // # Login as new user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T2090 Theme Colors: New theme color is saved', () => {
        // # Go to Settings modal - Display section
        cy.uiOpenSettingsModal('Display');

        // # Go to Theme settings tab
        cy.get('#displayButton', {timeout: TIMEOUTS.FIVE_SEC}).should('be.visible').click();
        cy.get('#themeTitle', {timeout: TIMEOUTS.TWO_SEC}).should('be.visible').click();

        // # Change to dark theme
        cy.get('#premadeThemeIndigo').should('not.have.class', 'active').click();
        cy.get('#premadeThemeIndigo').should('have.class', 'active');

        // # Save and close the Settings modal
        cy.uiSaveAndClose();

        // # Go to Settings modal - Display section
        cy.uiOpenSettingsModal('Display');

        // # Go to Theme settings tab
        cy.get('#displayButton', {timeout: TIMEOUTS.FIVE_SEC}).should('be.visible').click();
        cy.get('#themeTitle', {timeout: TIMEOUTS.TWO_SEC}).should('be.visible').click();

        // * Verify dark theme is selected
        cy.get('#premadeThemeIndigo').should('have.class', 'active');
    });
});
