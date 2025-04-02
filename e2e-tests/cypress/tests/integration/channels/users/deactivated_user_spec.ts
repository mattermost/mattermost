// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @system_console @user_management

import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';

describe('Deactivated user', () => {
    let testUser: UserProfile;
    let adminUser: UserProfile;
    let testTeam: Team;
    let personalAccessToken: string;

    before(() => {
        // # Set up admin user and team
        cy.apiInitSetup({loginAfter: true, promoteNewUserAsAdmin: true}).then(({user, team}) => {
            adminUser = user;
            testTeam = team;

            // # Enable Personal Access Token And User Deactivation
            cy.apiUpdateConfig({
                ServiceSettings: {
                    EnableUserAccessTokens: true,
                },
                TeamSettings: {
                    EnableUserDeactivation: true,
                },
            });
        });
    });

    it('should not allow API access with PAT after user deactivation', () => {
        // # Login as admin
        cy.apiLogin(adminUser);

        // # Create a new user
        cy.apiCreateUser().then(({user}) => {
            testUser = user;

            // # Add user to team
            cy.apiAddUserToTeam(testTeam.id, user.id);

            // # Grant user permission to create personal access tokens
            cy.apiPatchUserRoles(testUser.id, ['system_user', 'system_user_access_token']);

            // # Logout admin
            cy.apiLogout();

            // # Login as the test user
            cy.apiLogin(testUser);

            // # Navigate to the home page
            cy.visit('/');

            // # Create a personal access token as the test user
            const tokenName = 'token' + Date.now();

            // # Generate a personal access token via API
            cy.apiAccessToken(testUser.id, tokenName).then((token) => {
                personalAccessToken = token.token;

                // # Replace the auth cookie with the PAT
                cy.setCookie('MMAUTHTOKEN', personalAccessToken);

                // # Reload the page to use the PAT for authentication
                cy.visit('/');

                // * Verify the auth cookie has been set with the PAT
                cy.getCookie('MMAUTHTOKEN').
                    should('have.property', 'value', personalAccessToken);

                // * Verify we're still logged in using the PAT
                cy.get('#sidebarItem_town-square').should('be.visible');

                // # Make an API request using the PAT
                cy.request({
                    headers: {
                        Authorization: `Bearer ${personalAccessToken}`,
                    },
                    url: '/api/v4/users/me',
                    method: 'GET',
                }).then((response) => {
                    // * Verify the request was successful
                    expect(response.status).to.equal(200);

                    // * Verify the response contains the correct user ID
                    expect(response.body.id).to.equal(testUser.id);
                });

                // # Use an admin client to deactivate the user
                cy.makeClient({user: adminUser}).then((client) => {
                    // # Deactivate the test user
                    client.updateUserActive(testUser.id, false).then(() => {
                        // # Try to use the PAT after user deactivation
                        cy.request({
                            headers: {
                                Authorization: `Bearer ${personalAccessToken}`,
                            },
                            url: '/api/v4/users/me',
                            method: 'GET',
                            failOnStatusCode: false,
                        }).then((response) => {
                            // * Verify the request fails with 401 Unauthorized
                            expect(response.status).to.equal(401);
                        });

                        // # Try to navigate back to the channel
                        cy.visit(`/${testTeam.name}/channels/town-square`);

                        // * Verify we are redirect to the login page
                        cy.url().should('include', '/login');
                    });
                });
            });
        });
    });
});
