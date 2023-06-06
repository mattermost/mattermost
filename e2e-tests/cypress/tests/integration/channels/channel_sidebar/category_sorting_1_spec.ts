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
import {getRandomId} from '../../../utils';

import {clickSortCategoryMenuItem} from './helpers';

let testTeam;
let testUser;

describe('Category sorting', () => {
    beforeEach(() => {
        // # Login as test user and visit town-square
        cy.apiAdminLogin();
        cy.apiInitSetup({loginAfter: true}).then(({team, user}) => {
            testTeam = team;
            testUser = user;
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T3834 Category sorting -- KNOWN ISSUE: MM-43576', () => {
        const channelNames = [];
        const categoryName = createCategoryFromSidebarMenu();

        // # Create 5 channels and add them to a custom category
        for (let i = 0; i < 5; i++) {
            channelNames.push(createChannelAndAddToCategory(categoryName));
            cy.get('#SidebarContainer .scrollbar--view').scrollTo('bottom', {ensureScrollable: false});
        }

        // # Sort alphabetically
        clickSortCategoryMenuItem(categoryName, 'Alphabetically');

        // * Verify channels are sorted alphabetically
        verifyAlphabeticalSortingOrder(categoryName, channelNames.length);

        // # Add another channel
        channelNames.push(createChannelAndAddToCategory(categoryName));
        cy.get('#SidebarContainer .scrollbar--view').scrollTo('bottom', {ensureScrollable: false});

        // * Verify channels are still sorted alphabetically
        verifyAlphabeticalSortingOrder(categoryName, channelNames.length);

        // # Sort by recency
        clickSortCategoryMenuItem(categoryName, 'Recent activity');

        // # Sort channel names in reverse order that they were created (ie. most recent to least)
        let sortedByRecencyChannelNames = channelNames.concat().reverse();
        for (let i = 0; i < channelNames.length; i++) {
            // * Verify that the channels are in reverse order that they were created
            cy.get(`.SidebarChannelGroup:contains(${categoryName}) .NavGroupContent li:nth-child(${i + 1}) a[id^="sidebarItem_${sortedByRecencyChannelNames[i]}"]`).should('be.visible');
        }

        // # Add another channel
        channelNames.push(createChannelAndAddToCategory(categoryName));
        cy.get('#SidebarContainer .scrollbar--view').scrollTo('bottom', {ensureScrollable: false});

        // # Sort channel names in reverse order that they were created (ie. most recent to least)
        sortedByRecencyChannelNames = channelNames.concat().reverse();
        for (let i = 0; i < channelNames.length; i++) {
            // * Verify that the channels are still in reverse order that they were created
            cy.get(`.SidebarChannelGroup:contains(${categoryName}) .NavGroupContent li:nth-child(${i + 1}) a[id^="sidebarItem_${sortedByRecencyChannelNames[i]}"]`).should('be.visible');
        }

        // # Click on channel options of the oldest from the category
        cy.get(`.SidebarChannelGroup:contains(${categoryName}) .NavGroupContent a[id^="sidebarItem_${channelNames[0]}"]`).should('be.visible').within(() => {
            // # Open dropdown next to channel name
            cy.get('.SidebarMenu').invoke('show').get('.SidebarMenu_menuButton').should('be.visible').click({force: true});
        });

        // # Open the channel menu, select Move to
        cy.findAllByRole('menu', {name: 'Edit channel menu'}).should('be.visible').within(() => {
            cy.findByText('Move to...').should('be.visible').trigger('mouseover');
        });

        // # Click on move to favorites
        cy.findAllByRole('menu', {name: 'Move to submenu'}).should('be.visible').within(() => {
            cy.findByText('Favorites').should('be.visible').click({force: true});
        });

        // * Verify the channel is now in Favourites
        cy.get(`.SidebarChannelGroup:contains(FAVORITES) .NavGroupContent a[id^="sidebarItem_${channelNames[0]}"]`).should('be.visible');
        channelNames.shift();

        // # Sort manually
        clickSortCategoryMenuItem(categoryName, 'Manually');

        // # Add another channel
        channelNames.push(createChannelAndAddToCategory(categoryName));
        cy.get('#SidebarContainer .scrollbar--view').scrollTo('bottom', {ensureScrollable: false});

        // * Verify that the channel has been placed at the bottom of the category
        cy.get(`.SidebarChannelGroup:contains(${categoryName}) .NavGroupContent li:nth-child(1) a[id^="sidebarItem_${channelNames[channelNames.length - 1]}"]`).should('be.visible');
    });
});

function createChannelAndAddToCategory(categoryName) {
    const channelName = `channel-${getRandomId()}`;
    const userId = testUser.id;
    cy.apiCreateChannel(testTeam.id, channelName, 'New Test Channel').then(({channel}) => {
        // # Add the user to the channel
        cy.apiAddUserToChannel(channel.id, userId).then(() => {
            // # Move to a new category
            cy.uiMoveChannelToCategory(channel.display_name, categoryName);
        });
    });
    return channelName;
}

function verifyAlphabeticalSortingOrder(categoryName, length) {
    // # Go through each channel to get its name
    const sortedAlphabeticalChannelNames = [];
    for (let i = 0; i < length; i++) {
        // Grab the elements in the order that they appear in the sidebar
        cy.get(`.SidebarChannelGroup:contains(${categoryName}) .NavGroupContent li:nth-child(${i + 1}) .SidebarChannelLinkLabel`).should('be.visible').invoke('text').then((text) => {
            sortedAlphabeticalChannelNames.push(text);

            // # Sort the names manually
            const comparedSortedChannelNames = sortedAlphabeticalChannelNames.concat().sort((a, b) => a.localeCompare(b, 'en', {numeric: true}));

            // * Verify that the sorted order matches the order they were already in
            assert.deepEqual(sortedAlphabeticalChannelNames, comparedSortedChannelNames);
        });
    }
}

function createCategoryFromSidebarMenu() {
    // # Start with a new category
    const categoryName = `category-${getRandomId()}`;

    // # Click on the sidebar menu dropdown
    cy.uiGetLHSAddChannelButton().click();

    // # Click on create category link
    cy.findByText('Create new category').should('be.visible').click();

    // # Verify that Create Category modal has shown up.
    // # Wait for a while until the modal has fully loaded, especially during first-time access.
    cy.get('#editCategoryModal').should('be.visible').wait(TIMEOUTS.HALF_SEC).within(() => {
        cy.findByText('Create New Category').should('be.visible');

        // # Enter category name and hit enter
        cy.findByPlaceholderText('Name your category').should('be.visible').type(categoryName).type('{enter}');
    });

    return categoryName;
}
