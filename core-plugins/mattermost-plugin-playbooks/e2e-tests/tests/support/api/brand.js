// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// *****************************************************************************
// Brand
// https://api.mattermost.com/#tag/brand
// *****************************************************************************

Cypress.Commands.add('apiDeleteBrandImage', () => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/brand/image',
        method: 'DELETE',
        failOnStatusCode: false,
    }).then((response) => {
        // both deleted and not existing responses are valid
        expect(response.status).to.be.oneOf([200, 404]);
        return cy.wrap(response);
    });
});
