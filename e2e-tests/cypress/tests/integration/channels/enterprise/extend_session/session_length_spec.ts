// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @not_cloud @system_console

describe('MM-T2574 Session Lengths', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.apiRequireLicense();
        goToSessionLengths();
    });

    describe('"Extend session length with activity" defaults to true', () => {
        it('"Extend session length with activity" radio is checked', () => {
            cy.get('#extendSessionLengthWithActivitytrue').check().should('be.checked');
        });
        it('"Session idle timeout" setting should not exist', () => {
            cy.get('#sessionIdleTimeoutInMinutes').should('not.exist');
        });
    });

    describe('Setting "Extend session length with activity" to false alters subsequent settings', () => {
        before(() => cy.get('#extendSessionLengthWithActivityfalse').check());
        it('In enterprise edition, "Session idle timeout" setting should exist on page', () => {
            cy.get('#sessionIdleTimeoutInMinutes').should('exist');
        });
    });

    describe('Session Lengths settings should save successfully', () => {
        before(() => cy.get('#extendSessionLengthWithActivityfalse').check());
        it('Setting "Session Idle Timeout (minutes)" should save in UI', () => {
            cy.get('#sessionIdleTimeoutInMinutes').
                should('have.value', '43200').
                clear().type('43201');
            saveConfig();
            cy.get('#sessionIdleTimeoutInMinutes').should('have.value', '43201');
        });
        it('Setting "Session Cache (minutes)" should be saved in the server configuration', () => {
            cy.apiGetConfig().then(({config}) => {
                const setting = config.ServiceSettings.SessionIdleTimeoutInMinutes;
                expect(setting).to.equal(43201);
            });
        });
    });

    it('should match help text', () => {
        const helpText = {
            extendSessionLengthWithActivity: {
                false: 'When true, sessions will be automatically extended when the user is active in their Mattermost client. Users sessions will only expire if they are not active in their Mattermost client for the entire duration of the session lengths defined in the fields below. When false, sessions will not extend with activity in Mattermost. User sessions will immediately expire at the end of the session length or idle timeouts defined below. ',
                true: 'When true, sessions will be automatically extended when the user is active in their Mattermost client. Users sessions will only expire if they are not active in their Mattermost client for the entire duration of the session lengths defined in the fields below. When false, sessions will not extend with activity in Mattermost. User sessions will immediately expire at the end of the session length or idle timeouts defined below. ',
            },
            sessionLengthWebInHours: {
                false: 'The number of hours from the last time a user entered their credentials to the expiry of the user\'s session. After changing this setting, the new session length will take effect after the next time the user enters their credentials.',
                true: 'Set the number of hours from the last activity in Mattermost to the expiry of the user’s session when using email and AD/LDAP authentication. After changing this setting, the new session length will take effect after the next time the user enters their credentials.',
            },
            sessionLengthMobileInHours: {
                false: 'The number of hours from the last time a user entered their credentials to the expiry of the user\'s session. After changing this setting, the new session length will take effect after the next time the user enters their credentials.',
                true: 'Set the number of hours from the last activity in Mattermost to the expiry of the user’s session on mobile. After changing this setting, the new session length will take effect after the next time the user enters their credentials.',
            },
            sessionLengthSSOInHours: {
                false: 'The number of hours from the last time a user entered their credentials to the expiry of the user\'s session. If the authentication method is SAML or GitLab, the user may automatically be logged back in to Mattermost if they are already logged in to SAML or GitLab. After changing this setting, the setting will take effect after the next time the user enters their credentials.',
                true: 'Set the number of hours from the last activity in Mattermost to the expiry of the user’s session for SSO authentication, such as SAML, GitLab and OAuth 2.0. If the authentication method is SAML or GitLab, the user may automatically be logged back in to Mattermost if they are already logged in to SAML or GitLab. After changing this setting, the setting will take effect after the next time the user enters their credentials.',
            },
            sessionCacheInMinutes: {
                false: 'The number of minutes to cache a session in memory.',
                true: 'The number of minutes to cache a session in memory.',
            },
            sessionIdleTimeoutInMinutes: {
                false: 'The number of minutes from the last time a user was active on the system to the expiry of the user\'s session. Once expired, the user will need to log in to continue. Minimum is 5 minutes, and 0 is unlimited.Applies to the desktop app and browsers. For mobile apps, use an EMM provider to lock the app when not in use. In High Availability mode, enable IP hash load balancing for reliable timeout measurement.',
                true: false,
            },
        };

        cy.get('#extendSessionLengthWithActivityfalse').should('exist').check();
        Object.entries(helpText).forEach(([key, value]) => {
            cy.findByTestId(key).should('exist');
            cy.findByTestId(`${key}help-text`).should('have.text', value.false);
        });

        cy.get('#extendSessionLengthWithActivitytrue').should('exist').check();
        Object.entries(helpText).forEach(([key, value]) => {
            if (value.true) {
                cy.findByTestId(key).should('exist');
                cy.findByTestId(`${key}help-text`).should('have.text', value.true);
            } else {
                cy.findByTestId(key).should('not.exist');
            }
        });
    });

    // # Goes to the System Scheme page as System Admin
    const goToSessionLengths = () => {
        cy.apiAdminLogin();
        cy.visit('/admin_console/environment/session_lengths');
    };

    // # Wait's until the Saving text becomes Save
    const waitUntilConfigSave = () => {
        cy.waitUntil(() => cy.get('#saveSetting').then((el) => {
            return el[0].innerText === 'Save';
        }));
    };

    // Clicks the save button in the system console page.
    // waitUntilConfigSaved: If we need to wait for the save button to go from saving -> save.
    // Usually we need to wait unless we are doing this in team override scheme
    const saveConfig = (waitUntilConfigSaved = true, clickConfirmationButton = false) => {
        // # Save if possible (if previous test ended abruptly all permissions may already be enabled)
        cy.get('#saveSetting').then((btn) => {
            if (btn.is(':enabled')) {
                btn.click();
            }
        });
        if (clickConfirmationButton) {
            cy.get('#confirmModalButton').click();
        }
        if (waitUntilConfigSaved) {
            waitUntilConfigSave();
        }
    };
});
