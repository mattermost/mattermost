// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @system_console

describe('Workspace deletion', () => {
    const host = window.location.host;

    beforeEach(() => {
        cy.apiLogout();
        cy.apiAdminLogin();
    });

    it('Workspace deletion cta is visible for free trials', () => {
        // Professional Yearly.
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_3',
            is_free_trial: 'true',
        };
        cy.simulateSubscription(subscription);
        cy.visit('/admin_console/billing/subscription');

        cy.findByText('Delete your workspace').should('exist');
        cy.findByText(`${host}`).should('exist');
    });

    it('Workspace deletion cta is not visible for cloud professional with a yearly plan', () => {
        // Professional Yearly.
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_4',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);
        cy.visit('/admin_console/billing/subscription');

        // Text is separated by an html <a> tag, just get the last half.
        cy.findByText('Delete your workspace').should('not.exist');
        cy.findByText(`${host}`).should('not.exist');

        cy.findByText('Cancel your subscription').should('exist');
        cy.findByText('At this time, deleting a workspace can only be done with the help of a customer support representative.').should('exist');
    });

    it('Workspace deletion cta is not visible for cloud enterprise with a yearly plan', () => {
        // Enterprise Yearly.
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_5',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);
        cy.visit('/admin_console/billing/subscription');

        // Text is separated by an html <a> tag, just get the last half.
        cy.findByText('Delete your workspace').should('not.exist');
        cy.findByText(`${host}`).should('not.exist');

        cy.findByText('Cancel your subscription').should('exist');
        cy.findByText('At this time, deleting a workspace can only be done with the help of a customer support representative.').should('exist');
    });

    it('Workspace deletion cta is visible for cloud free', () => {
        // Free.
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_1',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);
        cy.visit('/admin_console/billing/subscription');

        cy.findByText('Delete your workspace').should('exist');
        cy.findByText(`${host}`).should('exist');
    });

    it('Workspace deletion cta is visible for cloud professional with a monthly plan', () => {
        // Professional Monthly.
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_2',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);
        cy.visit('/admin_console/billing/subscription');

        cy.findByText('Delete your workspace').should('exist');
        cy.findByText(`${host}`).should('exist');
    });

    it('Workspace deletion cta is not visible for cloud enterprise with a monthly plan', () => {
        // Professional Yearly.
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_3',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);
        cy.visit('/admin_console/billing/subscription');

        // Text is separated by an html <a> tag, just get the last half.
        cy.findByText('Delete your workspace').should('not.exist');
        cy.findByText(`${host}`).should('not.exist');

        cy.findByText('Cancel your subscription').should('exist');
        cy.findByText('At this time, deleting a workspace can only be done with the help of a customer support representative.').should('exist');
    });

    it('Workspace deletion modal > downgrade button is not visible for cloud free', () => {
        // Free.
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_1',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);
        cy.visit('/admin_console/billing/subscription');

        cy.findByText('Delete Workspace').click();
        cy.findByText('Are you sure you want to delete?').should('exist');
        cy.findByText('Downgrade To Free').should('not.exist');
    });

    it('Workspace deletion modal > downgrade button is visible for cloud professional', () => {
        // Professional Monthly.
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_2',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);
        cy.visit('/admin_console/billing/subscription');

        cy.findByText('Delete Workspace').click();
        cy.findByText('Are you sure you want to delete?').should('exist');
        cy.findByText('Downgrade To Free').should('exist');
    });

    it('Workspace deletion modal > downgrade button is not visible for free trials', () => {
        // Free.
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_3',
            is_free_trial: 'true',
        };
        cy.simulateSubscription(subscription);
        cy.visit('/admin_console/billing/subscription');

        cy.findByText('Delete Workspace').click();
        cy.findByText('Are you sure you want to delete?').should('exist');
        cy.findByText('Downgrade To Free').should('not.exist');
    });

    it('Workspace deletion modal > delete workspace button click > feedback modal shown before submitting deletion request', () => {
        // Professional Monthly.
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_2',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);
        cy.visit('/admin_console/billing/subscription');

        cy.findByText('Delete Workspace').click();
        cy.findByText('Are you sure you want to delete?').should('exist');
        cy.get('.DeleteWorkspaceModal__Buttons-Delete').contains('Delete Workspace').should('exist').click();
        cy.findByText('Please share your reason for deleting').should('exist');
    });

    it('Workspace deletion modal > delete workspace button click > feedback modal requires option selected to enable submit', () => {
        // Professional Monthly.
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_2',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);
        cy.visit('/admin_console/billing/subscription');

        cy.findByText('Delete Workspace').click();
        cy.findByText('Are you sure you want to delete?').should('exist');
        cy.get('.DeleteWorkspaceModal__Buttons-Delete').contains('Delete Workspace').should('exist').click();
        cy.findByText('Please share your reason for deleting').should('exist');
        cy.findByText('No longer found value').click();
        cy.get('.GenericModal__button.confirm').contains('Delete Workspace').should('be.enabled');
    });

    it('Workspace deletion modal > downgrade workspace button click > feedback modal shown before submitting downgrade request', () => {
        // Professional Monthly.
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_2',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);
        cy.visit('/admin_console/billing/subscription');

        cy.findByText('Delete Workspace').click();
        cy.findByText('Are you sure you want to delete?').should('exist');
        cy.findByText('Downgrade To Free').should('exist').click();
        cy.findByText('Please share your reason for downgrading').should('exist');
    });

    it('Workspace deletion modal > downgrade workspace button click > feedback modal requires option selected to enable submit', () => {
        // Professional Monthly.
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_2',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);
        cy.visit('/admin_console/billing/subscription');

        cy.findByText('Delete Workspace').click();
        cy.findByText('Are you sure you want to delete?').should('exist');
        cy.findByText('Downgrade To Free').should('exist').click();
        cy.findByText('Please share your reason for downgrading').should('exist');
        cy.findByText('Experienced technical issues').click();
        cy.findByText('Downgrade').should('be.enabled');
    });

    it('Workspace deletion modal > delete workspace > after survey, a success modal is displayed when the deletion succeeds', () => {
        cy.intercept('DELETE', '/api/v4/cloud/delete-workspace', {statusCode: 200, body: {message: 'Status OK'}}).as('deleteWorkspace');

        // Professional Monthly.
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_2',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);
        cy.visit('/admin_console/billing/subscription');

        cy.findByText('Delete Workspace').click();
        cy.findByText('Are you sure you want to delete?').should('exist');
        cy.get('.DeleteWorkspaceModal__Buttons-Delete').contains('Delete Workspace').should('exist').click();
        cy.findByText('Please share your reason for deleting').should('exist');
        cy.findByText('No longer found value').click();
        cy.get('.GenericModal__button.confirm').contains('Delete Workspace').should('be.enabled').click();
        cy.wait('@deleteWorkspace');

        cy.get('.result_modal').should('exist');
        cy.findByText('Your workspace has been deleted').should('exist');
    });

    it('Workspace deletion modal > delete workspace > after survey, a failure modal is displayed when the deletion fails', () => {
        cy.intercept('DELETE', '/api/v4/cloud/delete-workspace', {statusCode: 500}).as('deleteWorkspace');

        // Professional Monthly.
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_2',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);
        cy.visit('/admin_console/billing/subscription');

        cy.findByText('Delete Workspace').click();
        cy.findByText('Are you sure you want to delete?').should('exist');
        cy.get('.DeleteWorkspaceModal__Buttons-Delete').contains('Delete Workspace').should('exist').click();
        cy.findByText('Please share your reason for deleting').should('exist');
        cy.findByText('No longer found value').click();
        cy.get('.GenericModal__button.confirm').contains('Delete Workspace').should('be.enabled').click();

        cy.wait('@deleteWorkspace');

        cy.get('.result_modal').should('exist');
        cy.findByText('Workspace deletion failed').should('exist');
    });

    it('Workspace deletion modal > downgrade workspace > after survey, a success modal is displayed when the downgrade succeeds', () => {
        cy.intercept('PUT', '/api/v4/cloud/subscription', {statusCode: 200, body: {message: 'Status OK'}}).as('downgradeWorkspace');

        // Professional Monthly.
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_2',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);
        cy.visit('/admin_console/billing/subscription');

        cy.findByText('Delete Workspace').click();
        cy.findByText('Are you sure you want to delete?').should('exist');
        cy.findByText('Downgrade To Free').should('exist').click();
        cy.findByText('Please share your reason for downgrading').should('exist');
        cy.findByText('Experienced technical issues').click();
        cy.findByText('Downgrade').should('be.enabled').click();

        cy.wait('@downgradeWorkspace');

        cy.get('.cloud_subscribe_result_modal').should('exist');
        cy.findByText('You are now subscribed to Cloud Free').should('exist');
    });

    it('Workspace deletion modal > downgrade workspace > after survey, a failure modal is displayed when the downgrade fails', () => {
        cy.intercept('PUT', '/api/v4/cloud/subscription', {statusCode: 500}).as('downgradeWorkspace');

        // Professional Monthly.
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_2',
            is_free_trial: 'false',
        };
        cy.simulateSubscription(subscription);
        cy.visit('/admin_console/billing/subscription');

        cy.findByText('Delete Workspace').click();
        cy.findByText('Are you sure you want to delete?').should('exist');
        cy.findByText('Downgrade To Free').should('exist').click();
        cy.findByText('Please share your reason for downgrading').should('exist');
        cy.findByText('Experienced technical issues').click();
        cy.findByText('Downgrade').should('be.enabled').click();

        cy.wait('@downgradeWorkspace');

        cy.get('.cloud_subscribe_result_modal').should('exist');
        cy.findByText('We were unable to change your plan').should('exist');
    });
});
