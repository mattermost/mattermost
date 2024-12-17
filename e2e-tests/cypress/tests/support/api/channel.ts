// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Channel, ChannelMembership, ChannelType} from '@mattermost/types/channels';
import {UserProfile} from '@mattermost/types/users';
import {ChainableT} from 'tests/types';
import {getRandomId} from '../../utils';

// *****************************************************************************
// Channels
// https://api.mattermost.com/#tag/channels
// *****************************************************************************

export function createChannelPatch(teamId: string, name: string, displayName: string, type: ChannelType = 'O', purpose = '', header = '', unique = true): Partial<Channel> {
    const randomSuffix = getRandomId();

    return {
        team_id: teamId,
        name: unique ? `${name}-${randomSuffix}` : name,
        display_name: unique ? `${displayName} ${randomSuffix}` : displayName,
        type,
        purpose,
        header,
    };
}

/**
 * Create a new channel.
 * See https://api.mattermost.com/#tag/channels/paths/~1channels/post
 * @param {String} teamId - Unique handler for a team, will be present in the team URL
 * @param {String} name - Unique handler for a channel, will be present in the team URL
 * @param {String} displayName - Non-unique UI name for the channel
 * @param {String} type - 'O' for a public channel (default), 'P' for a private channel
 * @param {String} purpose - A short description of the purpose of the channel
 * @param {String} header - Markdown-formatted text to display in the header of the channel
 * @param {Boolean} [unique=true] - if true (default), it will create with unique/random channel name.
 * @returns {Channel} `out.channel` as `Channel`
 *
 * @example
 *   cy.apiCreateChannel('team-id', 'test-channel', 'Test Channel').then(({channel}) => {
 *       // do something with channel
 *   });
 */
function apiCreateChannel(
    teamId: string,
    name: string,
    displayName: string,
    type?: ChannelType,
    purpose?: string,
    header?: string,
    unique: boolean = true): ChainableT<{channel: Channel}> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/channels',
        method: 'POST',
        body: createChannelPatch(teamId, name, displayName, type, purpose, header, unique),
    }).then((response) => {
        expect(response.status).to.equal(201);
        return cy.wrap({channel: response.body});
    });
}

Cypress.Commands.add('apiCreateChannel', apiCreateChannel);

/**
 * Create a new direct message channel between two users.
 * See https://api.mattermost.com/#tag/channels/paths/~1channels~1direct/post
 * @param {string[]} userIds - The two user ids to be in the direct message
 * @returns {Channel} `out.channel` as `Channel`
 *
 * @example
 *   cy.apiCreateDirectChannel(['user-1-id', 'user-2-id']).then(({channel}) => {
 *       // do something with channel
 *   });
 */
function apiCreateDirectChannel(userIds: string[] = []): ChainableT<{channel: Channel}> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/channels/direct',
        method: 'POST',
        body: userIds,
    }).then((response) => {
        expect(response.status).to.equal(201);
        return cy.wrap({channel: response.body});
    });
}

Cypress.Commands.add('apiCreateDirectChannel', apiCreateDirectChannel);

/**
 * Create a new group message channel to group of users via API. If the logged in user's id is not included in the list, it will be appended to the end.
 * See https://api.mattermost.com/#tag/channels/paths/~1channels~1group/post
 * @param {string[]} userIds - User ids to be in the group message channel
 * @returns {Channel} `out.channel` as `Channel`
 *
 * @example
 *   cy.apiCreateGroupChannel(['user-1-id', 'user-2-id', 'current-user-id']).then(({channel}) => {
 *       // do something with channel
 *   });
 */
function apiCreateGroupChannel(userIds: string[]): ChainableT<{channel: Channel}> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/channels/group',
        method: 'POST',
        body: userIds,
    }).then((response) => {
        expect(response.status).to.equal(201);
        return cy.wrap({channel: response.body});
    });
}

Cypress.Commands.add('apiCreateGroupChannel', apiCreateGroupChannel);

/**
 * Update a channel.
 * The fields that can be updated are listed as parameters. Omitted fields will be treated as blanks.
 * See https://api.mattermost.com/#tag/channels/paths/~1channels~1{channel_id}/put
 * @param {string} channelId - The channel ID to be updated
 * @param {Channel} channel - Channel object to be updated
 * @param {string} channel.name - The unique handle for the channel, will be present in the channel URL
 * @param {string} channel.display_name - The non-unique UI name for the channel
 * @param {string} channel.purpose - A short description of the purpose of the channel
 * @param {string} channel.header - Markdown-formatted text to display in the header of the channel
 * @returns {Channel} `out.channel` as `Channel`
 *
 * @example
 *   cy.apiUpdateChannel('channel-id', {name: 'new-name', display_name: 'New Display Name'. 'purpose': 'Updated purpose', 'header': 'Updated header'});
 */
function apiUpdateChannel(channelId: string, channel: Channel): ChainableT<{channel: Channel}> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/channels/' + channelId,
        method: 'PUT',
        body: {
            id: channelId,
            ...channel,
        },
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({channel: response.body});
    });
}

Cypress.Commands.add('apiUpdateChannel', apiUpdateChannel);

/**
 * Partially update a channel by providing only the fields you want to update.
 * Omitted fields will not be updated.
 * The fields that can be updated are defined in the request body, all other provided fields will be ignored.
 * See https://api.mattermost.com/#tag/channels/paths/~1channels~1{channel_id}~1patch/put
 * @param {string} channelId - The channel ID to be patched
 * @param {Channel} channel - Channel object to be patched
 * @param {string} channel.name - The unique handle for the channel, will be present in the channel URL
 * @param {string} channel.display_name - The non-unique UI name for the channel
 * @param {string} channel.purpose - A short description of the purpose of the channel
 * @param {string} channel.header - Markdown-formatted text to display in the header of the channel
 * @returns {Channel} `out.channel` as `Channel`
 *
 * @example
 *   cy.apiPatchChannel('channel-id', {name: 'new-name', display_name: 'New Display Name'});
 */
function apiPatchChannel(channelId: string, channel: Partial<Channel>): ChainableT<{channel: Channel}> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        method: 'PUT',
        url: `/api/v4/channels/${channelId}/patch`,
        body: channel,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({channel: response.body});
    });
}

Cypress.Commands.add('apiPatchChannel', apiPatchChannel);

/**
 * Updates channel's privacy allowing changing a channel from Public to Private and back.
 * See https://api.mattermost.com/#tag/channels/paths/~1channels~1{channel_id}~1privacy/put
 * @param {string} channelId - The channel ID to be patched
 * @param {string} privacy - The privacy the channel should be set too. P = Private, O = Open
 * @returns {Channel} `out.channel` as `Channel`
 *
 * @example
 *   cy.apiPatchChannelPrivacy('channel-id', 'P');
 */
function apiPatchChannelPrivacy(channelId: string, privacy = 'O'): ChainableT<{channel: Channel}> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        method: 'PUT',
        url: `/api/v4/channels/${channelId}/privacy`,
        body: {privacy},
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({channel: response.body});
    });
}

Cypress.Commands.add('apiPatchChannelPrivacy', apiPatchChannelPrivacy);

/**
 * Get channel from the provided channel id string.
 * See https://api.mattermost.com/#tag/channels/paths/~1channels~1{channel_id}/get
 * @param {string} channelId - Channel ID
 * @returns {Channel} `out.channel` as `Channel`
 *
 * @example
 *   cy.apiGetChannel('channel-id').then(({channel}) => {
 *       // do something with channel
 *   });
 */
function apiGetChannel(channelId: string): ChainableT<{channel: Channel}> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/channels/${channelId}`,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({channel: response.body});
    });
}

Cypress.Commands.add('apiGetChannel', apiGetChannel);

/**
 * Gets a channel from the provided team name and channel name strings.
 * See https://api.mattermost.com/#tag/channels/paths/~1teams~1name~1{team_name}~1channels~1name~1{channel_name}/get
 * @param {string} teamName - Team name
 * @param {string} channelName - Channel name
 * @returns {Channel} `out.channel` as `Channel`
 *
 * @example
 *   cy.apiGetChannelByName('team-name', 'channel-name').then(({channel}) => {
 *       // do something with channel
 *   });
 */
function apiGetChannelByName(teamName: string, channelName: string): ChainableT<{channel: Channel}> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/teams/name/${teamName}/channels/name/${channelName}`,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({channel: response.body});
    });
}

Cypress.Commands.add('apiGetChannelByName', apiGetChannelByName);

/**
 * Get a list of all channels.
 * See https://api.mattermost.com/#tag/channels/paths/~1channels/get
 * @returns {Channel[]} `out.channels` as `Channel[]`
 *
 * @example
 *   cy.apiGetAllChannels().then(({channels}) => {
 *       // do something with channels
 *   });
 */
function apiGetAllChannels(): ChainableT<{channels: Channel[]}> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/channels',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({channels: response.body});
    });
}

Cypress.Commands.add('apiGetAllChannels', apiGetAllChannels);

/**
 * Get channels for user.
 * See https://api.mattermost.com/#tag/channels/paths/~1users~1{user_id}~1teams~1{team_id}~1channels/get
 * @returns {Channel[]} `out.channels` as `Channel[]`
 *
 * @example
 *   cy.apiGetChannelsForUser().then(({channels}) => {
 *       // do something with channels
 *   });
 */
function apiGetChannelsForUser(userId: string, teamId: string): ChainableT<{channels: Channel[]}> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/users/${userId}/teams/${teamId}/channels`,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({channels: response.body});
    });
}

Cypress.Commands.add('apiGetChannelsForUser', apiGetChannelsForUser);

/**
 * Soft deletes a channel, by marking the channel as deleted in the database.
 * Soft deleted channels will not be accessible in the user interface.
 * Direct and group message channels cannot be deleted.
 * See https://api.mattermost.com/#tag/channels/paths/~1channels~1{channel_id}/delete
 * @param {string} channelId - The channel ID to be deleted
 * @returns {Response} response: Cypress-chainable response which should have successful HTTP status of 200 OK to continue or pass.
 *
 * @example
 *   cy.apiDeleteChannel('channel-id');
 */
function apiDeleteChannel(channelId: string): ChainableT<any> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/channels/' + channelId,
        method: 'DELETE',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
}

Cypress.Commands.add('apiDeleteChannel', apiDeleteChannel);

/**
 * Add a user to a channel by creating a channel member object.
 * See https://api.mattermost.com/#tag/channels/paths/~1channels~1{channel_id}~1members/post
 * @param {string} channelId - Channel ID
 * @param {string} userId - User ID to add to the channel
 * @returns {ChannelMembership} `out.member` as `ChannelMembership`
 *
 * @example
 *   cy.apiAddUserToChannel('channel-id', 'user-id').then(({member}) => {
 *       // do something with member
 *   });
 */
function apiAddUserToChannel(channelId: string, userId: string): ChainableT<{member: ChannelMembership}> {
    return cy.request<ChannelMembership>({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/channels/' + channelId + '/members',
        method: 'POST',
        body: {
            user_id: userId,
        },
    }).then((response) => {
        expect(response.status).to.equal(201);
        return cy.wrap({member: response.body});
    });
}

Cypress.Commands.add('apiAddUserToChannel', apiAddUserToChannel);

function apiRemoveUserFromChannel(channelId, userId): ChainableT<any> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/channels/' + channelId + '/members/' + userId,
        method: 'DELETE',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({member: response.body});
    });
}

Cypress.Commands.add('apiRemoveUserFromChannel', apiRemoveUserFromChannel);

/**
 * Convenient command that create, post into and then archived a channel.
 * @param {string} name - name of channel to be created
 * @param {string} displayName - display name of channel to be created
 * @param {string} type - type of channel
 * @param {string} teamId - team Id where the channel will be added
 * @param {string[]} [messages] - messages to be posted before archiving a channel
 * @param {UserProfile} [user] - user who will be posting the messages
 * @returns {Channel} archived channel
 *
 * @example
 *   cy.apiCreateArchivedChannel('channel-name', 'channel-display-name', 'team-id', messages, user).then((channel) => {
 *       // do something with channel
 *   });
 */
function apiCreateArchivedChannel(name: string, displayName: string, type: ChannelType = 'O', teamId: string, messages: string[] = [], user?: UserProfile): ChainableT<Channel> {
    return cy.apiCreateChannel(teamId, name, displayName, type).then(({channel}) => {
        Cypress._.forEach(messages, (message) => {
            cy.postMessageAs({
                sender: user,
                message,
                channelId: channel.id,
            });
        });

        cy.apiDeleteChannel(channel.id);
        return cy.wrap(channel);
    });
}

Cypress.Commands.add('apiCreateArchivedChannel', apiCreateArchivedChannel);

/**
 * Command to convert a GM to a private channel
 * @param {string} channelId - channel id of GM to be converted
 * @param {string} teamId - id of team to move the converted private channel to
 * @param {string} displayName - display name of converted channel
 * @param {string} name - name of converted channel
 */
function apiConvertGMToPrivateChannel(channelId: string, teamId: string, displayName: string, name: string): ChainableT<any> {
    const body = {
        channel_id: channelId,
        team_id: teamId,
        display_name: displayName,
        name,
    };

    return cy.request<void>({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/channels/${channelId}/convert_to_channel?team_id=${teamId}`,
        method: 'POST',
        body,
    });
}

Cypress.Commands.add('apiConvertGMToPrivateChannel', apiConvertGMToPrivateChannel);

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            apiCreateChannel: typeof apiCreateChannel;
            apiCreateDirectChannel: typeof apiCreateDirectChannel;
            apiCreateGroupChannel: typeof apiCreateGroupChannel;
            apiUpdateChannel: typeof apiUpdateChannel;
            apiPatchChannel: typeof apiPatchChannel;
            apiPatchChannelPrivacy: typeof apiPatchChannelPrivacy;
            apiGetChannel: typeof apiGetChannel;
            apiGetChannelByName: typeof apiGetChannelByName;
            apiGetAllChannels: typeof apiGetAllChannels;
            apiGetChannelsForUser: typeof apiGetChannelsForUser;
            apiDeleteChannel: typeof apiDeleteChannel;
            apiAddUserToChannel: typeof apiAddUserToChannel;
            apiRemoveUserFromChannel: typeof apiRemoveUserFromChannel;
            apiCreateArchivedChannel: typeof apiCreateArchivedChannel;
            apiConvertGMToPrivateChannel: typeof apiConvertGMToPrivateChannel;
        }
    }
}
