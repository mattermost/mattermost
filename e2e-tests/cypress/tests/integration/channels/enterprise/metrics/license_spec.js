// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @metrics @not_cloud

describe('Metrics > License', () => {
    before(() => {
        cy.apiUpdateConfig({
            MetricsSettings: {
                Enable: true,
            },
        });
    });

    const checkMetrics = (expectedStatusCode) => {
        cy.apiGetConfig().then(({config}) => {
            const baseURL = new URL(Cypress.config('baseUrl'));
            baseURL.port = config.MetricsSettings.ListenAddress.replace(/^.+:/, '');
            baseURL.pathname = '/metrics';

            Cypress.log({name: 'Metrics License', message: `Checking metrics at ${baseURL.toString()}`});
            cy.request({
                headers: {'X-Requested-With': 'XMLHttpRequest'},
                url: baseURL.toString(),
                method: 'GET',
                failOnStatusCode: false,
            }).then((response) => {
                expect(response.status).to.equal(expectedStatusCode);
            });
        });
    };

    it('should enable metrics in BUILD_NUMBER == dev environments regardless of having a license', () => {
        cy.apiGetConfig(true).then(({config}) => {
            if (config.BuildNumber !== 'dev') {
                Cypress.log({name: 'Metrics License', message: `Skipping test since BUILD_NUMBER = ${config.BuildNumber}`});
                return;
            }

            cy.apiDeleteLicense();
            checkMetrics(200);

            cy.apiRequireLicense();
            checkMetrics(200);
        });
    });

    it('should enable metrics in BUILD_NUMBER != dev environments only when a license is installed', () => {
        cy.apiGetConfig(true).then(({config}) => {
            if (config.BuildNumber === 'dev') {
                Cypress.log({name: 'Metrics License', message: `Skipping test since BUILD_NUMBER = ${config.BuildNumber}`});
                return;
            }

            cy.apiDeleteLicense();
            checkMetrics(404);

            cy.apiRequireLicense();
            checkMetrics(200);
        });
    });
});
