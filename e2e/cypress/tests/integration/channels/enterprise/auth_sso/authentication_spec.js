// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @system_console @authentication

import * as TIMEOUTS from '../../../../fixtures/timeouts';

import {getRandomId} from '../../../../utils';

describe('Authentication', () => {
    let testTeam;

    before(() => {
        cy.apiRequireLicense();

        cy.apiInitSetup().then(({team}) => {
            testTeam = team;
        });
    });

    beforeEach(() => {
        // # Log in as a admin.
        cy.apiAdminLogin();
    });

    it('MM-T1759 - Restrict Domains - Team invite open team', () => {
        // # Set restricted domain
        cy.apiUpdateConfig({
            TeamSettings: {
                RestrictCreationToDomains: 'mattermost.com, test.com',
            },
        }).then(() => {
            cy.visit(`/admin_console/user_management/teams/${testTeam.id}`);

            cy.findByTestId('allowAllToggleSwitch', {timeout: TIMEOUTS.ONE_MIN}).click();

            // # Click "Save"
            cy.findByText('Save').scrollIntoView().click();

            // # Wait until we are at the Mattermost Teams page
            cy.findByText('Mattermost Teams', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');

            cy.apiLogout();

            cy.visit(`/signup_user_complete/?id=${testTeam.invite_id}`);

            cy.get('#input_email', {timeout: TIMEOUTS.ONE_MIN}).type(`Hossein_Is_The_Best_PROGRAMMER${getRandomId()}@BestInTheWorld.com`);

            cy.get('#input_password-input').type('Test123456!');

            cy.get('#input_name').clear().type(`HosseinIs2Cool${getRandomId()}`);

            cy.findByText('Create Account').click();

            // * Make sure account was not created successfully
            cy.findByText('The email you provided does not belong to an accepted domain. Please contact your administrator or sign up with a different email.').should('be.visible').and('exist');
        });
    });

    it('MM-T1761 - Enable Open Server - Create link appears if email account creation is false and other signin methods are true', () => {
        // # Disable sign up with email but enable LDAP
        cy.apiUpdateConfig({
            EmailSettings: {
                EnableSignUpWithEmail: false,
            },
            LdapSettings: {
                Enable: true,
            },
        }).then(() => {
            cy.apiLogout();
            cy.visit('/');

            // * Assert that create account button is visible
            cy.findByText('Don\'t have an account?', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');
        });
    });

    it('MM-T1766 - Authentication - Email - Creation with email = true', () => {
        // # Enable user account creation and set restricted domain
        cy.apiUpdateConfig({
            EmailSettings: {
                EnableSignUpWithEmail: true,
            },
            TeamSettings: {
                RestrictCreationToDomains: 'mattermost.com, test.com',
            },
        }).then(() => {
            cy.apiLogout();

            cy.visit(`/signup_user_complete/?id=${testTeam.invite_id}`);

            // * Email and Password option exist
            cy.findByText('Email address').should('exist').and('be.visible');
            cy.findByPlaceholderText('Choose a Password').should('exist').and('be.visible');
        });
    });
});
