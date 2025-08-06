// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// *****************************************************************************
// Webhooks
// https://api.mattermost.com/#tag/webhooks
// *****************************************************************************

Cypress.Commands.add('apiGetIncomingWebhook', (hookId) => {
    const options = {
        url: `api/v4/hooks/incoming/${hookId}`,
        method: 'GET',
        failOnStatusCode: false,
    };

    return cy.request(options).then((response) => {
        const {body, status} = response;
        return cy.wrap({webhook: body, status});
    });
});

Cypress.Commands.add('apiGetOutgoingWebhook', (hookId) => {
    const options = {
        url: `api/v4/hooks/outgoing/${hookId}`,
        method: 'GET',
        failOnStatusCode: false,
    };

    return cy.request(options).then((response) => {
        const {body, status} = response;
        return cy.wrap({webhook: body, status});
    });
});
