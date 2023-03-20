// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// *****************************************************************************
// Schemes
// https://api.mattermost.com/#tag/schemes
// *****************************************************************************

Cypress.Commands.add('apiGetSchemes', (scope) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/schemes?scope=${scope}`,
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({schemes: response.body});
    });
});

Cypress.Commands.add('apiCreateScheme', (name, scope, description) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/schemes',
        method: 'POST',
        body: {display_name: name, scope, description},
    }).then((response) => {
        expect(response.status).to.equal(201);
        return cy.wrap({scheme: response.body});
    });
});

Cypress.Commands.add('apiDeleteScheme', (schemeId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/schemes/' + schemeId,
        method: 'DELETE',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
});
