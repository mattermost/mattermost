// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @not_cloud @system_console

import * as TIMEOUTS from '../../../../fixtures/timeouts';

describe('Customization', () => {
    let origConfig;

    before(() => {
        cy.shouldNotRunOnCloudEdition();

        // Get config
        cy.apiGetConfig().then(({config}) => {
            origConfig = config;
        });

        // # Visit customization system console page
        cy.visit('/admin_console/site_config/customization');
        cy.get('.admin-console__header').should('be.visible').and('have.text', 'Customization');
    });

    it('MM-T1214 - Can change Report a Problem Link setting', () => {
        // * Verify Report a Problem link label is visible and matches the text
        cy.findByTestId('SupportSettings.ReportAProblemLinklabel').scrollIntoView().should('be.visible').and('have.text', 'Report a Problem Link:');

        // * Verify Report a Problem link input box has default value. The default value depends on the setup before running the test.
        cy.findByTestId('SupportSettings.ReportAProblemLinkinput').should('have.value', origConfig.SupportSettings.ReportAProblemLink);

        // * Verify Report a Problem link help text is visible and matches the text
        cy.findByTestId('SupportSettings.ReportAProblemLinkhelp-text').find('span').should('be.visible').and('have.text', 'The URL for the Report a Problem link in the Help Menu. If this field is empty, the link is removed from the Help Menu.');

        // # Enter a problem link
        const reportAProblemLink = 'https://mattermost.com/pl/report-a-bug';
        cy.findByTestId('SupportSettings.ReportAProblemLinkinput').clear().type(reportAProblemLink);

        // # Save setting
        saveSetting();

        // Get config again
        cy.apiGetConfig().then(({config}) => {
            // * Verify the Report a Problem link is saved, directly via REST API
            expect(config.SupportSettings.ReportAProblemLink).to.eq(reportAProblemLink);
        });
    });

    it('MM-T1212 - Can change Privacy Policy Link setting', () => {
        // * Verify that setting is visible and matches text content
        cy.findByTestId('SupportSettings.PrivacyPolicyLinklabel').scrollIntoView().should('be.visible').and('have.text', 'Privacy Policy Link:');

        // * Verify that help setting is visible and matches text content
        const content = 'The URL for the Privacy link on the login and sign-up pages. If this field is empty, the Privacy link is hidden from users.';
        cy.findByTestId('SupportSettings.PrivacyPolicyLinkhelp-text').scrollIntoView().find('span').should('be.visible').and('have.text', content);

        // * Verify the input box visible and has default value
        cy.findByTestId('SupportSettings.PrivacyPolicyLinkinput').scrollIntoView().should('have.value', origConfig.SupportSettings.PrivacyPolicyLink).and('be.visible');

        // # Fill input field with value
        const stringToSave = 'https://some.com';
        cy.findByTestId('SupportSettings.PrivacyPolicyLinkinput').clear().type(stringToSave);

        // # Save setting
        saveSetting();

        // * Verify that the value is save, directly via REST API
        cy.apiGetConfig().then(({config}) => {
            expect(config.SupportSettings.PrivacyPolicyLink).to.equal(stringToSave);
        });
    });

    it('MM-T1216 Can change Android App Download Link setting', () => {
        // # Scroll Android App Download Link section into view and verify that it's visible
        cy.findByTestId('NativeAppSettings.AndroidAppDownloadLink').scrollIntoView().should('be.visible');

        // * Verify that Android App Download Link label is visible and matches text content
        cy.findByTestId('NativeAppSettings.AndroidAppDownloadLinklabel').should('be.visible').and('have.text', 'Android App Download Link:');

        // * Verify the Android App Download Link input box has default value. The default value depends on the setup before running the test.
        cy.findByTestId('NativeAppSettings.AndroidAppDownloadLinkinput').should('have.value', origConfig.NativeAppSettings.AndroidAppDownloadLink);

        // * Verify that the help text is visible and matches text content
        cy.findByTestId('NativeAppSettings.AndroidAppDownloadLinkhelp-text').find('span').should('be.visible').and('have.text', 'Add a link to download the Android app. Users who access the site on a mobile web browser will be prompted with a page giving them the option to download the app. Leave this field blank to prevent the page from appearing.');

        const newAndroidAppDownloadLink = 'https://example.com/android-app/';

        // * Verify that set value is visible and matches text
        cy.findByTestId('NativeAppSettings.AndroidAppDownloadLinkinput').clear().type(newAndroidAppDownloadLink).should('have.value', newAndroidAppDownloadLink);

        // # Save setting
        saveSetting();

        // * Verify that the config is correctly saved in the server
        cy.apiGetConfig().then(({config}) => {
            expect(config.NativeAppSettings.AndroidAppDownloadLink).to.equal(newAndroidAppDownloadLink);
        });
    });

    it('MM-T1217 Can change iOS App Download Link setting', () => {
        // # Scroll iOS App Download Link section into view and verify that it's visible
        cy.findByTestId('NativeAppSettings.IosAppDownloadLink').scrollIntoView().should('be.visible');

        // * Verify that iOS App Download Link label is visible and matches text content
        cy.findByTestId('NativeAppSettings.IosAppDownloadLinklabel').should('be.visible').and('have.text', 'iOS App Download Link:');

        // * Verify the iOS App Download Link input box has default value. The default value depends on the setup before running the test.
        cy.findByTestId('NativeAppSettings.IosAppDownloadLinkinput').should('have.value', origConfig.NativeAppSettings.IosAppDownloadLink);

        // * Verify that the help text is visible and matches text content
        cy.findByTestId('NativeAppSettings.IosAppDownloadLinkhelp-text').find('span').should('be.visible').and('have.text', 'Add a link to download the iOS app. Users who access the site on a mobile web browser will be prompted with a page giving them the option to download the app. Leave this field blank to prevent the page from appearing.');

        const newIosAppDownloadLink = 'https://example.com/iOS-app/';

        // * Verify that set value is visible and matches text
        cy.findByTestId('NativeAppSettings.IosAppDownloadLinkinput').clear().type(newIosAppDownloadLink).should('have.value', newIosAppDownloadLink);

        // # Save setting
        saveSetting();

        // * Verify that the config is correctly saved in the server
        cy.apiGetConfig().then(({config}) => {
            expect(config.NativeAppSettings.IosAppDownloadLink).to.equal(newIosAppDownloadLink);
        });
    });

    it('MM-T1215 - Can change Mattermost Apps Download Page Link setting', () => {
        // * Verify Mattermost Apps Download Page Link's setting name is visible and matches the text
        cy.findByTestId('NativeAppSettings.AppDownloadLinklabel').scrollIntoView().should('be.visible').and('have.text', 'Mattermost Apps Download Page Link:');

        // * Verify the Mattermost Apps Download Page Link input box has default value. The default value depends on the setup before running the test.
        cy.findByTestId('NativeAppSettings.AppDownloadLinkinput').should('have.value', origConfig.NativeAppSettings.AppDownloadLink);

        // * Verify the site name's help text is visible and matches the text
        cy.findByTestId('NativeAppSettings.AppDownloadLinkhelp-text').find('span').should('be.visible').and('have.text', 'Add a link to a download page for the Mattermost apps. When a link is present, an option to "Download Mattermost Apps" will be added in the Product Menu so users can find the download page. Leave this field blank to hide the option from the Product Menu.');

        // # Enter new App download link
        const newAppDownloadLink = 'https://example.com/app-download-link/';
        cy.findByTestId('NativeAppSettings.AppDownloadLinkinput').clear().type(newAppDownloadLink);

        // # Save setting
        saveSetting();

        // Get config again
        cy.apiGetConfig().then(({config}) => {
            // * Verify the App download link is saved, directly via REST API
            expect(config.NativeAppSettings.AppDownloadLink).to.eq(newAppDownloadLink);
        });
    });

    it('MM-T1209 - Can change Help Link setting', () => {
        // * Verify that setting is visible and matches text content
        const contents = ['The URL for the Help link on the Mattermost login page, sign-up pages, and Help Menu. If this field is empty, the Help link is hidden from users.'];
        cy.findByTestId('SupportSettings.HelpLinklabel').scrollIntoView().should('be.visible').and('have.text', 'Help Link:');

        // * Verify that help setting is visible and matches text content
        cy.findByTestId('SupportSettings.HelpLinkhelp-text').scrollIntoView().find('span').should('be.visible').and('have.text', contents[0]);

        // * Verify the input box visible and has default value
        cy.findByTestId('SupportSettings.HelpLinkinput').scrollIntoView().should('have.value', origConfig.SupportSettings.HelpLink).and('be.visible');

        // # Fill input field with value
        const stringToSave = 'https://some.com';
        cy.findByTestId('SupportSettings.HelpLinkinput').clear().type(stringToSave);

        // # Save setting
        saveSetting();

        // * Verify that the value is save, directly via REST API
        cy.apiGetConfig().then(({config}) => {
            expect(config.SupportSettings.HelpLink).to.equal(stringToSave);
        });
    });

    it('MM-T1213 Can change About Link setting', () => {
        const newAboutLink = 'https://mattermost.com/';

        // * Verify that setting is visible and has the correct label text
        cy.findByTestId('SupportSettings.AboutLinklabel').scrollIntoView().should('be.visible').and('have.text', 'About Link:');

        // * Verify that the help text is visible and matches text content
        cy.findByTestId('SupportSettings.AboutLinkhelp-text').should('be.visible').and('have.text', 'The URL for the About link on the Mattermost login and sign-up pages. If this field is empty, the About link is hidden from users.');

        // * Verify that the existing is visible and has default value
        cy.findByTestId('SupportSettings.AboutLinkinput').should('be.visible').and('have.value', origConfig.SupportSettings.AboutLink);

        // # Clear existing about link and type the new about link
        cy.findByTestId('SupportSettings.AboutLinkinput').clear().type(newAboutLink);

        // # Save setting
        saveSetting();

        cy.apiGetConfig().then(({config}) => {
            expect(config.SupportSettings.AboutLink).to.equal(newAboutLink);
        });
    });

    it('MM-T1211 - Can change Terms of Use Link setting', () => {
        // * Verify site name's setting name for is visible and matches the text
        cy.findByTestId('SupportSettings.TermsOfServiceLinklabel').scrollIntoView().should('be.visible').and('have.text', 'Terms of Use Link:');

        // * Verify the site name input box has default value. The default value depends on the setup before running the test.
        cy.findByTestId('SupportSettings.TermsOfServiceLinkinput').should('have.value', origConfig.SupportSettings.TermsOfServiceLink);

        // * Verify the site name's help text is visible and matches the text
        cy.findByTestId('SupportSettings.TermsOfServiceLinkhelp-text').find('span').should('be.visible').and('have.text',
            'Link to the terms under which users may use your online service. By default, this includes the ' +
            '"Mattermost Acceptable Use Policy" explaining the terms under which Mattermost software is ' +
            'provided to end users. If you change the default link to add your own terms for using the service you ' +
            'provide, your new terms must include a link to the default terms so end users are aware of the Mattermost ' +
            'Acceptable Use Policy for Mattermost software.');

        // # Enter a new help link
        const newValue = 'https://test.com';
        cy.findByTestId('SupportSettings.TermsOfServiceLinkinput').clear().type(newValue);

        // # Save setting
        saveSetting();

        // Get config again
        cy.apiGetConfig().then(({config}) => {
            // * Verify the site name is saved, directly via REST API
            expect(config.SupportSettings.TermsOfServiceLink).to.eq(newValue);
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
