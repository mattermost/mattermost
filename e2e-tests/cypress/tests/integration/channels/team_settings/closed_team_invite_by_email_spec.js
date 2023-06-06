// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @team_settings

import {getAdminAccount} from '../../../support/env';
import * as TIMEOUTS from '../../../fixtures/timeouts';
import {
    getJoinEmailTemplate,
    getRandomId,
    reUrl,
    verifyEmailBody,
} from '../../../utils';

describe('Team Settings', () => {
    const sysadmin = getAdminAccount();
    const randomId = getRandomId();
    const username = `user${randomId}`;
    const email = `user${randomId}@sample.mattermost.com`;
    const password = 'passwd';

    let testTeam;
    let siteName;
    let isLicensed;

    before(() => {
        cy.apiGetClientLicense().then((data) => {
            ({isLicensed} = data);
        });

        // # Disable LDAP and do email test if setup properly
        cy.apiUpdateConfig({
            LdapSettings: {Enable: false},
            ServiceSettings: {EnableOnboardingFlow: true},
            TeamSettings: {
                EnableOpenServer: false,
            },
        }).then(({config}) => {
            siteName = config.TeamSettings.SiteName;
        });
        cy.shouldHaveEmailEnabled();

        cy.apiInitSetup().then(({team}) => {
            testTeam = team;
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T385 Invite new user to closed team using email invite', () => {
        // # Open 'Team Settings' modal
        cy.uiOpenTeamMenu('Team Settings');

        // * Check that the 'Team Settings' modal was opened
        cy.get('#teamSettingsModal').should('exist').within(() => {
            cy.get('#open_inviteDesc').should('have.text', 'No');

            // # Click on the 'Allow only users with a specific email domain to join this team' edit button
            cy.get('#allowed_domainsEdit').should('be.visible').click();

            // * Verify that the '#allowedDomains' input field is empty
            cy.get('#allowedDomains').should('be.empty');

            // # Close the modal
            cy.get('#teamSettingsModalLabel').find('button').should('be.visible').click();
        });

        // # Open the 'Invite People' full screen modal
        cy.uiOpenTeamMenu('Invite People');

        // # Wait half a second to ensure that the modal has been fully loaded
        cy.wait(TIMEOUTS.HALF_SEC);

        if (isLicensed) {
            // # Click invite members if needed
            cy.get('.InviteAs').findByTestId('inviteMembersLink').click();
        }

        cy.findByRole('textbox', {name: 'Add or Invite People'}).type(email, {force: true}).wait(TIMEOUTS.HALF_SEC).type('{enter}', {force: true});
        cy.get('#inviteMembersButton').click();

        // # Wait for a while to ensure that email notification is sent and logout from sysadmin account
        cy.wait(TIMEOUTS.FIVE_SEC);
        cy.apiLogout();

        // # Invite a new user (with the email declared in the parent scope)
        cy.getRecentEmail({username, email}).then((data) => {
            const {body: actualEmailBody, subject} = data;

            // * Verify email subject
            expect(subject).to.contain(`[${siteName}] ${sysadmin.username} invited you to join ${testTeam.display_name} Team`);

            // * Verify email body
            const expectedEmailBody = getJoinEmailTemplate(sysadmin.username, email, testTeam);
            verifyEmailBody(expectedEmailBody, actualEmailBody);

            // # Visit permalink (e.g. click on email link)
            const permalink = actualEmailBody[3].match(reUrl)[0];
            cy.visit(permalink);
        });

        // # Type username and password
        cy.wait(TIMEOUTS.HALF_SEC);
        cy.get('#input_name').type(username);
        cy.wait(TIMEOUTS.HALF_SEC);
        cy.get('#input_password-input').type(password);

        // # Attempt to create an account by clicking on the 'Create Account' button
        cy.findByText('Create Account').click();

        // # Close the onboarding tutorial
        cy.uiCloseOnboardingTaskList();

        // * Check that the display name of the team the user was invited to is being correctly displayed
        cy.uiGetLHSHeader().findByText(testTeam.display_name);

        // * Check that the 'Beginning of Town Square' message is visible
        cy.findByText('Beginning of Town Square').should('be.visible');
    });
});
