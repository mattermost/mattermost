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

describe('Custom Theme - Sidebar Styles', () => {
    const themeRgbColor = {};

    before(() => {
        // # Login as new user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);

            // # Go to Theme > Custom > Sidebar Styles
            cy.uiOpenSettingsModal('Display');
            cy.get('#themeTitle').scrollIntoView().click();
            cy.uiGetRadioButton('Custom Theme').click();
            cy.findByText('Sidebar Styles').scrollIntoView().click({force: true});
        });
    });

    it('MM-T3853_1 Should change custom sidebar styles on click to color picker', () => {
        const testCases = [
            {key: 0, name: 'Sidebar BG', themeId: 'sidebarBg'},
            {key: 1, name: 'Sidebar Text', themeId: 'sidebarText'},
            {key: 2, name: 'Sidebar Header BG', themeId: 'sidebarHeaderBg'},
            {key: 3, name: 'Team Sidebar BG', themeId: 'sidebarTeamBarBg'},
            {key: 4, name: 'Sidebar Header Text', themeId: 'sidebarHeaderTextColor'},
            {key: 5, name: 'Sidebar Unread Text', themeId: 'sidebarUnreadText'},
            {key: 6, name: 'Sidebar Text Hover BG', themeId: 'sidebarTextHoverBg'},
            {key: 7, name: 'Sidebar Text Active Border', themeId: 'sidebarTextActiveBorder'},
            {key: 8, name: 'Sidebar Text Active Color', themeId: 'sidebarTextActiveColor'},
            {key: 9, name: 'Online Indicator', themeId: 'onlineIndicator'},
            {key: 10, name: 'Away Indicator', themeId: 'awayIndicator'},
            {key: 11, name: 'Do Not Disturb Indicator', themeId: 'dndIndicator'},
            {key: 12, name: 'Mention Jewel BG', themeId: 'mentionBg'},
            {key: 13, name: 'Mention Jewel Text', themeId: 'mentionColor'},
        ];

        Cypress._.forEach(testCases, (testCase) => {
            // # Click input color button
            cy.get('.input-group-addon').eq(testCase.key).scrollIntoView().click({force: true});

            // # Click the 15, 40 plus key coordinate of color popover
            cy.get('.color-popover').should('be.visible').click(15, 40 + testCase.key);

            cy.get(`#${testCase.themeId}-inputColorValue`).scrollIntoView().should('be.visible').invoke('attr', 'value').then((hexColor) => {
                themeRgbColor[testCase.themeId] = hexToRgbArray(hexColor);

                // * Check that icon color change
                cy.get('.color-icon').eq(testCase.key).should('have.css', 'background-color', rgbArrayToString(themeRgbColor[testCase.themeId]));

                // * Check that theme colors for text sharing is updated
                cy.get('#pasteBox').scrollIntoView().should('contain', `"${testCase.themeId}":"${hexColor.toLowerCase()}"`);
            });
        });
    });

    it('MM-T3853_2 Should observe color change in Settings modal before saving', () => {
        // * Check Sidebar BG color change
        cy.get('.settings-links').should('have.css', 'background-color', rgbArrayToString(themeRgbColor.sidebarBg));

        // * Check Sidebar Text color change
        const rgbArr = themeRgbColor.sidebarText;
        cy.get('#displayButton').should('have.css', 'color', `rgba(${rgbArr[0]}, ${rgbArr[1]}, ${rgbArr[2]}, 0.6)`);

        // * Check Sidebar Header BG color change
        cy.get('#accountSettingsHeader').should('have.css', 'background', `${rgbArrayToString(themeRgbColor.sidebarHeaderBg)} none repeat scroll 0% 0% / auto padding-box border-box`);

        // * Check Sidebar Header Text color change
        cy.get('#accountSettingsModalLabel').should('have.css', 'color', rgbArrayToString(themeRgbColor.sidebarHeaderTextColor));

        cy.uiSaveAndClose();
    });

    it('MM-T3853_3 Should take effect each custom color in Channel View', () => {
        // * Check Mention Jewel BG color
        cy.get('#unreadIndicatorBottom').should('have.css', 'background-color', rgbArrayToString(themeRgbColor.mentionBg));

        // * Check Mention Jewel Text color
        cy.get('#unreadIndicatorBottom').should('have.css', 'color', rgbArrayToString(themeRgbColor.mentionColor));

        // # Set user status to online
        cy.uiOpenUserMenu('Online');

        // * Check Online Indicator color
        cy.get('.icon-check-circle').should('have.css', 'color', rgbArrayToString(themeRgbColor.onlineIndicator));

        // # Set user status to away
        cy.uiOpenUserMenu('Away');

        // * Check Away Indicator color
        cy.get('.icon-clock').should('have.css', 'color', rgbArrayToString(themeRgbColor.awayIndicator));

        // # Set user status to do not disturb
        cy.uiOpenDndStatusSubMenu().find('#dndTime-thirty_minutes_menuitem').click();

        // * Check Do Not Disturb Indicator color
        cy.get('.icon-minus-circle').should('have.css', 'color', rgbArrayToString(themeRgbColor.dndIndicator));
    });
});
