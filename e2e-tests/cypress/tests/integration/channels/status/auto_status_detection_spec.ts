// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @status

describe('Disable automatic activity detection', () => {
    let testUserId: string;

    beforeEach(() => {
        // # Login as a new test user and visit channel
        cy.apiInitSetup({loginAfter: true}).then(({team, channel, user}) => {
            testUserId = user.id;
            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });

    it('turns off Automatic status updates from Advanced settings and persists the preference', () => {
        // # Open Settings > Advanced and turn the setting Off
        cy.uiOpenSettingsModal('Advanced').within(() => {
            cy.findByRole('heading', {name: 'Automatic status updates'}).click();
            cy.findByRole('radio', {name: 'Off'}).click();
            cy.uiSaveAndClose();
        });

        // * The auto_status_update preference should be saved as "false"
        cy.apiGetUserPreference(testUserId).then((preferences) => {
            const pref = preferences.find(
                (p) => p.category === 'advanced_settings' && p.name === 'auto_status_update',
            );
            expect(pref?.value).to.equal('false');
        });
    });

    it('turns Automatic status updates back On after being disabled', () => {
        // # Pre-disable the preference via API
        cy.apiSaveUserPreference([{
            user_id: testUserId,
            category: 'advanced_settings',
            name: 'auto_status_update',
            value: 'false',
        }], testUserId);

        // # Reload so the setting reflects the saved preference
        cy.reload();

        // # Open Settings > Advanced and turn the setting back On
        cy.uiOpenSettingsModal('Advanced').within(() => {
            cy.findByRole('heading', {name: 'Automatic status updates'}).click();
            cy.findByRole('radio', {name: 'On'}).click();
            cy.uiSaveAndClose();
        });

        // * The auto_status_update preference should be saved as "true"
        cy.apiGetUserPreference(testUserId).then((preferences) => {
            const pref = preferences.find(
                (p) => p.category === 'advanced_settings' && p.name === 'auto_status_update',
            );
            expect(pref?.value).to.equal('true');
        });
    });
});
