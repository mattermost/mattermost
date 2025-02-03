// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('playbooks > edit', {testIsolation: true}, () => {
    let testUser;

    before(() => {
        cy.apiInitSetup().then(({user}) => {
            testUser = user;
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);
    });

    describe('checklists', () => {
        describe('pre-assignee', () => {
            it('user gets pre-assigned, added to invite user list, and invitations become enabled', () => {
                // # Open Playbooks
                cy.visit('/playbooks/playbooks');

                // # Start a blank playbook
                cy.findByText('Blank').click();
                cy.findByText('Outline').click();

                cy.get('#actions').within(() => {
                    cy.get('#invite-users').within(() => {
                        // * Verify invitations are disabled and no invited user exists
                        cy.get('label input').should('not.be.checked');
                        cy.get('.invite-users-selector__control').
                            after('content').
                            should('eq', '');
                    });
                });

                // # Pre-assign the user
                cy.get('#checklists').within(() => {
                    // # Trigger assignee select menu
                    cy.findByText('Untitled task').trigger('mouseover');
                    cy.findByTestId('hover-menu-edit-button').click();
                    cy.findByText('Assignee...').click();

                    // * Verify that the assignee input is focused now
                    cy.focused().
                        should('have.attr', 'type', 'text').
                        should('have.attr', 'id');

                    // * Verify that the root of the assignee select menu exists
                    cy.focused().parents('.playbook-react-select').
                        should('exist').
                        within(() => {
                            // # Select the test user
                            cy.findByText('@' + testUser.username).click();
                        });
                });

                cy.reload();

                cy.get('#checklists').within(() => {
                    // # Trigger assignee select menu
                    cy.findByText('Untitled task').trigger('mouseover');
                    cy.findByTestId('hover-menu-edit-button').click();
                    cy.findByText('@' + testUser.username).click();

                    // * Verify that the assignee input is focused now
                    cy.focused().
                        should('have.attr', 'type', 'text').
                        should('have.attr', 'id');

                    // * Verify that the root of the assignee select menu exists
                    cy.focused().
                        parents('.playbook-react-select').
                        should('exist');
                });

                cy.get('#actions').within(() => {
                    cy.get('#invite-users').within(() => {
                        // * Verify invitations are enabled and a single user is invited
                        cy.get('label input').should('be.checked');
                        cy.get('.invite-users-selector__control').
                            after('content').
                            should('eq', '1 SELECTED');
                    });
                });
            });
        });

        describe('slash command', () => {
            it('autocompletes after clicking Command...', () => {
                // # Open Playbooks
                cy.visit('/playbooks/playbooks');

                // # Start a blank playbook
                cy.findByText('Blank').click();
                cy.findByText('Outline').click();

                cy.get('#checklists').within(() => {
                    // # Open the slash command input on a step
                    cy.findByText('Untitled task').trigger('mouseover');
                    cy.findByTestId('hover-menu-edit-button').click();
                    cy.findByText('Command...').click();

                    // * Verify the slash command input field now has focus
                    // * and starts with a slash prefix.
                    cy.focused().
                        should('have.attr', 'placeholder', 'Slash Command').
                        should('have.value', '/');
                });

                // * Verify the autocomplete prompt is open
                cy.get('#suggestionList').should('exist');
            });

            it('resets when saving with an empty slash command', () => {
                // # Open Playbooks
                cy.visit('/playbooks/playbooks');

                // # Start a blank playbook
                cy.findByText('Blank').click();
                cy.findByText('Outline').click();

                cy.get('#checklists').within(() => {
                    // # Open the slash command input on a step
                    cy.findByText('Untitled task').trigger('mouseover');
                    cy.findByTestId('hover-menu-edit-button').click();
                    cy.findByText('Command...').click();
                });

                cy.get('#floating-ui-root').within(() => {
                    // * Verify the slash command input field now has focus
                    // * and starts with a slash prefix.
                    cy.findByPlaceholderText('Slash Command').should('have.focus');
                    cy.findByPlaceholderText('Slash Command').should('have.value', '/');

                    cy.findByPlaceholderText('Slash Command').type('{backspace}');

                    // # Click the save button
                    cy.findByText('Save').click();
                });

                // * Verify no slash command was saved
                cy.findByText('Command...').should('be.visible');
            });

            it('removes the input prompt when blurring with an invalid slash command', () => {
                // # Open Playbooks
                cy.visit('/playbooks/playbooks');

                // # Start a blank playbook
                cy.findByText('Blank').click();
                cy.findByText('Outline').click();

                cy.get('#checklists').within(() => {
                    // # Open the slash command input on a step
                    cy.findByText('Untitled task').trigger('mouseover');
                    cy.findByTestId('hover-menu-edit-button').click();
                    cy.findByText('Command...').click();
                });

                cy.get('#floating-ui-root').within(() => {
                    // * Verify the slash command input field now has focus
                    // * and starts with a slash prefix.
                    cy.findByPlaceholderText('Slash Command').should('have.focus');
                    cy.findByPlaceholderText('Slash Command').should('have.value', '/');

                    // # Click the save button
                    cy.findByText('Save').click();
                });

                // * Verify no slash command was saved
                cy.findByText('Command...').should('be.visible');
            });
        });
    });
});
