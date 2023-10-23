// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @notifications

describe('Notifications', () => {
    before(() => {
        cy.apiInitSetup().then(({team, user, channel}) => {
            // # Login as user and visit channel
            cy.apiLogin(user);
            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });

    it('MM-T5458 Notification sound modal selection should reset when settings canceled', () => {
        // # Call function that clicks on Settings -> Notifications -> Desktop Notifications -> Notification sound -> Change sound -> Cancel -> Desktop Notifications
        openSettingsAndChangeNotification();
    });

    function openSettingsAndChangeNotification() {
        // # Open 'Settings' modal
        cy.uiOpenSettingsModal().within(() => {
            // # Navigate to Desktop Notification Settings
            navigateToDesktopNotificationSettings();

            // # Change Notification selection
            setNotificationSound();

            // # Click Cancel button
            cy.uiCancelButton().click();

            // # Navigate to Desktop Notification Settings
            navigateToDesktopNotificationSettings();
            cy.uiClose();
        });
    }

    function setNotificationSound() {
        // # Change Notification sound selection value is set to Down
        cy.get('#displaySoundNotification').click();
        cy.findByText('Down').click();

        // * Verify Notification display changed to Down
        verifyNotificationSelectionValue('Down');
    }

    function navigateToDesktopNotificationSettings() {
        // # Click on the 'Edit' button next to Desktop Notifications
        cy.get('#desktopEdit').should('be.visible').click();

        // * Verify that the Notification sound is set to Bing
        verifyNotificationSelectionValue('Bing');
    }

    function verifyNotificationSelectionValue(value) {
        // * Verify that the Notification sound is set to certain value
        cy.get('#displaySoundNotification').findByTestId('displaySoundNotificationValue').should('contain', value);
    }
});
