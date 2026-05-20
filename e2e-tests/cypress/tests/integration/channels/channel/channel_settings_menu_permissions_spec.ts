// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel @channel_settings @permissions

import {Team} from '@mattermost/types/teams';
import {Channel} from '@mattermost/types/channels';
import {UserProfile} from '@mattermost/types/users';

describe('Channel Settings Menu Permissions', () => {
    let testTeam: Team;
    let testChannel: Channel;
    let admin: UserProfile;
    let user: UserProfile;

    before(() => {
        // # Create a test team, channel, and admin user
        cy.apiInitSetup({promoteNewUserAsAdmin: true}).then(({team, user: newAdmin, channel}) => {
            testTeam = team;
            admin = newAdmin;
            testChannel = channel;

            // # Create a regular user
            cy.apiCreateUser().then(({user: newUser}) => {
                user = newUser;
                cy.apiAddUserToTeam(team.id, newUser.id).then(() => {
                    cy.apiAddUserToChannel(channel.id, newUser.id);
                });
            });

            // # Change permission so that regular users can't access channel settings
            cy.apiGetRolesByNames(['channel_user']).then(({roles}) => {
                const role = roles[0];
                const permissions = role.permissions.filter((permission) => {
                    return !(['manage_public_channel_properties', 'manage_private_channel_properties', 'manage_public_channel_banner', 'manage_private_channel_banner', 'delete_public_channel', 'delete_private_channel'].includes(permission));
                });

                if (permissions.length !== role.permissions.length) {
                    cy.apiPatchRole(role.id, {permissions});
                }
            });

            cy.apiLogin(admin);
        });
    });

    it('MM-T1001: Channel Settings menu is visible for users with permissions', () => {
        // # Login as the admin user
        cy.apiLogin(admin);

        // # Visit the channel
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Open channel header menu
        cy.get('#channelHeaderDropdownButton').click();

        // * Verify Channel Settings option is visible
        cy.findByText('Channel Settings').should('be.visible');
    });

    it('MM-T1002: Channel Settings menu is hidden for users without permissions', () => {
        // # Login as the regular user
        cy.apiLogin(user);

        // # Visit the channel
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Open channel header menu
        cy.get('#channelHeaderDropdownButton').click();

        // * Verify Channel Settings option is not visible
        cy.findByText('Channel Settings').should('not.exist');
    });
});
