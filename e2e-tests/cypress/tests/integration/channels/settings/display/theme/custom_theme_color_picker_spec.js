// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @account_setting

import {hexToRgbArray, rgbArrayToString} from '../../../../../utils';

describe('Settings > Display > Theme', () => {
    before(() => {
        // # Login as new user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    beforeEach(() => {
        cy.reload();
        cy.postMessage('hello');

        // # Go to Settings modal - Display section, then custom theme
        cy.uiOpenSettingsModal('Display');
        cy.get('#displayButton').
            should('be.visible').
            click();
        cy.get('#themeTitle').
            scrollIntoView().
            should('be.visible').
            click();
        cy.get('#customThemes').
            should('be.visible').
            click();
    });

    it('MM-T280_1 Theme Colors - Color Picker (Sidebar styles)', () => {
        // # Change "Sidebar BG" and verify color change
        verifyColorPickerChange(
            'Sidebar Styles',
            '#sidebarBg-squareColorIcon',
            '#sidebarBg-inputColorValue',
            '#sidebarBg-squareColorIconValue',
        );
    });

    it('MM-T280_2 Theme Colors - Color Picker (Center Channel styles)', () => {
        // # Change "Center Channel BG" and verify color change
        verifyColorPickerChange(
            'Center Channel Styles',
            '#centerChannelBg-squareColorIcon',
            '#centerChannelBg-inputColorValue',
            '#centerChannelBg-squareColorIconValue',
        );
    });

    it('MM-T280_3 Theme Colors - Color Picker (Link and Button styles)', () => {
        // # Change "Link Color" and verify color change
        verifyColorPickerChange(
            'Link and Button Styles',
            '#linkColor-squareColorIcon',
            '#linkColor-inputColorValue',
            '#linkColor-squareColorIconValue',
        );
    });
});

function verifyColorPickerChange(stylesText, iconButtonId, inputId, iconValueId) {
    // # Open styles section
    cy.findByText(stylesText).scrollIntoView().should('be.visible').click({force: true});

    // # Click the Sidebar BG setting
    cy.get(iconButtonId).click();

    // # Click the 15, 40 coordinate of color popover
    cy.get('.color-popover').should('be.visible').click(15, 40);

    // # Click the Sidebar BG setting again to close popover
    cy.get(iconButtonId).click();

    // # Toggle theme colors the custom theme
    cy.get('#standardThemes').
        scrollIntoView().
        should('be.visible').
        check();
    cy.get('#customThemes').
        scrollIntoView().
        should('be.visible').
        check();

    // # Re-open styles section
    cy.findByText(stylesText).
        scrollIntoView().
        should('be.visible').
        click({force: true});

    // * Verify color change is applied correctly
    cy.get(inputId).
        scrollIntoView().
        should('be.visible').
        invoke('attr', 'value').
        then((hexColor) => {
            const rbgArr = hexToRgbArray(hexColor);
            cy.get(iconValueId).should('be.visible').and('have.css', 'background-color', rgbArrayToString(rbgArr));
        });
}
