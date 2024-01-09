// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @metrics @not_cloud @license_removal

import {checkMetrics, toggleMetricsOn} from './helper';

describe('Metrics > No license', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.apiAdminLogin();
        cy.apiDeleteLicense();
        toggleMetricsOn();
    });

    it('should enable metrics in BUILD_NUMBER == dev environments', () => {
        cy.apiGetConfig(true).then(({config}) => {
            if (config.BuildNumber !== 'dev') {
                Cypress.log({name: 'Metrics License', message: `Skipping test since BUILD_NUMBER = ${config.BuildNumber}`});
                return;
            }

            checkMetrics(200);
        });
    });

    it('should disable metrics in BUILD_NUMBER != dev environments', () => {
        cy.apiGetConfig(true).then(({config}) => {
            if (config.BuildNumber === 'dev') {
                Cypress.log({name: 'Metrics License', message: `Skipping test since BUILD_NUMBER = ${config.BuildNumber}`});
                return;
            }

            checkMetrics(404);
        });
    });
});
