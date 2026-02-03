// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const checkMetrics = (expectedStatusCode) => {
    cy.apiGetConfig().then(({config}) => {
        const baseURL = new URL(Cypress.config('baseUrl'));
        baseURL.port = config.MetricsSettings.ListenAddress.replace(/^.*:/, '');
        baseURL.pathname = '/metrics';

        cy.log({name: 'Metrics License', message: `Checking metrics at ${baseURL.toString()}`});
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

// toggleMetricsOn turns metrics off and back on, forcing it to be tested against the current
// license. When, in the future, the product detects license removal and does this automatically,
// this helper won't be required.
export const toggleMetricsOn = () => {
    cy.apiUpdateConfig({
        MetricsSettings: {
            Enable: false,
        },
    });
    cy.apiUpdateConfig({
        MetricsSettings: {
            Enable: true,
        },
    });
};
