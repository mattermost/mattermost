// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// *****************************************************************************
// LDAP
// https://api.mattermost.com/#tag/LDAP
// *****************************************************************************

Cypress.Commands.add('apiLDAPSync', () => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/ldap/sync',
        method: 'POST',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
});

Cypress.Commands.add('apiLDAPTest', () => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/ldap/test',
        method: 'POST',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
});

Cypress.Commands.add('apiSyncLDAPUser', ({
    ldapUser = {},
    bypassTutorial = true,
}) => {
    // # Test LDAP connection and synchronize user
    cy.apiLDAPTest();
    cy.apiLDAPSync();

    // # Login to sync LDAP user
    return cy.apiLogin(ldapUser).then(({user}) => {
        if (bypassTutorial) {
            cy.apiAdminLogin();
        }
        if (bypassTutorial) {
            cy.apiSaveTutorialStep(user.id, '999');
        }

        return cy.wrap(user);
    });
});
