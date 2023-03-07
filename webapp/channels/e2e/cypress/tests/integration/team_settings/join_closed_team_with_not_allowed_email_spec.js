// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @team_settings

import {getRandomId, stubClipboard} from '../../utils';
import * as TIMEOUTS from '../../fixtures/timeouts';

describe('Team Settings', () => {
    const randomId = getRandomId();
    const emailDomain = 'sample.mattermost.com';
    let testTeam;

    before(() => {
        cy.apiUpdateConfig({
            GuestAccountsSettings: {
                Enable: false,
            },
            LdapSettings: {
                Enable: false,
            },
        });
    });

    beforeEach(() => {
        // # Login as sysadmin
        cy.apiAdminLogin();

        cy.apiInitSetup().then(({team}) => {
            testTeam = team;
            cy.visit(`/${team.name}`);
        });
    });

    it('MM-T387 - Try to join a closed team from a NON-mattermost email address via "Get Team Invite Link" while "Allow only users with a specific email domain to join this team" set to "sample.mattermost.com"', () => {
        stubClipboard().as('clipboard');

        // # Open team menu and click 'Team Settings'
        cy.uiOpenTeamMenu('Team Settings');

        // * Check that the 'Team Settings' modal was opened
        cy.get('#teamSettingsModal').should('exist').within(() => {
            // # Click on the 'Allow only users with a specific email domain to join this team' edit button
            cy.get('#allowed_domainsEdit').should('be.visible').click();

            // # Set 'sample.mattermost.com' as the only allowed email domain, save then close
            cy.wait(TIMEOUTS.HALF_SEC);
            cy.focused().type(emailDomain);
            cy.uiSaveAndClose();
        });

        // # Open team menu and click 'Invite People'
        cy.uiOpenTeamMenu('Invite People');

        // # Get the invite URL
        cy.findByTestId('InviteView__copyInviteLink').should('be.visible').click();
        cy.get('@clipboard').its('contents').then((val) => {
            const inviteLink = val;

            // # Logout from admin account and visit the invite url
            cy.apiLogout();
            cy.visit(inviteLink);

            const email = `user${randomId}@sample.gmail.com`;
            const username = `user${randomId}`;
            const password = 'passwd';
            const errorMessage = `The following email addresses do not belong to an accepted domain: ${emailDomain}. Please contact your System Administrator for details.`;

            // # Type email, username and password
            cy.get('#input_email').should('be.visible').type(email);
            cy.get('#input_name').type(username);
            cy.get('#input_password-input').type(password);

            // # Attempt to create an account by clicking on the 'Create Account' button
            cy.findByText('Create Account').click();

            // * Assert that the expected error message from creating an account with an email not from the allowed email domain exists and is visible
            cy.findByText(errorMessage).should('be.visible');
        });
    });

    it('MM-T2341 Cannot add a user to a team if the user\'s email is not from the correct domain', () => {
        // # Open team menu and click 'Team Settings'
        cy.uiOpenTeamMenu('Team Settings');

        // * Check that the 'Team Settings' modal was opened
        cy.get('#teamSettingsModal').should('exist').within(() => {
            // # Click on the 'Allow any user with an account on this server to join this team' edit button
            cy.get('#open_inviteEdit').should('be.visible').click();

            // # Enable any user with an account on the server to join the team
            cy.get('#teamOpenInvite').should('be.visible').check();

            // # Save and verify it took effect
            cy.uiSave();
            cy.get('#open_inviteDesc').should('be.visible').and('have.text', 'Yes');

            // # Click on the 'Allow only users with a specific email domain to join this team' edit button
            cy.get('#allowed_domainsEdit').should('be.visible').click();

            // # Set 'sample.mattermost.com' as the only allowed email domain and save
            cy.wait(TIMEOUTS.HALF_SEC);
            cy.findByRole('textbox', {name: 'Allowed Domains'}).should('be.visible').and('be.focused').type(emailDomain);

            // # Save and verify it took effect
            cy.uiSave();
            cy.get('#allowed_domainsDesc').should('be.visible').and('have.text', emailDomain);

            // # Close the modal
            cy.uiClose();
        });

        // # Create a new user
        cy.apiCreateUser({user: {email: `user${randomId}@sample.gmail.com`, username: `user${randomId}`, password: 'passwd'}}).then(({user}) => {
            // # Create a second team
            cy.apiCreateTeam('other-team', 'Other Team').then(({team: otherTeam}) => {
                // # Add user to the other team
                cy.apiAddUserToTeam(otherTeam.id, user.id).then(() => {
                    // # Login as new team admin
                    cy.apiLogin(user);

                    // # Go to Town Square
                    cy.visit(`/${otherTeam.name}/channels/town-square`);

                    // # Open team menu and click 'Join Another Team'
                    cy.uiOpenTeamMenu('Join Another Team');

                    // # Try to join the existing team
                    cy.get('.signup-team-dir').find(`#${testTeam.display_name.replace(' ', '_')}`).scrollIntoView().click();

                    // * Verify that they get a 'Cannot join' screen
                    cy.get('div.has-error').should('contain', 'The user cannot be added as the domain associated with the account is not permitted.');
                });
            });
        });
    });
});
