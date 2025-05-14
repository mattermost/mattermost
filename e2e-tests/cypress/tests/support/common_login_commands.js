// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../fixtures/timeouts';

Cypress.Commands.add('checkLoginPage', (settings = {}) => {
    // # Remove autofocus from login input
    cy.get('.login-body-card-title').click();

    // * Check elements in the body
    cy.get('#input_loginId', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and(($loginTextbox) => {
        const placeholder = $loginTextbox[0].placeholder;
        expect(placeholder).to.match(/Email/);
        expect(placeholder).to.match(/Username/);
    }).focus();

    cy.get('#input_password-input').should('be.visible').and('have.attr', 'placeholder', 'Password');
    cy.get('#saveSetting').should('be.visible');

    // * Check the title
    cy.title().should('include', settings.siteName);
});

Cypress.Commands.add('checkLoginFailed', () => {
    // * Check the alert banner
    cy.get('.AlertBanner.danger', {timeout: TIMEOUTS.ONE_MIN}).then(() => {
        // * Check the login input in error
        cy.get('.login-body-card-form-input .Input_fieldset').should('have.class', 'Input_fieldset___error');

        // * Check the password input in error
        cy.get('.login-body-card-form-password-input.Input_fieldset').should('have.class', 'Input_fieldset___error');

        // * Check the Log in button enabled
        cy.get('#saveSetting').should('not.be.disabled');
    });
});

Cypress.Commands.add('checkGuestNoChannels', () => {
    cy.findByText('Your guest account has no channels assigned. Please contact an administrator.').should('be.visible');
});

Cypress.Commands.add('checkMemberNoChannels', () => {
    cy.findByText('No teams are available to join. Please create a new team or ask your administrator for an invite.').should('be.visible');
});

Cypress.Commands.add('checkLeftSideBar', (settings = {}) => {
    if (settings.teamName != null && settings.teamName.length > 0) {
        cy.uiGetLHSHeader().should('contain', settings.teamName);
    }

    if (settings.user.username.length > 0) {
        // * Verify username info
        cy.uiOpenUserMenu().findByText(`@${settings.user.username}`);

        // # Close status menu
        cy.get('body').type('{esc}');
    }

    if (settings.user.userType === 'Admin' || settings.user.isAdmin) {
        // # Check that user is an admin
        cy.uiOpenProductMenu().findByText('System Console');
    } else {
        // # Check that user is not an admin
        cy.uiOpenProductMenu().findByText('System Console').should('not.exist');
    }

    // # Close product switch menu
    cy.uiGetProductMenuButton().click();

    cy.get('#channel_view').should('be.visible');
});

Cypress.Commands.add('checkInvitePeoplePage', (settings = {}) => {
    cy.findByText('Copy invite link', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');
    if (settings.teamName != null && settings.teamName.length > 0) {
        const inviteRegexp = new RegExp(`Invite .* to ${settings.teamName}`);
        cy.findByText(inviteRegexp).should('be.visible');
    }
});

Cypress.Commands.add('checkInvitePeopleAdminPage', (settings = {}) => {
    cy.findByText('Members', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');
    cy.findByText('Guests').should('be.visible');
    if (settings.teamName != null && settings.teamName.length > 0) {
        cy.findByText('Invite people to ' + settings.teamName).should('be.visible');
    }
});

Cypress.Commands.add('doLogoutFromSignUp', () => {
    cy.checkGuestNoChannels();
    cy.findByText('Logout').should('be.visible').click();
});

Cypress.Commands.add('doMemberLogoutFromSignUp', () => {
    cy.checkMemberNoChannels();
    cy.findByText('Logout').should('be.visible').click();
});

Cypress.Commands.add('skipOrCreateTeam', (settings, userId) => {
    cy.wait(TIMEOUTS.FIVE_SEC);
    return cy.get('body').then((body) => {
        let teamName = '';

        // # Create a team if a user is not member of any team
        if (body.text().includes('Create a team')) {
            teamName = 't' + userId.substring(0, 14);

            cy.checkCreateTeamPage(settings);

            cy.get('#createNewTeamLink').scrollIntoView().should('be.visible').click();
            cy.get('#teamNameInput').should('be.visible').typeWithForce(teamName);
            cy.findByText('Next').should('be.visible').click();
            cy.findByText('Finish').should('be.visible').click();
        }

        return cy.wrap(teamName);
    });
});

Cypress.Commands.add('checkForLDAPError', () => {
    cy.wait(TIMEOUTS.FIVE_SEC);
    return cy.get('body').then((body) => {
        if (body.text().includes('User not registered on AD/LDAP server.')) {
            cy.findByText('Back to Mattermost').should('exist').and('be.visible').click().wait(TIMEOUTS.FIVE_SEC);
            return cy.wrap(true);
        }
        return cy.wrap(false);
    });
});
