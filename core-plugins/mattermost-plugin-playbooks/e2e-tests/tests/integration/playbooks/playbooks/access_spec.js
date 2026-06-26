// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('playbooks > edit', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testUser2;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;

            // # Create a second test user in this team
            cy.apiCreateUser().then((payload) => {
                testUser2 = payload.user;
                cy.apiAddUserToTeam(testTeam.id, payload.user.id);
            });

            // # Login as testUser
            cy.apiLogin(testUser);
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);
    });

    describe('rdp information refresh', () => {
        let testPlaybook;

        beforeEach(() => {
            // # Create a playbook
            cy.apiCreateTestPlaybook({
                teamId: testTeam.id,
                title: 'Playbook (' + Date.now() + ')',
                userId: testUser.id,
                public: true,
            }).then((playbook) => {
                testPlaybook = playbook;

                // Navigate to the playbook page
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/outline`);
            });
        });

        it('add / remove a member', () => {
            // # Open playbook access modal
            cy.findByTestId('playbook-members').click();

            // # Add a new member
            cy.findByTestId('add-people-input').type(testUser2.username);
            cy.wait(500);
            cy.findByTestId('profile-option-' + testUser2.username).click({force: true});

            // * Verify that user was added
            cy.findByTestId('members-list').findByText(testUser2.username).should('exist');

            // # Close playbook access modal
            cy.get('.close > [aria-hidden="true"]').click();

            // * Verify members number
            cy.findByTestId('playbook-members').findByText('2').should('exist');

            // # Open playbook access modal
            cy.findByTestId('playbook-members').click();

            // # Open dropdown and remove user
            cy.findByText('Playbook Member').click();
            cy.findByTestId('dropdownmenu').findByText('Remove').click();

            // * Verify that user was removed
            cy.findByTestId('members-list').findByText(testUser2.username).should('not.exist');

            // # Close playbook access modal
            cy.get('.close > [aria-hidden="true"]').click();

            // * Verify members number
            cy.findByTestId('playbook-members').findByText('1').should('exist');
        });

        it('change to private', () => {
            // # Open playbook access modal
            cy.findByTestId('playbook-members').click();

            // # Click on convert to private
            cy.findByText('Convert to private playbook').click();

            // * Check that confirm modal is open
            cy.get('#confirmModal').should('be.visible');

            // # Confirm convert to private
            cy.get('#confirmModal').get('#confirmModalButton').click();

            // * Verify that playbook is private
            cy.findByText('Convert to private playbook').should('not.exist');

            // # Close playbook access modal
            cy.get('.close > [aria-hidden="true"]').click();

            // * Verify lock icon is visible
            cy.findByTestId('playbook-editor-header').get('.icon-lock-outline').should('be.visible');
        });
    });
});
