// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channel_sidebar

import {getRandomId} from '../../utils';

describe('New category badge', () => {
    before(() => {
        // # Login as test user and visit town-square
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T3312 should show the new badge until a channel is added to the category', () => {
        const categoryName = `new-${getRandomId()}`;

        // # Create a new category
        cy.uiCreateSidebarCategory(categoryName).as('newCategory');

        cy.contains('.SidebarChannelGroup', categoryName, {matchCase: false}).within(() => {
            // * Verify that the new category has been added to the sidebar and that it has the required badge and drop target
            cy.get('.SidebarCategory_newLabel').should('be.visible');
            cy.get('.SidebarCategory_newDropBox').should('be.visible');
        });

        // # Move Town Square into the new category
        cy.uiMoveChannelToCategory('Town Square', categoryName);

        cy.contains('.SidebarChannelGroup', categoryName, {matchCase: false}).within(() => {
            // * Verify that the new category badge and drop target have been removed
            cy.get('.SidebarCategory_newLabel').should('not.exist');
            cy.get('.SidebarCategory_newDropBox').should('not.exist');
        });

        // # Move Town Square out of the new category
        cy.uiMoveChannelToCategory('Town Square', 'Channels');

        cy.contains('.SidebarChannelGroup', categoryName, {matchCase: false}).within(() => {
            // * Verify that Town Square has moved out of the new category
            cy.get('#sidebarItem_town-square').should('not.exist');

            // * Verify that the new category badge and drop target did not reappear
            cy.get('.SidebarCategory_newLabel').should('not.exist');
            cy.get('.SidebarCategory_newDropBox').should('not.exist');
        });
    });
});
