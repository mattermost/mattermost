// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @customization

describe('Customization', () => {
    it('MM-T5379 - Should match title and custom description in root html', () => {
        const defaultTitle = 'Mattermost';
        const defaultDescription = 'Log in';
        const customTitle = 'Custom site name';
        const customDescription = 'Custom description';

        // # Log out and visit login page
        cy.apiLogout();
        cy.visit('/login');

        // * Verify that the head tag contains default title and without og:description
        cy.get('head').find('title').should('have.text', defaultTitle);
        cy.get('head').get('meta[property="og:description"]').should('not.exist');

        // * Verify that the header contains default logo/image
        cy.get('.header-logo-link').should('have.text', '').and('have.attr', 'href', '/').find('svg').should('be.visible');

        // * Verify that login card contains default description
        cy.get('.login-body-card-title').should('be.visible').and('have.text', defaultDescription);

        // # Update the site name and custom description
        cy.apiAdminLogin();
        cy.apiUpdateConfig({TeamSettings: {SiteName: customTitle, CustomDescriptionText: customDescription}});

        // # Log out and visit login page
        cy.apiLogout();
        cy.visit('');

        // * Verify that the head tag contains custom title and description
        cy.get('head').find('title').should('have.text', customTitle);
        cy.get('head').get('meta[property="og:description"]').should('have.attr', 'content', customDescription);

        // * Verify that the header contains custom title
        cy.get('.header-logo-link').should('have.text', customTitle).and('have.attr', 'href', '/');

        // * Verify that login card contains custom description
        cy.get('.login-body-card-title').should('be.visible').and('have.text', customDescription);
    });
});
