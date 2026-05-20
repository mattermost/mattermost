// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// *****************************************************************************
// Data Retention
// https://api.mattermost.com/#tag/data-retention
// *****************************************************************************

/**
 * Get all Custom Retention Policies
 * @param {Integer} page - The page to select
 * @param {Integer} perPage - The number of policies per page
 */
Cypress.Commands.add('apiGetCustomRetentionPolicies', (page = 0, perPage = 100) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/data_retention/policies?page=${page}&per_page=${perPage}`,
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
});

/**
 * Get a Custom Retention Policy
 * @param {string} id - The id of the policy
 */
Cypress.Commands.add('apiGetCustomRetentionPolicy', (id) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/data_retention/policies/${id}`,
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
});

/**
 * Delete Custom Retention Policy
 * @param {string} id - The id of the policy
 */
Cypress.Commands.add('apiDeleteCustomRetentionPolicy', (id) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/data_retention/policies/${id}`,
        method: 'DELETE',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
});

/**
 * Get Custom Retention Policy teams
 * @param {string} id - The id of the policy
 * @param {Integer} page - The page to select
 * @param {Integer} perPage - The number of policy teams per page
 */
Cypress.Commands.add('apiGetCustomRetentionPolicyTeams', (id, page = 0, perPage = 100) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/data_retention/policies/${id}/teams?page=${page}&per_page=${perPage}`,
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
});

/**
 * Get Custom Retention Policy channels
 * @param {string} id - The id of the policy
 * @param {Integer} page - The page to select
 * @param {Integer} perPage - The number of policy channels per page
 */
Cypress.Commands.add('apiGetCustomRetentionPolicyChannels', (id, page = 0, perPage = 100) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/data_retention/policies/${id}/channels?page=${page}&per_page=${perPage}`,
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
});

/**
 * Search Custom Retention Policy teams
 * @param {string} id - The id of the policy
 * @param {string} term - The team search term
 */
Cypress.Commands.add('apiSearchCustomRetentionPolicyTeams', (id, term) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/data_retention/policies/${id}/teams/search`,
        method: 'POST',
        body: {term},
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
});

/**
 * Search Custom Retention Policy teams
 * @param {string} id - The id of the policy
 * @param {string} term - The channel search term
 */
Cypress.Commands.add('apiSearchCustomRetentionPolicyChannels', (id, term) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/data_retention/policies/${id}/channels/search`,
        method: 'POST',
        body: {term},
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
});

/**
 * Delete all custom retention policies
 */
Cypress.Commands.add('apiDeleteAllCustomRetentionPolicies', () => {
    cy.apiGetCustomRetentionPolicies().then((result) => {
        result.body.policies.forEach((policy) => {
            cy.apiDeleteCustomRetentionPolicy(policy.id);
        });
    });
});

/**
 * Create a post with create_at prop via API
 * @param {string} channelId - Channel ID
 * @param {string} message - Post a message
 * @param {string} token - token
 * @param {number} createAt -  epoch date
 */
Cypress.Commands.add('apiPostWithCreateDate', (channelId, message, token, createAt) => {
    const headers = {'X-Requested-With': 'XMLHttpRequest'};
    if (token !== '') {
        headers.Authorization = `Bearer ${token}`;
    }
    return cy.request({
        headers,
        url: '/api/v4/posts',
        method: 'POST',
        body: {
            channel_id: channelId,
            create_at: createAt,
            message,
        },
    });
});

