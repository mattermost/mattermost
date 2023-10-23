// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const checkMetrics = (expectedStatusCode) => {
    cy.apiGetConfig().then(({config}) => {
        const baseURL = new URL(Cypress.config('baseUrl'));
        baseURL.port = config.MetricsSettings.ListenAddress.replace(/^.*:/, '');
        baseURL.pathname = '/metrics';

        Cypress.log({name: 'Metrics License', message: `Checking metrics at ${baseURL.toString()}`});
        cy.request({
            headers: {'X-Requested-With': 'XMLHttpRequest'},
            url: baseURL.toString(),
            method: 'GET',
            failOnStatusCode: false,
        }).then((response) => {
            expect(response.headers['Content-Type'], 'should not hit webapp').not.to.equal('text/html');
            expect(response.status, 'should match expected status code').to.equal(expectedStatusCode);
        });
    });
};

