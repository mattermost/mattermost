// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @system_console @authentication

import * as TIMEOUTS from '../../../fixtures/timeouts';
import {reUrl, getRandomId} from '../../../utils';

describe('Authentication', () => {
    let testUser;

    before(() => {
        // # Do email test if setup properly
        cy.shouldHaveEmailEnabled();

        cy.apiCreateUser().then(({user: newUser}) => {
            testUser = newUser;
        });
    });

    beforeEach(() => {
        cy.apiAdminLogin();
    });

    it('MM-T1764 - Security - Signup: Email verification required (after having created account when verification was not required)', () => {
        // # Update Configs
        cy.apiUpdateConfig({
            EmailSettings: {
                RequireEmailVerification: false,
            },
        });

        // # Login as test user and make sure it goes to team selection
        cy.apiLogin(testUser);
        cy.visit('/');
        cy.url().should('include', '/select_team');
        cy.findByText('Teams you can join:', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');

        cy.apiAdminLogin();

        // # Update Configs
        cy.apiUpdateConfig({
            EmailSettings: {
                RequireEmailVerification: true,
            },
        });

        cy.apiLogout();

        // # Login as test user and make sure it goes to team selection
        cy.visit('/login');

        // # Remove autofocus from login input
        cy.get('.login-body-card-content').should('be.visible').focus();

        // # Clear email/username field and type username
        cy.apiGetClientLicense().then(({isLicensed}) => {
            cy.findByPlaceholderText(isLicensed ? 'Email, Username or AD/LDAP Username' : 'Email or Username', {timeout: TIMEOUTS.ONE_MIN}).clear().type(testUser.username);
        });

        // # Clear password field and type password
        cy.findByPlaceholderText('Password').clear().type(testUser.password);

        // # Hit enter to login
        cy.get('#saveSetting').should('not.be.disabled').click();

        cy.wait(TIMEOUTS.THREE_SEC);

        // * Assert that email verification has been sent and then resend to make sure it gets resent
        cy.findByText('Resend Email').should('be.visible').and('exist').click();
        cy.findByText('Verification email sent').should('be.visible').and('exist');
        cy.findByText('You’re almost done!').should('be.visible').and('exist');
        cy.findByText('Please verify your email address. Check your inbox for an email.').should('be.visible').and('exist');

        cy.getRecentEmail(testUser).then(({body}) => {
            const permalink = body[6].match(reUrl)[0];

            // # Visit permalink (e.g. click on email link), view in browser to proceed
            cy.visit(permalink);

            // # Clear password field and type password
            cy.get('#input_password-input').clear().type(testUser.password);

            // # Hit enter to login
            cy.get('#saveSetting').should('not.be.disabled').click();

            // * Should show the join team stuff
            cy.findByText('Teams you can join:', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');
        });
    });

    it('MM-T1770 - Default password settings', () => {
        cy.apiGetClientLicense().then(({isCloudLicensed}) => {
            const newConfig = {
                PasswordSettings: {
                    MinimumLength: null,
                    Lowercase: null,
                    Number: null,
                    Uppercase: null,
                    Symbol: null,
                },
                ServiceSettings: {},
            };

            if (!isCloudLicensed) {
                newConfig.ServiceSettings = {
                    MaximumLoginAttempts: null,
                };
            }

            cy.apiUpdateConfig(newConfig);

            // * Ensure password has a minimum length of 8 and no password requirements are checked
            cy.apiGetConfig().then(({config: {PasswordSettings}}) => {
                expect(PasswordSettings.MinimumLength).equal(8);
                expect(PasswordSettings.Lowercase).equal(false);
                expect(PasswordSettings.Number).equal(false);
                expect(PasswordSettings.Uppercase).equal(false);
                expect(PasswordSettings.Symbol).equal(false);
            });

            cy.visit('/admin_console/authentication/password');
            cy.get('.admin-console__header').should('be.visible').and('have.text', 'Password');

            cy.findByTestId('passwordMinimumLengthinput').should('be.visible').and('have.value', '8');
            cy.findByLabelText('At least one lowercase letter').get('input').should('not.be.checked');
            cy.findByLabelText('At least one uppercase letter').get('input').should('not.be.checked');
            cy.findByLabelText('At least one number').get('input').should('not.be.checked');
            cy.findByLabelText('At least one symbol (e.g. "~!@#$%^&*()")').get('input').should('not.be.checked');

            if (!isCloudLicensed) {
                cy.findByTestId('maximumLoginAttemptsinput').should('be.visible').and('have.value', '10');
            }
        });
    });

    it('MM-T1783 - Username validation shows errors for various username requirements', () => {
        // # Go to sign up with email page
        cy.visit('/signup_user_complete');

        cy.get('#input_email', {timeout: TIMEOUTS.ONE_MIN}).type(`test-${getRandomId()}@example.com`);

        cy.get('#input_password-input').type('Test123456!');

        ['1user', 'te', 'user#1', 'user!1'].forEach((option) => {
            cy.get('#input_name').clear().type(option);
            cy.findByText('Create Account').click();

            // * Assert the error is what is expected;
            cy.get('.Input___error').scrollIntoView().should('be.visible');
            cy.findByText('Usernames have to begin with a lowercase letter and be 3-22 characters long. You can use lowercase letters, numbers, periods, dashes, and underscores.').should('be.visible');
        });
    });

    it('MM-T1752 - Enable account creation - true', () => {
        // # Enable open server
        cy.apiUpdateConfig({
            TeamSettings: {
                EnableUserCreation: true,
            },
        });

        // # Logout and go to front page
        cy.apiLogout();
        cy.visit('/login');

        // * Assert that create account button is visible
        cy.findByText('Don\'t have an account?', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');

        // # Go to sign up with email page
        cy.visit('/signup_user_complete');

        cy.get('#input_email', {timeout: TIMEOUTS.ONE_MIN}).type(`test-${getRandomId()}@example.com`);

        cy.get('#input_password-input').type('Test123456!');

        cy.get('#input_name').clear().type(`Test${getRandomId()}`);

        cy.findByText('Create Account').click();

        // * Make sure account was created successfully and we are on the team joining page
        cy.findByText('Teams you can join:', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');
    });

    it('MM-T1753 - Enable account creation - false', () => {
        // # Disable user account creation
        cy.apiUpdateConfig({
            TeamSettings: {
                EnableUserCreation: false,
            },
        });

        cy.apiLogout();

        // # Go to front page
        cy.visit('/login');

        // * Assert that create account button is visible
        cy.findByText('Don\'t have an account?', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');

        // # Go to sign up with email page
        cy.visit('/signup_user_complete');

        cy.get('#input_email', {timeout: TIMEOUTS.ONE_MIN}).type(`test-${getRandomId()}@example.com`);

        cy.get('#input_password-input').type('Test123456!');

        cy.get('#input_name').clear().type(`Test${getRandomId()}`);

        cy.findByText('Create Account').click();

        // * Make sure account was not created successfully and we are on the team joining page
        cy.get('.AlertBanner__title').scrollIntoView().should('be.visible');
        cy.findByText('User sign-up with email is disabled.').should('be.visible').and('exist');
    });

    it('MM-T1754 - Restrict Domains - Account creation link on signin page', () => {
        // # Enable user account creation and set restricted domain
        cy.apiUpdateConfig({
            TeamSettings: {
                RestrictCreationToDomains: 'test.com',
                EnableUserCreation: true,
            },
        });

        cy.apiLogout();

        // # Go to front page
        cy.visit('/login');

        // * Assert that create account button is visible
        cy.findByText('Don\'t have an account?', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');

        // # Go to sign up with email page
        cy.visit('/signup_user_complete');

        cy.get('#input_email', {timeout: TIMEOUTS.ONE_MIN}).type(`test-${getRandomId()}@example.com`);

        cy.get('#input_password-input').type('Test123456!');

        cy.get('#input_name').clear().type(`Test${getRandomId()}`);

        cy.findByText('Create Account').click();

        // * Make sure account was not created successfully
        cy.get('.AlertBanner__title').scrollIntoView().should('be.visible');
        cy.findByText('The email you provided does not belong to an accepted domain. Please contact your administrator or sign up with a different email.').should('be.visible').and('exist');
    });

    it('MM-T1755 - Restrict Domains - Email invite', () => {
        // # Enable user account creation and set restricted domain
        cy.apiUpdateConfig({
            TeamSettings: {
                RestrictCreationToDomains: 'test.com',
                EnableUserCreation: true,
            },
        });

        cy.visit('/');
        cy.postMessage('hello');

        // # Open team menu and click on "Invite People"
        cy.uiOpenTeamMenu('Invite People');

        // # Click invite members if needed
        cy.findByText('Copy invite link').click();

        // # Input email, select member
        cy.findByLabelText('Add or Invite People').type(`test-${getRandomId()}@mattermost.com{downarrow}{downarrow}{enter}`, {force: true});

        // # Click invite members button
        cy.findByRole('button', {name: 'Invite'}).click({force: true});

        // * Verify message is what you expect it to be
        cy.contains('The following email addresses do not belong to an accepted domain:', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('exist');
    });
});
