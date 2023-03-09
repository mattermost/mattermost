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
import {generateRandomUser} from '../../support/api/user';
import {
    getWelcomeEmailTemplate,
    reUrl,
    verifyEmailBody,
    stubClipboard,
} from '../../utils';

describe('Onboarding', () => {
    let testTeam;
    let siteName;

    before(() => {
        // # Do email test if setup properly
        cy.shouldHaveEmailEnabled();

        // # Update config to require email verification and onboarding flow
        cy.apiUpdateConfig({
            ServiceSettings: {EnableOnboardingFlow: true},
            EmailSettings: {
                RequireEmailVerification: true,
            },
        }).then(({config}) => {
            siteName = config.TeamSettings.SiteName;
        });

        cy.apiInitSetup().then(({team}) => {
            testTeam = team;
            cy.visit(`/${team.name}`);
        });
    });

    it('MM-T398 Use team invite link to sign up using email and password', () => {
        stubClipboard().as('clipboard');

        // # Open the 'Invite People' full screen modal and get the invite url
        cy.uiOpenTeamMenu('Invite People');

        // # Copy invite link to clipboard
        cy.findByTestId('InviteView__copyInviteLink').click();

        cy.get('@clipboard').its('contents').then((val) => {
            const inviteLink = val;

            // # Logout from admin account and visit the invite url
            cy.apiLogout();
            cy.visit(inviteLink);
        });

        // * Verify it's on email signup page
        cy.findByText('Email address').should('be.visible');
        cy.findByPlaceholderText('Choose a Password').should('be.visible');

        // # Type email, username and password
        const user = generateRandomUser();
        const {username, email, password} = user;
        cy.get('#input_email', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').type(email);
        cy.get('#input_name').should('be.visible').type(username);
        cy.get('#input_password-input').should('be.visible').type(password);

        // # Attempt to create an account by clicking on the 'Create Account' button
        cy.findByText('Create Account').click();

        cy.wait(TIMEOUTS.HALF_SEC);

        // * Check that 'Mattermost: You are almost done' text should be visible when email hasn't been verified yet
        cy.findByText('You’re almost done!').should('be.visible');

        cy.getRecentEmail(user).then((data) => {
            const {body: expectedBody} = data;
            const expectedEmailBody = getWelcomeEmailTemplate(user.email, siteName, testTeam.name);

            // * Verify email body
            verifyEmailBody(expectedEmailBody, expectedBody);

            const permalink = expectedBody[4].match(reUrl)[0];

            // * Check that URL in address bar does not have an `undefined` team name appended
            cy.url().should('not.include', 'undefined');

            // # Visit permalink (e.g. click on email link)
            cy.visit(permalink);

            // # Check that 'Email Verified' text should be visible, email is pre-filled, and password field is focused, then login
            cy.findByText('Email Verified', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible');
            cy.get('#input_loginId').should('have.value', email);
            cy.get('#input_password-input').should('be.visible').type(password);
            cy.get('#saveSetting').click();
            cy.findByText('The email/username or password is invalid.').should('not.exist');
        });

        // # Close the onboarding tutorial
        cy.uiCloseOnboardingTaskList();

        // * Check that the display name of the team the user successfully joined is correct
        cy.uiGetLHSHeader().findByText(testTeam.display_name);

        // * Check that 'Town Square' is currently being selected
        cy.get('.active').within(() => {
            cy.findByText('Town Square').should('exist');
        });

        // * Check that the 'Beginning of Town Square' message is visible
        cy.findByText('Beginning of Town Square').should('be.visible').wait(TIMEOUTS.ONE_SEC);
    });
});
