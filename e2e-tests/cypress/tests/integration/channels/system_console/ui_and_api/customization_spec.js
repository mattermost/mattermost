// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @system_console

import * as TIMEOUTS from '../../../../fixtures/timeouts';

describe('Customization', () => {
    let origConfig;

    before(() => {
        // Get config
        cy.apiGetConfig().then(({config}) => {
            origConfig = config;
        });

        // # Visit customization system console page
        cy.visit('/admin_console/site_config/customization');
        cy.get('.admin-console__header').should('be.visible').and('have.text', 'Customization');
    });

    it('MM-T1207 - Can change Custom Brand Image setting', () => {
        // # Make sure necessary field is false
        cy.apiUpdateConfig({TeamSettings: {EnableCustomBrand: false}});
        cy.reload();

        // # Set Enable Custom Branding to true to be able to upload custom brand image
        cy.get('[id="TeamSettings.EnableCustomBrandtrue"]').check();

        cy.findByTestId('CustomBrandImage').should('be.visible').within(() => {
            // * Verify that setting is visible and matches text content
            cy.get('label').should('be.visible').and('have.text', 'Custom Brand Image:');

            // * Verify that help setting is visible and matches text content
            const contents = 'Customize your user experience by adding a custom image to your login screen. Recommended maximum image size is less than 2 MB.';
            cy.get('.help-text').should('be.visible').and('have.text', contents);

            // # upload the image
            cy.get('input').attachFile('mattermost-icon.png');
        });

        // # Save setting
        saveSetting();

        // # Verify that after page reload image exist
        cy.reload();
        cy.findByTestId('CustomBrandImage').should('be.visible').within(() => {
            cy.get('img').should('have.attr', 'src').and('include', '/api/v4/brand/image?t=');
        });
    });

    it('MM-T1204 - Can change Site Name setting', () => {
        // * Verify site name's setting name for is visible and matches the text
        cy.findByTestId('TeamSettings.SiteNamelabel').scrollIntoView().should('be.visible').and('have.text', 'Site Name:');

        // * Verify the site name input box has default value. The default value depends on the setup before running the test.
        cy.findByTestId('TeamSettings.SiteNameinput').should('have.value', origConfig.TeamSettings.SiteName);

        // * Verify the site name's help text is visible and matches the text
        cy.findByTestId('TeamSettings.SiteNamehelp-text').should('be.visible').and('have.text', 'Name of service shown in login screens and UI. When not specified, it defaults to "Mattermost".');

        // # Generate and enter a random site name
        const siteName = 'New site name';
        cy.findByTestId('TeamSettings.SiteNameinput').clear().type(siteName);

        // # Save setting
        saveSetting();

        // Get config again
        cy.apiGetConfig().then(({config}) => {
            // * Verify the site name is saved, directly via REST API
            expect(config.TeamSettings.SiteName).to.eq(siteName);
        });
    });

    it('MM-T1205 - Can change Site Description setting', () => {
        // * Verify site description label is visible and matches the text
        cy.findByTestId('TeamSettings.CustomDescriptionTextlabel').should('be.visible').and('have.text', 'Site Description: ');

        // * Verify the site description input box has default value. The default value depends on the setup before running the test.
        cy.findByTestId('TeamSettings.CustomDescriptionTextinput').should('have.value', origConfig.TeamSettings.CustomDescriptionText);

        // * Verify the site description help text is visible and matches the text
        cy.findByTestId('TeamSettings.CustomDescriptionTexthelp-text').find('span').should('be.visible').and('have.text', 'Displays as a title above the login form. When not specified, the phrase "Log in" is displayed.');

        // # Generate and enter a random site description
        const siteDescription = 'New site description';
        cy.findByTestId('TeamSettings.CustomDescriptionTextinput').clear().type(siteDescription);

        // # Save setting
        saveSetting();

        // Get config again
        cy.apiGetConfig().then(({config}) => {
            // * Verify the site description is saved, directly via REST API
            expect(config.TeamSettings.CustomDescriptionText).to.eq(siteDescription);
        });
    });

    it('MM-T1208 - Can change Custom Brand Text setting', () => {
        // * Verify custom brand text label is visible and matches the text
        cy.findByTestId('TeamSettings.CustomBrandTextlabel').scrollIntoView().should('be.visible').and('have.text', 'Custom Brand Text:');

        // * Verify the custom brand input box has default value. The default value depends on the setup before running the test.
        cy.findByTestId('TeamSettings.CustomBrandTextinput').should('have.value', origConfig.TeamSettings.CustomBrandText);

        // * Verify the custom brand help text is visible and matches the text
        cy.findByTestId('TeamSettings.CustomBrandTexthelp-text').find('span').should('be.visible').and('have.text', 'Text that will appear below your custom brand image on your login screen. Supports Markdown-formatted text. Maximum 500 characters allowed.');

        //Enable custom branding
        cy.findByTestId('TeamSettings.EnableCustomBrandtrue').check({force: true});

        // # Enter a custom brand text
        const customBrandText = 'Random brand text';
        cy.findByTestId('TeamSettings.CustomBrandTextinput').clear().type(customBrandText);

        // # Save setting
        saveSetting();

        // Get config again
        cy.apiGetConfig().then(({config}) => {
            // * Verify the custom brand text is saved, directly via REST API
            expect(config.TeamSettings.CustomBrandText).to.eq(customBrandText);
        });
    });

    it('MM-T1206 - Can change Enable Custom Branding setting', () => {
        // # Make sure necessary field is false
        cy.apiUpdateConfig({TeamSettings: {EnableCustomBrand: false}});
        cy.reload();

        cy.findByTestId('TeamSettings.EnableCustomBrand').should('be.visible').within(() => {
            // * Verify that setting is visible and matches text content
            cy.get('label:first').should('be.visible').and('have.text', 'Enable Custom Branding: ');

            // * Verify that help setting is visible and matches text content
            const content = 'Enable custom branding to show an image of your choice, uploaded below, and some help text, written below, on the login page.';
            cy.get('.help-text').should('be.visible').and('have.text', content);

            // # Set Enable Custom Branding to true
            cy.findByTestId('TeamSettings.EnableCustomBrandtrue').check();
        });

        // # Save setting
        saveSetting();

        // * Verify that the value is save, directly via REST API
        cy.apiGetConfig().then(({config}) => {
            expect(config.TeamSettings.EnableCustomBrand).to.equal(true);
        });

        // # Set Enable Custom Branding to false
        cy.findByTestId('TeamSettings.EnableCustomBrandfalse').check();

        // # Save setting
        saveSetting();

        // * Verify that the value is save, directly via REST API
        cy.apiGetConfig().then(({config}) => {
            expect(config.TeamSettings.EnableCustomBrand).to.equal(false);
        });
    });
});

function saveSetting() {
    // # Click save button, and verify text and visibility
    cy.get('#saveSetting').
        should('have.text', 'Save').
        and('be.enabled').
        click().
        should('be.disabled').
        wait(TIMEOUTS.HALF_SEC);
}
