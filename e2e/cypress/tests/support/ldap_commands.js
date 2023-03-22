// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../fixtures/timeouts';

import {getAdminAccount} from './env';

Cypress.Commands.add('visitLDAPSettings', () => {
    // # Go to LDAP settings Page
    cy.visit('/admin_console/authentication/ldap');
    cy.get('.admin-console__header').should('be.visible').and('have.text', 'AD/LDAP');
});

Cypress.Commands.add('doLDAPLogin', (settings = {}, useEmail = false) => {
    // # Go to login page
    cy.apiLogout();
    cy.visit('/login');
    cy.wait(TIMEOUTS.FIVE_SEC);
    cy.checkLoginPage(settings);
    cy.performLDAPLogin(settings, useEmail);
});

Cypress.Commands.add('performLDAPLogin', (settings = {}, useEmail = false) => {
    const loginId = useEmail ? settings.user.email : settings.user.username;
    cy.get('#input_loginId').type(loginId);
    cy.get('#input_password-input').type(settings.user.password);

    //click the login button
    cy.get('#saveSetting').should('not.be.disabled').click();
});

Cypress.Commands.add('doLDAPLogout', (settings = {}) => {
    cy.checkLeftSideBar(settings);

    // # Logout then check login page
    cy.uiLogout();
    cy.checkLoginPage(settings);
});

Cypress.Commands.add('doSkipTutorial', () => {
    cy.wait(TIMEOUTS.FIVE_SEC);
    cy.get('body').then((body) => {
        if (body.find('#tutorialSkipLink').length > 0) {
            cy.get('#tutorialSkipLink').click().wait(TIMEOUTS.HALF_SEC);
        }
    });
});

Cypress.Commands.add('runLdapSync', (admin) => {
    cy.externalRequest({user: admin, method: 'post', path: 'ldap/sync'}).then(() => {
        cy.waitForLdapSyncCompletion(Date.now(), TIMEOUTS.THREE_MIN).then(() => {
            return cy.wrap(true);
        });
    });
});

Cypress.Commands.add('getLdapSyncJobStatus', (start) => {
    const admin = getAdminAccount();
    cy.externalRequest({user: admin, method: 'get', path: 'jobs/type/ldap_sync'}).then((result) => {
        const jobs = result.data;
        if (jobs && jobs[0]) {
            if (Math.abs(jobs[0].create_at - start) < TIMEOUTS.TWO_SEC) {
                switch (jobs[0].status) {
                case 'success':
                    return cy.wrap('success');
                case 'pending':
                case 'in_progress':
                    return cy.wrap('pending');
                default:
                    return cy.wrap('unsuccessful');
                }
            }
        }
        return cy.wrap('not found');
    });
});

Cypress.Commands.add('waitForLdapSyncCompletion', (start, timeout) => {
    if (Date.now() - start > timeout) {
        throw new Error('Timeout Waiting for LdapSync');
    }

    cy.getLdapSyncJobStatus(start).then((status) => {
        if (status === 'success') {
            return;
        }
        if (status === 'unsuccessful') {
            throw new Error('LdapSync Unsuccessful');
        }

        // eslint-disable-next-line cypress/no-unnecessary-waiting
        cy.wait(TIMEOUTS.FIVE_SEC);
        cy.waitForLdapSyncCompletion(start, timeout);
    });
});
