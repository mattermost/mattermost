// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../fixtures/timeouts';
import {stubClipboard} from '../utils';

Cypress.Commands.add('checkCreateTeamPage', (settings = {}) => {
    if (settings.user.userType === 'Guest' || settings.user.isGuest) {
        cy.findByText('Create a team').scrollIntoView().should('not.exist');
    } else {
        cy.findByText('Create a team').scrollIntoView().should('be.visible');
    }
});

Cypress.Commands.add('doSamlLogin', (settings = {}) => {
    // # Go to login page
    cy.apiLogout();
    cy.visit('/login');
    cy.checkLoginPage(settings);

    //click the login button
    cy.findByText(settings.loginButtonText).should('be.visible').click().wait(TIMEOUTS.ONE_SEC);
});

Cypress.Commands.add('doSamlLogout', (settings = {}) => {
    cy.checkLeftSideBar(settings);

    // # Logout then check login page
    cy.uiLogout();
    cy.checkLoginPage(settings);
});

Cypress.Commands.add('getInvitePeopleLink', (settings = {}) => {
    cy.checkLeftSideBar(settings);

    // # Open team menu and click 'Invite People'
    cy.uiOpenTeamMenu('Invite People');

    stubClipboard().as('clipboard');
    cy.checkInvitePeoplePage();
    cy.findByTestId('InviteView__copyInviteLink').click();
    cy.get('@clipboard').its('contents').then((text) => {
        // # Close Invite People modal
        cy.uiClose();
        return cy.wrap(text);
    });
});

Cypress.Commands.add('setTestSettings', (loginButtonText, config) => {
    return {
        loginButtonText,
        siteName: config.TeamSettings.SiteName,
        siteUrl: config.ServiceSettings.SiteURL,
        teamName: '',
        user: null,
    };
});
