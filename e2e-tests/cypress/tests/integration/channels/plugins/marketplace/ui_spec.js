// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @not_cloud @plugin_marketplace @plugin @plugins_uninstall

import * as TIMEOUTS from '../../../../fixtures/timeouts';
import {githubPluginOld} from '../../../../utils/plugins';

describe('Plugin Marketplace', () => {
    let townsquareLink;

    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.shouldHavePluginUploadEnabled();

        cy.apiInitSetup().then(({team}) => {
            townsquareLink = `/${team.name}/channels/town-square`;
        });
    });

    beforeEach(() => {
        // # Enable Plugin Marketplace and Remote Marketplace
        // # Disable Plugin State Github and Webex
        cy.apiUpdateConfig({
            PluginSettings: {
                Enable: true,
                EnableMarketplace: true,
                EnableRemoteMarketplace: true,
                MarketplaceURL: 'https://api.integrations.mattermost.com',
                PluginStates: {
                    github: {
                        Enable: false,
                    },
                    'com.mattermost.webex': {
                        Enable: false,
                    },
                },
            },
        });

        // # Cleanup installed plugins
        cy.apiUninstallAllPlugins();

        // # Visit the Town Square channel
        cy.visit(townsquareLink);

        // # Open up marketplace
        cy.uiOpenProductMenu('Marketplace');

        // * Verify error bar should not be visible
        cy.get('#error_bar').should('not.exist');

        // * Verify search should be visible
        cy.findByPlaceholderText('Search Marketplace').scrollIntoView().should('be.visible');

        // * Verify tabs should be visible
        cy.get('#marketplaceTabs').should('be.visible');

        // * Verify all plugins tab button should be visible
        cy.get('#marketplaceTabs-tab-allListing').should('be.visible');

        // * Verify installed plugins tabs button should be visible
        cy.get('#marketplaceTabs-tab-installed').should('be.visible');

        // * Verify list of all plugins are visible
        cy.get('#marketplaceTabs-pane-allListing').should('be.visible');
    });

    it('MM-T2001 autofocus on search plugin input box', () => {
        cy.uiClose();

        // # Open up marketplace
        cy.uiOpenProductMenu('Marketplace');

        // * Verify search plugins should be focused
        cy.findByPlaceholderText('Search Marketplace').should('be.focused');
    });

    it('render the list of all plugins by default', () => {
        // * Verify all plugins tab should be active
        cy.get('#marketplaceTabs-tab-allListing').should('be.visible').parent().should('have.class', 'active');
        cy.get('#marketplaceTabs-pane-allListing').should('be.visible');

        // * Verify installed plugins tab should not be active
        cy.get('#marketplaceTabs-tab-installed').should('be.visible').parent().should('not.have.class', 'active');
        cy.get('#marketplaceTabs-pane-installed').should('not.exist');
    });

    // this test uses exist, not visible, due to issues with Cypress
    it('render the list of installed plugins on demand', () => {
        // # Click on installed plugins tab
        cy.get('#marketplaceTabs-tab-installed').should('be.visible').click();

        // * Verify all plugins tab should not be active
        cy.get('#marketplaceTabs-tab-allListing').should('be.visible').parent().should('not.have.class', 'active');
        cy.get('#marketplaceTabs-pane-allListing').should('not.exist');

        // * Verify installed plugins tab is shown
        cy.get('#marketplaceTabs-tab-installed').should('be.visible').parent().should('have.class', 'active');
        cy.get('#marketplaceTabs-pane-installed').should('be.visible');
    });

    it('should close the modal on demand', () => {
        // * Verify marketplace is be visible
        cy.get('#modal_marketplace').should('be.visible');

        // # Close marketplace modal
        cy.uiClose();

        // * Verify marketplace should not be visible
        cy.get('#modal_marketplace').should('not.exist');
    });

    it('should filter all on search', () => {
        // # Load all plugins before searching
        cy.get('.more-modal__row').should('have.length', 15);

        // # Filter to jira plugin only
        cy.findByPlaceholderText('Search Marketplace').
            scrollIntoView().
            should('be.visible').
            type('jira');

        // * Verify jira plugin should be visible
        cy.get('#marketplace-plugin-jira').should('be.visible');

        // * Verify no other plugins should be visible
        cy.get('#marketplaceTabs-pane-allListing').
            find('.more-modal__row').
            should('have.length', 1);
    });

    it('should show an error bar on failing to filter', () => {
        // # Enable Plugin Marketplace
        cy.apiUpdateConfig({
            PluginSettings: {
                Enable: true,
                EnableMarketplace: true,
                MarketplaceURL: 'example.com',
            },
        });

        // # Filter to jira plugin only
        cy.findByPlaceholderText('Search Marketplace').scrollIntoView().should('be.visible').type('jira');

        // * Verify should be an error connecting to the marketplace server
        cy.get('#error_bar').contains('Error connecting to the marketplace server');
    });

    it('should install a plugin on demand', () => {
        // # Uninstall any existing webex plugin
        cy.apiRemovePluginById('com.mattermost.webex');

        // * Verify webex plugin should be visible
        cy.findByText('Next').click();
        cy.get('#marketplace-plugin-com\\.mattermost\\.webex').scrollIntoView().should('be.visible');

        // # Install the webex plugin
        cy.get('#marketplace-plugin-com\\.mattermost\\.webex').find('.btn.btn-primary').click();

        // * Verify should show "Configure" after installation
        cy.get('#marketplace-plugin-com\\.mattermost\\.webex').find('.btn.btn-outline', {timeout: TIMEOUTS.ONE_MIN}).scrollIntoView().should('be.visible').and('have.text', 'Configure');
    });

    it('should install a plugin from search results on demand', () => {
        // # Uninstall any existing webex plugin
        cy.apiRemovePluginById('com.mattermost.webex');

        // # Filter to webex plugin only
        cy.findByPlaceholderText('Search Marketplace').scrollIntoView().should('be.visible').type('webex');

        // * Verify no other plugins should be visible
        cy.get('#marketplaceTabs-pane-allListing').find('.more-modal__row').should('have.length', 1);

        // * Verify webex plugin should be visible
        cy.get('#marketplace-plugin-com\\.mattermost\\.webex').scrollIntoView().should('be.visible');

        // # Install the webex plugin
        cy.get('#marketplace-plugin-com\\.mattermost\\.webex').find('.btn.btn-primary').click();

        // * Verify should show "Configure" after installation
        cy.get('#marketplace-plugin-com\\.mattermost\\.webex').find('.btn.btn-outline', {timeout: TIMEOUTS.ONE_MIN}).scrollIntoView().should('be.visible').and('have.text', 'Configure');

        // * Verify search filter should be maintained
        cy.get('#marketplaceTabs-pane-allListing').find('.more-modal__row').should('have.length', 1);
    });

    it('should prompt to update an old GitHub plugin from all plugins', () => {
        // # Install old version of GitHub plugin
        cy.apiInstallPluginFromUrl(githubPluginOld.url, true);

        // # Scroll to GitHub plugin
        cy.get('#marketplace-plugin-github').scrollIntoView().should('be.visible');

        // * Verify github plugin should have update prompt
        cy.get('#marketplace-plugin-github').find('.update').should('be.visible').and('to.contain', 'Update available');

        // * Verify github plugin should have update link
        cy.get('#marketplace-plugin-github').find('.update b a').should('be.visible').and('have.text', 'Update');

        // # Update GitHub plugin
        cy.get('#marketplace-plugin-github .update b a').click();

        // * Verify confirmation modal should be visible
        cy.get('#confirmModal').should('be.visible');

        // # Confirm update
        cy.get('#confirmModal').find('.btn.btn-primary').click();

        // * Verify confirmation modal should not be visible
        cy.get('#confirmModal').should('not.exist');

        // * Verify github plugin update prompt should not be visible
        cy.get('#marketplace-plugin-github').find('.update').should('not.exist');

        // * Verify should show "Configure" after installation
        cy.get('#marketplace-plugin-github').find('.btn.btn-outline', {timeout: TIMEOUTS.ONE_MIN}).scrollIntoView().should('be.visible').and('have.text', 'Configure');

        // * Verify github plugin should still be visible
        cy.get('#marketplace-plugin-github').should('be.visible');
    });

    it('MM-T1986 change tab to "All Plugins" when "Install Plugins" link is clicked', () => {
        cy.get('#marketplaceTabs').scrollIntoView().should('be.visible').within(() => {
            // # Switch tab to installed plugin
            cy.findByRole('tab', {name: /Installed/}).should('be.visible').and('have.attr', 'aria-selected', 'false').click();

            // * Verify installed plugins tab should be active
            cy.get('#marketplaceTabs-tab-allListing').should('be.visible').parent().should('not.have.class', 'active');
            cy.get('#marketplaceTabs-tab-installed').should('be.visible').parent().should('have.class', 'active');

            // # Click on Install Plugins should change current tab
            cy.findByText('Install Plugins').should('be.visible').click();

            // * Verify all plugins tab should be active
            cy.findByRole('tab', {name: 'All'}).should('be.visible').and('have.attr', 'aria-selected', 'true');
            cy.get('#marketplaceTabs-tab-allListing').should('be.visible').parent().should('have.class', 'active');
            cy.get('#marketplaceTabs-tab-installed').should('be.visible').parent().should('not.have.class', 'active');
        });
    });
});
