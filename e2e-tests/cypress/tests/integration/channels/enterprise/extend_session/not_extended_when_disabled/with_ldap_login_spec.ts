// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @enterprise @not_cloud @extend_session @ldap

import {UserProfile} from '@mattermost/types/users';
import ldapUsers from '../../../../../fixtures/ldap_users.json';

import {verifyExtendedSession, verifyNotExtendedSession} from './helpers';

describe('Extended Session Length', () => {
    const sessionLengthInHours = 1;
    const setting = {
        ServiceSettings: {
            SessionLengthWebInHours: sessionLengthInHours,
            ExtendSessionLengthWithActivity: false,
        },
    };
    let testLdapUser: UserProfile;
    let offTopicUrl: string;

    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.apiRequireLicense();

        // * Server database should match with the DB client and config at "cypress.json"
        cy.apiRequireServerDBToMatch();

        const ldapUser = ldapUsers['test-1'];
        cy.apiSyncLDAPUser({ldapUser}).then((user) => {
            testLdapUser = user;
        });

        cy.apiInitSetup().then(({team, offTopicUrl: url}) => {
            offTopicUrl = url;
            cy.apiAddUserToTeam(team.id, testLdapUser.id);
        });
    });

    beforeEach(() => {
        cy.apiAdminLogin();
        cy.apiRevokeUserSessions(testLdapUser.id);
    });

    it('MM-T4046_1 LDAP user session should have extended due to user activity when enabled', () => {
        // # Enable ExtendSessionLengthWithActivity
        setting.ServiceSettings.ExtendSessionLengthWithActivity = true;
        cy.apiUpdateConfig(setting);

        cy.apiLogin(testLdapUser);
        verifyExtendedSession(testLdapUser, sessionLengthInHours, offTopicUrl);
    });

    it('MM-T4046_2 LDAP user session should not extend even with user activity when disabled', () => {
        // # Disable ExtendSessionLengthWithActivity
        setting.ServiceSettings.ExtendSessionLengthWithActivity = false;
        cy.apiUpdateConfig(setting);

        cy.apiLogin(testLdapUser);
        verifyNotExtendedSession(testLdapUser, offTopicUrl);
    });
});
