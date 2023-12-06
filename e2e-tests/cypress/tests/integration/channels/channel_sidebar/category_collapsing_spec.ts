// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel_sidebar

import * as TIMEOUTS from '../../../fixtures/timeouts';
import * as MESSAGES from '../../../fixtures/messages';
import {getAdminAccount} from '../../../support/env';

describe('Channel sidebar', () => {
    const sysadmin = getAdminAccount();

    let testTeam;

    beforeEach(() => {
        // # Start with a new team
        cy.apiAdminLogin();
        cy.apiInitSetup({loginAfter: true}).then(({team, townSquareUrl}) => {
            testTeam = team;

            cy.visit(townSquareUrl);
        });
    });

    it('should display collapsed state when collapsed', () => {
        // # Check that the CHANNELS group header is visible
        cy.get('.SidebarChannelGroupHeader:contains(CHANNELS)').should('be.visible').as('channelsGroup');

        // * Verify that the category doesn't appear collapsed currently
        cy.get('@channelsGroup').find('i').should('not.have.class', 'icon-rotate-minus-90');

        // # Click on CHANNELS
        cy.get('@channelsGroup').click();

        // * Verify that the category now appears collapsed
        cy.get('@channelsGroup').find('i').should('have.class', 'icon-rotate-minus-90');
    });

    it('should collapse channels that are not the currently viewed channel', () => {
        // # Check that the CHANNELS group header is visible
        cy.get('.SidebarChannelGroupHeader:contains(CHANNELS)').should('be.visible').as('channelsGroup');

        // * Verify that both channels are visible when not collapsed
        cy.get('.SidebarChannelGroup').should('be.visible').as('sidebarChannelGroup');
        cy.get('@sidebarChannelGroup').findByText('Town Square').should('exist').and('be.visible');
        cy.get('@sidebarChannelGroup').findByText('Off-Topic').should('be.visible');

        // # Click on CHANNELS
        cy.get('@channelsGroup').click();

        // * Verify that both channels are visible when not collapsed
        cy.get('.SidebarChannelGroup').should('be.visible').as('sidebarChannelGroup');
        cy.get('@sidebarChannelGroup').findByText('Town Square').should('be.visible');
        cy.get('@sidebarChannelGroup').findByText('Off-Topic').should('not.exist');
    });

    it('should collapse channels that are not unread channels', () => {
        const uniqueChannelName = MESSAGES.TINY;

        // Create a new channel and post a message into it
        cy.apiCreateChannel(testTeam.id, 'channel-test', uniqueChannelName, 'O', '', '', false).then(({channel}) => {
            cy.postMessageAs({sender: sysadmin, message: MESSAGES.SMALL, channelId: channel.id});

            // Force a reload to ensure the unread message displays
            cy.reload();
            cy.uiGetPostTextBox();

            // # Check that the CHANNELS group header is visible
            cy.get('.SidebarChannelGroupHeader:contains(CHANNELS)').should('be.visible').as('channelsGroup');

            // * Verify that all channels are visible
            cy.get('.SidebarChannelGroup').should('be.visible').as('sidebarChannelGroup');
            cy.get('.SidebarChannelGroup').findByText('Off-Topic').should('exist').and('be.visible');
            cy.get('.SidebarChannelGroup').findByText(uniqueChannelName).should('exist').and('be.visible');

            // # Click on CHANNELS
            cy.get('@channelsGroup').click();

            // * Verify that Off-Topic is no longer visible but Channel Test still is
            cy.get('.SidebarChannelGroup').should('be.visible').as('sidebarChannelGroup');
            cy.get('@sidebarChannelGroup').findByText('Off-Topic').should('not.exist');
            cy.get('@sidebarChannelGroup').findByText(uniqueChannelName).should('be.visible');
        });
    });

    it('should save collapsed state and remember the state on refresh', () => {
        // # Check that the CHANNELS group header is visible
        cy.get('.SidebarChannelGroupHeader:contains(CHANNELS)').should('be.visible');

        // * Verify that the category doesn't appear collapsed currently
        cy.get('.SidebarChannelGroupHeader:contains(CHANNELS) i').should('be.visible').should('not.have.class', 'icon-rotate-minus-90');

        // # Click on CHANNELS
        cy.get('.SidebarChannelGroupHeader:contains(CHANNELS)').should('be.visible').click();

        // * Verify that the category appears collapsed
        cy.get('.SidebarChannelGroupHeader:contains(CHANNELS) i').should('have.class', 'icon-rotate-minus-90');

        // Wait for state to settle
        // This is necessary since we have no observable way of finding out when the state actually settles so that it persists on reload
        // eslint-disable-next-line cypress/no-unnecessary-waiting
        cy.wait(TIMEOUTS.FIVE_SEC);

        // # Reload the page and wait
        cy.reload();
        cy.uiGetPostTextBox();

        // * Verify that the category still appears collapsed after refresh
        cy.get('.SidebarChannelGroupHeader:contains(CHANNELS) i').should('have.class', 'icon-rotate-minus-90');

        // # Click on CHANNELS
        cy.get('.SidebarChannelGroupHeader:contains(CHANNELS)').click();

        // * Verify that the category appears not collapsed after refresh
        cy.get('.SidebarChannelGroupHeader:contains(CHANNELS) i').should('not.have.class', 'icon-rotate-minus-90');

        // Wait for state to settle
        // eslint-disable-next-line cypress/no-unnecessary-waiting
        cy.wait(TIMEOUTS.FIVE_SEC);

        // # Reload the page and wait
        cy.reload();
        cy.uiGetPostTextBox();

        // * Verify that the category still appears not collapsed after refresh
        cy.get('.SidebarChannelGroupHeader:contains(CHANNELS) i').should('not.have.class', 'icon-rotate-minus-90');
    });

    it('should retain the collapsed state of categories when unread filter is enabled/disabled', () => {
        cy.apiCreateChannel(testTeam.id, 'channel-test', 'Channel Test').then(({channel}) => {
            cy.postMessageAs({sender: sysadmin, message: 'Test', channelId: channel.id});

            // * Verify that CHANNELS starts expanded
            cy.get('.SidebarChannelGroupHeader:contains(CHANNELS) i').should('not.have.class', 'icon-rotate-minus-90');

            // * Verify that all categories are visible
            cy.get('.SidebarChannelGroupHeader:contains(CHANNELS)').should('be.visible');
            cy.get('.SidebarChannelGroupHeader:contains(CHANNELS) i').should('be.visible').should('not.have.class', 'icon-rotate-minus-90');
            cy.get('.SidebarChannelGroupHeader:contains(DIRECT MESSAGES)').should('be.visible');
            cy.get('.SidebarChannelGroupHeader:contains(DIRECT MESSAGES) i').should('be.visible').should('not.have.class', 'icon-rotate-minus-90');

            // # Collapse CHANNELS
            cy.get('.SidebarChannelGroupHeader:contains(CHANNELS)').click();

            // * Verify that CHANNELS is collapsed
            cy.get('.SidebarChannelGroupHeader:contains(CHANNELS) i').should('have.class', 'icon-rotate-minus-90');

            // # Enable the unread filter
            cy.get('.SidebarFilters_filterButton').click();

            // * Verify that the unread filter is enabled
            cy.get('.SidebarChannelGroupHeader:contains(UNREADS)').should('be.visible');

            // # Disable the unread filter
            cy.get('.SidebarFilters_filterButton').click();

            // * Verify that DIRECT MESSAGES is not collapsed but CHANNELS still is
            cy.get('.SidebarChannelGroupHeader:contains(CHANNELS) i').should('be.visible').should('have.class', 'icon-rotate-minus-90');
            cy.get('.SidebarChannelGroupHeader:contains(DIRECT MESSAGES) i').should('be.visible').should('not.have.class', 'icon-rotate-minus-90');
        });
    });
});
