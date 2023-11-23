// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {clickCategoryMenuItem} from './helpers';

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel_sidebar

describe('Sidebar category menu', () => {
    before(() => {
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T3171_1 Verify that the 3-dot menu on the Channels Category contains an option to Create New Category', () => {
        clickCategoryMenuItem('CHANNELS', 'Create New Category');

        cy.get('body').type('{esc}', {force: true});
    });

    it('MM-T3171_2 Verify that the 3-dot menu on the Favourites Category contains an option to Create New Category, and that the Create New Category modal shows', () => {
        // * Verify that the channel starts in the CHANNELS category
        cy.contains('.SidebarChannelGroup', 'CHANNELS').as('channelsCategory');
        cy.get('@channelsCategory').find('#sidebarItem_town-square');

        // # Open the channel menu and select the Favorite option
        cy.uiGetChannelSidebarMenu('Town Square').within(() => {
            cy.findByText('Favorite').click();
        });

        // * Verify that the channel has moved to the FAVORITES category
        cy.contains('.SidebarChannelGroup', 'FAVORITES').find('#sidebarItem_town-square');

        // # Verify that Create New Category exists on Favorites category and click on it
        clickCategoryMenuItem('FAVORITES', 'Create New Category');

        cy.get('body').type('{esc}', {force: true});
    });
});
