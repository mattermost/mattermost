// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. #. Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @ldap

// assumes the CYPRESS_* variables are set
// assumes that E20 license is uploaded
// for setup with AWS: Follow the instructions mentioned in the mattermost/platform-private/config/ldap-test-setup.txt file

describe('LDAP settings', () => {
    beforeEach(() => {
        // # Login as sysadmin
        cy.apiAdminLogin();

        // * Check if server has license for LDAP
        cy.apiRequireLicenseForFeature('LDAP');
    });

    it('MM-T2699 Connection test button - Successful', () => {
        // # Load AD/LDAP page in system console
        cy.visitLDAPSettings();

        // # Click "AD/LDAP Test"
        cy.findByRole('button', {name: /ad\/ldap test/i}).click();

        // * Confirmation message saying the connection is successful.
        cy.findByText(/ad\/ldap test successful/i).should('be.visible');
        cy.findByTitle(/success icon/i).should('be.visible');
    });

    it('MM-T2700 LDAP username required', () => {
        cy.visitLDAPSettings();

        // # Remove text from Username Attribute
        cy.findByLabelText(/username attribute:/i).click().clear();

        // # Click Save
        cy.findByRole('button', {name: /save/i}).click();

        // * Verifying message "AD/LDAP field "Username Attribute" is required."
        cy.findByText('AD/LDAP field "Username Attribute" is required.').should('be.visible');

        // # Set back to what it was
        cy.findByLabelText(/username attribute:/i).click().type('uid');
        cy.findByRole('button', {name: /save/i}).click();
        cy.findByRole('button', {name: /save/i}).should('be.disabled');
    });

    it('MM-T2701 LDAP LoginidAttribute required', () => {
        cy.visitLDAPSettings();

        // # Try to save LDAP settings with blank Loginid
        cy.findByTestId('LdapSettings.LoginIdAttributeinput').click().clear();
        cy.findByRole('button', {name: /save/i}).click();

        // * Verifying Error Message
        cy.findByText(/ad\/ldap field "login id attribute" is required./i).should('be.visible');
    });

    it('MM-T2704 Create new LDAP account from login page', () => {
        const testSettings = {
            user: {
                username: 'test.two',
                password: 'Password1',
            },
            siteName: 'Mattermost',
        };

        // # Login as a new LDAP user
        cy.doLDAPLogin(testSettings);

        // * Verify user is logged in  Successfully
        cy.findByText(/logout/i).should('be.visible');
    });
});
