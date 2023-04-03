// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @channel_sidebar

import {
    beMuted,
    beRead,
    beUnmuted,
    beUnread,
} from '../../../support/assertions';
import {getAdminAccount} from '../../../support/env';

import {getRandomId, stubClipboard} from '../../../utils';

describe('Sidebar channel menu', () => {
    const sysadmin = getAdminAccount();
    const townSquare = 'Town Square';

    let teamName;
    let userName;

    before(() => {
        cy.apiInitSetup({loginAfter: true}).then(({team, user}) => {
            teamName = team.name;
            userName = user.username;

            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T3349_1 should be able to mark a channel as read', () => {
        // # Start in Town Square
        cy.uiGetLHS().within(() => {
            cy.findByText(townSquare).should('be.visible');
        });
        cy.get('#channelHeaderTitle').should('contain', townSquare);

        // # Save the ID of the Town Square channel for later
        cy.getCurrentChannelId().as('townSquareId');

        // # Switch to the Off Topic channel
        cy.get('#sidebarItem_off-topic').click();
        cy.get('#channelHeaderTitle').should('contain', 'Off-Topic');

        // # Have another user send a message in the Town Square
        cy.get('@townSquareId').then((townSquareId) => {
            cy.postMessageAs({
                sender: sysadmin,
                message: 'post1',
                channelId: `${townSquareId}`,
            });
        });

        // * Verify that the Town Square channel is now unread
        cy.get('#sidebarItem_town-square').should(beUnread);

        // # Open the channel menu and select the Mark as Read option
        cy.uiGetChannelSidebarMenu(townSquare).within(() => {
            cy.findByText('Mark as Read').click();
        });

        // * Verify that the Town Square channel is now read
        cy.get('#sidebarItem_town-square').should(beRead);
    });

    it('MM-T3349_2 should be able to favorite/unfavorite a channel', () => {
        // * Verify that the channel starts in the CHANNELS category
        cy.uiGetLhsSection('CHANNELS').findByText(townSquare).should('be.visible');

        // # Open the channel menu and select the Favorite option
        cy.uiGetChannelSidebarMenu(townSquare).within(() => {
            cy.findByText('Favorite').click();
        });

        // * Verify that the channel has moved to the FAVORITES category
        cy.uiGetLhsSection('FAVORITES').findByText(townSquare).should('be.visible');

        // # Open the channel menu and select the Unfavorite option
        cy.uiGetChannelSidebarMenu(townSquare).within(() => {
            cy.findByText('Unfavorite').click();
        });

        // * Verify that the channel has moved back to the CHANNELS category
        cy.uiGetLhsSection('CHANNELS').findByText(townSquare).should('be.visible');
    });

    it('MM-T3349_3 should be able to mute/unmute a channel', () => {
        // * Verify that the channel starts unmuted
        cy.get('#sidebarItem_town-square').should(beUnmuted);

        // # Open the channel menu and select the Mute Channel option
        cy.uiGetChannelSidebarMenu(townSquare).within(() => {
            cy.findByText('Mute Channel').click();
        });

        // * Verify that the channel is now muted
        cy.get('#sidebarItem_town-square').should(beMuted);

        // # Open the channel menu and select the Unmute Channel option
        cy.uiGetChannelSidebarMenu(townSquare).within(() => {
            cy.findByText('Unmute Channel').click();
        });

        // // * Verify that the channel is no longer muted
        cy.get('#sidebarItem_town-square').should(beUnmuted);
    });

    it('MM-T3349_4 should be able to move channels between categories', () => {
        const categoryName = `new-${getRandomId()}`;

        // * Verify that the channel starts in the CHANNELS category
        cy.uiGetLhsSection('CHANNELS').findByText(townSquare).should('be.visible');

        // # Move the channel into a new category
        cy.uiMoveChannelToCategory(townSquare, categoryName, true);

        // * Verify that Town Square has moved into the new category
        cy.uiGetLhsSection(categoryName).findByText(townSquare).should('be.visible');
        cy.uiGetLhsSection('CHANNELS').findByText(townSquare).should('not.exist');

        // # Move the channel back to Channels
        cy.uiMoveChannelToCategory(townSquare, 'Channels');

        // * Verify that Town Square has moved back to Channels
        cy.uiGetLhsSection(categoryName).findByText(townSquare).should('not.exist');
        cy.uiGetLhsSection('CHANNELS').findByText(townSquare).should('be.visible');
    });

    it('MM-T3349_5 should be able to copy the channel link', () => {
        stubClipboard().as('clipboard');

        // # Open the channel menu and select the Copy Link option
        cy.uiGetChannelSidebarMenu(townSquare).within(() => {
            cy.findByText('Copy Link').click();
        });

        // Ensure that the clipboard contents are correct
        cy.get('@clipboard').its('wasCalled').should('eq', true);
        cy.location().then((location) => {
            cy.get('@clipboard').its('contents').should('eq', `${location.origin}/${teamName}/channels/town-square`);
        });
    });

    it('MM-T3349_6 should be able to open the add other users to the channel', () => {
        // # Open the channel menu and select the Add Members option
        cy.uiGetChannelSidebarMenu(townSquare).within(() => {
            cy.findByText('Add Members').click();
        });

        // * Verify that the modal appears and then close it
        cy.get('#addUsersToChannelModal').should('be.visible').findByText('Add people to Town Square');
        cy.uiClose();
    });

    it('MM-T3350 Mention badge should remain hidden as long as the channel/dm/gm menu is open', () => {
        // # Start in Town Square
        cy.get('#sidebarItem_town-square').click();
        cy.get('#channelHeaderTitle').should('contain', townSquare);

        // # Save the ID of the Town Square channel for later
        cy.getCurrentChannelId().as('townSquareId');

        // # Switch to the Off Topic channel
        cy.get('#sidebarItem_off-topic').click();
        cy.get('#channelHeaderTitle').should('contain', 'Off-Topic');

        // # Have another user send a message in the Town Square
        cy.get('@townSquareId').then((townSquareId) => {
            cy.postMessageAs({
                sender: sysadmin,
                message: `@${userName} post1`,
                channelId: `${townSquareId}`,
            });
        });

        // * Verify that a mention badge appears
        cy.get('#sidebarItem_town-square .badge').should('be.visible');

        // # Open the channel menu
        cy.get('#sidebarItem_town-square').find('.SidebarMenu_menuButton').click({force: true});

        // * Verify that the mention badge disappears
        cy.get('#sidebarItem_town-square .badge').should('not.be.visible');
    });
});
