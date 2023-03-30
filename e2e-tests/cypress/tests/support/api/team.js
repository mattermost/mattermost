// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getRandomId} from '../../utils';

// *****************************************************************************
// Teams
// https://api.mattermost.com/#tag/teams
// *****************************************************************************

export function createTeamPatch(name = 'team', displayName = 'Team', type = 'O', unique = true) {
    const randomSuffix = getRandomId();

    return {
        name: unique ? `${name}-${randomSuffix}` : name,
        display_name: unique ? `${displayName} ${randomSuffix}` : displayName,
        type,
    };
}

Cypress.Commands.add('apiCreateTeam', (name, displayName, type, unique, options) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/teams',
        method: 'POST',
        body: {
            ...createTeamPatch(name, displayName, type, unique),
            ...options,
        },
    }).then((response) => {
        expect(response.status).to.equal(201);
        return cy.wrap({team: response.body});
    });
});

Cypress.Commands.add('apiDeleteTeam', (teamId, permanent = false) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/teams/' + teamId + (permanent ? '?permanent=true' : ''),
        method: 'DELETE',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({data: response.body});
    });
});

Cypress.Commands.add('apiDeleteUserFromTeam', (teamId, userId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/teams/' + teamId + '/members/' + userId,
        method: 'DELETE',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({data: response.body});
    });
});

Cypress.Commands.add('apiPatchTeam', (teamId, teamData) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/teams/${teamId}/patch`,
        method: 'PUT',
        body: teamData,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({team: response.body});
    });
});

Cypress.Commands.add('apiGetTeamByName', (name) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/teams/name/' + name,
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({team: response.body});
    });
});

Cypress.Commands.add('apiGetAllTeams', ({page = 0, perPage = 60} = {}) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `api/v4/teams?page=${page}&per_page=${perPage}`,
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({teams: response.body});
    });
});

Cypress.Commands.add('apiGetTeamsForUser', (userId = 'me') => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `api/v4/users/${userId}/teams`,
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({teams: response.body});
    });
});

Cypress.Commands.add('apiAddUserToTeam', (teamId, userId) => {
    return cy.request({
        method: 'POST',
        url: `/api/v4/teams/${teamId}/members`,
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        body: {team_id: teamId, user_id: userId},
        qs: {team_id: teamId},
    }).then((response) => {
        expect(response.status).to.equal(201);
        return cy.wrap({member: response.body});
    });
});

Cypress.Commands.add('apiAddUsersToTeam', (teamId, teamMembers) => {
    return cy.request({
        method: 'POST',
        url: `/api/v4/teams/${teamId}/members/batch`,
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        body: teamMembers,
    }).then((response) => {
        expect(response.status).to.equal(201);
        return cy.wrap({members: response.body});
    });
});

Cypress.Commands.add('apiGetTeamMembers', (teamId) => {
    return cy.request({
        method: 'GET',
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/teams/${teamId}/members`,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({members: response.body});
    });
});

Cypress.Commands.add('apiUpdateTeamMemberSchemeRole', (teamId, userId, schemeRoles = {}) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/teams/${teamId}/members/${userId}/schemeRoles`,
        method: 'PUT',
        body: schemeRoles,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({data: response.body});
    });
});

Cypress.Commands.add('apiSetTeamScheme', (teamId, schemeId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/teams/${teamId}/scheme`,
        method: 'PUT',
        body: {
            scheme_id: schemeId,
        },
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({data: response.body});
    });
});
