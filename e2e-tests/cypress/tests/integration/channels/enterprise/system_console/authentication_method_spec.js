// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @system_console @mfa

import ldapUsers from '../../../../fixtures/ldap_users.json';
import * as TIMEOUTS from '../../../../fixtures/timeouts';
import {getAdminAccount} from '../../../../support/env';

const authenticator = require('authenticator');

describe('Settings', () => {
    let mfaUser;
    let samlUser;

    const ldapUser = ldapUsers['test-1'];

    before(() => {
        cy.apiInitSetup().then(({user}) => {
            mfaUser = user;

            cy.apiUpdateConfig({
                ServiceSettings: {
                    EnableMultifactorAuthentication: true,
                },
            });

            // * Check if server has license for LDAP
            cy.apiRequireLicenseForFeature('LDAP');

            return cy.apiSyncLDAPUser({ldapUser});
        }).then(() => {
            return cy.apiCreateUser();
        }).then(({user: user2}) => {
            // # Create SAML user
            samlUser = user2;
            const body = {
                from: 'email',
                auto: false,
            };
            body.matches = {};
            body.matches[user2.email] = user2.username;

            return migrateAuthToSAML(body);
        }).then(() => {
            return cy.apiGenerateMfaSecret(mfaUser.id);
        }).then((res) => {
            // # Create MFA user
            const token = authenticator.generateToken(res.code.secret);

            return cy.apiActivateUserMFA(mfaUser.id, true, token);
        });
    });

    it('MM-T953 Verify correct authentication method', () => {
        cy.visit('/admin_console/user_management/users');

        const adminUsername = getAdminAccount().username;

        // # Type sysadmin
        cy.findByPlaceholderText('Search users').clear().type(adminUsername).wait(TIMEOUTS.TWO_SEC);

        // * Verify sign-in method from user profile
        cy.get('.displayName').click();
        cy.get('.AdminUserCard__body > :nth-child(4) > span:nth-child(3)').should('have.text', 'Email');
        cy.get('a.back').click();

        // # Type saml user
        cy.findByPlaceholderText('Search users').clear().type(samlUser.username).wait(TIMEOUTS.TWO_SEC);

        // * Verify sign-in method from user profile
        cy.get('.displayName').click();
        cy.get('.AdminUserCard__body > :nth-child(4) > span:nth-child(3)').should('have.text', 'SAML');
        cy.get('a.back').click();

        // # Type ldap user
        cy.findByPlaceholderText('Search users').clear().type(ldapUser.username).wait(TIMEOUTS.TWO_SEC);

        // * Verify sign-in method from user profile
        cy.get('.displayName').click();
        cy.get('.AdminUserCard__body > :nth-child(4) > span:nth-child(3)').should('have.text', 'LDAP');
        cy.get('a.back').click();

        // # Type mfa user
        cy.findByPlaceholderText('Search users').clear().type(mfaUser.username).wait(TIMEOUTS.TWO_SEC);

        // * Verify sign-in method from user profile
        cy.get('.displayName').click();
        cy.get('.AdminUserCard__body > :nth-child(4) > span:nth-child(3)').should('contain.text', 'MFA');
        cy.get('a.back').click();
    });
});

function migrateAuthToSAML(body) {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/users/migrate_auth/saml',
        method: 'POST',
        body,
        timeout: TIMEOUTS.ONE_MIN,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
}
