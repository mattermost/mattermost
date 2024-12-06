// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getRandomId} from '../../../utils';

const openPersonalAccessTokensSection = () => {
    // # Click edit for Personal Access Tokens section
    cy.get('#tokensEdit').should('be.visible').click();
};

describe('Personal Access Tokens', () => {
    let testUser: Cypress.UserProfile;
    let userWithoutPermission: Cypress.UserProfile;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testUser = user;
            cy.apiPatchUserRoles(user.id, ['system_user', 'system_user_access_token']);

            cy.apiCreateUser().then(({user}) => {
                cy.apiAddUserToTeam(team.id, user.id);
                userWithoutPermission = user;
            });
        });
    });

    it('MM-TXXXX Admin can create a personal access token', () => {
        // # Enable user access tokens with no expiry
        cy.apiAdminLogin();
        cy.apiUpdateConfig({
            ServiceSettings: {
                EnableUserAccessTokens: true,
                UserAccessTokensMaxExpiresSeconds: 0,
            },
        });
        cy.visit('/');

        // # Open profile settings modal
        cy.uiOpenProfileModal('Security');

        // # Open the personal access tokens section
        openPersonalAccessTokensSection();

        // # Click Create Token button
        cy.findByText('Create Token').click();

        // # Enter token description and save
        const tokenDescription = `admin-token-${getRandomId()}`;
        cy.get('#newTokenDescription').type(tokenDescription);
        cy.findByText('Save').click();

        // * Verify warning about admin token appears
        cy.findByText('You are generating a personal access token with System Admin permissions. Are you sure want to create this token?').should('be.visible');
        cy.findByText('Yes, Create').click();

        // * Verify token was created successfully
        cy.get('.alert.alert-warning').within(() => {
            cy.findByText('Token Description:').should('exist');
            cy.findByText('Token ID:').should('exist');
            cy.findByText('Expires:').should('exist');
            cy.findByText('Access Token:').should('exist');
        });

        // # Close the dialog and confirm
        cy.get('#cancelSetting').click();
        cy.findByText('Yes, I have copied the token').click();

        // # Open the personal access tokens section
        openPersonalAccessTokensSection();

        // * Verify the token appears in the list
        cy.get('.setting-box__item').should('contain', tokenDescription);
    });

    it('MM-TXXXX Can create and revoke a personal access token', () => {
        // # Enable user access tokens with no expiry
        cy.apiAdminLogin();
        cy.apiUpdateConfig({
            ServiceSettings: {
                EnableUserAccessTokens: true,
                UserAccessTokensMaxExpiresSeconds: 0,
            },
        });

        // # Login as test user with required role
        cy.apiLogin(testUser);
        cy.visit('/');

        // # Open profile settings modal
        cy.uiOpenProfileModal('Security');

        // # Open the personal access tokens section
        openPersonalAccessTokensSection();

        // # Click Create Token button
        cy.findByText('Create Token').click();

        // # Enter token description and save
        const tokenDescription = `token-${getRandomId()}`;
        cy.get('#newTokenDescription').type(tokenDescription);
        cy.findByText('Save').click();

        // * Verify token was created successfully
        cy.get('.alert.alert-warning').within(() => {
            cy.findByText('Token Description:').should('exist');
            cy.findByText('Token ID:').should('exist');
            cy.findByText('Expires:').should('exist');
            cy.findByText('Access Token:').should('exist');
        });

        // # Get token ID and verify token value
        cy.findByText('Token ID:').parent().invoke('text').then((text) => {
            const tokenId = text.split('Token ID:')[1].trim();
            expect(tokenId).to.have.length.greaterThan(0);

            // # Close the dialog without confirming copy
            cy.get('#cancelSetting').click();

            // # Confirm token copied
            cy.findByText('Yes, I have copied the token').click();

            // # Click edit for Personal Access Tokens section
            openPersonalAccessTokensSection();

            // * Verify the token appears in the list
            cy.get('.setting-box__item').should('contain', tokenDescription);

            // # Click delete for the token using ID
            cy.get(`#${tokenId}_delete`).click();

            // # Confirm deletion
            cy.findByText('Yes, Delete').click();

            // * Verify token is removed from the list
            cy.findByText('No personal access tokens.').should('be.visible');
        });
    });

    it('MM-TXXXX Users without system_user_access_token role cannot see Personal Access Tokens section', () => {
        // # Enable user access tokens with no expiry
        cy.apiAdminLogin();
        cy.apiUpdateConfig({
            ServiceSettings: {
                EnableUserAccessTokens: true,
                UserAccessTokensMaxExpiresSeconds: 0,
            },
        });

        // # Login as regular user without token role
        cy.apiLogin(userWithoutPermission);
        cy.visit('/');

        // # Open profile settings modal
        cy.uiOpenProfileModal('Security');

        // * Verify the Personal Access Tokens section is not visible
        cy.get('#tokensEdit').should('not.exist');
        cy.findByText('Personal Access Tokens').should('not.exist');
    });

    it('MM-TXXXX Personal Access Tokens section is not visible when tokens are disabled', () => {
        // # Disable user access tokens in system config
        cy.apiAdminLogin();
        cy.apiUpdateConfig({
            ServiceSettings: {
                EnableUserAccessTokens: false,
            },
        });

        // # Login as user with token role
        cy.apiLogin(testUser);
        cy.visit('/');

        // # Open profile settings modal
        cy.uiOpenProfileModal('Security');

        // * Verify the Personal Access Tokens section is not visible even for users with the role
        cy.get('#tokensEdit').should('not.exist');
        cy.findByText('Personal Access Tokens').should('not.exist');

        // # Login as user without token role
        cy.apiLogin(userWithoutPermission);
        cy.visit('/');

        // # Open profile settings modal
        cy.uiOpenProfileModal('Security');

        // * Verify the Personal Access Tokens section is not visible
        cy.get('#tokensEdit').should('not.exist');
        cy.findByText('Personal Access Tokens').should('not.exist');
    });

    it('MM-TXXXX Shows Never for token expiry when UserAccessTokensMaxExpiresSeconds is 0', () => {
        // # Enable user access tokens with no expiry
        cy.apiAdminLogin();
        cy.apiUpdateConfig({
            ServiceSettings: {
                EnableUserAccessTokens: true,
                UserAccessTokensMaxExpiresSeconds: 0,
            },
        });

        // # Login as test user with required role
        cy.apiLogin(testUser);
        cy.visit('/');

        // # Open profile settings modal
        cy.uiOpenProfileModal('Security');

        // # Open the personal access tokens section
        openPersonalAccessTokensSection();

        // # Click Create Token button
        cy.findByText('Create Token').click();

        // # Enter token description and save
        const tokenDescription = `token-${getRandomId()}`;
        cy.get('#newTokenDescription').type(tokenDescription);
        cy.findByText('Save').click();

        // * Verify token was created successfully
        cy.get('.alert.alert-warning').within(() => {
            cy.findByText('Token Description:').should('exist');
            cy.findByText('Token ID:').should('exist');
            cy.findByText('Expires:').should('exist').parent().should('contain', 'Never');
            cy.findByText('Access Token:').should('exist');
        });

        // # Close the dialog and confirm
        cy.get('#cancelSetting').click();
        cy.findByText('Yes, I have copied the token').click();
    });

    it('MM-TXXXX Shows expiry timestamp when UserAccessTokensMaxExpiresSeconds is set', () => {
        // # Set token expiry to 300 seconds
        cy.apiAdminLogin();
        cy.apiUpdateConfig({
            ServiceSettings: {
                EnableUserAccessTokens: true,
                UserAccessTokensMaxExpiresSeconds: 300,
            },
        });

        // # Login as test user with required role
        cy.apiLogin(testUser);
        cy.visit('/');

        // # Open profile settings modal
        cy.uiOpenProfileModal('Security');

        // # Open the personal access tokens section
        openPersonalAccessTokensSection();

        // # Click Create Token button
        cy.findByText('Create Token').click();

        // # Enter token description and save
        const tokenDescription = `token-${getRandomId()}`;
        cy.get('#newTokenDescription').type(tokenDescription);
        cy.findByText('Save').click();

        // * Verify token was created successfully
        cy.get('.alert.alert-warning').within(() => {
            cy.findByText('Token Description:').should('exist');
            cy.findByText('Token ID:').should('exist');

            // * Verify token shows expiry timestamp
            cy.findByText('Expires:').parent().invoke('text').then((text) => {
                const expiryText = text.split('Expires:')[1].trim();
                expect(expiryText).to.have.length.greaterThan(0);
                expect(expiryText).to.not.equal('Never');

                // Convert expiry text to timestamp and verify it's roughly 300 seconds in the future
                const expiryTime = new Date(expiryText).getTime();
                const now = Date.now();
                const diff = Math.abs(((expiryTime - now) / 1000) - 300);
                expect(diff).to.be.lessThan(30); // Allow 30 seconds tolerance
            });

            cy.findByText('Access Token:').should('exist');
        });

        // # Close the dialog and confirm
        cy.get('#cancelSetting').click();
        cy.findByText('Yes, I have copied the token').click();
    });
});
