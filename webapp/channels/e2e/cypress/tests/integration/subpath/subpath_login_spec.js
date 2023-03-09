// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @subpath @not_cloud @signin_authentication

describe('Cookie with Subpath', () => {
    let testUser;
    let townsquareLink;

    before(() => {
        cy.shouldRunWithSubpath();
        cy.shouldNotRunOnCloudEdition();

        // # Create new team and user
        cy.apiInitSetup().then(({team, user}) => {
            testUser = user;

            // Logout current session and try to visit town-square
            cy.apiLogout().then(() => {
                townsquareLink = `/${team.name}/channels/town-square`;
                cy.visit(townsquareLink);
            });
        });
    });

    it('should generate cookie with subpath', () => {
        cy.url().then((url) => {
            cy.location().its('origin').then((origin) => {
                let subpath = '';
                if (url !== origin) {
                    subpath = url.replace(origin, '').replace(townsquareLink, '');
                }

                // * Check login page is loaded
                cy.get('.login-body-card').should('be.visible');

                // # Login as testUser
                cy.get('#input_loginId').should('be.visible').type(testUser.username);
                cy.get('#input_password-input').should('be.visible').type(testUser.password);
                cy.get('#saveSetting').should('be.visible').click();

                // * Check login success
                cy.get('#channel_view').should('be.visible');

                // * Check subpath included in url
                cy.url().should('include', subpath);
                cy.url().should('include', '/channels/town-square');

                // * Check cookies have correct path parameter
                cy.getCookies().should('have.length', 5).each((cookie) => {
                    if (subpath) {
                        expect(cookie).to.have.property('path', subpath);
                    } else {
                        expect(cookie).to.have.property('path', '/');
                    }
                });
            });
        });
    });
});
