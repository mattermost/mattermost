// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @onboarding

import * as TIMEOUTS from '../../fixtures/timeouts';
import {getRandomId} from '../../utils';

const uniqueUserId = getRandomId();

function signupWithEmail(name, pw) {
    // # Go to /login
    cy.visit('/login');

    // # Click on sign up button
    cy.findByText('Don\'t have an account?', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').click();

    // # Type email address (by adding the uniqueUserId in the email address)
    cy.get('#input_email').type('unique.' + uniqueUserId + '@sample.mattermost.com');

    // # Type 'unique-1' for username
    cy.get('#input_name').type(name);

    // # Type 'unique1pw' for password
    cy.get('#input_password-input').type(pw);

    // # Click on Create Account button
    cy.findByText('Create Account').click();
}

describe('Cloud Onboarding', () => {
    before(() => {
        // # Disable other auth options
        const newSettings = {
            Office365Settings: {Enable: false},
            LdapSettings: {Enable: false},
        };
        cy.apiUpdateConfig(newSettings);
        cy.apiLogout();
    });

    it('MM-T403 Email address already exists', () => {
        // # Signup a new user with an email address and user generated in signupWithEmail
        signupWithEmail('unique.' + uniqueUserId, 'unique1pw');

        // * Verify there is Logout Button
        cy.contains('Logout').should('be.visible');

        // * Verify 'Teams you can join' is visible
        cy.get('#teamsYouCanJoinContent').should('be.visible');

        // * Verify the link to create a new team is available
        cy.get('#createNewTeamLink').should('have.attr', 'href', '/create_team').and('be.visible', 'contain', 'Create a team');

        // # Logout and signup another user with the same email but different username and password
        cy.apiLogout();
        signupWithEmail('unique-2', 'unique2pw');

        // * Error message displays below the Create Account button that says "An account with that email already exists"
        cy.findByText('An account with that email already exists.').should('be.visible');
    });
});
