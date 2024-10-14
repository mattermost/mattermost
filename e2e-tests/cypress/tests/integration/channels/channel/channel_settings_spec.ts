// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel @channel_settings

import {Team} from '@mattermost/types/teams';
import {
    beMuted,
    beUnmuted,
} from '../../../support/assertions';

describe('Channel Settings', () => {
    let testTeam: Team;
    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            cy.apiCreateChannel(testTeam.id, 'channel', 'Private Channel', 'P').then(({channel}) => {
                cy.apiAddUserToChannel(channel.id, user.id);
            });

            cy.apiLogin(user);

            // # Visit town-square channel
            cy.visit(`/${testTeam.name}/channels/town-square`);
        });
    });

    it('MM-T882 Channel URL validation works properly', () => {
        cy.apiCreateChannel(testTeam.id, 'channel-test', 'Channel').then(({channel}) => {
            // # Go to test channel
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            // # Go to channel dropdown > Rename channel
            cy.get('#channelHeaderDropdownIcon').click();
            cy.findByText('Rename Channel').click();

            // # Try to enter existing URL and save
            cy.get('#channel_name').clear().type('town-square');
            cy.get('#save-button').click();

            // # Error is displayed and URL is unchanged
            cy.get('.has-error').should('be.visible').and('contain', 'A channel with that name already exists on the same team.');
            cy.url().should('include', `/${testTeam.name}/channels/${channel.name}`);

            // # Enter a new URL and save
            cy.get('#channel_name').clear().type('another-town-square');
            cy.get('#save-button').click();

            // * URL is updated and no errors are displayed
            cy.url().should('include', `/${testTeam.name}/channels/another-town-square`);
        });
    });

    it('MM-T887 Channel dropdown menu - Mute / Unmute', () => {
        // # Visit off-topic
        cy.visit(`/${testTeam.name}/channels/off-topic`);

        // # Go to channel dropdown > Mute channel
        cy.get('#channelHeaderDropdownIcon').click();
        cy.get('#channelHeaderDropdownMenu').should('exist').
            findByText('Mute Channel').should('be.visible').click();

        // # Verify channel is muted
        cy.get('#sidebarItem_off-topic').should(beMuted);

        // # Verify mute bell icon is visible
        cy.get('#toggleMute').should('be.visible');

        // # Verify that off topic is last in the list of channels
        cy.uiGetLhsSection('CHANNELS').find('.SidebarChannel').
            last().should('contain', 'Off-Topic').
            get('a').should('have.class', 'muted');

        // # Click Unmute channel while menu is open
        cy.get('#channelHeaderDropdownIcon').click();
        cy.get('#channelHeaderDropdownMenu').should('exist').
            findByText('Unmute Channel').should('be.visible').click();

        // # Verify channel is unmuted
        cy.get('#sidebarItem_off-topic').should(beUnmuted);

        // # Verify mute bell icon is not visible
        cy.get('#toggleMute').should('not.exist');

        // # Verify that off topic is not last in the list of channels
        cy.uiGetLhsSection('CHANNELS').find('.SidebarChannel').
            last().should('not.contain', 'Off-Topic');
    });
});
