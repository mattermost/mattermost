// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('playbooks > playbook_attributes', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Create a fresh playbook for each test
        cy.apiCreateTestPlaybook({
            teamId: testTeam.id,
            title: 'Attributes Test Playbook (' + Date.now() + ')',
            userId: testUser.id,
        }).then((playbook) => {
            testPlaybook = playbook;
        });

        // # Set viewport for consistent testing
        cy.viewport('macbook-16');
    });

    describe('empty state', () => {
        it('shows empty state when no attributes exist', () => {
            // # Navigate to attributes section
            navigateToAttributes();

            // * Verify empty state is displayed
            cy.findByText(/no attributes yet/i).should('be.visible');
            cy.findByText(/add custom attributes/i).should('be.visible');
            cy.findByRole('button', {name: /add.*first attribute/i}).should('be.visible');
        });

        it('can add first attribute from empty state', () => {
            // # Navigate to attributes section
            navigateToAttributes();

            // # Click add button in empty state
            cy.findByRole('button', {name: /add.*first attribute/i}).click();

            // # Wait for attribute to be created
            cy.wait(500);

            // * Verify empty state is gone
            cy.findByText(/no attributes yet/i).should('not.exist');

            // * Verify attribute row appears in table
            cy.findAllByTestId('property-field-row').should('have.length', 1);

            // # Edit the default name
            cy.findAllByTestId('property-field-row').first().within(() => {
                cy.findByLabelText('Attribute name').clear().type('Priority');
            });

            // # Save by clicking outside
            cy.get('body').click(0, 0);
            cy.wait(500);

            // * Verify attribute is displayed with correct name
            verifyAttribute(0, 'Priority');
        });
    });

    describe('create attribute', () => {
        it('can create a text attribute', () => {
            // # Navigate to attributes section
            navigateToAttributes();

            // # Add a text attribute
            addAttribute('Customer Name', 'text');

            // * Verify attribute was created
            verifyAttribute(0, 'Customer Name');

            // # Reload page
            cy.reload();

            // * Verify attribute persists
            verifyAttribute(0, 'Customer Name');
        });

        it('can create a select attribute with options', () => {
            // # Navigate to attributes section
            navigateToAttributes();

            // # Add a select attribute with options
            addAttribute('Severity', 'select', ['Critical', 'High', 'Medium', 'Low']);

            // * Verify attribute was created
            verifyAttribute(0, 'Severity');

            // * Verify options are present
            cy.get('table tbody tr').eq(0).within(() => {
                cy.findByText('Critical').should('exist');
                cy.findByText('High').should('exist');
                cy.findByText('Medium').should('exist');
                cy.findByText('Low').should('exist');
            });
        });

        it('can create a multi-select attribute', () => {
            // # Navigate to attributes section
            navigateToAttributes();

            // # Add a multiselect attribute
            addAttribute('Tags', 'multi-select', ['Security', 'Performance', 'Bug']);

            // * Verify attribute was created
            verifyAttribute(0, 'Tags');

            // * Verify options are present
            cy.get('table tbody tr').eq(0).within(() => {
                cy.findByText('Security').should('exist');
                cy.findByText('Performance').should('exist');
                cy.findByText('Bug').should('exist');
            });
        });

        it('can create a URL attribute', () => {
            // # Navigate to attributes section
            navigateToAttributes();

            // # Add a URL attribute
            addAttribute('Documentation Link', 'url');

            // * Verify attribute was created
            verifyAttribute(0, 'Documentation Link');

            // # Reload page
            cy.reload();

            // * Verify attribute persists
            verifyAttribute(0, 'Documentation Link');
        });
    });

    describe('update attribute', () => {
        it('can rename an attribute', () => {
            // # Navigate and create an attribute
            navigateToAttributes();
            addAttribute('Old Name', 'text');

            // # Edit the attribute name
            editAttributeName(0, 'New Name');

            // * Verify name was updated
            verifyAttribute(0, 'New Name');

            // # Reload page
            cy.reload();

            // * Verify change persists
            verifyAttribute(0, 'New Name');
        });

        it('can change attribute type', () => {
            // # Navigate and create a text attribute
            navigateToAttributes();
            addAttribute('Flexible Field', 'text');

            // # Click on type button to change type
            cy.findAllByTestId('property-field-row').eq(0).within(() => {
                cy.findByRole('button', {name: 'Change attribute type'}).click();
            });

            // # Select new type
            cy.findByText(/^select$/i).click();

            // # Wait for GraphQL mutation
            cy.wait(500);

            // * Verify type changed (should now have property values input)
            cy.findAllByTestId('property-field-row').eq(0).within(() => {
                cy.findByTestId('property-values-input').should('exist');
            });
        });

        it('can add options to existing select attribute', () => {
            // # Navigate and create a select attribute with initial options
            navigateToAttributes();
            addAttribute('Status', 'select', ['Open']);

            // # Add another option
            cy.findAllByTestId('property-field-row').eq(0).within(() => {
                addNewOption('Closed');
            });

            // # Click outside to save
            cy.get('body').click(0, 0);
            cy.wait(500);

            // * Verify both options exist
            cy.findAllByTestId('property-field-row').eq(0).within(() => {
                cy.findByText('Open').should('exist');
                cy.findByText('Closed').should('exist');
            });
        });

        it('can update an existing option value', () => {
            // # Navigate and create a select attribute with options
            navigateToAttributes();
            addAttribute('Priority', 'select', ['Low', 'High']);

            // # Click on an existing option to edit it
            cy.findAllByTestId('property-field-row').eq(0).within(() => {
                getOptionEditor('Low').within(() => {
                    cy.findByPlaceholderText('Enter value name').clear().type('Medium{enter}');
                });
            });

            cy.waitForGraphQLQueries();

            // # Click outside to save
            cy.get('body').click(0, 0);
            cy.wait(500);

            // * Verify the option was updated
            cy.findAllByTestId('property-field-row').eq(0).within(() => {
                cy.findByText('Medium').should('exist');
                cy.findByText('Low').should('not.exist');
                cy.findByText('High').should('exist');
            });
        });

        it('can delete an option value', () => {
            // # Navigate and create a select attribute with multiple options
            navigateToAttributes();
            addAttribute('Status', 'select', ['Open', 'In Progress', 'Closed']);

            // # Click on an option to open the dropdown and delete it
            cy.findAllByTestId('property-field-row').eq(0).within(() => {
                getOptionEditor('In Progress').within(() => {
                    cy.findByText('Delete').click();
                });
            });

            cy.waitForGraphQLQueries();

            // # Click outside to save
            cy.get('body').click(0, 0);
            cy.wait(500);

            // * Verify the option was deleted
            cy.findAllByTestId('property-field-row').eq(0).within(() => {
                cy.findByText('Open').should('exist');
                cy.findByText('In Progress').should('not.exist');
                cy.findByText('Closed').should('exist');
            });
        });

        it('cannot delete the last option', () => {
            // # Navigate and create a select attribute with one option
            navigateToAttributes();
            addAttribute('Category', 'select', ['Single']);

            // # Click on the only option to open the dropdown
            cy.findAllByTestId('property-field-row').eq(0).within(() => {
                // * Verify the Delete option is not available
                getOptionEditor('Single').within(() => {
                    cy.findByText('Delete').should('not.exist');
                });
            });
        });
    });

    describe('delete attribute', () => {
        it('can delete an attribute', () => {
            // # Navigate and create two attributes
            navigateToAttributes();
            addAttribute('Attribute 1', 'text');
            addAttribute('Attribute 2', 'text');

            // * Verify both exist
            cy.findAllByTestId('property-field-row').should('have.length', 2);

            // # Delete the first attribute
            deleteAttribute(0);

            // * Verify only one attribute remains
            cy.findAllByTestId('property-field-row').should('have.length', 1);
            verifyAttribute(0, 'Attribute 2');
        });

        it('shows confirmation modal when deleting', () => {
            // # Navigate and create an attribute
            navigateToAttributes();
            addAttribute('Important Field', 'text');

            // # Click the dot menu for the attribute
            cy.findAllByTestId('property-field-row').eq(0).within(() => {
                cy.findByTestId('menuButton').click();
            });

            // # Click delete
            cy.findByText(/delete/i).click();

            // * Verify confirmation modal appears
            cy.get('#confirm-property-delete-modal').should('be.visible');
            cy.findByText(/are you sure/i).should('be.visible');

            // # Cancel the deletion
            cy.findByRole('button', {name: /cancel/i}).click();

            // * Verify attribute still exists
            cy.findAllByTestId('property-field-row').should('have.length', 1);
        });

        it('returns to empty state after deleting last attribute', () => {
            // # Navigate and create one attribute
            navigateToAttributes();
            addAttribute('Last Attribute', 'text');

            // # Delete the attribute
            deleteAttribute(0);

            // * Verify empty state is displayed
            cy.findByText(/no attributes yet/i).should('be.visible');
            cy.findByRole('button', {name: /add.*first attribute/i}).should('be.visible');
        });
    });

    describe('attribute limits', () => {
        it('can add attributes up to MAX_PROPERTIES_LIMIT', () => {
            // # Get the max limit
            const maxLimit = 20;

            // # Add 19 attributes via API for speed
            for (let i = 0; i < maxLimit - 1; i++) {
                cy.apiAddPropertyField(testPlaybook.id, {
                    name: `Attribute ${i + 1}`,
                    type: 'text',
                    attrs: {
                        visibility: 'when_set',
                        sortOrder: i,
                    },
                });
            }

            // # Navigate to attributes section
            navigateToAttributes();

            // * Verify 19 attributes exist
            cy.findAllByTestId('property-field-row').should('have.length', maxLimit - 1);

            // # Add the last attribute via UI to test button state change
            addAttribute();

            // * Verify all attributes were created
            cy.findAllByTestId('property-field-row').should('have.length', maxLimit);

            // * Verify add button is disabled with appropriate message
            cy.findByRole('button', {name: /maximum attributes reached/i}).
                should('be.disabled');
        });

        it('can add new attribute after deleting when at limit', () => {
            const maxLimit = 20;

            // # Add 19 attributes via API for speed
            for (let i = 0; i < maxLimit - 1; i++) {
                cy.apiAddPropertyField(testPlaybook.id, {
                    name: `Attribute ${i + 1}`,
                    type: 'text',
                    attrs: {
                        visibility: 'when_set',
                        sortOrder: i,
                    },
                });
            }

            // # Navigate to attributes section
            navigateToAttributes();

            // * Verify 19 attributes exist
            cy.findAllByTestId('property-field-row').should('have.length', maxLimit - 1);

            // # Add the last attribute via UI to reach the limit
            addAttribute();

            // * Verify add button is disabled with appropriate message
            cy.findByRole('button', {name: /maximum attributes reached/i}).
                should('be.disabled');

            // # Delete one attribute
            deleteAttribute(0);

            // * Verify add button is now enabled
            cy.findByRole('button', {name: /add.*attribute/i}).
                should('not.be.disabled');

            // # Add a new attribute
            addAttribute();

            // * Verify we're back at the limit
            cy.findAllByTestId('property-field-row').should('have.length', maxLimit);
        });
    });

    describe('duplicate attribute', () => {
        it('can duplicate a text attribute', () => {
            // # Navigate and create an attribute
            navigateToAttributes();
            addAttribute('Original Field', 'text');

            // # Duplicate the attribute
            cy.findAllByTestId('property-field-row').eq(0).within(() => {
                cy.findByTestId('menuButton').click();
            });
            cy.findByText(/duplicate/i).click();

            // # Wait for duplication
            cy.wait(500);

            // * Verify duplicate was created with "Copy" suffix
            cy.findAllByTestId('property-field-row').eq(0).within(() => {
                cy.findByLabelText('Attribute name').should('have.value', 'Original Field');
            });
            cy.findAllByTestId('property-field-row').eq(1).within(() => {
                cy.findByLabelText('Attribute name').should('have.value', 'Original Field Copy');
            });

            // * Verify we now have 2 attributes
            cy.findAllByTestId('property-field-row').should('have.length', 2);
        });

        it('can duplicate a select attribute with all its options', () => {
            // # Navigate and create a select attribute
            navigateToAttributes();
            addAttribute('Priority', 'select', ['High', 'Medium', 'Low']);

            // # Duplicate the attribute
            cy.findAllByTestId('property-field-row').eq(0).within(() => {
                cy.findByTestId('menuButton').click();
            });
            cy.findByText(/duplicate/i).click();

            // # Wait for duplication
            cy.wait(500);

            // * Verify duplicate has the same options
            cy.findAllByTestId('property-field-row').eq(1).within(() => {
                cy.findByLabelText('Attribute name').should('have.value', 'Priority Copy');
                cy.findByText('High').should('exist');
                cy.findByText('Medium').should('exist');
                cy.findByText('Low').should('exist');
            });
        });

        it('duplicated attribute can be edited independently', () => {
            // # Navigate and create an attribute
            navigateToAttributes();
            addAttribute('Original', 'text');

            // # Duplicate it
            cy.findAllByTestId('property-field-row').eq(0).within(() => {
                cy.findByTestId('menuButton').click();
            });
            cy.findByText(/duplicate/i).click();

            // # Wait for duplication
            cy.wait(500);

            // # Edit the duplicate's name
            editAttributeName(1, 'Modified Copy');

            // * Verify original is unchanged
            verifyAttribute(0, 'Original');
            verifyAttribute(1, 'Modified Copy');
        });
    });

    // Helper Functions

    /**
     * Navigate to the playbook attributes section
     */
    function navigateToAttributes() {
        cy.visit(`/playbooks/playbooks/${testPlaybook.id}/attributes`);
    }

    /**
     * Open the option editor for a specific option and return the floating UI element
     * @param {string} optionText - The text of the option to edit
     * @returns {Cypress.Chainable} The floating UI element for chaining
     */
    function getOptionEditor(optionText) {
        cy.findByText(optionText).parent().as('targetOption');
        cy.get('@targetOption').click();

        cy.waitUntil(() =>
            cy.get('@targetOption').then(($el) => $el.attr('aria-controls') !== undefined)
        , {
            errorMsg: 'aria-controls attribute not found on option element',
            timeout: 2000,
            interval: 100,
        });

        return cy.get('@targetOption').invoke('attr', 'aria-controls').then((ariaControls) => {
            const escapedId = ariaControls.replace(/:/g, '\\:');
            return cy.document().its('body').find(`#${escapedId}`);
        });
    }

    /**
     * Add a new option to a select/multi-select attribute
     * @param {string} optionText - The text of the option to add
     */
    function addNewOption(optionText, isFirstOption = false) {
        if (!isFirstOption) {
            cy.findByRole('button', {name: 'Add value'}).click();
            cy.waitForGraphQLQueries();
        }

        cy.findAllByText(/^Option \d+$/).last().parent().as('optionElement');
        cy.get('@optionElement').click();

        cy.waitUntil(() =>
            cy.get('@optionElement').then(($el) => $el.attr('aria-controls') !== undefined)
        , {
            errorMsg: 'aria-controls attribute not found on option element',
            timeout: 2000,
            interval: 100,
        });

        cy.get('@optionElement').invoke('attr', 'aria-controls').then((ariaControls) => {
            const escapedId = ariaControls.replace(/:/g, '\\:');
            cy.document().its('body').find(`#${escapedId}`).within(() => {
                cy.findByPlaceholderText('Enter value name').clear().type(`${optionText}{enter}`);
            });
        });
        cy.waitForGraphQLQueries();
    }

    /**
     * Add a new attribute with specified parameters
     * @param {string} name - The attribute name (optional, uses default "Attribute X" if not provided)
     * @param {string} type - The attribute type (text, select, multiselect, etc.)
     * @param {Array} options - Array of option strings for select types
     */
    function addAttribute(name = null, type = 'text', options = []) {
        // # Click add attribute button
        cy.findByRole('button', {name: /add.*attribute/i}).click();

        // # Wait for GraphQL mutation
        cy.wait(500);

        // # Fill in the name only if provided
        if (name) {
            cy.findAllByTestId('property-field-row').last().within(() => {
                cy.findByLabelText('Attribute name').clear().type(name);
            });
            cy.get('body').click(0, 0);

            // # Wait for GraphQL mutation
            cy.wait(500);
        }

        // # Change type if not text
        if (type !== 'text') {
            cy.findAllByTestId('property-field-row').last().within(() => {
                cy.findByRole('button', {name: 'Change attribute type'}).trigger('click');
            });

            // # Select the type from dropdown
            cy.findByText(new RegExp(`^${type}$`, 'i')).click();
            cy.wait(500);
        }

        // # Add options for select types
        if (options.length > 0 && (type === 'select' || type === 'multi-select')) {
            cy.findAllByTestId('property-field-row').last().within(() => {
                // # Rename the first option (Option 1)
                addNewOption(options[0], true);

                // # Add remaining options
                for (let i = 1; i < options.length; i++) {
                    addNewOption(options[i]);
                }
            });
        }

        // # Click outside to save (trigger blur)
        cy.get('body').click(0, 0);
        cy.wait(500);
    }

    /**
     * Verify an attribute exists with specific properties
     * @param {number} index - The index of the attribute in the list
     * @param {string} name - Expected attribute name
     */
    function verifyAttribute(index, name) {
        cy.findAllByTestId('property-field-row').eq(index).within(() => {
            cy.findByLabelText('Attribute name').should('have.value', name);
        });
    }

    /**
     * Delete an attribute by index
     * @param {number} index - The index of the attribute to delete
     */
    function deleteAttribute(index) {
        // # Click the dot menu for the attribute
        cy.findAllByTestId('property-field-row').eq(index).within(() => {
            cy.findByTestId('menuButton').click();
        });

        // # Click delete
        cy.findByText(/delete/i).click();

        // # Confirm deletion in modal
        cy.get('#confirm-property-delete-modal').should('be.visible');
        cy.findByRole('button', {name: /delete/i}).click();
        cy.wait(500);
    }

    /**
     * Edit attribute name
     * @param {number} index - The index of the attribute to edit
     * @param {string} newName - The new name for the attribute
     */
    function editAttributeName(index, newName) {
        cy.findAllByTestId('property-field-row').eq(index).within(() => {
            cy.findByLabelText('Attribute name').clear().type(newName);
        });

        // # Click outside to trigger save
        cy.get('body').click(0, 0);
        cy.wait(500);
    }
});
