// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getRandomId} from '../../utils';

// *****************************************************************************
// Channels
// https://api.mattermost.com/#tag/channels
// *****************************************************************************

export function createChannelPatch(teamId, name, displayName, type = 'O', purpose = '', header = '', unique = true) {
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

Cypress.Commands.add('apiCreateChannel', (...args) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/channels',
        method: 'POST',
        body: createChannelPatch(...args),
    }).then((response) => {
        expect(response.status).to.equal(201);
        return cy.wrap({channel: response.body});
    });
});

Cypress.Commands.add('apiCreateDirectChannel', (userIds = []) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/channels/direct',
        method: 'POST',
        body: userIds,
    }).then((response) => {
        expect(response.status).to.equal(201);
        return cy.wrap({channel: response.body});
    });
});

Cypress.Commands.add('apiCreateGroupChannel', (userIds = []) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/channels/group',
        method: 'POST',
        body: userIds,
    }).then((response) => {
        expect(response.status).to.equal(201);
        return cy.wrap({channel: response.body});
    });
});

Cypress.Commands.add('apiUpdateChannel', (channelId, channelData) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/channels/' + channelId,
        method: 'PUT',
        body: {
            id: channelId,
            ...channelData,
        },
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({channel: response.body});
    });
});

Cypress.Commands.add('apiPatchChannel', (channelId, channelData) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        method: 'PUT',
        url: `/api/v4/channels/${channelId}/patch`,
        body: channelData,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({channel: response.body});
    });
});

Cypress.Commands.add('apiPatchChannelPrivacy', (channelId, privacy = 'O') => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        method: 'PUT',
        url: `/api/v4/channels/${channelId}/privacy`,
        body: {privacy},
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({channel: response.body});
    });
});

Cypress.Commands.add('apiGetChannel', (channelId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/channels/${channelId}`,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({channel: response.body});
    });
});

Cypress.Commands.add('apiGetChannelByName', (teamName, channelName) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/teams/name/${teamName}/channels/name/${channelName}`,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({channel: response.body});
    });
});

Cypress.Commands.add('apiGetAllChannels', () => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/channels',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({channels: response.body});
    });
});

Cypress.Commands.add('apiGetChannelsForUser', (userId, teamId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/users/${userId}/teams/${teamId}/channels`,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({channels: response.body});
    });
});

Cypress.Commands.add('apiDeleteChannel', (channelId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/channels/' + channelId,
        method: 'DELETE',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
});

Cypress.Commands.add('apiAddUserToChannel', (channelId, userId) => {
    return cy.request({
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
});

Cypress.Commands.add('apiRemoveUserFromChannel', (channelId, userId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/channels/' + channelId + '/members/' + userId,
        method: 'DELETE',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({member: response.body});
    });
});

Cypress.Commands.add('apiCreateArchivedChannel', (name, displayName, type = 'O', teamId, messages = [], user) => {
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
});
