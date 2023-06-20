// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @system_console @authentication

describe('Authentication', () => {
    beforeEach(() => {
        // # Log in as a admin.
        cy.apiAdminLogin();
    });

    after(() => {
        cy.apiAdminLogin({failOnStatusCode: false});
        cy.apiUpdateConfig({});
    });

    const testCases = [
        {
            title: 'MM-T1767 - Email signin false Username signin true',
            signinWithEmail: false,
            signinWithUsername: true,
        },
        {
            title: 'MM-T1768 - Email signin true Username signin true',
            signinWithEmail: true,
            signinWithUsername: true,
        },
        {
            title: 'MM-T1769 - Email signin true Username signin false',
            signinWithEmail: true,
            signinWithUsername: false,
        },
    ];

    testCases.forEach(({title, signinWithEmail, signinWithUsername}) => {
        it(title, () => {
            cy.apiUpdateConfig({
                EmailSettings: {
                    EnableSignInWithEmail: signinWithEmail,
                    EnableSignInWithUsername: signinWithUsername,
                },
                LdapSettings: {
                    Enable: false,
                },
            });

            cy.apiLogout();

            // # Go to front page
            cy.visit('/login');

            // # Remove autofocus from login input
            cy.focused().blur();

            let expectedPlaceholderText;
            if (signinWithEmail && signinWithUsername) {
                expectedPlaceholderText = 'Email or Username';
            } else if (signinWithEmail) {
                expectedPlaceholderText = 'Email';
            } else {
                expectedPlaceholderText = 'Username';
            }

            // * Make sure the username field has expected placeholder text
            cy.findByPlaceholderText(expectedPlaceholderText).should('exist').and('be.visible');
        });
    });
});
