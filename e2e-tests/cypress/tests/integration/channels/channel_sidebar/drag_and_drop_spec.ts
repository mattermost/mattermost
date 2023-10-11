// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod @smoke
// Group: @channels @channel_sidebar

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Channel sidebar', () => {
    const SpaceKeyCode = 32;
    const DownArrowKeyCode = 40;

    let teamName;
    let channelName;

    before(() => {
        cy.apiCreateCustomAdmin({loginAfter: true});
    });

    beforeEach(() => {
        // # Start with a new team
        cy.apiCreateTeam('team', 'Team').then(({team}) => {
            teamName = team.display_name;
            cy.apiCreateChannel(team.id, 'channel', 'Channel').then(({channel}) => {
                channelName = channel.display_name;
            });
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('should move channel to correct place when dragging channel within category', () => {
        // * Verify that we've switched to the new team
        cy.uiGetLHSHeader().findByText(teamName);

        // * Verify the order is correct to begin with
        cy.uiGetLhsSection('CHANNELS').within(() => {
            cy.get('.SidebarChannel > .SidebarLink').should('be.visible').as('fromChannelSidebarLink');
            cy.get('@fromChannelSidebarLink').eq(0).should('contain', channelName);
            cy.get('@fromChannelSidebarLink').eq(1).should('contain', 'Off-Topic');
            cy.get('@fromChannelSidebarLink').eq(2).should('contain', 'Town Square');
        });

        // # Perform drag using keyboard
        cy.get('.SidebarChannel:contains(Off-Topic) > .SidebarLink').
            trigger('keydown', {keyCode: SpaceKeyCode}).
            trigger('keydown', {keyCode: DownArrowKeyCode, force: true}).wait(TIMEOUTS.THREE_SEC).
            trigger('keydown', {keyCode: SpaceKeyCode, force: true}).wait(TIMEOUTS.THREE_SEC);

        // * Verify that the elements have been re-ordered
        cy.uiGetLhsSection('CHANNELS').within(() => {
            cy.get('.SidebarChannel > .SidebarLink').as('toChannelSidebarLink');
            cy.get('@toChannelSidebarLink').eq(0).should('contain', channelName);
            cy.get('@toChannelSidebarLink').eq(1).should('contain', 'Town Square');
            cy.get('@toChannelSidebarLink').eq(2).should('contain', 'Off-Topic');
        });
    });

    it('should move category to correct place', () => {
        // * Verify that we've switched to the new team
        cy.uiGetLHSHeader().findByText(teamName);

        // # Get channel group button and wait for Channels to be visible since for some reason it shows up later...
        cy.get('.SidebarChannelGroupHeader_groupButton > div[data-rbd-drag-handle-draggable-id]').should('be.visible').as('fromChannelGroup');
        cy.get('@fromChannelGroup').should('contain', 'CHANNELS');

        // * Verify the order is correct to begin with
        cy.get('@fromChannelGroup').eq(0).should('contain', 'CHANNELS');
        cy.get('@fromChannelGroup').eq(1).should('contain', 'DIRECT MESSAGES');

        // # Perform drag using keyboard
        cy.get('@fromChannelGroup').eq(0).should('contain', 'CHANNELS').
            trigger('keydown', {keyCode: SpaceKeyCode}).
            trigger('keydown', {keyCode: DownArrowKeyCode, force: true}).wait(TIMEOUTS.THREE_SEC).
            trigger('keydown', {keyCode: SpaceKeyCode, force: true}).wait(TIMEOUTS.THREE_SEC);

        // * Verify that the elements have been re-ordered
        cy.get('.SidebarChannelGroupHeader_groupButton > div[data-rbd-drag-handle-draggable-id]').as('toChannelGroup');
        cy.get('@toChannelGroup').eq(1).should('contain', 'CHANNELS');
        cy.get('@toChannelGroup').eq(0).should('contain', 'DIRECT MESSAGES');
    });

    it('should retain focus within the channel sidebar after dragging and dropping with the keyboard', () => {
        // * Verify that we've switched to the new team
        cy.uiGetLHSHeader().findByText(teamName);

        // # Perform drag using keyboard
        cy.get('.SidebarChannel:contains(Off-Topic) > .SidebarLink').
            click().
            focus().
            trigger('keydown', {key: ' ', keyCode: SpaceKeyCode}).
            trigger('keydown', {keyCode: DownArrowKeyCode, force: true}).
            wait(TIMEOUTS.THREE_SEC).
            trigger('keydown', {key: ' ', keyCode: SpaceKeyCode, force: true}).wait(TIMEOUTS.THREE_SEC);

        // * Verify that the current focused element is the channel
        cy.focused().should('contain', 'Off-Topic');
    });
});
