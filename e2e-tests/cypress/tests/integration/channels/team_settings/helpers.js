// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../../../fixtures/timeouts';
import {
    getJoinEmailTemplate,
    reUrl,
    verifyEmailBody,
} from '../../../utils';

export const allowOnlyUserFromSpecificDomain = (domain) => {
    // # Open 'Team Settings' modal
    cy.uiOpenTeamMenu('Team Settings');

    // * Check that the 'Team Settings' modal was opened
    cy.get('#teamSettingsModal').should('exist').within(() => {
        // * Ensure that 'Allow any user with an account on this server' is set to 'No'
        cy.get('#open_inviteDesc').should('have.text', 'No');

        // # Click on the 'Allow only users with a specific email domain to join this team' edit button
        cy.get('#allowed_domainsEdit').should('be.visible').click();

        // # Set the allowed domain as the one received as the param and save
        cy.focused().type(domain);
        cy.findByText('Save').should('be.visible').click();

        // # Close the modal
        cy.get('#teamSettingsModalLabel').find('button').should('be.visible').click();
    });
};

export const inviteUserByEmail = (email) => {
    // # Open team menu and click 'Invite People'
    cy.uiOpenTeamMenu('Invite People');

    // # Wait half a second to ensure that the modal has been fully loaded
    cy.wait(TIMEOUTS.HALF_SEC);

    cy.findByRole('textbox', {name: 'Add or Invite People'}).
        typeWithForce(email).
        wait(TIMEOUTS.HALF_SEC).
        typeWithForce('{enter}');
    cy.findByTestId('inviteButton').click();

    // # Wait for a while to ensure that email notification is sent
    cy.wait(TIMEOUTS.TWO_SEC);
};

export const verifyEmailInviteAndVisitLink = (sender, username, email, team, siteName) => {
    // # Invite a new user
    cy.getRecentEmail({username, email}).then((data) => {
        const {body: actualEmailBody, subject} = data;

        // * Verify email subject
        expect(subject).to.contain(`[${siteName}] ${sender} invited you to join ${team.display_name} Team`);

        // * Verify email body
        const expectedEmailBody = getJoinEmailTemplate(sender, email, team);
        verifyEmailBody(expectedEmailBody, actualEmailBody);

        // # Visit permalink (e.g. click on email link)
        const permalink = actualEmailBody[3].match(reUrl)[0];
        cy.visit(permalink);

        // * Verify it redirects into the signup page
        cy.get('.signup-body', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible');
    });
};

export const signupAndVerifyTutorial = (username, password, teamDisplayName) => {
    cy.get('#name', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').type(username);
    cy.get('#password').should('be.visible').type(password);

    // # Attempt to create an account by clicking on the 'Create Account' button
    cy.get('#createAccountButton').click();

    // # Close the onboarding tutorial
    cy.uiCloseOnboardingTaskList();

    // * Check that the display name of the team the user was invited to is being correctly displayed
    cy.uiGetLHSHeader().findByText(teamDisplayName);

    // * Check that the 'Beginning of Town Square' message is visible
    cy.findByText('Beginning of Town Square').should('be.visible');

    // * Check that 'Town Square' is currently being selected
    cy.get('.active').within(() => {
        cy.get('#sidebarItem_town-square').should('exist');
    });
};
