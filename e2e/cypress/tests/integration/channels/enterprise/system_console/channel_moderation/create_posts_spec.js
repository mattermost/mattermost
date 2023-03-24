// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @system_console @channel_moderation

import {checkboxesTitleToIdMap} from './constants';

import {
    disablePermission,
    enablePermission,
    saveConfigForChannel,
    visitChannel,
    visitChannelConfigPage,
} from './helpers';

describe('MM-23102 - Channel Moderation - Create Posts', () => {
    let regularUser;
    let guestUser;
    let testTeam;
    let testChannel;

    before(() => {
        // * Check if server has license
        cy.apiRequireLicense();

        cy.apiInitSetup().then(({team, channel, user}) => {
            regularUser = user;
            testTeam = team;
            testChannel = channel;

            cy.apiCreateGuestUser().then(({guest}) => {
                guestUser = guest;

                cy.apiAddUserToTeam(testTeam.id, guestUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, guestUser.id);
                });
            });
        });
    });

    it('MM-T1541 Create Post option for Guests', () => {
        // # Go to channel configuration page of
        visitChannelConfigPage(testChannel);

        // # Uncheck the Create Posts option for Guests and Save
        disablePermission(checkboxesTitleToIdMap.CREATE_POSTS_GUESTS);
        saveConfigForChannel();

        // # Login as a Guest user and visit the same channel
        visitChannel(guestUser, testChannel, testTeam);

        // # Check Guest user should not have the permission to create a post on a channel when the option is removed
        // * Guest user should see a message stating that this channel is read-only and the textbox area should be disabled
        cy.findByTestId('post_textbox_placeholder').should('have.text', 'This channel is read-only. Only members with permission can post here.');
        cy.findByTestId('post_textbox').should('be.disabled');

        // # As a system admin, check the option to allow Create Posts for Guests and save
        visitChannelConfigPage(testChannel);
        enablePermission(checkboxesTitleToIdMap.CREATE_POSTS_GUESTS);
        saveConfigForChannel();

        // # Login as a Guest user and visit the same channel
        visitChannel(guestUser, testChannel, testTeam);

        // # Check Guest user should have the permission to create a post on a channel when the option is allowed
        // * Guest user should see a message stating that this channel is read-only and the textbox area should be disabled
        cy.findByTestId('post_textbox').clear();
        cy.findByTestId('post_textbox_placeholder').should('have.text', `Write to ${testChannel.display_name}`);
        cy.findByTestId('post_textbox').should('not.be.disabled');
    });

    it('MM-T1542 Create Post option for Members', () => {
        // # Go to system admin page and to channel configuration page of test channel
        visitChannelConfigPage(testChannel);

        // # Uncheck the Create Posts option for Members and Save
        disablePermission(checkboxesTitleToIdMap.CREATE_POSTS_MEMBERS);
        saveConfigForChannel();

        // # Login as a Guest user and visit test channel
        visitChannel(regularUser, testChannel, testTeam);

        // # Check Member should not have the permission to create a post on a channel when the option is removed.
        // * User should see a message stating that this channel is read-only and the textbox area should be disabled
        cy.findByTestId('post_textbox_placeholder').should('have.text', 'This channel is read-only. Only members with permission can post here.');
        cy.findByTestId('post_textbox').should('be.disabled');

        // # As a system admin, check the option to allow Create Posts for Members and save
        visitChannelConfigPage(testChannel);
        enablePermission(checkboxesTitleToIdMap.CREATE_POSTS_MEMBERS);
        saveConfigForChannel();

        // # Login as a Member user and visit the same channel
        visitChannel(regularUser, testChannel, testTeam);

        // # Check Member should have the permission to create a post on a channel when the option is allowed
        // * Member user should see a message stating that this channel is read-only and the textbox area should be disabled
        cy.findByTestId('post_textbox').clear();
        cy.findByTestId('post_textbox_placeholder').should('have.text', `Write to ${testChannel.display_name}`);
        cy.findByTestId('post_textbox').should('not.be.disabled');
    });
});
