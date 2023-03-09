// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @enterprise @system_console

describe('Main menu', () => {
    before(() => {
        // * Check if server has license
        cy.apiRequireLicense();

        // # Go to admin console
        cy.visit('/admin_console');

        // # Open the hamburger menu
        cy.get('button > span[class="menu-icon"]').click();
    });

    it('MM-T913 About opens About modal', () => {
        // # click to open about modal
        cy.findByText('About Mattermost').click();

        // * Verify server link text has correct link destination and opens in a new tab
        verifyLink('server', 'https://github.com/mattermost/mattermost-server/blob/master/NOTICE.txt');

        // * Verify link text has correct link destination and opens in a new tab
        verifyLink('desktop', 'https://github.com/mattermost/desktop/blob/master/NOTICE.txt');

        // * Verify link text has correct matches link destination and opens in a new tab
        verifyLink('mobile', 'https://github.com/mattermost/mattermost-mobile/blob/master/NOTICE.txt');

        // * Verify version exists in modal
        cy.findByText('Mattermost Version:').should('be.visible');

        // * Verify licensed to exists in modal
        cy.findByText('Licensed to:').should('be.visible');
    });
});

const verifyLink = (text, link) => {
    // * Verify link opens in new tab
    cy.get('a[href="' + link + '"]').scrollIntoView().should('have.attr', 'target', '_blank');

    // * Verify link text matches correct href value
    cy.get('a[href="' + link + '"]').contains(text);
};
