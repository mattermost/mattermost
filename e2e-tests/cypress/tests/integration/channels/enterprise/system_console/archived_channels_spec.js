// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @system_console

import * as TIMEOUTS from '../../../../fixtures/timeouts';

describe('Archived channels', () => {
    let testChannel;

    before(() => {
        cy.apiRequireLicense();

        cy.apiUpdateConfig({
            TeamSettings: {
                ExperimentalViewArchivedChannels: true,
            },
        });

        cy.apiInitSetup({
            channelPrefix: {name: '000-archive', displayName: '000 Archive Test'},
        }).then(({channel}) => {
            testChannel = channel;

            // # Archive the channel
            cy.apiDeleteChannel(testChannel.id);
        });
    });

    it('are present in the channels list view', () => {
        // # Go to the channels list view
        cy.visit('/admin_console/user_management/channels');

        // * Verify the archived channel is visible
        cy.findByText(testChannel.display_name, {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');

        // * Verify the deleted channel displays the correct icon
        cy.findByTestId(`${testChannel.name}-archive-icon`).should('be.visible');
    });

    it('appear in the search results of the channels list view', () => {
        // # Go to the channels list view
        cy.visit('/admin_console/user_management/channels');

        // # Search for the archived channel
        cy.findByTestId('searchInput', {timeout: TIMEOUTS.ONE_MIN}).type(`${testChannel.display_name}{enter}`);

        // * Verify the archived channel is in the results
        cy.findByText(testChannel.display_name).should('be.visible');
    });

    it('display an unarchive button and a limited set of other UI elements', () => {
        // # Go to the channel details view
        cy.visit(`/admin_console/user_management/channels/${testChannel.id}`);

        // * Verify the Unarchive Channel button is visible
        cy.get('button.btn-secondary', {timeout: TIMEOUTS.TWO_SEC}).should('have.text', 'Unarchive Channel').should('be.visible').should('be.enabled');

        // * Verify that only one widget is visible
        cy.get('div.AdminPanel').should('be.visible').and('have.length', 1);
    });

    it('can be unarchived', () => {
        // # Go to the channel details view
        cy.visit(`/admin_console/user_management/channels/${testChannel.id}`);

        // # Click Unarchive Channel button
        cy.get('button.btn-secondary', {timeout: TIMEOUTS.TWO_SEC}).findAllByText('Unarchive Channel').click();

        // * Verify the Archive Channel button is visible
        cy.get('button.btn-secondary.btn-danger', {timeout: TIMEOUTS.TWO_SEC}).findAllByText('Archive Channel').should('be.visible');

        // * Verify that the other widget appears
        cy.get('div.AdminPanel').should('be.visible').should('have.length', 5);

        // # Save and wait for redirect
        cy.get('#saveSetting').click();
        cy.get('.DataGrid', {timeout: TIMEOUTS.TWO_SEC}).scrollIntoView().should('be.visible');

        // * Verify via the API that the channel is unarchived
        cy.apiGetChannel(testChannel.id).then(({channel}) => {
            expect(channel.delete_at).to.eq(0);
        });
    });
});
