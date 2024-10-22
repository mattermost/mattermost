// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @channel

import {UserProfile} from '@mattermost/types/users';
import {getAdminAccount} from '../../../support/env';

const demoteToChannelMember = (user, channelId, admin) => {
    cy.externalRequest({
        user: admin,
        method: 'put',
        path: `channels/${channelId}/members/${user.id}/schemeRoles`,
        data: {
            scheme_user: true,
            scheme_admin: false,
        },
    });
};

const promoteToChannelAdmin = (user, channelId, admin) => {
    cy.externalRequest({
        user: admin,
        method: 'put',
        path: `channels/${channelId}/members/${user.id}/schemeRoles`,
        data: {
            scheme_user: true,
            scheme_admin: true,
        },
    });
};

describe('Change Roles', () => {
    const admin = getAdminAccount();
    let testUser: UserProfile;
    let testChannelId: string;

    beforeEach(() => {
        // # Login as test user and visit test channel
        cy.apiInitSetup().then(({team, user, channel}) => {
            testUser = user;
            testChannelId = channel.id;

            cy.apiCreateUser().then(({user: otherUser}) => {
                cy.apiAddUserToTeam(team.id, otherUser.id);
            });

            // # Change permission so that regular users can't change channels or add members
            cy.apiGetRolesByNames(['channel_user']).then(({roles}) => {
                const role = roles[0];
                const permissions = role.permissions.filter((permission) => {
                    return !(['manage_public_channel_members', 'manage_private_channel_members', 'manage_public_channel_properties', 'manage_private_channel_properties'].includes(permission));
                });

                if (permissions.length !== role.permissions.length) {
                    cy.apiPatchRole(role.id, {permissions});
                }
            });

            cy.apiLogin(testUser);
            cy.visit(`/${team.name}/channels/${channel.name}`);

            // # Make user a regular member for channel and system
            cy.externalUpdateUserRoles(user.id, 'system_user');
            demoteToChannelMember(testUser, testChannelId, admin);

            // # Reload page to ensure no cache or saved information
            cy.reload(true);
        });
    });

    it('MM-T4174 User role to channel admin/member updates channel member modal immediately without refresh', () => {
        // # Go to member modal
        cy.uiGetChannelMemberButton().click();
        cy.uiGetRHS().findByText('Manage').should('not.exist');

        // Promote user to a channel admin
        promoteToChannelAdmin(testUser, testChannelId, admin);

        // * Check to see if a dropdown exists now
        cy.uiGetRHS().findByText('Manage').should('be.visible');
    });
});
