// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @not_cloud @system_console

import {fileSizeToString} from '../../../utils';

describe('Unsaved Changes', () => {
    let defaultMaxFileSize;

    before(() => {
        cy.shouldNotRunOnCloudEdition();

        cy.apiGetConfig(true).then(({config}) => {
            defaultMaxFileSize = config.MaxFileSize;
        });
    });

    it('MM-T955 Warning leaving changed page without saving: Leave page, discard changes', () => {
        // # Make a change on any page.
        cy.visit('/admin_console/environment/file_storage');
        cy.findByTestId('FileSettings.MaxFileSizenumber').clear().type('150');

        // # Click a navigation item in left nav.
        cy.findByText('Database').click();

        // # When prompted: Yes, discard changes.
        cy.get('#confirmModal').should('be.visible');
        cy.get('#confirmModalButton').click();

        // * Opens other page, changes discarded.
        cy.url().should('include', '/environment/database');
        cy.visit('/admin_console/environment/file_storage');
        cy.findByTestId('FileSettings.MaxFileSizenumber').should('have.value', fileSizeToString(defaultMaxFileSize).replace('MB', ''));
    });

    it('MM-T956 Warning leaving changed page without saving: Cancel leaving page', () => {
        const draftValue = '150';

        // # Make a change on any page.
        cy.visit('/admin_console/environment/file_storage');
        cy.findByTestId('FileSettings.MaxFileSizenumber').clear().type(draftValue);

        // # Click a navigation item in left nav.
        cy.findByText('Database').click();

        // # When prompted: No, cancel.
        cy.get('#confirmModal').should('be.visible');
        cy.get('#cancelModalButton').click();

        // * Stays on current page, changes kept.
        cy.url().should('include', '/environment/file_storage');
        cy.findByTestId('FileSettings.MaxFileSizenumber').should('have.value', draftValue);
    });
});

