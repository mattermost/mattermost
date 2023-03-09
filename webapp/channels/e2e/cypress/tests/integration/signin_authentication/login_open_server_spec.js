// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @signin_authentication

import {FixedCloudConfig} from '../../utils/constants';

describe('Login page with open server', () => {
    let config;
    let testUser;
    before(() => {
        // Disable other auth options
        const newSettings = {
            Office365Settings: {Enable: false},
            LdapSettings: {Enable: false},
        };
        cy.apiUpdateConfig(newSettings).then((data) => {
            ({config} = data);
        });

        // # Create new team and users
        cy.apiInitSetup().then(({user}) => {
            testUser = user;

            cy.apiLogout();
            cy.visit('/login');
        });
    });

    it('MM-T3306_2 Should autofocus on email field on page load', () => {
        // * Check the focused element has the placeholder of email/username
        cy.get('#input_loginId').should('have.focus');
    });

    it('MM-T3306_1 Should render all elements of the page', () => {
        // * Verify URL is of login page
        cy.url().should('include', '/login');

        // * Verify title of the document is correct
        cy.title().should('include', config.TeamSettings.SiteName);

        // # Remove autofocus from login id input
        cy.get('.login-body-card-content').should('be.visible').focus();

        // * Verify email/username field is present
        cy.findByPlaceholderText('Email or Username').should('exist').and('be.visible');

        // * Verify password is present
        cy.findByPlaceholderText('Password').should('exist').and('be.visible');

        // * Verify sign in button is present
        cy.get('#saveSetting').should('exist').and('be.visible');

        // * Verify forget password link is present
        cy.findByText('Forgot your password?').should('exist').and('be.visible').should('have.attr', 'href', '/reset_password');

        // * Verify create an account link is present
        cy.findByText('Don\'t have an account?').should('exist').and('be.visible').should('have.attr', 'href', '/signup_user_complete');

        // # Move inside of footer section
        cy.get('.hfroute-footer').should('exist').and('be.visible').within(() => {
            const {
                ABOUT_LINK,
                HELP_LINK,
                PRIVACY_POLICY_LINK,
                TERMS_OF_SERVICE_LINK,
            } = FixedCloudConfig.SupportSettings;

            // * Check if about footer link is present
            cy.findByText('About').should('exist').
                and('have.attr', 'href', config.SupportSettings.AboutLink || ABOUT_LINK);

            // * Check if privacy footer link is present
            cy.findByText('Privacy Policy').should('exist').
                and('have.attr', 'href', config.SupportSettings.PrivacyPolicyLink || PRIVACY_POLICY_LINK);

            // * Check if terms footer link is present
            cy.findByText('Terms').should('exist').
                and('have.attr', 'href', config.SupportSettings.TermsOfServiceLink || TERMS_OF_SERVICE_LINK);

            // * Check if help footer link is present
            cy.findByText('Help').should('exist').
                and('have.attr', 'href', config.SupportSettings.HelpLink || HELP_LINK);

            const todaysDate = new Date();
            const currentYear = todaysDate.getFullYear();

            // * Check if copyright footer is present
            cy.findByText(`© ${currentYear} Mattermost Inc.`).should('exist');
        });
    });

    it('MM-T3306_3 Should keep enable Log in button when empty email/username and password field', () => {
        // # Clear email/username field
        cy.findByPlaceholderText('Email or Username').clear();

        // # Clear password field
        cy.findByPlaceholderText('Password').clear();

        // # Verify Log in button enabled
        cy.get('#saveSetting').should('not.be.disabled');
    });

    it('MM-T3306_4 Should keep enable Log in button when empty email/username field', () => {
        // # Clear email/username field
        cy.findByPlaceholderText('Email or Username').clear();

        // # Enter a password
        cy.findByPlaceholderText('Password').clear().type('samplepassword');

        // # Verify Log in button enabled
        cy.get('#saveSetting').should('not.be.disabled');
    });

    it('MM-T3306_5 Should keep enable Log in button when empty password field', () => {
        // # Enter any email/username in the email field
        cy.findByPlaceholderText('Email or Username').clear().type('sampleusername');

        // # Clear password field
        cy.findByPlaceholderText('Password').clear();

        // # Verify Log in button enabled
        cy.get('#saveSetting').should('not.be.disabled');
    });

    it('MM-T3306_6 Should show error with invalid email/username and password', () => {
        const invalidEmail = `${Date.now()}-user`;
        const invalidPassword = `${Date.now()}-password`;

        // # Lets verify generated email is not an actual email/username
        expect(invalidEmail).to.not.equal(testUser.username);

        // # Lets verify generated password is not an actual password
        expect(invalidPassword).to.not.equal(testUser.password);

        // # Enter invalid email/username in the email field
        cy.findByPlaceholderText('Email or Username').clear().type(invalidEmail);

        // # Enter invalid password in the password field
        cy.findByPlaceholderText('Password').clear().type(invalidPassword);

        // # Verify Log in button enabled and click
        cy.get('#saveSetting').should('not.be.disabled').click();

        // * Verify appropriate error message is displayed for incorrect email/username and password
        cy.findByText('The email/username or password is invalid.').should('exist').and('be.visible');
    });

    it('MM-T3306_7 Should show error with invalid password', () => {
        const invalidPassword = `${Date.now()}-password`;

        // # Lets verify generated password is not an actual password
        expect(invalidPassword).to.not.equal(testUser.password);

        // # Enter actual users email/username in the email field
        cy.findByPlaceholderText('Email or Username').clear().type(testUser.username);

        // # Enter invalid password in the password field
        cy.findByPlaceholderText('Password').clear().type(invalidPassword);

        // # Verify Log in button enabled and click
        cy.get('#saveSetting').should('not.be.disabled').click();

        // * Verify appropriate error message is displayed for incorrect email/username and password
        cy.findByText('The email/username or password is invalid.').should('exist').and('be.visible');
    });

    it('MM-T3306_8 Should login with a valid email and password and logout', () => {
        // # Enter actual users email/username in the email field
        cy.findByPlaceholderText('Email or Username').clear().type(testUser.username);

        // # Enter any password in the email field
        cy.findByPlaceholderText('Password').clear().type(testUser.password);

        // # Verify Log in button enabled and click
        cy.get('#saveSetting').should('not.be.disabled').click();

        // * Check that it login successfully and it redirects into the main channel page
        cy.url().should('include', '/channels/town-square');

        // # Click logout via user menu
        cy.uiOpenUserMenu('Log Out');

        // * Check that it logout successfully and it redirects into the login page
        cy.url().should('include', '/login');
    });

    it('MM-42489 Should login with a valid email and password using enter key and logout', () => {
        // # Visit login page
        cy.visit('/login');

        // # Remove autofocus from login id input
        cy.get('.login-body-card-content').should('be.visible').focus();

        // # Enter actual users email/username in the email field
        cy.findByPlaceholderText('Email or Username').clear().type(testUser.username);

        // # Enter any password in the email field and hit enter
        cy.findByPlaceholderText('Password').clear().type(`${testUser.password}{enter}`);

        // * Check that it login successfully and it redirects into the main channel page
        cy.url().should('include', '/channels/town-square');

        // # Click logout via user menu
        cy.uiOpenUserMenu('Log Out');

        // * Check that it logout successfully and it redirects into the login page
        cy.url().should('include', '/login');
    });
});
