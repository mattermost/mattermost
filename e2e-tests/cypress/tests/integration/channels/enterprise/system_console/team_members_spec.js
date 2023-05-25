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

describe('Team members test', () => {
    let testTeam;
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
            testTeam = team;

            cy.apiCreateUser().then(({user: otherUser}) => {
                user2 = otherUser;

                cy.apiAddUserToTeam(testTeam.id, user2.id).then(() => {
                    cy.apiAddUserToChannel(channel.id, user2.id);
                });
            });
        });
    });

    it('MM-23938 - Team members block is only visible when team is not group synced', () => {
        // # Visit the team page
        cy.visit(`/admin_console/user_management/teams/${testTeam.id}`);

        // * Assert that the members block is visible on non group synced team
        cy.get('#teamMembers').scrollIntoView().should('be.visible');

        // # Click the sync group members switch
        cy.findByTestId('syncGroupSwitch').
            scrollIntoView().
            findByRole('button').
            click({force: true});

        // * Assert that the members block is no longer visible
        cy.get('#teamMembers').should('not.exist');
    });

    it('MM-23938 - Team members block can search for users, remove users, add users and modify their roles', () => {
        // # Visit the team page
        cy.visit(`/admin_console/user_management/teams/${testTeam.id}`);

        // * Assert that the members block is visible on non group synced team
        cy.get('#teamMembers').scrollIntoView().should('be.visible');

        // # Search for user1 that we know is in the team
        searchFor(user1.email);

        // # Wait till loading complete and then remove the only visible user
        cy.get('#teamMembers .DataGrid_loading').should('not.exist');
        cy.get('#teamMembers .UserGrid_removeRow a').should('be.visible').click();

        // # Attempt to save
        cy.get('#saveSetting').click();

        // * Assert that confirmation modal contains the right message
        cy.get('#confirmModalBody').should('be.visible').and('contain', '1 user will be removed.').and('contain', 'Are you sure you wish to remove this user?');

        // # Cancel
        cy.get('#cancelModalButton').click();

        // # Search for user2 that we know is in the team
        searchFor(user2.email);

        // # Wait till loading complete and then remove the only visible user
        cy.get('#teamMembers .DataGrid_loading').should('not.exist');
        cy.get('#teamMembers .UserGrid_removeRow a').should('be.visible').click();

        // # Attempt to save
        cy.get('#saveSetting').click();

        // * Assert that confirmation modal contains the right message
        cy.get('#confirmModalBody').should('be.visible').and('contain', '2 users will be removed.').and('contain', 'Are you sure you wish to remove these users?');

        // # Confirm Save
        cy.get('#confirmModalButton').click();

        // # Check that the members block is no longer visible meaning that the save has succeeded and we were redirected out
        cy.get('#teamMembers').should('not.exist');

        // # Visit the team page
        cy.visit(`/admin_console/user_management/teams/${testTeam.id}`);

        // # Search for user1 that we know is no longer in the team
        searchFor(user1.email);

        // * Assert that no matching users found
        cy.get('#teamMembers .DataGrid_rows').should('contain', 'No users found');

        // # Search for user2 that we know is no longer in the team
        searchFor(user2.email);

        // * Assert that no matching users found
        cy.get('#teamMembers .DataGrid_rows').should('contain', 'No users found');

        // # Open the add members modal
        cy.get('#addTeamMembers').click();

        // # Enter user1 and user2 emails
        cy.get('#addUsersToTeamModal input').typeWithForce(`${user1.email}{enter}${user2.email}{enter}`);

        // # Confirm add the users
        cy.get('#addUsersToTeamModal #saveItems').click();

        // # Search for user1
        searchFor(user1.email);

        // * Assert that the user is now added to the members block and contains text denoting that they are New
        cy.get('#teamMembers .DataGrid_rows').children(0).should('contain', user1.email).and('contain', 'New');

        // # Open the user role dropdown menu
        cy.get(`#userGridRoleDropdown_${user1.username}`).click();

        // * Verify that the menu is opened
        cy.get('.Menu__content').should('be.visible').within(() => {
            // # Make the user an admin
            cy.findByText('Make Team Admin').should('be.visible').click();
        });

        // # Search for user2
        searchFor(user2.email);

        // * Assert that the user is now added to the members block and contains text denoting that they are New
        cy.get('#teamMembers .DataGrid_rows').children(0).should('contain', user2.email).and('contain', 'New');

        // # Search for sysadmin
        searchFor(sysadmin.email);

        // * Assert that searching for users after adding users returns only relevant search results
        cy.get('#teamMembers .DataGrid_rows').children(0).should('contain', sysadmin.email);

        // # Attempt to save
        saveConfig();

        // # Visit the team page
        cy.visit(`/admin_console/user_management/teams/${testTeam.id}`);

        // # Search user1 that we know is now in the team again
        searchFor(user1.email);
        cy.get('#teamMembers .DataGrid_loading').should('not.exist');

        // * Assert that the user is now saved as an admin
        cy.get('#teamMembers .DataGrid_rows').children(0).should('contain', user1.email).and('not.contain', 'New').and('contain', 'Team Admin');

        // # Open the user role dropdown menu
        cy.get(`#userGridRoleDropdown_${user1.username}`).click();

        // * Verify that the menu is opened
        cy.get('.Menu__content').should('be.visible').within(() => {
            // # Make the user a regular member again
            cy.findByText('Make Team Member').should('be.visible').click();
        });

        // * Assert user1 is now back to being a regular member
        cy.get('#teamMembers .DataGrid_rows').children(0).should('contain', user1.email).and('not.contain', 'New').and('contain', 'Member');

        // # Search user2 that we know is now in the team again
        searchFor(user2.email);
        cy.get('#teamMembers .DataGrid_loading').should('not.exist');

        // * Assert user2 is now saved as a regular member
        cy.get('#teamMembers .DataGrid_rows').children(0).should('contain', user2.email).and('not.contain', 'New').and('contain', 'Member');

        // # Attempt to save
        saveConfig();
    });
});

function searchFor(searchTerm) {
    cy.get('#teamMembers .DataGrid_search input[type="text"]').scrollIntoView().clear().type(searchTerm);
    cy.wait(TIMEOUTS.HALF_SEC); // Timeout required to wait for timeout that happens when search input changes
}

function saveConfig() {
    // # Click save
    cy.get('#saveSetting').click();

    // # Check that the members block is no longer visible meaning that the save has succeeded and we were redirected out
    cy.get('#teamMembers').should('not.exist');
}
