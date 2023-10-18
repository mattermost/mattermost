// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @notifications
import {callsPlugin} from '../../../utils/plugins';

describe('Notifications', () => {
    before(() => {
        // # Upload and enable Calls plugin
        cy.shouldNotRunOnCloudEdition();
        cy.shouldHavePluginUploadEnabled();
        cy.apiUploadAndEnablePlugin(callsPlugin);

        cy.apiInitSetup().then(({team, user, channel}) => {
            // # Login as user and visit channel
            cy.apiLogin(user);
            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });

    it('MM-53166 Notification sound modal selection should reset when settings canceled', () => {
        // # Call function that clicks on Settings -> Notifications -> Desktop Notifications -> Notification sound -> Change sound -> Cancel -> Desktop Notifications
        openSettingsAndChangeNotification('desktopNotification');

        // # Call function that clicks on Settings -> Notifications -> Desktop Notifications -> Notification sound for incoming calls -> Cancel -> Desktop Notifications
        openSettingsAndChangeNotification('callsDesktopSound');
    });

    function openSettingsAndChangeNotification(type) {
        // # Open 'Settings' modal
        cy.uiOpenSettingsModal().within(() => {
            // # Navigate to Desktop Notification Settings
            navigateToDesktopNotificationSettings(type);

            // # Change Notification selection
            setNotificationToDown(type);

            // # Click Cancel button
            cy.uiCancelButton().click();

            // # Navigate to Desktop Notification Settings
            navigateToDesktopNotificationSettings(type);
        });
    }

    function setNotificationToDown(type) {
        switch (type) {
        case 'desktopNotification':
            // # Change Notification sound selection value is set to Down
            cy.get('#displaySoundNotification').
                find('.react-select__dropdown-indicator').
                click().
                get('.react-select__menu').
                contains('Down').
                click();
            break;
        case 'callsDesktopSound':
            // # Change Notification Notification sound for incoming calls selection value is set to Down
            cy.get('#displayCallsSoundNotification').
                find('.react-select__dropdown-indicator').
                click().
                get('.react-select__menu').
                contains('Down').
                click();
            break;
        default:
            break;
        }

        // * Verify Notification display changed to Down
        verifyNotificationSelectionValue(type, 'Down');
    }

    function navigateToDesktopNotificationSettings(type) {
        // # Click on the 'Edit' button next to Desktop Notifications
        cy.get('#desktopEdit').should('be.visible').click();

        // * Verify that the Notification is set to On
        verifyNotificationIsOn(type);

        // * Verify Notification selection display default value (Bing)
        verifyNotificationSelectionValue(type, 'Bing');
    }

    function verifyNotificationIsOn(type) {
        switch (type) {
        case 'desktopNotification':
            // * Verify that the Notification sound is set to On
            cy.get('#soundOn').should('be.visible').and('be.checked');
            break;
        case 'callsDesktopSound':
            // * Verify that the Notification sound for incoming calls is set to On
            cy.get('#callsSoundOn').should('be.visible').and('be.checked');
            break;
        default:
            break;
        }
    }

    function verifyNotificationSelectionValue(type, value) {
        switch (type) {
        case 'desktopNotification':
            // * Verify that the Notification sound is set to certain value
            cy.get('#displaySoundNotification').
                find('.react-select__single-value').
                should('contain', value);
            break;
        case 'callsDesktopSound':
            // * Verify that the Notification sound for incoming calls is set to certain value
            cy.get('#displayCallsSoundNotification').
                find('.react-select__single-value').
                should('contain', value);
            break;
        default:
            break;
        }
    }
});
