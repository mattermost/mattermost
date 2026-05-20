// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @system_console @high_availability @not_cloud

describe('Cluster', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();

        // * Check if server has license
        cy.apiRequireLicense();

        // # Reset Gossip Encryption
        cy.apiUpdateConfig({
            ClusterSettings: {
                Enable: null,
                EnableGossipEncryption: null,
            },
        });

        // # Visit high availability system console page
        cy.visit('/admin_console/environment/high_availability');
    });

    it('SC25050 - Can change Gossip Encryption', () => {
        cy.findByTestId('EnableGossipEncryption').scrollIntoView().should('be.visible').within(() => {
            // * Verify that setting is visible and matches text content
            cy.get('.control-label').should('be.visible').and('have.text', 'Enable Gossip encryption:');

            // * Verify that the help setting is visible and matches text content
            const contents = 'When true, all communication through the gossip protocol will be encrypted.';
            cy.get('.help-text').should('be.visible').and('have.text', contents);

            // * Verify that Gossip Encryption is set to true by default
            cy.get('#EnableGossipEncryptiontrue').should('have.attr', 'checked');
        });

        // # Enable Gossip Encryption
        cy.apiUpdateConfig({
            ClusterSettings: {
                Enable: true,
                EnableGossipEncryption: true,
            },
        });
        cy.reload();

        cy.findByTestId('EnableGossipEncryption').scrollIntoView().should('be.visible').within(() => {
            // * Verify that Gossip Encryption is set to true
            cy.get('#EnableGossipEncryptiontrue').should('have.attr', 'checked');
        });
    });

    it('Can change Gossip Compression', () => {
        cy.findByTestId('EnableGossipCompression').scrollIntoView().should('be.visible').within(() => {
            // * Verify that setting is visible and matches text content
            cy.get('.control-label').should('be.visible').and('have.text', 'Enable Gossip compression:');

            // * Verify that the help setting is visible and matches text content
            const contents = 'When true, all communication through the gossip protocol will be compresssed. It is recommended to keep this flag disabled.';
            cy.get('.help-text').should('be.visible').and('have.text', contents);

            // * Verify that Gossip Compression is set to true by default
            cy.get('#EnableGossipCompressiontrue').should('have.attr', 'checked');
        });

        // # Disable Gossip Compression
        cy.apiUpdateConfig({
            ClusterSettings: {
                Enable: true,
                EnableGossipCompression: false,
            },
        });
        cy.reload();

        cy.findByTestId('EnableGossipCompression').scrollIntoView().should('be.visible').within(() => {
            // * Verify that Gossip Compression is set to false
            cy.get('#EnableGossipCompressionfalse').should('have.attr', 'checked');
        });
    });
});
