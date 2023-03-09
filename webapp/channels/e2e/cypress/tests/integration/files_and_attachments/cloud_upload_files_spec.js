// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @files_and_attachments

import * as TIMEOUTS from '../../fixtures/timeouts';

import {interceptFileUpload, waitUntilUploadComplete} from './helpers';

function simulateSubscription(subscription, currentStorageUsageBytes, planLimit) {
    cy.intercept('GET', '**/api/v4/cloud/subscription', {
        statusCode: 200,
        body: subscription,
    });

    cy.intercept('GET', '**/api/v4/usage/storage', {
        statusCode: 200,
        body: {
            bytes: currentStorageUsageBytes,
        },
    });

    cy.intercept('GET', '**/api/v4/cloud/limits', {
        statusCode: 200,
        body: {
            files: {
                total_storage: planLimit,
            },
        },
    });

    cy.intercept('GET', '**/api/v4/cloud/products', {
        statusCode: 200,
        body: [
            {
                id: 'prod_1',
                sku: 'cloud-starter',
                price_per_seat: 0,
                name: 'Cloud Free',
            },
            {
                id: 'prod_2',
                sku: 'cloud-professional',
                price_per_seat: 10,
                name: 'Cloud Professional',
            },
            {
                id: 'prod_3',
                sku: 'cloud-enterprise',
                price_per_seat: 30,
                name: 'Cloud Enterprise',
            },
        ],
    });
}

describe('Cloud Freemium limits Upload Files', () => {
    let channelUrl;
    let createdUser;

    before(() => {
        // * Check if server has license for Cloud
        cy.apiRequireLicenseForFeature('Cloud');
    });

    beforeEach(() => {
        // # Init setup
        cy.apiInitSetup().then((out) => {
            channelUrl = out.channelUrl;
            createdUser = out.user;

            cy.visit(channelUrl);
            interceptFileUpload();
        });
    });

    it('Show file limits banner for admin uploading files when storage usage above current freemium file storage limit', () => {
        // # Login as sysadmin
        cy.apiAdminLogin();

        const currentsubscription = {
            id: 'sub_test1',
            product_id: 'prod_1',
            is_free_trial: 'false',
        };

        const currentFileStorageUsageBytes = 11000000000;
        const planLimit = 10000000000; // 1.2GB

        simulateSubscription(currentsubscription, currentFileStorageUsageBytes, planLimit);

        const filename = 'svg.svg';

        cy.visit(channelUrl);
        cy.get('#post_textbox', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');

        // # Attach file
        cy.get('#advancedTextEditorCell').find('#fileUploadInput').attachFile(filename);
        waitUntilUploadComplete();

        // * Banner shows
        cy.get('#cloud_file_limit_banner').should('exist');
        cy.get('#cloud_file_limit_banner').contains('Your free plan is limited to 1.2GB of files. New uploads will automatically archive older files');
        cy.get('#cloud_file_limit_banner').contains('upgrade to a paid plan');
    });

    it('Do not show file limits banner for admin uploading files and not above current freemium file storage limit', () => {
        // # Login as sysadmin
        cy.apiAdminLogin();

        const currentsubscription = {
            id: 'sub_test1',
            product_id: 'prod_1',
            is_free_trial: 'false',
        };

        const currentFileStorageUsageBytes = 900000000;
        const planLimit = 10000000000; // 1.2GB

        simulateSubscription(currentsubscription, currentFileStorageUsageBytes, planLimit);

        const filename = 'svg.svg';

        cy.visit(channelUrl);
        cy.get('#post_textbox', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');

        // # Attach file
        cy.get('#advancedTextEditorCell').find('#fileUploadInput').attachFile(filename);
        waitUntilUploadComplete();

        // banner does not show
        cy.get('#cloud_file_limit_banner').should('not.exist');
    });

    it('Show file limits banner for non admin uploading files when above current freemium file storage limit', () => {
        // # Login user
        cy.apiLogin(createdUser);

        const currentFileStorageUsageBytes = 11000000000;
        const planLimit = 10000000000; // 1.2GB
        const currentsubscription = {
            id: 'sub_test1',
            product_id: 'prod_1',
            is_free_trial: 'false',
        };

        simulateSubscription(currentsubscription, currentFileStorageUsageBytes, planLimit);

        const filename = 'svg.svg';

        cy.visit(channelUrl);
        cy.get('#post_textbox', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');

        // # Attach file
        cy.get('#advancedTextEditorCell').find('#fileUploadInput').attachFile(filename);
        waitUntilUploadComplete();

        // * Banner shows
        cy.get('#cloud_file_limit_banner').should('exist');
        cy.get('#cloud_file_limit_banner').contains('Your free plan is limited to 1.2GB of files. New uploads will automatically archive older files');
        cy.get('#cloud_file_limit_banner').contains('notify your admin to upgrade to a paid plan');
    });
});

