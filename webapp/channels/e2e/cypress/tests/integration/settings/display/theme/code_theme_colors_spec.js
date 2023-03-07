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

describe('Settings > Display > Theme > Custom Theme Colors', () => {
    before(() => {
        // # Login as new user, visit off-topic and post a message
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
            cy.postMessage('```\ncode\n```');
        });
    });

    [
        {name: 'github', backgroundColor: 'rgb(255, 255, 255)', color: 'rgb(36, 41, 46)'},
        {name: 'monokai', backgroundColor: 'rgb(39, 40, 34)', color: 'rgb(221, 221, 221)'},
        {name: 'solarized-light', backgroundColor: 'rgb(253, 246, 227)', color: 'rgb(88, 110, 117)'},
        {name: 'solarized-dark', backgroundColor: 'rgb(0, 43, 54)', color: 'rgb(147, 161, 161)'},
    ].forEach((theme, index) => {
        it(`MM-T293_${index + 1} Theme Colors - Code (${theme.name})`, () => {
            // # Navigate to the theme settings
            navigateToThemeSettings();

            // # Check Custom Themes
            cy.get('#customThemes').check().should('be.checked');

            // # Open Center Channel Styles section
            cy.get('#centerChannelStyles').click({force: true});

            // # Select custom code theme
            cy.get('#codeThemeSelect').scrollIntoView().should('be.visible').select(theme.name);

            // * Verify that the setting changes in the background?
            verifyLastPostStyle(theme);

            // # Save and close settings modal
            cy.get('#saveSetting').click().wait(TIMEOUTS.HALF_SEC);
            cy.uiClose();

            // * Verify that the styles remain after saving and closing modal
            verifyLastPostStyle(theme);

            // # Reload the browser
            cy.reload();

            // * Verify the styles are still intact
            verifyLastPostStyle(theme);
        });
    });
});

function verifyLastPostStyle(codeTheme) {
    cy.getLastPostId().then((postId) => {
        const postCodeBlock = `#postMessageText_${postId} code`;

        // * Verify that the code block background color and color match the desired theme
        cy.get(postCodeBlock).
            should('have.css', 'background-color', codeTheme.backgroundColor).
            and('have.css', 'color', codeTheme.color);
    });
}

function navigateToThemeSettings() {
    // Change theme to desired theme (keeps settings modal open)
    cy.uiOpenSettingsModal('Display');

    // Open edit theme
    cy.get('#themeTitle').should('be.visible');
    cy.get('#themeEdit').click();
    cy.get('.section-max').scrollIntoView();
}
