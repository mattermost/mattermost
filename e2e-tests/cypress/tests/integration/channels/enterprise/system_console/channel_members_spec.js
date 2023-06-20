// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise

import * as TIMEOUTS from '../../../../fixtures/timeouts';

describe('Channel members test', () => {
    let testChannel;
    let user1;
    let user2;
    let sysadmin;

    before(() => {
        // # Login as sysadmin
        cy.apiAdminLogin().then((res) => {
            sysadmin = res.user;
        });

        // * Check if server has license
        cy.apiRequireLicense();

        cy.apiInitSetup().then(({team, channel, user}) => {
            user1 = user;
            testChannel = channel;

            cy.apiCreateUser().then(({user: newUser}) => {
                user2 = newUser;

                cy.apiAddUserToTeam(team.id, user2.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, user2.id);
                });
            });
        });
    });

    it('MM-23938 - Channel members block is only visible when channel is not group synced', () => {
        // # Visit the channel page
        cy.visit(`/admin_console/user_management/channels/${testChannel.id}`);

        // * Assert that the members block is visible on non group synced channel
        cy.get('#channelMembers').scrollIntoView().should('be.visible');

        // # Click the sync group members switch
        cy.findByTestId('syncGroupSwitch').
            scrollIntoView().
            findByRole('button').
            click({force: true});

        // * Assert that the members block is no longer visible
        cy.get('#channelMembers').should('not.exist');
    });

    it('MM-23938 - Channel Members block can search for users, remove users, add users and modify their roles', () => {
        // # Visit the channel page
        cy.visit(`/admin_console/user_management/channels/${testChannel.id}`);

        // * Assert that the members block is visible on non group synced team
        cy.get('#channelMembers').scrollIntoView().should('be.visible');

        // # Search for user1 that we know is in the team
        searchFor(user1.email);

        // # Wait till loading complete and then remove the only visible user
        cy.get('#channelMembers .DataGrid_loading').should('not.exist');
        cy.get('#channelMembers .UserGrid_removeRow a').should('be.visible').click();

        // # Attempt to save
        cy.get('#saveSetting').click();

        // * Assert that confirmation modal contains the right message
        cy.get('#confirmModalBody').should('be.visible').and('contain', '1 user will be removed.').and('contain', 'Are you sure you wish to remove this user?');

        // # Cancel
        cy.get('#cancelModalButton').click();

        // # Search for user2 that we know is in the team
        searchFor(user2.email);

        // # Wait till loading complete and then remove the only visible user
        cy.get('#channelMembers .DataGrid_loading').should('not.exist');
        cy.get('#channelMembers .UserGrid_removeRow a').should('be.visible').click();

        // # Attempt to save
        cy.get('#saveSetting').click();

        // * Assert that confirmation modal contains the right message
        cy.get('#confirmModalBody').should('be.visible').and('contain', '2 users will be removed.').and('contain', 'Are you sure you wish to remove these users?');

        // # Confirm Save
        cy.get('#confirmModalButton').click();

        // # Check that the members block is no longer visible meaning that the save has succeeded and we were redirected out
        cy.get('#channelMembers').should('not.exist');

        // # Visit the channel page
        cy.visit(`/admin_console/user_management/channels/${testChannel.id}`);

        // # Search for user1 that we know is no longer in the team
        searchFor(user1.email);

        // * Assert that no matching users found
        cy.get('#channelMembers .DataGrid_rows').should('contain', 'No users found');

        // # Search for user2 that we know is no longer in the team
        searchFor(user2.email);

        // * Assert that no matching users found
        cy.get('#channelMembers .DataGrid_rows').should('contain', 'No users found');

        // # Open the add members modal
        cy.get('#addChannelMembers').click();

        // # Enter user1 and user2 emails
        cy.findByRole('textbox', {name: 'Search for people'}).typeWithForce(`${user1.email}{enter}${user2.email}{enter}`);

        // # Confirm add the users
        cy.get('#addUsersToChannelModal #saveItems').click();

        // # Search for user1
        searchFor(user1.email);

        // * Assert that the user is now added to the members block and contains text denoting that they are New
        cy.get('#channelMembers .DataGrid_rows').children(0).should('contain', user1.email).and('contain', 'New');

        // # Open the user role dropdown menu
        cy.get(`#userGridRoleDropdown_${user1.username}`).click();

        // * Verify that the menu is opened
        cy.get('.Menu__content').should('be.visible').within(() => {
            // # Make the user an admin
            cy.findByText('Make Channel Admin').should('be.visible');
            cy.findByText('Make Channel Admin').click();
        });

        // # Search for user2
        searchFor(user2.email);

        // * Assert that the user is now added to the members block and contains text denoting that they are New
        cy.get('#channelMembers .DataGrid_rows').children(0).should('contain', user2.email).and('contain', 'New');

        // # Search for sysadmin
        searchFor(sysadmin.email);

        // * Assert that searching for users after adding users returns only relevant search results
        cy.get('#channelMembers .DataGrid_rows').children(0).should('contain', sysadmin.email);

        // # Attempt to save
        saveConfig();

        // # Visit the channel page
        cy.visit(`/admin_console/user_management/channels/${testChannel.id}`);

        // # Search user1 that we know is now in the team again
        searchFor(user1.email);
        cy.get('#channelMembers .DataGrid_loading').should('not.exist');

        // * Assert that the user is now saved as an admin
        cy.get('#channelMembers .DataGrid_rows').children(0).should('contain', user1.email).and('not.contain', 'New').and('contain', 'Channel Admin');

        // # Open the user role dropdown menu
        cy.get(`#userGridRoleDropdown_${user1.username}`).click();

        // * Verify that the menu is opened
        cy.get('.Menu__content').should('be.visible').within(() => {
            // # Make the user a regular member again
            cy.findByText('Make Channel Member').should('be.visible').click();
        });

        // * Assert user1 is now back to being a regular member
        cy.get('#channelMembers .DataGrid_rows').children(0).should('contain', user1.email).and('not.contain', 'New').and('contain', 'Member');

        // # Search user2 that we know is now in the team again
        searchFor(user2.email);
        cy.get('#channelMembers .DataGrid_loading').should('not.exist');

        // * Assert user2 is now saved as a regular member
        cy.get('#channelMembers .DataGrid_rows').children(0).should('contain', user2.email).and('not.contain', 'New').and('contain', 'Member');

        // # Attempt to save
        saveConfig();
    });
});

function saveConfig() {
    // # Click save
    cy.get('#saveSetting').click();

    // # Check that the members block is no longer visible meaning that the save has succeeded and we were redirected out
    cy.get('#channelMembers').should('not.exist');
}

function searchFor(searchTerm) {
    cy.get('#channelMembers .DataGrid_search input[type="text"]').scrollIntoView().clear().type(searchTerm);
    cy.wait(TIMEOUTS.HALF_SEC); // Timeout required to wait for timeout that happens when search input changes
}
