// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channel_sidebar

import {
    beMuted,
    beRead,
    beUnread,
} from '../../support/assertions';
import {getAdminAccount} from '../../support/env';

import * as TIMEOUTS from '../../fixtures/timeouts';
import {getRandomId} from '../../utils';

describe('Channel sidebar unread filter', () => {
    const randomId = getRandomId();

    let testUser;
    let teamId;

    before(() => {
        // # Setting up for CRT
        cy.apiUpdateConfig({
            ServiceSettings: {
                ThreadAutoFollow: true,
                CollapsedThreads: 'default_off',
            },
        });

        // # Setting up user
        cy.apiInitSetup({loginAfter: true}).then(({user, team}) => {
            testUser = user;
            teamId = team.id;

            cy.visit('/');
        });
    });

    it('MM-T3441 should change the filter label when the unread filter changes state', () => {
        // * Verify that the unread filter is in all channels state
        cy.findByRole('application', {name: 'channel sidebar region'}).within(() => {
            cy.findAllByText('UNREADS').should('not.exist');
            cy.findAllByRole('button', {name: 'CHANNELS'}).should('be.visible');
            cy.findAllByRole('button', {name: 'DIRECT MESSAGES'}).should('be.visible');
        });

        enableUnreadFilter();

        // * Verify that the unread filter is in filter by unread state
        cy.findByRole('application', {name: 'channel sidebar region'}).within(() => {
            cy.findAllByText('UNREADS').should('be.visible');
            cy.findAllByRole('button', {name: 'CHANNELS'}).should('not.exist');
            cy.findAllByRole('button', {name: 'DIRECT MESSAGES'}).should('not.exist');
        });

        disableUnreadFilter();

        // * Verify that the unread filter is back in all channels state
        cy.findByRole('application', {name: 'channel sidebar region'}).within(() => {
            cy.findAllByText('UNREADS').should('not.exist');
            cy.findAllByRole('button', {name: 'CHANNELS'}).should('be.visible');
            cy.findAllByRole('button', {name: 'DIRECT MESSAGES'}).should('be.visible');
        });
    });

    it('MM-T3442 should not persist the state of the unread filter on reload', () => {
        // * Verify that all categories are visible
        cy.get('.SidebarChannelGroupHeader:contains(CHANNELS)').should('be.visible');
        cy.get('.SidebarChannelGroupHeader:contains(DIRECT MESSAGES)').should('be.visible');

        enableUnreadFilter();

        // # Reload the page
        cy.reload();

        // * Verify that all categories are visible again
        cy.get('.SidebarChannelGroupHeader:contains(CHANNELS)').should('be.visible');
        cy.get('.SidebarChannelGroupHeader:contains(DIRECT MESSAGES)').should('be.visible');
    });

    it('MM-T3443 should only show unread channels with filter enabled', () => {
        // * Verify that the unread filter is not enabled
        cy.get('.SidebarChannelGroupHeader:contains(CHANNELS)').should('be.visible');

        // # Create a couple of new channels, one of which is unread and one of which is not
        const readChannelName = `read${randomId}`;
        const unreadChannelName = `unread${randomId}`;
        createChannel(teamId, readChannelName);
        createChannel(teamId, unreadChannelName, 'test');

        // * Verify that the channels are correctly read and unread
        cy.get(`#sidebarItem_${readChannelName}`).should(beRead);
        cy.get(`#sidebarItem_${unreadChannelName}`).should(beUnread);

        enableUnreadFilter();

        // * Verify that the read channel has been hidden
        cy.get(`#sidebarItem_${readChannelName}`).should('not.exist');

        // * Verify that the unread channel is still visible
        cy.get(`#sidebarItem_${unreadChannelName}`).should('be.visible').should(beUnread);

        disableUnreadFilter();

        // * Verify that the read channel has reappeared
        cy.get(`#sidebarItem_${readChannelName}`).should('be.visible').should(beRead);
    });

    it('MM-T3444 should always show the current channel, even if it is not unread', () => {
        // * Verify that the unread filter is not enabled
        cy.get('.SidebarChannelGroupHeader:contains(CHANNELS)').should('be.visible');

        // # Switch to the town square
        cy.get('#sidebarItem_town-square').click();
        cy.get('#channelHeaderTitle').should('contain', 'Town Square');

        // * Verify that the Town Square is not unread
        cy.get('#sidebarItem_town-square').should('be.visible').should(beRead);

        enableUnreadFilter();

        // * Verify that the Town Square is still visible
        cy.get('#sidebarItem_town-square').should('be.visible').should(beRead);

        disableUnreadFilter();
    });

    it('MM-T3445 should hide channels once they have been read', () => {
        // * Verify that the unread filter is not enabled
        cy.get('.SidebarChannelGroupHeader:contains(CHANNELS)').should('be.visible');

        // # Create a couple of new channels, both of which are unread
        const channelName1 = `channel1${randomId}`;
        const channelName2 = `channel2${randomId}`;
        createChannel(teamId, channelName1, 'test');
        createChannel(teamId, channelName2, 'test');

        enableUnreadFilter();

        // * Verify that both channels are visible
        cy.get(`#sidebarItem_${channelName1}`).should('be.visible').should(beUnread);
        cy.get(`#sidebarItem_${channelName2}`).should('be.visible').should(beUnread);

        // # Visit the first channel
        cy.get(`#sidebarItem_${channelName1}`).click();

        // * Verify that both channels are still visible
        cy.get(`#sidebarItem_${channelName1}`).should('be.visible').should(beRead);
        cy.get(`#sidebarItem_${channelName2}`).should('be.visible').should(beUnread);

        // # Visit the second channel
        cy.get(`#sidebarItem_${channelName2}`).click();

        // * Verify that the first channel has disappeared
        cy.get(`#sidebarItem_${channelName1}`).should('not.exist');
        cy.get(`#sidebarItem_${channelName2}`).should('be.visible').should(beRead);

        disableUnreadFilter();
    });

    it('MM-T3446 should only show unread channels with filter enabled', () => {
        // * Verify that the unread filter is not enabled
        cy.get('.SidebarChannelGroupHeader:contains(CHANNELS)').should('be.visible');

        // # Create a couple of new channels
        const mentionedChannelName = `mentioned${randomId}`;
        const unreadChannelName = `muted${randomId}`;

        [mentionedChannelName, unreadChannelName].forEach((channelName, index) => {
            createChannel(teamId, channelName).then(({channel}) => {
                // # Open and mute a channel
                cy.uiGetChannelSidebarMenu(channel.display_name).within(() => {
                    cy.findByText('Mute Channel').should('be.visible').click();
                });

                // # Go to other channel
                cy.get('#sidebarItem_town-square').click({force: true});

                // # Post a message from other user
                cy.postMessageAs({
                    sender: getAdminAccount(),
                    message: index === 0 ? `@${testUser.username}` : 'test',
                    channelId: channel.id,
                });
            });
        });

        // * Verify that the first channel has a mention and is muted
        cy.get(`#sidebarItem_${mentionedChannelName}`).should(beUnread).should(beMuted);
        cy.get(`#sidebarItem_${mentionedChannelName} .badge`).should('be.visible');

        // * Verify that the second channel does not have a mention and is muted
        cy.get(`#sidebarItem_${unreadChannelName}`).should(beRead).should(beMuted);
        cy.get(`#sidebarItem_${unreadChannelName} .badge`).should('not.exist');

        enableUnreadFilter();

        // * Verify that the muted channel with a mention is still visible
        cy.get(`#sidebarItem_${mentionedChannelName}`).should('be.visible');

        // * Verify that the muted channel without a mention has been hidden
        cy.get(`#sidebarItem_${unreadChannelName}`).should('not.exist');

        disableUnreadFilter();

        // * Verify that the muted channel without a mention has reappeared
        cy.get(`#sidebarItem_${unreadChannelName}`).should('be.visible');
    });

    it('MM-T5192 should toggle between unreads and all channels with shortcut usage', () => {
        // * Verify that the unread filter is not enabled
        cy.get('.SidebarChannelGroupHeader:contains(CHANNELS)').should('be.visible');

        // # Create a couple of new channels, one of which is unread and one of which is not
        const readChannelName = `shortcutread${randomId}`;
        const unreadChannelName = `shortcutunread${randomId}`;
        createChannel(teamId, readChannelName);
        createChannel(teamId, unreadChannelName, 'test');

        // * Verify that the channels are correctly read and unread
        cy.get(`#sidebarItem_${readChannelName}`).should(beRead);
        cy.get(`#sidebarItem_${unreadChannelName}`).should(beUnread);

        enableUnreadFilterWithShortcut();

        // * Verify that the read channel has been hidden
        cy.get(`#sidebarItem_${readChannelName}`).should('not.exist');

        // * Verify that the unread channel is still visible
        cy.get(`#sidebarItem_${unreadChannelName}`).should('be.visible').should(beUnread);

        disableUnreadFilterWithShortcut();

        // * Verify that the read channel has reappeared
        cy.get(`#sidebarItem_${readChannelName}`).should('be.visible').should(beRead);
    });
    it('MM-T5208 continue to show global Threads item when unread filter is enabled', () => {
        // # Verify there is no Unread category on the sidebar
        cy.get('.SidebarChannelGroupHeader:contains(UNREADS)').should('not.exist');

        // * Verify that the unread filter is in all channels state
        cy.findByRole('application', {name: 'channel sidebar region'}).within(() => {
            cy.findAllByText('UNREADS').should('not.exist');
            cy.findAllByRole('button', {name: 'CHANNELS'}).should('be.visible');
            cy.findAllByRole('button', {name: 'DIRECT MESSAGES'}).should('be.visible');
        });

        // * Verify Threads global item is present on the sidebar
        cy.apiSaveCRTPreference(testUser.id, 'on');
        cy.get('.SidebarGlobalThreads').should('exist');

        // * The unreads tab button does NOT have a blue dot (unread indicator; no unread threads)
        cy.get('#threads-list-unread-button .dot').should('not.exist');

        // # Create a couple of new channels, one of which is unread and one of which is not
        const readChannelName = `globalthreadread${randomId}`;
        const unreadChannelName = `globalthreadunread${randomId}`;
        createChannel(teamId, readChannelName);
        createChannel(teamId, unreadChannelName, 'test in unread channel');

        // * Verify that the channels are correctly read and unread
        cy.get(`#sidebarItem_${readChannelName}`).should(beRead);
        cy.get(`#sidebarItem_${unreadChannelName}`).should(beUnread);

        // # Enable the unread filter
        enableUnreadFilter();

        // * Verify that the unread filter is in filter by unread state
        cy.findByRole('application', {name: 'channel sidebar region'}).within(() => {
            cy.findAllByText('UNREADS').should('be.visible');
            cy.findAllByRole('button', {name: 'CHANNELS'}).should('not.exist');
            cy.findAllByRole('button', {name: 'DIRECT MESSAGES'}).should('not.exist');
        });

        // * Verify that the read channel has been hidden
        cy.get(`#sidebarItem_${readChannelName}`).should('not.exist');

        // * Verify that the unread channel is still visible
        cy.get(`#sidebarItem_${unreadChannelName}`).should('be.visible').should(beUnread);

        // * Verify that Threads item is still visible on the sidebar despite not having any unread threads
        cy.get('.SidebarGlobalThreads').should('exist');

        // # Disable the unread filter
        disableUnreadFilter();

        // * Verify that the read channel has reappeared
        cy.get(`#sidebarItem_${readChannelName}`).should('be.visible').should(beRead);

        // * Verify that the unread filter is back in all channels state
        cy.findByRole('application', {name: 'channel sidebar region'}).within(() => {
            cy.findAllByText('UNREADS').should('not.exist');
            cy.findAllByRole('button', {name: 'CHANNELS'}).should('be.visible');
            cy.findAllByRole('button', {name: 'DIRECT MESSAGES'}).should('be.visible');
        });
    });
});

function enableUnreadFilter() {
    // # Enable the unread filter
    cy.get('.SidebarFilters_filterButton').click();

    // * Verify that the unread filter is enabled
    cy.get('.SidebarChannelGroupHeader:contains(UNREADS)').should('be.visible');
}

function disableUnreadFilter() {
    // # Enable the unread filter
    cy.get('.SidebarFilters_filterButton').click();

    // * Verify that the unread filter is disabled
    cy.get('.SidebarChannelGroupHeader:contains(UNREADS)').should('not.exist');
}

function enableUnreadFilterWithShortcut() {
    // # Enable the unread filter with shorcut
    cy.get('body').cmdOrCtrlShortcut('{shift}U');

    // * Verify that the unread filter is enabled
    cy.get('.SidebarChannelGroupHeader:contains(UNREADS)').should('be.visible');
}

function disableUnreadFilterWithShortcut() {
    // # Enable the unread filter with shortcut
    cy.get('body').cmdOrCtrlShortcut('{shift}U');

    // * Verify that the unread filter is disabled
    cy.get('.SidebarChannelGroupHeader:contains(UNREADS)').should('not.exist');
}

function createChannel(teamId, channelName, message?) {
    return cy.apiCreateChannel(teamId, channelName, channelName, 'O', '', '', false).then(({channel}) => {
        if (message) {
            cy.wait(TIMEOUTS.THREE_SEC);
            cy.postMessageAs({sender: getAdminAccount(), message, channelId: channel.id});
        }

        return cy.wrap({channel});
    });
}
