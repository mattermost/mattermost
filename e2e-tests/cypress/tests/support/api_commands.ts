// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChainableT, ResponseT} from 'tests/types';

import {getAdminAccount, User} from './env';

// *****************************************************************************
// Read more:
// - https://on.cypress.io/custom-commands on writing Cypress commands
// - https://api.mattermost.com/ for Mattermost API reference
// *****************************************************************************

// *****************************************************************************
// Commands
// https://api.mattermost.com/#tag/commands
// *****************************************************************************

type CypressResponseAny = Cypress.Response<any>
function apiCreateCommand(command: Record<string, any> = {}): Cypress.Chainable<{data: CypressResponseAny['body']; status: CypressResponseAny['status']}> {
    const options = {
        url: '/api/v4/commands',
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        method: 'POST',
        body: command,
    };

    return cy.request(options).then((response) => {
        expect(response.status).to.equal(201);
        return cy.wrap({data: response.body, status: response.status});
    });
}

Cypress.Commands.add('apiCreateCommand', apiCreateCommand);

// *****************************************************************************
// Email
// *****************************************************************************
function apiEmailTest(): ResponseT {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/email/test',
        method: 'POST',
    }).then((response) => {
        expect(response.status, 'SMTP not setup at sysadmin config').to.equal(200);
        return cy.wrap(response);
    });
}
Cypress.Commands.add('apiEmailTest', apiEmailTest);

// *****************************************************************************
// Posts
// https://api.mattermost.com/#tag/posts
// *****************************************************************************

function apiCreatePost(channelId: string, message: string, rootId: string, props: Record<string, any>, token = '', failOnStatusCode = true): ResponseT {
    const headers: Record<string, string> = {'X-Requested-With': 'XMLHttpRequest'};
    if (token !== '') {
        headers.Authorization = `Bearer ${token}`;
    }
    return cy.request<any>({
        headers,
        failOnStatusCode,
        url: '/api/v4/posts',
        method: 'POST',
        body: {
            channel_id: channelId,
            root_id: rootId,
            message,
            props,
        },
    });
}

Cypress.Commands.add('apiCreatePost', apiCreatePost);

function apiDeletePost(postId: string, user: User = getAdminAccount(), permanent = false): Cypress.Chainable<{status: number}> {
    return cy.externalRequest({
        user,
        method: 'delete',
        path: `posts/${postId}?permanent=${permanent}`,
    }).then((response) => {
        // * Validate that request was successful
        expect(response.status).to.equal(200);
        return cy.wrap({status: response.status});
    });
}
Cypress.Commands.add('apiDeletePost', apiDeletePost);

function apiCreateToken(userId: string): Cypress.Chainable<{token: string}> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/users/${userId}/tokens`,
        method: 'POST',
        body: {
            description: 'some text',
        },
    }).then((response) => {
        // * Validate that request was successful
        expect(response.status).to.equal(200);
        return cy.wrap({token: response.body.token});
    });
}
Cypress.Commands.add('apiCreateToken', apiCreateToken);

/**
 * Unpins pinned posts of given postID directly via API
 * This API assume that the user is logged in and has cookie to access
 */
function apiUnpinPosts(postId: string): ResponseT {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/posts/' + postId + '/unpin',
        method: 'POST',
    });
}
Cypress.Commands.add('apiUnpinPosts', apiUnpinPosts);

// *****************************************************************************
// Webhooks
// https://api.mattermost.com/#tag/webhooks
// *****************************************************************************

function apiCreateWebhook(hook: Record<string, any> = {}, isIncoming = true): ChainableT<{data: CypressResponseAny['body']; url: string}> {
    const hookUrl = isIncoming ? '/api/v4/hooks/incoming' : '/api/v4/hooks/outgoing';
    const options = {
        url: hookUrl,
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        method: 'POST',
        body: hook,
    };

    return cy.request(options).then((response) => {
        const data = response.body;
        return cy.wrap(Promise.resolve({...data, url: isIncoming ? `${Cypress.config().baseUrl}/hooks/${data.id}` : ''}));
    });
}

Cypress.Commands.add('apiCreateWebhook', apiCreateWebhook);

function apiGetTeam(teamId: string): ChainableT<any> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `api/v4/teams/${teamId}`,
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
}
Cypress.Commands.add('apiGetTeam', apiGetTeam);

function removeUserFromChannel(channelId: string, userId: string): ReturnType<typeof cy.externalRequest> {
    const admin = getAdminAccount();

    return cy.externalRequest({user: admin, method: 'delete', path: `channels/${channelId}/members/${userId}`});
}
Cypress.Commands.add('removeUserFromChannel', removeUserFromChannel);

function removeUserFromTeam(teamId: string, userId: string): ReturnType<typeof cy.externalRequest> {
    const admin = getAdminAccount();

    return cy.externalRequest({user: admin, method: 'delete', path: `teams/${teamId}/members/${userId}`});
}
Cypress.Commands.add('removeUserFromTeam', removeUserFromTeam);

interface LDAPSyncResponse {
    status: number;
    body: Array<{status: string; last_activity_at: number}>;
}

function apiGetLDAPSync(): Cypress.Chainable<LDAPSyncResponse > {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/jobs/type/ldap_sync?page=0&per_page=50',
        method: 'GET',
        timeout: 60000,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
}
Cypress.Commands.add('apiGetLDAPSync', apiGetLDAPSync);

// *****************************************************************************
// Groups
// https://api.mattermost.com/#tag/groups
// *****************************************************************************
function apiGetGroups(page = 0, perPage = 100): ResponseT {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/groups?page=${page}&per_page=${perPage}`,
        method: 'GET',
        timeout: 60000,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
}
Cypress.Commands.add('apiGetGroups', apiGetGroups);

function apiPatchGroup(groupID: string, patch: Record<string, any>): ResponseT {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/groups/${groupID}/patch`,
        method: 'PUT',
        timeout: 60000,
        body: patch,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
}
Cypress.Commands.add('apiPatchGroup', apiPatchGroup);

function apiGetLDAPGroups(page = 0, perPage = 100): ResponseT {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/ldap/groups?page=${page}&per_page=${perPage}`,
        method: 'GET',
        timeout: 60000,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
}

Cypress.Commands.add('apiGetLDAPGroups', apiGetLDAPGroups);

function apiAddLDAPGroupLink(remoteId: string) {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/ldap/groups/${remoteId}/link`,
        method: 'POST',
        timeout: 60000,
    }).then((response) => {
        return cy.wrap(response);
    });
}
Cypress.Commands.add('apiAddLDAPGroupLink', apiAddLDAPGroupLink);

function apiGetTeamGroups(teamId: string) {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/teams/${teamId}/groups`,
        method: 'GET',
        timeout: 60000,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
}
Cypress.Commands.add('apiGetTeamGroups', apiGetTeamGroups);

function apiDeleteLinkFromTeamToGroup(groupId: string, teamId: string): ResponseT {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/groups/${groupId}/teams/${teamId}/link`,
        method: 'DELETE',
        timeout: 60000,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
}
Cypress.Commands.add('apiDeleteLinkFromTeamToGroup', apiDeleteLinkFromTeamToGroup);

function apiLinkGroup(groupID: string): ResponseT {
    return linkUnlinkGroup(groupID, 'POST');
}
Cypress.Commands.add('apiLinkGroup', apiLinkGroup);

function apiUnlinkGroup(groupID: string): ResponseT {
    return linkUnlinkGroup(groupID, 'DELETE');
}
Cypress.Commands.add('apiUnlinkGroup', apiUnlinkGroup);

function linkUnlinkGroup(groupID: string, httpMethod: string): ResponseT {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/ldap/groups/${groupID}/link`,
        method: httpMethod,
        timeout: 60000,
    }).then((response) => {
        expect(response.status).to.be.oneOf([200, 201, 204]);
        return cy.wrap(response);
    });
}

function apiGetGroupTeams(groupID: string): ResponseT {
    return getGroupSyncables(groupID, 'team');
}
Cypress.Commands.add('apiGetGroupTeams', apiGetGroupTeams);

function apiGetGroupTeam(groupID: string, teamID: string): ResponseT {
    return getGroupSyncable(groupID, 'team', teamID);
}
Cypress.Commands.add('apiGetGroupTeam', apiGetGroupTeam);

function apiGetGroupChannels(groupID: string): ResponseT {
    return getGroupSyncables(groupID, 'channel');
}
Cypress.Commands.add('apiGetGroupChannels', apiGetGroupChannels);

function apiGetGroupChannel(groupID: string, channelID: string): ResponseT {
    return getGroupSyncable(groupID, 'channel', channelID);
}
Cypress.Commands.add('apiGetGroupChannel', apiGetGroupChannel);

function getGroupSyncable(groupID: string, syncableType: string, syncableID: string): ResponseT {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/groups/${groupID}/${syncableType}s/${syncableID}`,
        method: 'GET',
        timeout: 60000,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
}

function getGroupSyncables(groupID: string, syncableType: string): ResponseT {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/groups/${groupID}/${syncableType}s?page=0&per_page=100`,
        method: 'GET',
        timeout: 60000,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
}

function apiUnlinkGroupTeam(groupID: string, teamID: string): ResponseT {
    return linkUnlinkGroupSyncable(groupID, teamID, 'team', 'DELETE');
}
Cypress.Commands.add('apiUnlinkGroupTeam', apiUnlinkGroupTeam);

function apiLinkGroupTeam(groupID: string, teamID: string): ResponseT {
    return linkUnlinkGroupSyncable(groupID, teamID, 'team', 'POST');
}
Cypress.Commands.add('apiLinkGroupTeam', apiLinkGroupTeam);

function apiUnlinkGroupChannel(groupID: string, channelID: string): ResponseT {
    return linkUnlinkGroupSyncable(groupID, channelID, 'channel', 'DELETE');
}
Cypress.Commands.add('apiUnlinkGroupChannel', apiUnlinkGroupChannel);

function apiLinkGroupChannel(groupID: string, channelID: string): ResponseT {
    return linkUnlinkGroupSyncable(groupID, channelID, 'channel', 'POST');
}
Cypress.Commands.add('apiLinkGroupChannel', apiLinkGroupChannel);

function simulateSubscription(subscription, withLimits = true) {
    cy.intercept('GET', '**/api/v4/cloud/subscription', {
        statusCode: 200,
        body: subscription,
    });

    cy.intercept('GET', '**/api/v4/cloud/products**', {
        statusCode: 200,
        body: [
            {
                id: 'prod_1',
                sku: 'cloud-starter',
                price_per_seat: 0,
                recurring_interval: 'month',
                name: 'Cloud Free',
                cross_sells_to: '',
            },
            {
                id: 'prod_2',
                sku: 'cloud-professional',
                price_per_seat: 10,
                recurring_interval: 'month',
                name: 'Cloud Professional',
                cross_sells_to: 'prod_4',
            },
            {
                id: 'prod_3',
                sku: 'cloud-enterprise',
                price_per_seat: 30,
                recurring_interval: 'month',
                name: 'Cloud Enterprise',
                cross_sells_to: 'prod_5',
            },
            {
                id: 'prod_4',
                sku: 'cloud-professional',
                price_per_seat: 96,
                recurring_interval: 'year',
                name: 'Cloud Professional Yearly',
                cross_sells_to: 'prod_2',
            },
            {
                id: 'prod_5',
                sku: 'cloud-enterprise',
                price_per_seat: 96,
                recurring_interval: 'year',
                name: 'Cloud Enterprise Yearly',
                cross_sells_to: 'prod_3',
            },
        ],
    });

    if (withLimits) {
        cy.intercept('GET', '**/api/v4/cloud/limits', {
            statusCode: 200,
            body: {
                messages: {
                    history: 10000,
                },
            },
        });
    }
}

Cypress.Commands.add('simulateSubscription', simulateSubscription);

function linkUnlinkGroupSyncable(groupID: string, syncableID: string, syncableType: string, httpMethod: string) {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/groups/${groupID}/${syncableType}s/${syncableID}/link`,
        method: httpMethod,
        body: {auto_add: true},
    }).then((response) => {
        expect(response.status).to.be.oneOf([200, 201, 204]);
        return cy.wrap(response);
    });
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {

            /**
             * Get LDAP Group Sync Job Status
             *
             * @example
             *   cy.apiGetLDAPSync().then((response) => {
             */
            apiGetLDAPSync: typeof apiGetLDAPSync;

            /**
             * Test SMTP setup
             */
            apiEmailTest: typeof apiEmailTest;

            /**
             * Creates a post directly via API
             * This API assume that the user is logged in and has cookie to access
             * @param {String} channelId - Where to post
             * @param {String} message - What to post
             * @param {String} rootId - Parent post ID. Set to "" to avoid nesting
             * @param {Object} props - Post props
             * @param {String} token - Optional token to use for auth. If not provided - posts as current user
             */
            apiCreatePost: typeof apiCreatePost;

            /**
             * Deletes a post directly via API
             * @param {String} postId - Post ID
             * @param {Object} [user] - the user trying to invoke the API
             */
            apiDeletePost: typeof apiDeletePost;

            /**
             * Creates a post directly via API
             * This API assume that the user is logged in as admin
             * @param {String} userId - user for whom to create the token
             */
            apiCreateToken: typeof apiCreateToken;

            /**
             * Unpins pinned posts of given postID directly via API
             * This API assume that the user is logged in and has cookie to access
             */
            apiUnpinPosts: typeof apiUnpinPosts;

            /**
            * Creates a command directly via API
            * This API assume that the user is logged in and has required permission to create a command
            * @param {Object} command - command to be created
            */
            apiCreateCommand: typeof apiCreateCommand;

            apiCreateWebhook: typeof apiCreateWebhook;

            /**
             * Gets a team on the system
             * * @param {String} teamId - The team ID to get
             * All parameter required
             */
            apiGetTeam: typeof apiGetTeam;

            /**
             * Remove a User from a Channel directly via API
             * @param {String} channelId - The channel ID
             * @param {String} userId - The user ID
             * All parameter required
             */
            removeUserFromChannel: typeof removeUserFromChannel;

            /**
             * Remove a User from a Team directly via API
             * @param {String} teamID - The team ID
             * @param {String} userId - The user ID
             * All parameter required
             */
            removeUserFromTeam: typeof removeUserFromTeam;

            /**
             * Get all groups via the API
             *
             * @param {Integer} page - The desired page of the paginated list
             * @param {Integer} perPage - The number of groups per page
             *
             */
            apiGetGroups: typeof apiGetGroups;

            /**
             * Patch a group directly via API
             *
             * @param {String} name - The new name for the group
             * @param {Object} patch
             *   {Boolean} allow_reference - Whether to allow reference (group mention) or not  - true/false
             *   {String} name - Name for the group, used for group mentions
             *   {String} display_name - Display name for the group
             *   {String} description - Description for the group
             *
             */
            apiPatchGroup: typeof apiPatchGroup;

            /**
             * Get all LDAP groups via API
             * @param {Integer} page - The page to select
             * @param {Integer} perPage - The number of groups per page
             */
            apiGetLDAPGroups: typeof apiGetLDAPGroups;

            /**
             * Add a link for LDAP group via API
             * @param {String} remoteId - remote ID of the group
             */
            apiAddLDAPGroupLink: typeof apiAddLDAPGroupLink;

            /**
             * Retrieve the list of groups associated with a given team via API
             * @param {String} teamId - Team GUID
             */
            apiGetTeamGroups: typeof apiGetTeamGroups;

            /**
             * Delete a link from a team to a group via API
             * @param {String} groupId - Group GUID
             * @param {String} teamId - Team GUID
             */
            apiDeleteLinkFromTeamToGroup: typeof apiDeleteLinkFromTeamToGroup;

            apiLinkGroup: typeof apiLinkGroup;

            apiUnlinkGroup: typeof apiUnlinkGroup;

            apiLinkGroupTeam: typeof apiLinkGroupTeam;

            apiUnlinkGroupTeam: typeof apiUnlinkGroupTeam;

            apiUnlinkGroupChannel: typeof apiUnlinkGroupChannel;

            apiLinkGroupChannel: typeof apiLinkGroupChannel;

            apiGetGroupTeams: typeof apiGetGroupTeams;

            apiGetGroupTeam: typeof apiGetGroupTeam;

            apiGetGroupChannels: typeof apiGetGroupChannels;

            apiGetGroupChannel: typeof apiGetGroupChannel;

            simulateSubscription: typeof simulateSubscription;
        }
    }
}
