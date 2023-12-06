// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @account_setting

import * as TIMEOUTS from '../../../../fixtures/timeouts';

describe('Profile > Security > View and Log Out of Active Sessions', () => {
    const platforms = [
        'Linux',
        'Macintosh',
        'Windows',
        'Native Desktop App',
        'iPhone Native App',
        'Android Native App',
        'iPhone Native Classic App',
        'Android Native Classic App',
    ];
    const platformRegex = new RegExp(`${platforms.join('|')}`, 'g');

    let testUser: Cypress.UserProfile;

    before(() => {
        // # Login as new user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl, user}) => {
            testUser = user;
            cy.visit(offTopicUrl);

            // # Go to Profile
            cy.uiOpenProfileModal('Security');

            // * Check that the Security tab is loaded
            cy.get('#securityButton').should('be.visible');

            // # Click the Security tab
            cy.get('#securityButton').click();
        });
    });

    it('MM-T2088 View and Logout of Active Sessions (Se)', () => {
        // # Go to "View and Logout of Active Sessions"
        cy.findByText('View and Log Out of Active Sessions').should('be.visible').click();

        // * Verify an appropriate platform is shown
        cy.get('.report__platform').contains(platformRegex);

        // # Click "More info" for the login session
        cy.get('.report__info a').should('be.visible').and('have.text', 'More info').click();

        // * Verify info is displayed
        cy.get('.report__info').should('contain', 'Last activity:').
            and('contain', 'First time active:').
            and('contain', 'OS:').
            and('contain', 'Browser:').
            and('contain', 'Session ID:');

        // # Click "Log Out" to log out of the specified session
        cy.findByText('Log Out').click();

        // * Verify we have been logged out, and we can log back in
        cy.uiLogin(testUser);

        // * Verify we have successfully logged back in
        cy.get('#channel_view', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');
    });
});
