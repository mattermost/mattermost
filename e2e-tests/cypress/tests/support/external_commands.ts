// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChannelMembership} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {TeamMembership} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {getAdminAccount} from './env';

import {getRandomId} from '../utils';

function externalActivateUser(userId: string, active = true) {
    const admin = getAdminAccount();

    return cy.externalRequest({user: admin, method: 'PUT', path: `users/${userId}/active`, data: {active}});
}
Cypress.Commands.add('externalActivateUser', externalActivateUser);

function externalAddUserToChannel(userId: string, channelId: string): Cypress.Chainable<ChannelMembership> {
    const admin = getAdminAccount();

    return cy.externalRequest({
        user: admin,
        method: 'POST',
        path: `channels/${channelId}/members`,
        data: {
            user_id: userId,
        },
    }).then((response) => response.data);
}
Cypress.Commands.add('externalAddUserToChannel', externalAddUserToChannel);

function externalAddUserToTeam(userId: string, teamId: string): Cypress.Chainable<TeamMembership> {
    const admin = getAdminAccount();

    return cy.externalRequest({
        user: admin,
        method: 'POST',
        path: `teams/${teamId}/members`,
        data: {
            team_id: teamId,
            user_id: userId,
        },
    }).then((response) => response.data);
}
Cypress.Commands.add('externalAddUserToTeam', externalAddUserToTeam);

function externalCreatePostAsUser(user: Pick<UserProfile, 'username' | 'password'>, post: Partial<Post>): Cypress.Chainable<Post> {
    return cy.externalRequest({
        user,
        method: 'POST',
        path: 'posts',
        data: post,
    }).then((response) => response.data);
}
Cypress.Commands.add('externalCreatePostAsUser', externalCreatePostAsUser);

function externalCreateUser(user: Partial<UserProfile>): Cypress.Chainable<UserProfile> {
    const admin = getAdminAccount();

    const randomValue = getRandomId();

    return cy.externalRequest({
        user: admin,
        method: 'POST',
        path: 'users',
        data: {
            username: 'user' + randomValue,
            email: 'email' + randomValue + '@example.mattermost.com',
            password: 'password' + randomValue,
            ...user,
        },
    }).then((response) => {
        // Re-add the password to the result so that we can make requests as that user
        return {
            ...response.data,
            password: 'password' + randomValue,
        };
    });
}
Cypress.Commands.add('externalCreateUser', externalCreateUser);

function externalUpdateUserRoles(userId: string, roles: string): Cypress.Chainable<unknown> {
    const admin = getAdminAccount();

    return cy.externalRequest({
        user: admin,
        method: 'PUT',
        path: `users/${userId}/roles`,
        data: {roles},
    });
}
Cypress.Commands.add('externalUpdateUserRoles', externalUpdateUserRoles);

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {

            /**
             * Makes an external request as a sysadmin and activate/deactivate a user directly via API
             * @param {String} userId - The user ID
             * @param {Boolean} active - Whether to activate or deactivate - true/false
             *
             * @example
             *   cy.externalActivateUser('user-id', false);
             */
            externalActivateUser: typeof externalActivateUser;

            /**
             * As the system admin, adds a user to a channel.
             */
            externalAddUserToChannel: typeof externalAddUserToChannel;

            /**
             * As the system admin, adds a user to a team.
             */
            externalAddUserToTeam: typeof externalAddUserToTeam;

            /**
             * As the given user, creates a post via the API.
             */
            externalCreatePostAsUser: typeof externalCreatePostAsUser;

            /**
             * As the system admin, creates a new user via the API. The user is automatically given a username, email,
             * and password, but the override parameter can be be used to specify any other fields if needed.
             */
            externalCreateUser: typeof externalCreateUser;

            /**
             * As the system admin, updates a user's roles via the API.
             */
            externalUpdateUserRoles: typeof externalUpdateUserRoles;
        }
    }
}
