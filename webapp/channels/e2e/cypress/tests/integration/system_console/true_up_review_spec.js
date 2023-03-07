// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';

describe('System Console > Site Statistics > True Up Review', () => {
    before(() => {
        cy.apiInitSetup();
        cy.apiRequireLicense();

        cy.apiGetConfig().then(({config}) => {
            const originalConfig = config;
            const newConfig = {
                ...originalConfig,
                LogSettings: {
                    ...originalConfig.LogSettings,
                    EnableDiagnostics: false,
                },
            };

            cy.apiUpdateConfig(newConfig);
        });
    });

    it('cloud instances should not see true up review sections', () => {
        cy.apiAdminLogin();
        cy.apiRequireLicense('cloud');

        // # Go to team statistics
        cy.visit('/admin_console/reporting/team_statistics');
        cy.findByText('True Up Review').should('not.exist');

        // # Go to site statistics
        cy.visit('/admin_console/reporting/system_analytics');
        cy.findByText('True Up Review').should('not.exist');
    });

    it('starter instances should not see true up review sections', () => {
        cy.apiAdminLogin();
        cy.apiRequireLicense('starter');

        // # Go to team statistics
        cy.visit('/admin_console/reporting/team_statistics');
        cy.findByText('True Up Review').should('not.exist');

        // # Go to site statistics
        cy.visit('/admin_console/reporting/system_analytics');
        cy.findByText('True Up Review').should('not.exist');
    });

    it('non-admin users do no see the true up review sections', () => {
        // # Go to team statistics
        cy.visit('/admin_console/reporting/team_statistics');
        cy.findByText('True Up Review').should('not.exist');

        // # Go to site statistics
        cy.visit('/admin_console/reporting/system_analytics');
        cy.findByText('True Up Review').should('not.exist');
    });

    it('true up review exists in each statistics section', () => {
        // # Log in as admin
        cy.apiAdminLogin();

        const dueDate = moment().add(1, 'day').unix();
        cy.intercept('GET', '**/api/v4/license/review/status', {statusCode: 200, body: {complete: false, due_date: dueDate}}).as('reviewStatus');

        // # Go to team statistics
        cy.visit('/admin_console/reporting/team_statistics');
        cy.findByText('True Up Review').should('exist');

        // # Go to site statistics
        cy.visit('/admin_console/reporting/system_analytics');
        cy.findByText('True Up Review').should('exist');
    });

    it('non air-gapped instances can submit a true up review request', () => {
        // # Log in as admin
        cy.apiAdminLogin();

        const dueDate = moment().add(1, 'day').unix();
        cy.intercept('GET', '**/api/v4/hosted_customer/signup_available', {statusCode: 200, body: {status: 'OK'}}).as('reviewRequest');
        cy.intercept('GET', '**/api/v4/license/review/status', {statusCode: 200, body: {complete: false, due_date: dueDate}}).as('reviewStatus');
        cy.intercept('POST', '**/api/v4/license/review', {statusCode: 200, body: {status: 'OK'}}).as('reviewRequest');

        // # Go to team statistics
        cy.visit('/admin_console/reporting/team_statistics');
        cy.findByText('True Up Review').should('exist');

        cy.findByText('Share to Mattermost').should('exist').click();

        cy.wait('@reviewRequest');

        cy.findByText('Success!').should('exist');
    });

    it('air-gapped instances can submit a true up review request (for bundle download)', () => {
        // # Log in as admin
        cy.apiAdminLogin();

        const dueDate = moment().add(1, 'day').unix();
        cy.intercept('GET', '**/api/v4/hosted_customer/signup_available', {statusCode: 200, body: {status: 'OK'}}).as('reviewRequest');
        cy.intercept('POST', '**/api/v4/license/review', {statusCode: 200, body: {status: 'OK'}}).as('reviewRequest');
        cy.intercept('GET', '**/api/v4/license/review/status', {statusCode: 200, body: {complete: false, due_date: dueDate}}).as('reviewStatus');

        // # Go to team statistics
        cy.visit('/admin_console/reporting/team_statistics');
        cy.findByText('True Up Review').should('exist');

        cy.findByText('Share to Mattermost').should('exist').click();

        cy.wait('@reviewRequest');

        cy.findByText('Success!').should('exist');
    });

    it('error state visible when review request fails', () => {
        // # Log in as admin
        cy.apiAdminLogin();
        cy.apiRequireLicense();

        const dueDate = moment().add(1, 'day').unix();
        cy.intercept('GET', '**/api/v4/hosted_customer/signup_available', {statusCode: 200, body: {status: 'OK'}}).as('reviewRequest');
        cy.intercept('GET', '**/api/v4/license/review/status', {statusCode: 200, body: {complete: false, due_date: dueDate}}).as('reviewStatus');
        cy.intercept('POST', '**/api/v4/license/review', {statusCode: 500}).as('reviewRequest');

        // # Go to team statistics
        cy.visit('/admin_console/reporting/team_statistics');
        cy.findByText('True Up Review').should('exist');

        cy.findByText('Share to Mattermost').should('exist').click();

        cy.wait('@reviewRequest');

        cy.findByText('There was an issue sending your True Up Review. Please try again.').should('exist');
    });

    it('panel should not be present if true up review is already complete', () => {
        // # Log in as admin
        cy.apiAdminLogin();
        cy.apiRequireLicense();

        const dueDate = moment().add(1, 'day').unix();
        cy.intercept('GET', '**/api/v4/hosted_customer/signup_available', {statusCode: 200, body: {status: 'OK'}}).as('reviewRequest');
        cy.intercept('GET', '**/api/v4/license/review/status', {statusCode: 200, body: {complete: true, due_date: dueDate}}).as('reviewStatus');

        // # Go to team statistics
        cy.visit('/admin_console/reporting/team_statistics');
        cy.findByText('True Up Review').should('not.exist');

        // # Go to site statistics
        cy.visit('/admin_console/reporting/system_analytics');
        cy.findByText('True Up Review').should('not.exist');
    });

    it('panel should not be present if current date is not within the due date window', () => {
        // # Log in as admin
        cy.apiAdminLogin();
        cy.apiRequireLicense();

        const dueDate = moment().add(20, 'day').unix();
        cy.intercept('GET', '**/api/v4/hosted_customer/signup_available', {statusCode: 200, body: {status: 'OK'}}).as('reviewRequest');
        cy.intercept('GET', '**/api/v4/license/review/status', {statusCode: 200, body: {complete: true, due_date: dueDate}}).as('reviewStatus');

        // # Go to team statistics
        cy.visit('/admin_console/reporting/team_statistics');
        cy.findByText('True Up Review').should('not.exist');

        // # Go to site statistics
        cy.visit('/admin_console/reporting/system_analytics');
        cy.findByText('True Up Review').should('not.exist');
    });

    it('panel should not be present if current date is not within the due date window', () => {
        // # Log in as admin
        cy.apiAdminLogin();
        cy.apiRequireLicense();

        const dueDate = moment().add(20, 'day').unix();
        cy.intercept('GET', '**/api/v4/hosted_customer/signup_available', {statusCode: 200, body: {status: 'OK'}}).as('reviewRequest');
        cy.intercept('GET', '**/api/v4/license/review/status', {statusCode: 200, body: {complete: true, due_date: dueDate}}).as('reviewStatus');

        // # Go to team statistics
        cy.visit('/admin_console/reporting/team_statistics');
        cy.findByText('True Up Review').should('not.exist');

        // # Go to site statistics
        cy.visit('/admin_console/reporting/system_analytics');
        cy.findByText('True Up Review').should('not.exist');
    });

    it('panel should not be present if telemetry is enabled', () => {
        // # Log in as admin
        cy.apiAdminLogin();
        cy.apiRequireLicense();

        cy.apiGetConfig().then(({config}) => {
            const originalConfig = config;
            const newConfig = {
                ...originalConfig,
                LogSettings: {
                    ...originalConfig.LogSettings,
                    EnableDiagnostics: true,
                },
            };

            cy.apiUpdateConfig(newConfig);
        });

        const dueDate = moment().add(1, 'day').unix();
        cy.intercept('GET', '**/api/v4/hosted_customer/signup_available', {statusCode: 200, body: {status: 'OK'}}).as('reviewRequest');
        cy.intercept('GET', '**/api/v4/license/review/status', {statusCode: 200, body: {complete: true, due_date: dueDate}}).as('reviewStatus');

        // # Go to team statistics
        cy.visit('/admin_console/reporting/team_statistics');
        cy.findByText('True Up Review').should('not.exist');

        // # Go to site statistics
        cy.visit('/admin_console/reporting/system_analytics');
        cy.findByText('True Up Review').should('not.exist');
    });
});
