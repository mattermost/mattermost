// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/// <reference types="cypress" />

// ***************************************************************
// Each command should be properly documented using JSDoc.
// See https://jsdoc.app/index.html for reference.
// Basic requirements for documentation are the following:
// - Meaningful description
// - Specific link to https://api.mattermost.com
// - Each parameter with `@params`
// - Return value with `@returns`
// - Example usage with `@example`
// Custom command should follow naming convention of having `api` prefix, e.g. `apiLogin`.
// ***************************************************************

declare namespace Cypress {
    interface Chainable {

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
        apiCreateChannel(
            teamId: string,
            name: string,
            displayName: string,
            type?: string,
            purpose?: string,
            header?: string,
            unique: boolean = true
        ): Chainable<{channel: Channel}>;

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
        apiCreateDirectChannel(userIds: string[]): Chainable<{channel: Channel}>;

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
        apiCreateGroupChannel(userIds: string[]): Chainable<{channel: Channel}>;

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
        apiUpdateChannel(channelId: string, channel: Channel): Chainable<{channel: Channel}>;

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
        apiPatchChannel(channelId: string, channel: Partial<Channel>): Chainable<{channel: Channel}>;

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
        apiPatchChannelPrivacy(channelId: string, privacy: string): Chainable<{channel: Channel}>;

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
        apiGetChannel(channelId: string): Chainable<{channel: Channel}>;

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
        apiGetChannelByName(teamName: string, channelName: string): Chainable<{channel: Channel}>;

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
        apiGetAllChannels(): Chainable<{channels: Channel[]}>;

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
        apiGetChannelsForUser(): Chainable<{channels: Channel[]}>;

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
        apiDeleteChannel(channelId: string): Chainable<Response>;

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
        apiAddUserToChannel(channelId: string, userId: string): Chainable<ChannelMembership>;

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
        apiCreateArchivedChannel(name: string, displayName: string, type: string, teamId: string, messages?: string[], user?: UserProfile): Chainable<Channel>;
    }
}
