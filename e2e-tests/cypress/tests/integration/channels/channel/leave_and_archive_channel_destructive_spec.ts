// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserProfile} from 'mattermost-redux/types/users';

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel

describe('Leave and Archive channel actions display as destructive', () => {
    let testUser: UserProfile;
    let offTopicUrl: string;

    before(() => {
        // # Login as test user and visit off-topic channel
        cy.apiInitSetup().then(({user, offTopicUrl: url}) => {
            testUser = user;
            offTopicUrl = url;

            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
        });
    });

    beforeEach(() => {
        cy.reload();
    });

    it('MM-T4943_1 Leave and Archive channel actions display as destructive in the channel dropdown menu', () => {
        // # click on channel drop-down menu
        cy.get('#channelHeaderTitle').should('be.visible').click();

        // * View Info menu option should be visible
        cy.findByText('View Info').should('be.visible');

        // * Move to... menu option should be visible
        cy.findByText('Move to...').should('be.visible').children().trigger('mouseover');

        // * Favorites Sub-menu option should be visible
        cy.findByText('Favorites').should('be.visible');

        // * New Category Sub-menu option should be visible
        cy.findByText('New Category').should('be.visible');

        // * Notification Preferences menu option should be visible
        cy.get('#channelNotificationPreferences').should('be.visible');

        // * Mute Channel menu option should be visible
        cy.get('#channelToggleMuteChannel').should('be.visible');

        // * Add Members menu option should be visible
        cy.get('#channelAddMembers').should('be.visible');

        // * Manage Members menu option should be visible
        cy.get('#channelManageMembers').should('be.visible');

        // * Edit Channel Header menu option should be visible
        cy.get('#channelEditHeader').should('be.visible');

        // * Edit Channel Purpose menu option should be visible
        cy.get('#channelEditPurpose').should('be.visible');

        // * Rename Channel menu option should be visible
        cy.get('#channelRename').should('be.visible');

        // * Archive Channel menu option should be visible and have a background-color (destructive)
        cy.get('#channelArchiveChannel').should('be.visible').children().focus().should('have.css', 'background-color', 'rgb(210, 75, 78)');

        // * Leave Channel menu option should be visible and hav a background-color (destructive)
        cy.get('#channelLeaveChannel').should('be.visible').children().focus().should('have.css', 'background-color', 'rgb(210, 75, 78)');
    });

    it('MM-T4943_2 Leave channel actions display as destructive in the Edit Channel Menu ', () => {
        // # Open Edit Channel Menu and verify menu optin
        cy.uiGetChannelSidebarMenu('Off-Topic').within(() => {
            // * Favorite menu option should be visible
            cy.findByText('Favorite').should('be.visible').should('not.have.css', 'color', 'rgb(210, 75, 78)');

            // * Mute Channel menu option should be visible
            cy.findByText('Mute Channel').should('be.visible').should('not.have.css', 'color', 'rgb(210, 75, 78)');

            // * Copy Link menu option should be visible
            cy.findByText('Copy Link').should('be.visible').should('not.have.css', 'color', 'rgb(210, 75, 78)');

            // * Add Members menu option should be visible
            cy.findByText('Add Members').should('be.visible').should('not.have.css', 'color', 'rgb(210, 75, 78)');

            // * Move to... menu option should be visible and is not destructive
            cy.findByText('Move to...').should('be.visible').should('not.have.css', 'color', 'rgb(210, 75, 78)');

            // * Leave Channel menu option should be visible and have a color (destructive)
            cy.findByText('Leave Channel').should('be.visible').should('have.css', 'color', 'rgb(210, 75, 78)');
        });
    });
});
