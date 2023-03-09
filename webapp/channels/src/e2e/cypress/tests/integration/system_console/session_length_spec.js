// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @not_cloud @system_console

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

describe('MM-T2574 Session Lengths', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();

        goToSessionLengths();
    });

    describe('"Extend session length with activity" defaults to true', () => {
        it('"Extend session length with activity" radio is checked', () => {
            cy.get('#extendSessionLengthWithActivitytrue').check().should('be.checked');
        });
    });

    describe('Setting "Extend session length with activity" to false alters subsequent settings', () => {
        before(() => cy.get('#extendSessionLengthWithActivityfalse').check());
        it('In team edition, "Session idle timeout" setting should not exist', () => {
            cy.get('#sessionIdleTimeoutInMinutesinput').should('not.exist');
        });
    });

    describe('Session Lengths settings should save successfully', () => {
        it('Setting "Extend session length with activity" to TRUE should save in UI', () => {
            cy.get('#extendSessionLengthWithActivitytrue').check();
            saveConfig();
            cy.get('#extendSessionLengthWithActivitytrue').should('be.checked');
        });
        it('Setting "Extend session length with activity" to TRUE is saved in the server configuration', () => {
            cy.apiGetConfig().then(({config}) => {
                const setting = config.ServiceSettings.ExtendSessionLengthWithActivity;
                expect(setting).to.be.true;
            });
        });
        it('Setting "Extend session length with activity" to FALSE should save in UI', () => {
            cy.get('#extendSessionLengthWithActivityfalse').check();
            saveConfig();
            cy.get('#extendSessionLengthWithActivityfalse').should('be.checked');
        });
        it('Setting "Extend session length with activity" to FALSE is saved in the server configuration', () => {
            cy.apiGetConfig().then(({config}) => {
                const setting = config.ServiceSettings.ExtendSessionLengthWithActivity;
                expect(setting).to.be.false;
            });
        });
        it('Setting "Session Length AD/LDAP and Email (hours)" should save in UI', () => {
            cy.findByTestId('sessionLengthWebInHoursinput').
                should('have.value', '720').
                clear().type('744');
            saveConfig();
            cy.findByTestId('sessionLengthWebInHoursinput').should('have.value', '744');
        });
        it('Setting "Session Length AD/LDAP and Email (hours)" should be saved in the server configuration', () => {
            cy.apiGetConfig().then(({config}) => {
                const setting = config.ServiceSettings.SessionLengthWebInHours;
                expect(setting).to.equal(744);
            });
        });
        it('Setting "Session Length Mobile (hours)" should save in UI', () => {
            cy.findByTestId('sessionLengthMobileInHoursinput').
                should('have.value', '720').
                clear().type('744');
            saveConfig();
            cy.findByTestId('sessionLengthMobileInHoursinput').should('have.value', '744');
        });
        it('Setting "Session Length Mobile (hours)" should be saved in the server configuration', () => {
            cy.apiGetConfig().then(({config}) => {
                const setting = config.ServiceSettings.SessionLengthMobileInHours;
                expect(setting).to.equal(744);
            });
        });
        it('Setting "Session Length SSO (hours)" should save in UI', () => {
            cy.findByTestId('sessionLengthSSOInHoursinput').
                should('have.value', '720').
                clear().type('744');
            saveConfig();
            cy.findByTestId('sessionLengthSSOInHoursinput').should('have.value', '744');
        });
        it('Setting "Session Length SSO (hours)" should be saved in the server configuration', () => {
            cy.apiGetConfig().then(({config}) => {
                const setting = config.ServiceSettings.SessionLengthSSOInHours;
                expect(setting).to.equal(744);
            });
        });
        it('Setting "Session Cache (minutes)" should save in UI', () => {
            cy.get('#sessionCacheInMinutes').
                should('have.value', '10').
                clear().type('11');
            saveConfig();
            cy.get('#sessionCacheInMinutes').should('have.value', '11');
        });
        it('Setting "Session Cache (minutes)" should be saved in the server configuration', () => {
            cy.apiGetConfig().then(({config}) => {
                const setting = config.ServiceSettings.SessionCacheInMinutes;
                expect(setting).to.equal(11);
            });
        });
    });
});
