// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @te_only @team_settings

import {getAdminAccount} from '../../support/env';
import {generateRandomUser} from '../../support/api/user';

import {allowOnlyUserFromSpecificDomain, inviteUserByEmail, verifyEmailInviteAndVisitLink, signupAndVerifyTutorial} from './helpers';

describe('Team Settings', () => {
    const sysadmin = getAdminAccount();
    const {username, password} = generateRandomUser();
    const email = `${username}@gmail.com`;
    const emailDomain = 'gmail.com';

    let testTeam;
    let siteName;

    before(() => {
        cy.shouldRunOnTeamEdition();

        cy.apiUpdateConfig({
            LdapSettings: {Enable: false},
            ServiceSettings: {EnableOnboardingFlow: true},
        }).then(({config}) => {
            siteName = config.TeamSettings.SiteName;
        });

        // # Do email test if setup properly
        cy.shouldHaveEmailEnabled();

        cy.apiInitSetup().then(({team}) => {
            testTeam = team;
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T389 Invite new user to closed team with \'Allow only users with a specific email domain to join this team\' set to an email that is NOT \'sample.mattermost.com\'', () => {
        // # Allow only users from 'gmail.com' domain
        allowOnlyUserFromSpecificDomain(emailDomain);

        // # Invite a new user (with the email declared in the parent scope)
        inviteUserByEmail(email);

        // # Logout from sysadmin account
        cy.apiLogout();

        // # Verify that the invite email is correct, and visit the link provided in the email
        verifyEmailInviteAndVisitLink(sysadmin.username, username, email, testTeam, siteName);

        // # Signup and verify the initial tutorial
        signupAndVerifyTutorial(username, password, testTeam.display_name);
    });
});
