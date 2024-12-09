// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @menu @custom_status @status_menu

import theme from '../../../fixtures/theme.json';

describe('Status dropdown menu', () => {
    const statusTestCases = [
        {text: 'Online', className: 'userAccountMenu_onlineMenuItem_icon'},
        {text: 'Away', className: 'userAccountMenu_awayMenuItem_icon'},
        {text: 'Do not disturb', className: 'userAccountMenu_dndMenuItem_icon'},
        {text: 'Offline', className: 'userAccountMenu_offlineMenuItem_icon'},
    ];

    before(() => {
        // # Login as test user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
            cy.postMessage('hello');
        });
    });

    beforeEach(() => {
        // # Click anywhere to close open menu
        cy.get('body').click();
    });

    it('MM-T2927_1 Should show all available statuses with their icons', () => {
        // # Open user menu
        cy.uiOpenUserMenu().as('userMenu');

        // * Verify all available statuses are shown with icon and text
        statusTestCases.forEach((tc) => {
            cy.uiGetStatusMenu().within(() => {
                cy.findByText(tc.text).should('be.visible');
                cy.get('svg').filter(`.${tc.className}`).should('have.length', 1);
            });
        });
    });

    it('MM-T2927_2 Should select each status, and have the user\'s active status change', () => {
        // * Verify that all statuses get set correctly
        stepThroughStatuses(statusTestCases);
    });

    it('MM-T2927_3 Icons are visible in dark mode', () => {
        // #Change to dark mode
        cy.apiSaveThemePreference(JSON.stringify(theme.dark));

        // * Verify that all statuses get set correctly
        stepThroughStatuses(statusTestCases);

        // # Reset the theme to default
        cy.apiSaveThemePreference(JSON.stringify(theme.default));
    });

    it('MM-T2927_4 "Set a Custom Header Status" is clickable', () => {
        // # Open user menu
        cy.uiOpenUserMenu().as('userMenu');

        // * Verify "Set a Custom Status" header is clickable
        cy.get('@userMenu').findByText('Set custom status').should('have.css', 'cursor', 'pointer');
    });

    it('MM-T2927_5 When custom status is disabled, status menu is displayed when status icon is clicked', () => {
        cy.apiAdminLogin();
        cy.visit('/');

        // # Disable custom statuses
        cy.apiUpdateConfig({TeamSettings: {EnableCustomUserStatuses: false}});

        // # Open user menu to verify it still open up and visible
        cy.uiOpenUserMenu();
    });

    it('MM-T4914 Profile menu header is clickable, opens Profile settings', () => {
        // # Open user menu
        cy.uiOpenUserMenu().within(() => {
            // * Verify menu header is clickable
            cy.get('li').first().should('have.css', 'cursor', 'pointer').click();
        });

        // * Verify click on header opens Profile settings modal
        cy.findByRole('dialog', {name: 'Profile'}).should('be.visible');
    });
});

function stepThroughStatuses(statusTestCases = []) {
    // # Wait for posts to load
    cy.get('#postListContent').should('be.visible');

    // * Verify the user's status icon changes correctly every time
    statusTestCases.forEach((tc) => {
        // # Open user menu and click option
        if (tc.text === 'Do not disturb') {
            cy.uiOpenDndStatusSubMenuAndClick30Mins();
        } else {
            cy.uiOpenUserMenu(tc.text);
        }

        // # Verify correct status icon is shown on user's profile picture
        cy.uiGetSetStatusButton().within(() => {
            cy.get('svg').filter(`.${tc.className}`).should('have.length', 1);
        });
    });
}
