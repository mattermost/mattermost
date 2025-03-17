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

describe('Category sorting', () => {
    beforeEach(() => {
        // # Login as test user and visit town-square
        cy.apiAdminLogin();
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T3916 Create Category character limit', () => {
        // # Click on the sidebar menu dropdown and select Create Category
        cy.uiBrowseOrCreateChannel('Create new category');

        // # Add a name 26 characters in length e.g `abcdefghijklmnopqrstuvwxyz`
        cy.get('#editCategoryModal').should('be.visible').wait(TIMEOUTS.HALF_SEC).within(() => {
            cy.findByText('Create New Category').should('be.visible');

            // # Enter category name
            cy.findByPlaceholderText('Name your category').should('be.visible').type('abcdefghijklmnopqrstuvwxyz');
        });

        // * Verify error state and negative character count at the end of the textbox based on the number of characters the user has exceeded
        cy.get('#editCategoryModal .MaxLengthInput.has-error').should('be.visible');
        cy.get('#editCategoryModal .MaxLengthInput__validation').should('be.visible').should('contain', '-4');

        // * Verify Create button is disabled.
        cy.get('#editCategoryModal .GenericModal__button.confirm').should('be.visible').should('be.disabled');

        // # Use backspace to remove 4 characters
        cy.get('#editCategoryModal .MaxLengthInput').should('be.visible').type('{backspace}{backspace}{backspace}{backspace}');

        // * Verify error state and negative character count at the end of the textbox are no longer displaying
        cy.get('#editCategoryModal .MaxLengthInput.has-error').should('not.exist');
        cy.get('#editCategoryModal .MaxLengthInput__validation').should('not.exist');

        // * Verify Create button is enabled
        cy.get('#editCategoryModal .GenericModal__button.confirm').should('be.visible').should('not.be.disabled');

        // Click Create
        cy.get('#editCategoryModal .GenericModal__button.confirm').should('be.visible').click();

        // Verify new category is created
        cy.findByLabelText('abcdefghijklmnopqrstuv').should('be.visible');
    });

    // // Commented out since we've had to disable sticky headings because of issues with the menu components
    // it('MM-T3864 Sticky category headers', () => {
    //     const categoryName = createCategoryFromSidebarMenu();

    //     // # Move test channel to Favourites
    //     cy.get(`#sidebarItem_${testChannel.name}`).parent().then((element) => {
    //         // # Get id of the channel
    //         const id = element[0].getAttribute('data-rbd-draggable-id');
    //         cy.get(`#sidebarItem_${testChannel.name}`).parent('li').within(() => {
    //             // # Open dropdown next to channel name
    //             cy.get('.SidebarMenu').invoke('show').get('.SidebarMenu_menuButton').should('be.visible').click({force: true});

    //             // # Favourite the channel
    //             cy.get(`#favorite-${id} button`).should('be.visible').click({force: true});
    //         });
    //     });

    //     // # Create 15 channels and add them to a custom category
    //     for (let i = 0; i < 15; i++) {
    //         createChannelAndAddToCategory(categoryName);
    //         cy.get('#SidebarContainer .scrollbar--view').scrollTo('bottom', {ensureScrollable: false});
    //     }

    //     // # Create 10 channels and add them to Favourites
    //     for (let i = 0; i < 10; i++) {
    //         createChannelAndAddToFavourites();
    //         cy.get('#SidebarContainer .scrollbar--view').scrollTo('bottom', {ensureScrollable: false});
    //     }

    //     // # Scroll to the center of the channel list
    //     cy.get('#SidebarContainer .scrollbar--view').scrollTo('center', {ensureScrollable: false});

    //     // * Verify that both the 'More Unreads' label and the category header are visible
    //     cy.get('#unreadIndicatorTop').should('be.visible');
    //     cy.get('#SidebarContainer .SidebarChannelGroupHeader:contains(FAVORITES)').should('be.visible');

    //     // # Scroll to the bottom of the list
    //     cy.get('#SidebarContainer .scrollbar--view').scrollTo('bottom', {ensureScrollable: false});

    //     // * Verify that the 'More Unreads' label is still visible but the category is not
    //     cy.get('#unreadIndicatorTop').should('be.visible');
    //     cy.get('#SidebarContainer .SidebarChannelGroupHeader:contains(FAVORITES)').should('not.be.visible');
    // });
});

// // Commented out since we've had to disable sticky headings because of issues with the menu components
// function createChannelAndAddToFavourites() {
//     const userId = testUser.id;
//     cy.apiCreateChannel(testTeam.id, `channel-${getRandomId()}`, 'New Test Channel').then(({channel}) => {
//         // # Add the user to the channel
//         cy.apiAddUserToChannel(channel.id, userId).then(() => {
//             // # Move to a new category
//             cy.get(`#sidebarItem_${channel.name}`).parent().then((element) => {
//                 // # Get id of the channel
//                 const id = element[0].getAttribute('data-rbd-draggable-id');
//                 cy.get(`#sidebarItem_${channel.name}`).parent('li').within(() => {
//                     // # Open dropdown next to channel name
//                     cy.get('.SidebarMenu').invoke('show').get('.SidebarMenu_menuButton').should('be.visible').click({force: true});

//                     // # Favourite the channel
//                     cy.get(`#favorite-${id} button`).should('be.visible').click({force: true});
//                 });
//             });
//         });
//     });
// }
