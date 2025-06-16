// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @account_settings

describe('Account Settings', () => {
    let testUser: Cypress.UserProfile;
    let testTeam: Cypress.Team;
    let offTopic: string;

    before(() => {
        // # Login as new user and visit off-topic
        cy.apiInitSetup({userPrefix: 'other', loginAfter: true}).then(({offTopicUrl, user, team}) => {
            cy.visit(offTopicUrl);
            offTopic = offTopicUrl;
            testUser = user;
            testTeam = team;

            cy.postMessage('hello');
        });
    });

    it('MM-T2049 Account Settings link in own popover', () => {
        // # Click avatar to open profile popover
        cy.uiOpenProfileModal('Profile Settings');

        // # Check if profile settings modal is open
        cy.get('#accountSettingsModal').should('be.visible');

        cy.uiClose();
    });

    it('MM-T2081 Password: Save should be disabled on blank', () => {
        // # Go to Profile > Security
        cy.uiOpenProfileModal('Security');

        // * Check that the Security tab is loaded
        cy.get('#securityButton').should('be.visible');

        // # Click the Security tab
        cy.get('#securityButton').click();

        // # Click "Edit" to the right of "Password"
        cy.get('#passwordEdit').should('be.visible').click();

        // # Check that save button is disabled
        cy.get('button[type="submit"]').should('be.disabled');

        cy.uiClose();
    });

    it('MM-T2074 New email not visible to other users until it has been confirmed', () => {
        // # Login as admin
        cy.apiAdminLogin();

        // # Create user
        cy.apiCreateUser({prefix: 'test'}).then(({user: newUser}) => {
            // # Add user to team
            cy.apiAddUserToTeam(testTeam.id, newUser.id).then(() => {
                // # Create DM channel
                cy.apiCreateDirectChannel([testUser.id, newUser.id]).then(({channel}) => {
                    cy.apiLogin(testUser);
                    cy.visit(offTopic);
                    cy.postMessage('hello');

                    // * Update email
                    const oldEMail = testUser.email;
                    const newEMail = 'test@example.com';
                    cy.uiOpenProfileModal('Profile Settings');
                    cy.get('#emailEdit').should('be.visible').click();
                    cy.get('#primaryEmail').should('be.visible').type(newEMail);
                    cy.get('#confirmEmail').should('be.visible').type(newEMail);
                    cy.get('#currentPassword').should('be.visible').type(testUser.password);
                    cy.uiSaveAndClose();

                    // * Send DM
                    cy.postMessageAs({sender: testUser, message: `@${newUser.username}`, channelId: channel.id});

                    // # Login to 2nd user
                    cy.apiLogin(newUser);

                    // * Check if email updated
                    cy.visit(`/${testTeam.name}/messages/@${testUser.username}`);
                    cy.get('#channelIntro .user-popover').should('be.visible').click();
                    cy.get('#user-profile-popover').should('be.visible').should('contain', oldEMail);
                });
            });
        });
    });
});
