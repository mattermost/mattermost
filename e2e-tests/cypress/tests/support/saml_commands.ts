// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AdminConfig} from '@mattermost/types/config';
import * as TIMEOUTS from '../fixtures/timeouts';
import {ChainableT} from '../types';
import {stubClipboard} from '../utils';

// SAMLUser interface is based on cypress/tests/fixtures/saml_users.json
interface SAMLUser {
    username: string;
    password: string;
    email: string;
    firstname: string;
    lastname: string;
    userType: string;
    isGuest?: boolean;
}

interface TestSettings {
    loginButtonText: string;
    siteName: string;
    siteUrl: string;
    teamName: string;
    user: SAMLUser | null;
}

/**
 * checkCreateTeamPage checks that the "create a team" element is visible in the page if user is not a Guest.
 * Otherwise it should not exist.
 * @param {TestSettings} settings - Settings object
 */
function checkCreateTeamPage(settings: TestSettings) {
    if (settings.user.userType === 'Guest' || settings.user.isGuest) {
        cy.findByText('Create a team').scrollIntoView().should('not.exist');
    } else {
        cy.findByText('Create a team').scrollIntoView().should('be.visible');
    }
}

Cypress.Commands.add('checkCreateTeamPage', checkCreateTeamPage);

/**
 * doSamlLogin check that the login page is loaded with the correct settings (siteName) and logs in using SAML.
 * @param {TestSettings} settings - Settings object to perform SAML tests.
 */
function doSamlLogin(settings) {
    // # Go to login page
    cy.apiLogout();
    cy.visit('/login');
    cy.checkLoginPage(settings);

    //click the login button
    return cy.findByText(settings.loginButtonText).should('be.visible').click().wait(TIMEOUTS.ONE_SEC);
}

Cypress.Commands.add('doSamlLogin', doSamlLogin);

/**
 * doSamlLogout logs out and checks that it reloads the login page with the correct settings (siteName).
 * @param {TestSettings} settings - Settings object to perform SAML tests.
 */
function doSamlLogout(settings) {
    cy.checkLeftSideBar(settings);

    // # Logout then check login page
    cy.uiLogout();
    return cy.checkLoginPage(settings);
}

Cypress.Commands.add('doSamlLogout', doSamlLogout);

/**
 * getInvitePeopleLink gets the invite people link from the invite people modal
 * @param {TestSettings} settings - Settings object to perform SAML tests.
 * @returns {ChainableT<any>} - the invite people link wrapped in a cypress chainable
 */
function getInvitePeopleLink(settings: TestSettings): ChainableT<any> {
    cy.checkLeftSideBar(settings);

    // # Open team menu and click 'Invite People'
    cy.uiOpenTeamMenu('Invite People');

    stubClipboard().as('clipboard');
    cy.checkInvitePeoplePage();
    cy.findByTestId('InviteView__copyInviteLink').click();
    return cy.get('@clipboard').its('contents').then((text) => {
        // # Close Invite People modal
        cy.uiClose();
        return cy.wrap(text);
    });
}

Cypress.Commands.add('getInvitePeopleLink', getInvitePeopleLink);

/**
 * setTestSettings sets the test settings object based on the AdminConfig
 * @param {string} loginButtonText - The text of the login button
 * @param {AdminConfig} config - The config object
 * @returns {TestSettings} - The settings to use for SAML tests
 */
function setTestSettings(loginButtonText: string, config: AdminConfig): ChainableT<TestSettings> {
    return cy.wrap({
        loginButtonText,
        siteName: config.TeamSettings.SiteName,
        siteUrl: config.ServiceSettings.SiteURL,
        teamName: '',
        user: null,
    });
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
