// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @team_settings

import {getRandomId, stubClipboard} from '../../../utils';

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
        cy.uiOpenTeamMenu('Team settings');

        // * Check that the 'Team Settings' modal was opened
        cy.get('#teamSettingsModal').should('exist').within(() => {
            // # Go to Access section
            cy.get('#accessButton').click();

            // # Click on the 'Allow only users with a specific email domain to join this team' edit button
            cy.get('.access-allowed-domains-section').should('exist').within(() => {
                // # Click on the 'Allow only users with a specific email domain to join this team' checkbox
                cy.get('.mm-modal-generic-section-item__input-checkbox').should('not.be.checked').click();
            });

            // # Set 'sample.mattermost.com' as the only allowed email domain and save
            cy.get('#allowedDomains').click().type(emailDomain).type(' ');
            cy.findByText('Save').should('be.visible').click();
        });

        cy.uiClose();

        // # Open team menu and click 'Invite People'
        cy.uiOpenTeamMenu('Invite people');

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
        cy.uiOpenTeamMenu('Team settings');

        // * Check that the 'Team Settings' modal was opened
        cy.get('#teamSettingsModal').should('exist').within(() => {
            // # Go to Access section
            cy.get('#accessButton').click();

            cy.get('.access-invite-domains-section').should('exist').within(() => {
                // # Enable any user with an account on the server to join the team
                cy.get('.mm-modal-generic-section-item__input-checkbox').should('not.be.checked').click();
            });

            // # Click on the 'Allow only users with a specific email domain to join this team' edit button
            cy.get('.access-allowed-domains-section').should('exist').within(() => {
                // # Click on the 'Allow only users with a specific email domain to join this team' checkbox
                cy.get('.mm-modal-generic-section-item__input-checkbox').should('not.be.checked').click();
            });

            // # Set 'sample.mattermost.com' as the only allowed email domain and save
            cy.get('#allowedDomains').click().type(emailDomain).type(' ');
            cy.findByText('Save').should('be.visible');

            // # Save and verify it took effect
            cy.uiSave();

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
                    cy.uiOpenTeamMenu('Join another team');

                    // # Try to join the existing team
                    cy.get('.signup-team-dir').find(`#${testTeam.display_name.replace(' ', '_')}`).scrollIntoView().click();

                    // * Verify that they get a 'Cannot join' screen
                    cy.get('div.has-error').should('contain', 'The user cannot be added as the domain associated with the account is not permitted.');
                });
            });
        });
    });
});
