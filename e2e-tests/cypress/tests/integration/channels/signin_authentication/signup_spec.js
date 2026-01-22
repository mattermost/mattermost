// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @signin_authentication

import {FixedCloudConfig} from '../../../utils/constants';

describe('Signup Email page', () => {
    let config;

    before(() => {
        // Disable other auth options
        const newSettings = {
            Office365Settings: {Enable: false},
            LdapSettings: {Enable: false},
        };
        cy.apiUpdateConfig(newSettings);

        cy.apiGetConfig().then((data) => {
            ({config} = data);
        });
        cy.apiLogout();

        // # Go to signup email page
        cy.visit('/signup_user_complete');
    });

    it('should render', () => {
        // * check the initialUrl
        cy.url().should('include', '/signup_user_complete');

        // * Check that the login section is loaded
        cy.get('.signup-body').should('be.visible');

        // * Check the title
        cy.title().should('include', config.TeamSettings.SiteName);
    });

    it('should match elements, back button', () => {
        // * Check elements in the header with back button
        cy.findByTestId('back_button').
            should('be.visible').
            and('have.text', 'Back');
        cy.get('#back_button_icon').
            should('be.visible').
            and('have.attr', 'title', 'Back Icon');
    });

    it('should match elements, body', () => {
        // * Check elements in the body
        cy.get('.signup-body').should('be.visible');
        cy.get('.header-logo-link').should('be.visible');
        cy.get('.signup-body-card-title').should('contain', config.TeamSettings.CustomDescriptionText);
        cy.get('.signup-body-message-title').should('contain', 'Let’s get started');
        cy.get('.alternate-link__message').should('contain', 'Already have an account?');
        cy.get('.alternate-link__link').should('contain', 'Log in');
        cy.get('.alternate-link__link').should('have.attr', 'href', '/login');

        cy.get('#input_email').should('be.visible');
        cy.focused().should('have.attr', 'id', 'input_email');

        cy.get('#input_name').should('be.visible').and('have.attr', 'placeholder', 'Choose a Username');
        cy.findByText('You can use lowercase letters, numbers, periods, dashes, and underscores.').should('be.visible');

        cy.get('#input_password-input').should('be.visible').and('have.attr', 'placeholder', 'Choose a Password');
        cy.findByText('Your password must be 5-72 characters long.').should('be.visible');

        cy.get('#saveSetting').scrollIntoView().should('be.visible');
        cy.get('#saveSetting').should('contain', 'Create account');

        // * Check newsletter subscription checkbox text and links
        cy.findByText('I would like to receive Mattermost security updates via newsletter.').should('be.visible');
        cy.findByText(/By subscribing, I consent to receive emails from Mattermost with product updates, promotions, and company news\./).should('be.visible');
        cy.findByText(/I have read the/).parent().within(() => {
            cy.findByRole('link', {name: 'Privacy Policy'}).should('be.visible').and('have.attr', 'href').and('include', 'mattermost.com/pl/privacy-policy/');
            cy.findByRole('link', {name: 'unsubscribe'}).should('be.visible').and('have.attr', 'href').and('include', 'forms.mattermost.com/UnsubscribePage.html');
        });
    });

    it('should match elements, footer', () => {
        const {
            ABOUT_LINK,
            HELP_LINK,
            PRIVACY_POLICY_LINK,
            TERMS_OF_SERVICE_LINK,
        } = FixedCloudConfig.SupportSettings;

        // * Check elements in the footer
        cy.get('.hfroute-footer').scrollIntoView().should('be.visible').within(() => {
            // * Check if about footer link is present
            cy.findByText('About').should('be.visible').
                should('have.attr', 'href').and('match', new RegExp(`${config.SupportSettings.AboutLink || ABOUT_LINK}/*`));

            // * Check if privacy footer link is present
            cy.findByText('Privacy Policy').should('be.visible').
                should('have.attr', 'href').and('match', new RegExp(`${config.SupportSettings.PrivacyPolicyLink || PRIVACY_POLICY_LINK}/*`));

            // * Check if terms footer link is present
            cy.findByText('Terms').should('be.visible').
                should('have.attr', 'href').and('match', new RegExp(`${config.SupportSettings.TermsOfServiceLink || TERMS_OF_SERVICE_LINK}/*`));

            // * Check if help footer link is present
            cy.findByText('Help').should('be.visible').
                should('have.attr', 'href').and('match', new RegExp(`${config.SupportSettings.HelpLink || HELP_LINK}/*`));

            const todaysDate = new Date();
            const currentYear = todaysDate.getFullYear();

            cy.get('.footer-copyright').should('contain', `© ${currentYear} Mattermost Inc.`);
        });
    });
});
