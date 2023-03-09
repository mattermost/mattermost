// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @system_console

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Customization', () => {
    beforeEach(() => {
        // # as many of the tests logout the user, ensure it's logged
        // in as an admin before each test
        cy.apiAdminLogin();

        // # Visit customization system console page
        cy.visit('/admin_console/site_config/customization');
        cy.get('.admin-console__header').should('be.visible').and('have.text', 'Customization');
    });

    it('MM-T1024 - Can change name and desc with Custom Branding set to false', () => {
        // # Make sure necessary field is false
        cy.apiUpdateConfig({TeamSettings: {EnableCustomBrand: false}});

        // * Verify that setting is visible and matches text content
        cy.findByTestId('TeamSettings.SiteNamelabel').scrollIntoView().should('be.visible').and('have.text', 'Site Name:');

        // # Update both Site Name and Description to store test values
        const siteName = 'Mattermost_Text';
        const siteDescription = 'This is a testing Mattermost site';
        cy.findByTestId('TeamSettings.SiteNameinput').clear().type(siteName);
        cy.findByTestId('TeamSettings.CustomDescriptionTextinput').clear().type(siteDescription);

        // # Save setting
        saveSetting();

        // # Logout
        cy.apiLogout();

        // * Ensure that the user was redirected to the login page after the logout
        cy.url().should('include', '/login');

        // * Ensure Site Name and Description are shown the updated values in the login screen
        cy.findByRole('link', {name: siteName}).should('be.visible');
        cy.get('.login-body-card-title').should('have.text', siteDescription);
    });

    it('MM-T1025 - Site Name - Product Menu ➜ About and About Modal show custom name', () => {
        // * Verify that setting is visible and matches text content
        cy.findByTestId('TeamSettings.SiteNamelabel').scrollIntoView().should('be.visible').and('have.text', 'Site Name:');

        // # Update Site Name test value
        const siteName = "A team's instance";
        cy.findByTestId('TeamSettings.SiteNameinput').clear().type(siteName);

        // # Save setting
        saveSetting();

        // # Exit settings
        cy.visit('/');

        // # Open About Mattermost menu option
        cy.uiOpenProductMenu(`About ${siteName}`);

        // * Verify in the about modal that the new site name is being shown
        cy.get('#aboutModalLabel').should('be.visible').and('have.text', `About ${siteName}`);
    });

    it('MM-T1026 - Custom Branding - Name character limit', () => {
        // * Verify that setting is visible and matches text content
        cy.findByTestId('TeamSettings.SiteNamelabel').scrollIntoView().should('be.visible').and('have.text', 'Site Name:');

        // Character limit is 30, and Mattermost is exactly 10 characters long
        const siteName = 'Mattermost'.repeat(3);

        // # Type the maximum amount of characters and then some more
        cy.findByTestId('TeamSettings.SiteNameinput').clear().type(siteName + 'something else');

        // * Verify that the input field didn't accept more characters than the limit
        cy.findByTestId('TeamSettings.SiteNameinput').should('have.value', siteName);

        // # Save setting
        saveSetting();

        // * Verify that the value was saved correctly, without the extra characters
        cy.apiGetConfig().then(({config}) => {
            expect(config.TeamSettings.SiteName).to.equal(siteName);
        });
    });

    it('MM-T1027 - Custom branding is enabled but no image has been uploaded', () => {
        // # Ensure that the brand image is deleted
        cy.apiDeleteBrandImage();
        cy.reload();

        // # Set Enable Custom Branding to true
        cy.findByTestId('TeamSettings.EnableCustomBrandtrue').check();

        // # Save setting
        saveSetting();

        // # Logout from the current user
        cy.apiLogout();

        // * Ensure that the user was redirected to the login page after the logout
        cy.url().should('include', '/login');

        // * Ensure that the signup is loaded and the img doesn't exist
        cy.get('.login-body-custom-branding-image').should('not.exist');
    });

    it('MM-T1028 - Custom brand image and text - true, and uploaded / updated', () => {
        // # Make sure necessary field is false
        cy.apiUpdateConfig({TeamSettings: {EnableCustomBrand: false}});

        // # Ensure that the brand image is deleted
        cy.apiDeleteBrandImage();
        cy.reload();

        // # Enable custom branding
        cy.findByTestId('TeamSettings.EnableCustomBrandtrue').check();

        // # Upload the image
        cy.findByTestId('CustomBrandImage').should('be.visible').within(() => {
            cy.get('input').attachFile('mattermost-icon.png');
        });

        // * Verify that custom brand image setting is visible and matches text content
        cy.findByTestId('TeamSettings.CustomBrandTextlabel').scrollIntoView().should('be.visible').and('have.text', 'Custom Brand Text:');

        // # Update custom brand text
        const customBrandText = 'This is a custom brand text';
        cy.findByTestId('TeamSettings.CustomBrandTextinput').clear().type(customBrandText);

        // # Save setting
        saveSetting();

        // # Logout from the current user
        cy.apiLogout();

        // * Ensure that the user was redirected to the login page after the logout
        cy.url().should('include', '/login');

        // * Verify that the image is visible
        cy.get('.login-body-custom-branding-image').should('exist').and('be.visible');

        cy.get('.login-body-custom-branding-markdown').first().within(() => {
            // * Ensure that the custom brand text has been updated
            cy.get('p').should('have.text', customBrandText);
        });
    });

    it('MM-T1029 - Custom branding text can render markdown text', () => {
        // # Visit emoji system console page
        cy.visit('/admin_console/site_config/emoji');
        cy.get('.admin-console__header').should('be.visible').and('have.text', 'Emoji');

        // # Set Enable Custom Emoji to true
        cy.findByTestId('ServiceSettings.EnableCustomEmojitrue').check();

        // # Save setting
        saveSetting();

        // * Visit the add custom emoji page for ad-1
        cy.visit('/ad-1/emoji/add');
        cy.get('.backstage-header').should('be.visible');

        // * Ensure the form is visible
        cy.get('.backstage-form').should('be.visible').within(() => {
            // # Fill the emoji data
            cy.get('input#name').clear().type('yay');
            cy.get('input#select-emoji').attachFile('mattermost-icon.png');

            // # Save emoji
            cy.get('.backstage-form__footer button').click();
        });

        // # Make sure necessary field is true
        cy.apiUpdateConfig({TeamSettings: {EnableCustomBrand: true}});
        cy.reload();

        // # Visit customization system console page
        cy.visit('/admin_console/site_config/customization');
        cy.get('.admin-console__header').should('be.visible').and('have.text', 'Customization');

        // eslint-disable-next-line no-irregular-whitespace
        const customBrandText = `​​​​:yay:
:smile:

- This is a bullet point
- This is another bullet point

**This has been bolded**
~~This has been strikethrough~~
*This has been italicized*
[This is a link to mattermost.com](https://mattermost.com)
` + '`This is inline code`'; // eslint-disable-line no-useless-concat

        // # Update custom brand text
        cy.findByTestId('TeamSettings.CustomBrandTextinput').clear().type(customBrandText);

        // # Save setting
        saveSetting();

        // # Logout
        cy.apiLogout();

        // * Ensure that the user was redirected to the login page after the logout
        cy.url().should('include', '/login');

        cy.get('.login-body-custom-branding-markdown').first().scrollIntoView().should('be.visible').within(() => {
            // * Ensure custom emoji has been rendered
            // ToDo: uncomment after fixing MM-12657
            //cy.get('span.emoticon').should('have.attr', 'title', ':yay:');

            // * Ensure default emoji has been rendered
            cy.get('span.emoticon').should('have.attr', 'title', ':smile:');

            // * Ensure the list and two bullets have been rendered
            cy.get('ul.markdown__list').should('be.visible').within(() => {
                cy.contains('This is a bullet point');
                cy.contains('This is another bullet point');
            });

            // * Find within the paragraph after the list
            cy.get('ul+p').should('be.visible').within(() => {
                // * Ensure the bold text has been rendered
                cy.get('strong').should('be.visible').and('have.text', 'This has been bolded');

                // * Ensure the strikethrough text has been rendered
                cy.get('del').should('be.visible').and('have.text', 'This has been strikethrough');

                // * Ensure the italic text has been rendered
                cy.get('em').should('be.visible').and('have.text', 'This has been italicized');

                // * Ensure the link has been rendered
                cy.get('a.markdown__link').should('be.visible').and('have.text', 'This is a link to mattermost.com').and('have.attr', 'href', 'https://mattermost.com');

                // * Ensure the inline code has been rendered
                cy.get('.codespan__pre-wrap').should('be.visible').and('have.text', 'This is inline code');
            });
        });
    });

    it('MM-T1030 - Custom branding removed - Default site name and description, and brand image and text - false', () => {
        // # Make sure necessary field is true
        cy.apiUpdateConfig({TeamSettings: {EnableCustomBrand: true}});
        cy.reload();

        // * Verify that setting is visible and matches text content
        cy.findByTestId('TeamSettings.SiteNamelabel').scrollIntoView().should('be.visible').and('have.text', 'Site Name:');

        // # Update both Site Name and Description to store default or empty values
        const siteName = 'Mattermost';
        cy.findByTestId('TeamSettings.SiteNameinput').clear().type(siteName);
        cy.findByTestId('TeamSettings.CustomDescriptionTextinput').clear();

        // # Remove the brand image
        cy.get('button.remove-image__btn').should('be.visible').click();

        // # Set Enable Custom Branding to false
        cy.findByTestId('TeamSettings.EnableCustomBrandfalse').check();

        // # Save setting
        saveSetting();

        // # Logout
        cy.apiLogout();

        // * Ensure that the user was redirected to the login page after the logout
        cy.url().should('include', '/login');

        // * Ensure that the default Site Name is shown in the login screen
        cy.get('.header-logo-link svg').should('be.visible');

        // * Ensure Description have the default values
        cy.findByText('Collaborate with your team in real-time').should('exist').and('be.visible');

        // * Ensure that the custom branding img is not visible
        cy.get('.login-body-custom-branding-image').should('not.exist');

        // * Ensure that the custom branding text is not visible
        cy.get('.login-body-custom-branding-markdown').should('not.exist');
    });

    it('MM-T1282 - Site Name help text matches text field behavior', () => {
        // * Verify that the existing Site Name is empty
        cy.findByTestId('TeamSettings.SiteNameinput').should('be.empty');

        // # Configure a custom Site Name
        const siteName = 'MM-T1282';
        cy.findByTestId('TeamSettings.SiteNameinput').clear().type(siteName);

        // # Save setting
        saveSetting();

        // # Logout
        cy.apiLogout();

        // * Ensure that the user was redirected to the login page after the logout
        cy.url().should('include', '/login');

        // * Ensure that the custom Site Name is shown
        cy.findByRole('link', {name: siteName}).should('be.visible');

        // # Log back in as an administrator
        cy.apiAdminLogin();

        // # Visit customization system console page
        cy.visit('/admin_console/site_config/customization');

        // * Ensure that the 'about' link and modal render the custom Site Name
        verifySiteNameInAboutModal(siteName);

        // # Empty the Site Name configuration
        cy.findByTestId('TeamSettings.SiteNameinput').clear();

        // # Save setting
        saveSetting();

        // # Logout
        cy.apiLogout();

        // * Ensure that the user was redirected to the login page after the logout
        cy.url().should('include', '/login');

        // * Ensure that the default Site Name is shown in the login screen
        cy.get('.header-logo-link svg').should('be.visible');

        // # Log back in as an administrator
        cy.apiAdminLogin();

        // # Visit customization system console page
        cy.visit('/admin_console/site_config/customization');

        // * Ensure that the 'about' link and modal render the default Site Name
        verifySiteNameInAboutModal('Mattermost');
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

function verifySiteNameInAboutModal(siteName) {
    // # Open the hamburger menu
    cy.get('button > span[class="menu-icon"]').click();

    // # Click to open about modal
    cy.findByText(`About ${siteName}`).click();

    // * Verify about text is visible
    cy.findByText(`About ${siteName}`).should('be.visible');

    // # Close the modal
    cy.get('div.modal-header button.close').should('exist').click();
}
