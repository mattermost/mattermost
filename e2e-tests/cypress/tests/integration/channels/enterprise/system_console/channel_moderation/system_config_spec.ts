// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @system_console @channel_moderation

import {Channel} from '@mattermost/types/channels';
import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import * as TIMEOUTS from '../../../../../fixtures/timeouts';

import {checkBoxes} from './constants';

import {
    disableAllChannelModeratedPermissions,
    enableAllChannelModeratedPermissions,
    saveConfigForChannel,
} from './helpers';

describe('Channel Moderation', () => {
    let guestUser: UserProfile;
    let testTeam: Team;
    let testChannel: Channel;

    before(() => {
        // * Check if server has license
        cy.apiRequireLicense();

        cy.apiInitSetup().then(({team, channel}) => {
            testTeam = team;
            testChannel = channel;

            cy.apiCreateGuestUser({}).then(({guest}) => {
                guestUser = guest;

                cy.apiAddUserToTeam(testTeam.id, guestUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, guestUser.id);
                });
            });
        });
    });

    it('MM-22276 - Enable and Disable all channel moderated permissions', () => {
        // # Go to system admin page and to channel configuration page of test channel
        cy.apiAdminLogin();
        cy.visit('/admin_console/user_management/channels');

        // # Search for the channel.
        cy.get('.DataGrid_searchBar').within(() => {
            cy.findByPlaceholderText('Search').type(`${testChannel.name}{enter}`);
        });
        cy.findByText('Edit').click();

        // # Wait until the groups retrieved and show up
        cy.wait(TIMEOUTS.ONE_SEC);

        // # Check all the boxes currently unchecked (align with the system scheme permissions)
        enableAllChannelModeratedPermissions();

        // # Save if possible (if previous test ended abruptly all permissions may already be enabled)
        saveConfigForChannel(testChannel.display_name);

        // # Wait until the groups retrieved and show up
        cy.wait(TIMEOUTS.ONE_SEC);

        // * Ensure all checkboxes are checked
        checkBoxes.forEach((buttonId) => {
            cy.findByTestId(buttonId).should('have.class', 'checked');
        });

        // # Uncheck all the boxes currently checked
        disableAllChannelModeratedPermissions();

        // # Save the page and wait till saving is done
        saveConfigForChannel(testChannel.display_name);

        // # Wait until the groups retrieved and show up
        cy.wait(TIMEOUTS.ONE_SEC);

        // * Ensure all checkboxes have the correct unchecked state
        checkBoxes.forEach((buttonId) => {
            // * Ensure all checkboxes are unchecked
            cy.findByTestId(buttonId).should('not.have.class', 'checked');

            // * Ensure Channel Mentions are disabled due to Create Posts
            if (buttonId.includes('use_channel_mentions')) {
                cy.findByTestId(buttonId).should('be.disabled');
                return;
            }

            // * Ensure all other check boxes are still enabled
            cy.findByTestId(buttonId).should('not.be.disabled');
        });
    });
});
