// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @signin_authentication

import timeouts from '../../../fixtures/timeouts';

import {fillCredentialsForUser} from './helpers';

describe('Authentication', () => {
    let testTeam;
    let testTeam2;
    let testUser;
    let testUser2;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });

        cy.apiCreateUser().then(({user: user2}) => {
            testUser2 = user2;
            cy.apiAddUserToTeam(testTeam.id, testUser2.id);
        });

        cy.apiCreateTeam().then(({team}) => {
            testTeam2 = team;
            cy.apiAddUserToTeam(testTeam2.id, testUser.id);
            cy.apiAddUserToTeam(testTeam2.id, testUser2.id);
        });
    });

    beforeEach(() => {
        cy.apiLogout();
    });

    it('MM-T406 Sign In Forgot password - Email address not on server (but valid) Focus in login field on login page', () => {
        // # On a server with site URL and email settings configured (such as rc.test.mattermost.com):
        // # Go to the login page where you enter username & password
        cy.visit('/login').wait(timeouts.FIVE_SEC);

        // # Verify focus is in first login field
        cy.focused().should('have.id', 'input_loginId');

        // # Click "I forgot my password"
        cy.findByText('Forgot your password?').should('be.visible').click();
        cy.url().should('contain', '/reset_password');

        // # Enter an email that doesn't have an account on the server (but that you CAN receive email at)
        cy.get('#passwordResetEmailInput').type('test@test.com');

        cy.findByText('Reset my password').should('be.visible').click();

        // * User redirected to a page with message
        // "If the account exists, a password reset email will be sent to: [email address]. Please check your inbox."
        cy.get('#passwordResetEmailSent').should('be.visible').within(() => {
            cy.get('span').first().should('have.text', 'If the account exists, a password reset email will be sent to:');
            cy.get('div b').first().should('have.text', 'test@test.com');
            cy.get('span').last().should('have.text', 'Please check your inbox.');
        });

        // * Verify reset email is not sent.
        cy.getRecentEmail(testUser).then(({subject}) => {
            // Last email should be something else for the test user.
            expect(subject).not.contain('Reset your password');
        });
    });

    it('MM-T409 Logging out clears currently logged in user from the store', () => {
        // # Login as user A and switch to a different team and channel
        cy.visit('/login');
        fillCredentialsForUser(testUser);

        cy.visit(`/${testTeam.name}/channels/off-topic`).wait(timeouts.ONE_SEC);

        // # Logout
        cy.uiLogout();

        // # Login as user B and switch to a different team and channel
        cy.visit('/login');
        fillCredentialsForUser(testUser2);

        cy.visit(`/${testTeam2.name}/channels/town-square`).wait(timeouts.ONE_SEC);

        // # Logout
        cy.uiLogout();

        // # Login as user A again, observe you're viewing the team/channel you switched to in step 1
        cy.visit('/login');
        fillCredentialsForUser(testUser);

        cy.url().should('include', `/${testTeam.name}/channels/off-topic`);

        // # Logout
        cy.uiLogout();

        // # Login as user B again, observe you're viewing the team/channel you switched to in step 2
        cy.visit('/login');
        fillCredentialsForUser(testUser2);

        cy.url().should('include', `/${testTeam2.name}/channels/town-square`);
    });
});
