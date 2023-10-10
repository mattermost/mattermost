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
import {getRandomId} from '../../../utils';

describe('Authentication', () => {
    const restrictCreationToDomains = 'mattermost.com, test.com';
    let testUser;
    let testUserAlreadyInTeam;
    let testTeam;

    before(() => {
        // # Do email test if setup properly
        cy.shouldHaveEmailEnabled();

        cy.apiInitSetup().then(({user, team}) => {
            testUserAlreadyInTeam = user;
            testTeam = team;
            cy.apiCreateUser().then(({user: newUser}) => {
                testUser = newUser;
            });
        });
    });

    beforeEach(() => {
        // # Log in as a admin.
        cy.apiAdminLogin();
    });

    it('MM-T1756 - Restrict Domains - Multiple - success', () => {
        // # Set restricted domain
        cy.apiUpdateConfig({
            TeamSettings: {
                RestrictCreationToDomains: restrictCreationToDomains,
            },
        });

        // # Log out and go to login page
        cy.apiLogout();
        cy.visit('/login');

        // * Assert that create account button is visible
        cy.findByText('Don\'t have an account?', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');

        // # Go to sign up with email page
        cy.visit('/signup_user_complete');

        cy.get('#input_email', {timeout: TIMEOUTS.ONE_MIN}).type(`test-${getRandomId()}@mattermost.com`);

        cy.get('#input_password-input').type('Test123456!');

        cy.get('#input_name').clear().type(`test${getRandomId()}`);

        cy.findByText('Create Account').click();

        // * Make sure account was created successfully and we are at the select team page
        cy.findByText('Teams you can join:', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');
    });

    it('MM-T1757 - Restrict Domains - Multiple - fail', () => {
        // # Set restricted domain
        cy.apiUpdateConfig({
            TeamSettings: {
                RestrictCreationToDomains: restrictCreationToDomains,
            },
        });

        cy.apiLogin(testUserAlreadyInTeam);
        cy.visit('/');

        // # Open Profile
        cy.uiOpenProfileModal('Profile Settings');

        // # Click "Edit" to the right of "Email"
        cy.get('#emailEdit').should('be.visible').click();

        // # Type new email
        cy.get('#primaryEmail').should('be.visible').type('user-123123@example.com');
        cy.get('#confirmEmail').should('be.visible').type('user-123123@example.com');
        cy.get('#currentPassword').should('be.visible').type(testUser.password);

        // # Save the settings
        cy.uiSave().wait(TIMEOUTS.HALF_SEC);

        // * Assert an error exist and is what is expected
        cy.findByText('The email you provided does not belong to an accepted domain. Please contact your administrator or sign up with a different email.').should('be.visible');
    });

    it('MM-T1758 - Restrict Domains - Team invite closed team', () => {
        // # Set restricted domain
        cy.apiUpdateConfig({
            TeamSettings: {
                RestrictCreationToDomains: restrictCreationToDomains,
            },
        });

        cy.apiLogout();
        cy.visit(`/signup_user_complete/?id=${testTeam.invite_id}`);

        cy.get('#input_email', {timeout: TIMEOUTS.ONE_MIN}).type(`test-${getRandomId()}@example.com`);

        cy.get('#input_password-input').type('Test123456!');

        cy.get('#input_name').clear().type(`test${getRandomId()}`);

        cy.findByText('Create Account').click();

        // * Make sure account was not created successfully
        cy.get('.AlertBanner__title').scrollIntoView().should('be.visible');
        cy.findByText('The email you provided does not belong to an accepted domain. Please contact your administrator or sign up with a different email.').should('be.visible');
    });

    it('MM-T1763 - Security - Signup: Email verification not required, user immediately sees Town Square', () => {
        // # Disable email verification
        cy.apiUpdateConfig({
            EmailSettings: {
                RequireEmailVerification: false,
            },
        }).then(({config}) => {
            // # Log out and go to front page
            cy.apiLogout();
            cy.visit('/login');

            // * Assert that create account button is visible
            cy.findByText('Don\'t have an account?', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');

            // # Go to sign up with email page
            cy.visit('/signup_user_complete');

            const username = `Test${getRandomId()}`;
            const email = `${username.toLowerCase()}@example.com`;

            cy.get('#input_email', {timeout: TIMEOUTS.ONE_MIN}).type(email);

            cy.get('#input_password-input').type('Test123456!');

            cy.get('#input_name').clear().type(username);

            cy.findByText('Create Account').click();

            // * Make sure account was created successfully and we are on the team joining page
            cy.findByText('Teams you can join:', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');

            cy.getRecentEmail({username, email}).then(({subject}) => {
                // * Verify the subject
                expect(subject).to.include(`[${config.TeamSettings.SiteName}] You joined`);
            });
        });
    });

    it('MM-T1765 - Authentication - Email - Creation with email = false', () => {
        // # Disable user sign up and enable GitLab
        cy.apiUpdateConfig({
            EmailSettings: {
                EnableSignUpWithEmail: false,
            },
            GitLabSettings: {
                Enable: true,
            },
        });

        cy.apiLogout();
        cy.visit(`/signup_user_complete/?id=${testTeam.invite_id}`);

        cy.findByText('Create your account with one of the following:').should('exist');
        cy.findByText('GitLab', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');

        // * Email and Password option does not exist
        cy.findByText('Email address').should('not.exist');
        cy.findByText('Choose a Password').should('not.exist');
    });
});
