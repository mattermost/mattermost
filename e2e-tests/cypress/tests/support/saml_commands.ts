// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// <reference path="../support/index.d.ts" />

import {AdminConfig} from '@mattermost/types/config';
import * as TIMEOUTS from '../fixtures/timeouts';
import {ChainableT} from '../types';
import {stubClipboard} from '../utils';

/**
 * checkCreateTeamPage checks that the create team page is loaded
 * @param {Object} settings - Settings object
 */
function checkCreateTeamPage(settings) {
    if (settings.user.userType === 'Guest' || settings.user.isGuest) {
        cy.findByText('Create a team').scrollIntoView().should('not.exist');
    } else {
        cy.findByText('Create a team').scrollIntoView().should('be.visible');
    }
}
Cypress.Commands.add('checkCreateTeamPage', checkCreateTeamPage);

/**
 * doSamlLogin logs into the system using SAML
 * @param {Object} settings - Settings object
 */
function doSamlLogin(settings) {
    // # Go to login page
    cy.apiLogout();
    cy.visit('/login');
    cy.checkLoginPage(settings);

    //click the login button
    cy.findByText(settings.loginButtonText).should('be.visible').click().wait(TIMEOUTS.ONE_SEC);
}
Cypress.Commands.add('doSamlLogin', doSamlLogin);

/**
 * doSamlLogout logs out of the system and checks that the login page is loaded
 * @param {Object} settings - Settings object
 */
function doSamlLogout(settings) {
    cy.checkLeftSideBar(settings);

    // # Logout then check login page
    cy.uiLogout();
    cy.checkLoginPage(settings);
}
Cypress.Commands.add('doSamlLogout', doSamlLogout);

/**
 * getInvitePeopleLink gets the invite people link from the invite people modal
 * @param {Object} settings - Settings object
 * @returns {String} - The invite people link
 */
function getInvitePeopleLink(settings): ChainableT<any> {
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
    return cy.wrap(null);
}
Cypress.Commands.add('getInvitePeopleLink', getInvitePeopleLink);

/**
 * setTestSettings sets the test settings
 * @param {string} loginButtonText - The text of the login button
 * @param {Object} config - The config object
 * @returns {Object} - The test settings
 */
function setTestSettings(loginButtonText: string, config: AdminConfig): any {
    return {
        loginButtonText,
        siteName: config.TeamSettings.SiteName,
        siteUrl: config.ServiceSettings.SiteURL,
        teamName: '',
        user: null,
    };
}
Cypress.Commands.add('setTestSettings', setTestSettings);

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            checkCreateTeamPage: typeof checkCreateTeamPage;
            doSamlLogin: typeof doSamlLogin;
            doSamlLogout: typeof doSamlLogout;
            getInvitePeopleLink: typeof getInvitePeopleLink;
            setTestSettings: typeof setTestSettings;
        }
    }
}
