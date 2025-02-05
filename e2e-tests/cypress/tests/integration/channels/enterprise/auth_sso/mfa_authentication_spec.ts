// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @enterprise @system_console @authentication @mfa

import {UserProfile} from '@mattermost/types/users';
import * as authenticator from 'authenticator';
import * as TIMEOUTS from '../../../../fixtures/timeouts';

describe('Authentication', () => {
    let mfaSysAdmin: UserProfile;
    let testUser: UserProfile;
    let adminMFASecret: string;

    before(() => {
        cy.apiRequireLicenseForFeature('MFA');

        // # Do email test if setup properly
        cy.shouldHaveEmailEnabled();

        cy.apiInitSetup().then(({user}) => {
            testUser = user;
        });

        // # Create and login a newly created user as sysadmin
        cy.apiCreateCustomAdmin().then(({sysadmin}) => {
            mfaSysAdmin = sysadmin;
        });
    });

    it('MM-T1778 - MFA - Enforced', () => {
        // # Log in as a admin.
        cy.apiLogin(mfaSysAdmin);

        // # Navigate to System Console -> Authentication -> MFA Page.
        cy.visit('/admin_console/authentication/mfa');
        cy.findByText('Multi-factor Authentication', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('exist');

        // # Ensure the setting 'Enable Multi factor authentication' is set to true in the MFA page.
        cy.findByTestId('ServiceSettings.EnableMultifactorAuthenticationtrue').check();

        // # Also ensure that this MFA setting is enforced.
        cy.findByTestId('ServiceSettings.EnforceMultifactorAuthenticationtrue').check();

        // # Click "Save".
        cy.findByText('Save').click().wait(TIMEOUTS.ONE_SEC);

        // # Get MFA secret
        cy.uiGetMFASecret(mfaSysAdmin.id).then((secret) => {
            adminMFASecret = secret;

            // # Navigate to System Console -> User Management -> Users
            cy.visit('/admin_console/user_management/users');
            cy.findByPlaceholderText('Search users').type(testUser.username).wait(TIMEOUTS.HALF_SEC);

            // * Remove MFA option not available for the user
            cy.get('#systemUsersTable-cell-0_actionsColumn').click().wait(TIMEOUTS.HALF_SEC);
            cy.findByText('Remove MFA').should('not.exist');

            cy.apiLogout();
        });

        // # Login as test user
        cy.uiLogin(testUser);
        cy.wait(TIMEOUTS.THREE_SEC);

        // * MFA page is shown
        cy.findByText('Multi-factor Authentication Setup', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('exist');
    });

    // This test relies on the previous test for having MFA enabled (MM-T1778)
    it('MM-T1781 - MFA - Admin removes another users MFA', () => {
        // # Login as test user
        cy.apiLogin(testUser);
        cy.wait(TIMEOUTS.THREE_SEC);

        // # Complete MFA setup which we didnt do for the test user
        cy.get('#mfa').wait(TIMEOUTS.HALF_SEC).find('.col-sm-12').then((p) => {
            const secretp = p.text();
            const testUserMFASecret = secretp.split(' ')[1];

            const token = authenticator.generateToken(testUserMFASecret);
            cy.findByPlaceholderText('MFA Code').type(token);
            cy.findByText('Save').click();

            cy.wait(TIMEOUTS.HALF_SEC);
            cy.findByText('Okay').click();

            cy.apiLogout();
        });

        cy.wait(TIMEOUTS.THREE_SEC);

        // # Login back as admin.
        const adminMFAToken = authenticator.generateToken(adminMFASecret);
        cy.apiLoginWithMFA(mfaSysAdmin, adminMFAToken);

        // # Navigate to System Console -> User Management -> Users
        cy.visit('/admin_console/user_management/users');
        cy.findByPlaceholderText('Search users').type(testUser.username).wait(TIMEOUTS.HALF_SEC);

        // * Remove MFA option available for the user and click it
        cy.get('#systemUsersTable-cell-0_actionsColumn').click().wait(TIMEOUTS.HALF_SEC);
        cy.findByText('Remove MFA').should('be.visible').click();

        // # Navigate to System Console -> Authentication -> MFA Page.
        cy.visit('/admin_console/authentication/mfa');
        cy.findByText('Multi-factor Authentication', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('exist');

        // # Also ensure that this MFA setting is enforced.
        cy.findByTestId('ServiceSettings.EnforceMultifactorAuthenticationfalse').check();

        // # Click "Save".
        cy.findByText('Save').click().wait(TIMEOUTS.ONE_SEC);
        cy.apiLogout();

        // # Login as test user
        cy.apiLogin(testUser);
        cy.visit('/');

        // * No MFA page is shown
        cy.findByText('Multi-factor Authentication Setup', {timeout: TIMEOUTS.ONE_MIN}).should('not.exist').and('not.exist');
    });

    // This test relies on the previous test for having MFA enabled (MM-T1781)
    it('MM-T1782 - MFA - Removing MFA option hidden for users without MFA set up', () => {
        // # Login back as admin.
        const token = authenticator.generateToken(adminMFASecret);
        cy.apiLoginWithMFA(mfaSysAdmin, token);

        // # Navigate to System Console -> User Management -> Users
        cy.visit('/admin_console/user_management/users');
        cy.findByPlaceholderText('Search users').type(testUser.username).wait(TIMEOUTS.HALF_SEC);

        // * Remove MFA option available for the user and click it
        cy.wait(TIMEOUTS.HALF_SEC);
        cy.get('#systemUsersTable-cell-0_actionsColumn').click().wait(TIMEOUTS.HALF_SEC);
        cy.findByText('Remove MFA').should('not.exist');

        // # Done with that MFA stuff so we disable it all
        cy.apiUpdateConfig({
            ServiceSettings: {
                EnableMultifactorAuthentication: false,
                EnforceMultifactorAuthentication: false,
            },
        });
    });
});
