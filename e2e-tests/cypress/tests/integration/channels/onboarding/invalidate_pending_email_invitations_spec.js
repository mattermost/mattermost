// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @te_only @onboarding

import * as TIMEOUTS from '../../../fixtures/timeouts';
import {getAdminAccount} from '../../../support/env';
import {getRandomId} from '../../../utils';

import {inviteUserByEmail, verifyEmailInviteAndVisitLink, signupAndVerifyTutorial} from '../team_settings/helpers';

describe('Onboarding', () => {
    const sysadmin = getAdminAccount();
    const usernameOne = `user${getRandomId()}`;
    const usernameTwo = `user${getRandomId()}`;
    const usernameThree = `user${getRandomId()}`;
    const emailOne = `${usernameOne}@sample.mattermost.com`;
    const emailTwo = `${usernameTwo}@sample.mattermost.com`;
    const emailThree = `${usernameThree}@sample.mattermost.com`;
    const password = 'passwd';

    let testTeam;
    let siteName;

    before(() => {
        cy.shouldRunOnTeamEdition();

        // # Disable LDAP, enable onboarding and do email test if setup properly
        cy.apiUpdateConfig({
            LdapSettings: {Enable: false},
            ServiceSettings: {EnableOnboardingFlow: true},
        }).then(({config}) => {
            siteName = config.TeamSettings.SiteName;
        });
        cy.shouldHaveEmailEnabled();

        cy.apiInitSetup().then(({team}) => {
            testTeam = team;
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T399 Invalidate Pending Email Invitations', () => {
        // # As sysadmin, invite the first user and logout
        inviteUserByEmail(emailOne);
        cy.apiLogout();

        // # Get the email sent to the first user, verify the email and go to the provided link
        verifyEmailInviteAndVisitLink(sysadmin.username, usernameOne, emailOne, testTeam, siteName);

        // # Signup as as the first user and verify that signup was successful
        signupAndVerifyTutorial(usernameOne, password, testTeam.display_name);

        // # Logout from the current user and login as sysadmin
        cy.apiLogout();
        cy.apiAdminLogin();
        cy.reload();

        // # Open the 'Invite People' modal
        cy.uiOpenTeamMenu('Invite People');

        // # Wait half a second to ensure that the modal has been fully loaded
        cy.wait(TIMEOUTS.HALF_SEC);

        // # Invite two more users and close the modal
        inviteNewUser(emailTwo);
        cy.findByTestId('invite-more').click();
        inviteNewUser(emailThree);
        cy.findByText('Done').should('be.visible').click();

        // # Go to system console and invalidate the last two email invites
        cy.uiOpenProductMenu('System Console');
        cy.findByText('Signup').scrollIntoView().should('be.visible').click();
        cy.get('#InvalidateEmailInvitesButton').should('be.visible').within(() => {
            cy.findByText('Invalidate pending email invites').should('be.visible').click();
        });

        // # Logout from sysadmin account
        cy.apiLogout();

        // # Get the email sent to the second user, verify the email and go to the provided link
        verifyEmailInviteAndVisitLink(sysadmin.username, usernameTwo, emailTwo, testTeam, siteName);

        // # Type username and password
        cy.get('#name').should('be.visible').type(usernameTwo);
        cy.get('#password').should('be.visible').type(password);

        // # Attempt to create an account by clicking on the 'Create Account' button
        cy.get('#createAccountButton').click();

        // * Ensure that since the invite was invalidated, the correct error message should be shown
        cy.get('#existingEmailErrorContainer').should('exist').and('have.text', 'The signup link does not appear to be valid.');
    });

    function inviteNewUser(email) {
        cy.findByRole('textbox', {name: 'Add or Invite People'}).
            typeWithForce(email).wait(TIMEOUTS.HALF_SEC).
            typeWithForce('{enter}');
        cy.findByTestId('inviteButton').click();
    }
});
