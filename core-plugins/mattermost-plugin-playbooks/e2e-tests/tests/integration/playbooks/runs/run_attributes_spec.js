// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('runs > run_attributes', {testIsolation: true}, () => {
    let testTeam;
    let testUser;
    let testPlaybook;
    let testRun;

    before(() => {
        cy.apiInitSetup().then(({team, user}) => {
            testTeam = team;
            testUser = user;
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);

        // # Set viewport to show RHS
        cy.viewport('macbook-13');
    });

    describe('empty state', () => {
        beforeEach(() => {
            // # Create playbook without attributes
            cy.apiCreatePlaybook({
                teamId: testTeam.id,
                title: 'Playbook Without Attributes',
                memberIDs: [testUser.id],
            }).then((playbook) => {
                testPlaybook = playbook;

                // # Start a run
                return cy.apiRunPlaybook({
                    teamId: testTeam.id,
                    playbookId: testPlaybook.id,
                    playbookRunName: 'Test Run',
                    ownerUserId: testUser.id,
                });
            }).then((run) => {
                testRun = run;

                // # Navigate to run
                cy.visit(`/playbooks/runs/${testRun.id}`);
            });
        });

        it('does not show attributes section when playbook has no attributes', () => {
            // * Verify Attributes section does NOT exist
            cy.findByRole('complementary').within(() => {
                cy.findByText('Attributes').should('not.exist');
            });
        });
    });

    describe('attribute inheritance', () => {
        it('copies text attribute from playbook to run', () => {
            // # Create playbook with text attribute
            createPlaybookWithAttributes([
                {name: 'Project Name', type: 'text'},
            ]);

            // # Start a run
            startRun('Test Run With Text Attr');

            // # Navigate to run
            navigateToRun();

            // * Verify attribute appears in RHS
            verifyAttributeExists('Project Name');
            verifyAttributeValue('Project Name', 'Empty');
        });

        it('copies all attribute types from playbook to run', () => {
            // # Create playbook with all attribute types
            createPlaybookWithAttributes([
                {name: 'Description', type: 'text'},
                {name: 'Status', type: 'select', options: ['Not Started', 'In Progress', 'Complete']},
                {name: 'Teams', type: 'multiselect', options: ['Engineering', 'Design', 'Product']},
            ]);

            // # Start a run
            startRun('Test Run With All Attrs');

            // # Navigate to run
            navigateToRun();

            // * Verify all attributes appear
            verifyAttributeExists('Description');
            verifyAttributeValue('Description', 'Empty');

            verifyAttributeExists('Status');
            verifyAttributeValue('Status', 'Empty');

            verifyAttributeExists('Teams');
            verifyAttributeValue('Teams', 'Empty');
        });
    });

    describe('edit attribute values', () => {
        beforeEach(() => {
            // # Create playbook with attributes
            createPlaybookWithAttributes([
                {name: 'Notes', type: 'text'},
                {name: 'Priority', type: 'select', options: ['Low', 'Medium', 'High']},
                {name: 'Labels', type: 'multiselect', options: ['Bug', 'Feature', 'Enhancement']},
                {name: 'Documentation', type: 'text', valueType: 'url'},
            ]);

            // # Start a run
            startRun('Test Run For Editing');
        });

        describe('from run details page', () => {
            beforeEach(() => {
                // # Navigate to run details page
                navigateToRun();
            });

            it('can edit text attribute value', () => {
                // # Edit text attribute
                editTextAttribute('Notes', 'Initial implementation notes');
                cy.wait(500);

                // * Verify value is displayed
                verifyAttributeValue('Notes', 'Initial implementation notes');

                // # Reload page
                cy.reload();

                // * Verify value persists
                verifyAttributeValue('Notes', 'Initial implementation notes');
            });

            it('can edit URL attribute and displays as clickable link', () => {
                // # Edit URL attribute with a real URL
                const testUrl = 'https://docs.mattermost.com';
                editTextAttribute('Documentation', testUrl);
                cy.wait(500);

                // * Verify URL is displayed as a clickable link
                getAttributeRow('Documentation').within(() => {
                    cy.get('a').
                        should('exist').
                        should('have.attr', 'href', testUrl).
                        should('have.attr', 'target', '_blank').
                        should('have.attr', 'rel', 'noopener noreferrer').
                        should('contain', testUrl);
                });

                // # Capture current URL before navigating away
                cy.url().as('currentUrl');

                // * Verify the link is clickable and navigates correctly
                getAttributeRow('Documentation').within(() => {
                    // # Remove target attribute to navigate in same window
                    cy.get('a').invoke('removeAttr', 'target').click();
                });

                // * Verify navigation occurred (wait for new page to load)
                cy.url().should('include', 'docs.mattermost.com');

                // # Go back to the run page
                cy.go('back');

                // * Verify we're back on the run page
                cy.get('@currentUrl').then((currentUrl) => {
                    cy.url().should('include', currentUrl);
                });

                // # Click on the wrapper (not on the link) to start editing
                getAttributeRow('Documentation').within(() => {
                    cy.findByTestId('property-value').then(($el) => {
                        const rect = $el[0].getBoundingClientRect();
                        cy.wrap($el).click(rect.width - 10, rect.height - 10);
                    });
                });

                // * Verify input field appears (in edit mode)
                getAttributeRow('Documentation').within(() => {
                    cy.get('input').should('exist').should('have.value', testUrl);
                });

                // # Update the URL
                const newUrl = 'https://github.com/mattermost';
                cy.focused().clear().type(newUrl);
                cy.get('body').click(0, 0);
                cy.wait(500);

                // * Verify new URL is displayed as a link
                getAttributeRow('Documentation').within(() => {
                    cy.get('a').
                        should('have.attr', 'href', newUrl).
                        should('contain', newUrl);
                });

                // # Reload page
                cy.reload();

                // * Verify URL persists and is still a clickable link
                getAttributeRow('Documentation').within(() => {
                    cy.get('a').
                        should('have.attr', 'href', newUrl).
                        should('contain', newUrl);
                });
            });

            it('can edit select attribute value', () => {
                // # Edit select attribute
                editSelectAttribute('Priority', 'High');
                cy.wait(500);

                // * Verify selected value is displayed
                verifyAttributeValue('Priority', 'High');

                // # Change selection
                editSelectAttribute('Priority', 'Low');
                cy.wait(500);

                // * Verify updated value
                verifyAttributeValue('Priority', 'Low');
            });

            it('can edit multiselect attribute value', () => {
                // # Click on multiselect attribute
                clickAttributeToEdit('Labels');

                // # Select multiple options
                cy.findByText('Bug').click();
                cy.findByText('Enhancement').click();
                cy.get('body').click(0, 0);
                cy.wait(500);

                // * Verify both values are displayed
                getAttributeRow('Labels').within(() => {
                    cy.contains('Bug').should('exist');
                    cy.contains('Enhancement').should('exist');
                });

                // # Add another selection
                clickAttributeToEdit('Labels');
                cy.findByText('Feature').click();
                cy.get('body').click(0, 0);
                cy.wait(500);

                // * Verify all three values displayed
                getAttributeRow('Labels').within(() => {
                    cy.contains('Bug').should('exist');
                    cy.contains('Feature').should('exist');
                    cy.contains('Enhancement').should('exist');
                });
            });

            it('can clear text attribute value', () => {
                // # Set a value first
                editTextAttribute('Notes', 'Test summary');
                cy.wait(500);

                // * Verify value is set
                verifyAttributeValue('Notes', 'Test summary');

                // # Click to edit and clear
                clickAttributeToEdit('Notes');
                cy.focused().clear();
                cy.get('body').click(0, 0);
                cy.wait(500);

                // * Verify empty state returns
                verifyAttributeValue('Notes', 'Empty');
            });

            it('can clear select attribute value', () => {
                // # Set a value first
                editSelectAttribute('Priority', 'High');
                cy.wait(500);

                // * Verify value is set
                verifyAttributeValue('Priority', 'High');

                // # Click to edit
                clickAttributeToEdit('Priority');

                // # Click clear indicator
                getAttributeRow('Priority').within(() => {
                    cy.get('div.property-select__clear-indicator').click();
                });
                cy.wait(500);

                // * Verify empty state returns
                verifyAttributeValue('Priority', 'Empty');
            });

            it('can clear multiselect attribute value', () => {
                // # Set values first
                clickAttributeToEdit('Labels');
                cy.findByText('Bug').click();
                cy.findByText('Feature').click();
                cy.get('body').click(0, 0);
                cy.wait(500);

                // * Verify values are set
                getAttributeRow('Labels').within(() => {
                    cy.contains('Bug').should('exist');
                    cy.contains('Feature').should('exist');
                });

                // # Click to edit
                clickAttributeToEdit('Labels');

                cy.wait(500);

                // # Click clear indicator
                getAttributeRow('Labels').within(() => {
                    cy.get('div.property-select__clear-indicator').realClick();
                });
                cy.wait(500);

                // * Verify empty state returns
                verifyAttributeValue('Labels', 'Empty');
            });
        });

        describe('from channel RHS', () => {
            beforeEach(() => {
                // # Navigate to the run's channel
                cy.then(() => {
                    cy.visit(`/${testTeam.name}/channels/${testRun.channel_id}`);
                });
            });

            it('can edit text attribute value', () => {
                // # Edit text attribute
                editTextAttribute('Notes', 'Channel edit notes');
                cy.wait(500);

                // * Verify value is displayed
                verifyAttributeValue('Notes', 'Channel edit notes');
            });

            it('can edit URL attribute and displays as clickable link', () => {
                // # Edit URL attribute with a real URL
                const testUrl = 'https://docs.mattermost.com';
                editTextAttribute('Documentation', testUrl);
                cy.wait(500);

                // * Verify URL is displayed as a clickable link
                getAttributeRow('Documentation').within(() => {
                    cy.get('a').
                        should('exist').
                        should('have.attr', 'href', testUrl).
                        should('have.attr', 'target', '_blank').
                        should('have.attr', 'rel', 'noopener noreferrer').
                        should('contain', testUrl);
                });

                // # Capture current URL before navigating away
                cy.url().as('currentUrl');

                // * Verify the link is clickable and navigates correctly
                getAttributeRow('Documentation').within(() => {
                    // # Remove target attribute to navigate in same window
                    cy.get('a').invoke('removeAttr', 'target').click();
                });

                // * Verify navigation occurred (wait for new page to load)
                cy.url().should('include', 'docs.mattermost.com');

                // # Go back to the channel
                cy.go('back');

                // * Verify we're back on the channel page
                cy.get('@currentUrl').then((currentUrl) => {
                    cy.url().should('include', currentUrl);
                });

                // # Click on the wrapper (not on the link) to start editing
                getAttributeRow('Documentation').within(() => {
                    cy.findByTestId('property-value').then(($el) => {
                        const rect = $el[0].getBoundingClientRect();
                        cy.wrap($el).click(rect.width - 10, rect.height - 10);
                    });
                });

                // * Verify input field appears (in edit mode)
                getAttributeRow('Documentation').within(() => {
                    cy.get('input').should('exist').should('have.value', testUrl);
                });

                // # Update the URL
                const newUrl = 'https://github.com/mattermost';
                cy.focused().clear().type(newUrl);
                cy.get('body').click(0, 0);
                cy.wait(500);

                // * Verify new URL is displayed as a link
                getAttributeRow('Documentation').within(() => {
                    cy.get('a').
                        should('have.attr', 'href', newUrl).
                        should('contain', newUrl);
                });
            });

            it('can edit select attribute value', () => {
                // # Edit select attribute
                editSelectAttribute('Priority', 'Medium');
                cy.wait(500);

                // * Verify selected value is displayed
                verifyAttributeValue('Priority', 'Medium');
            });

            it('can edit multiselect attribute value', () => {
                // # Click on multiselect attribute
                clickAttributeToEdit('Labels');

                // # Select multiple options
                cy.findByText('Feature').click();
                cy.get('body').click(0, 0);
                cy.wait(500);

                // * Verify value is displayed
                getAttributeRow('Labels').within(() => {
                    cy.contains('Feature').should('exist');
                });
            });
        });
    });

    describe('timeline entries for property changes', () => {
        beforeEach(() => {
            // # Create playbook with attributes
            createPlaybookWithAttributes([
                {name: 'Environment', type: 'text'},
                {name: 'Severity', type: 'select', options: ['Low', 'Medium', 'High']},
            ]);

            // # Start a run
            startRun('Timeline Test Run');
        });

        it('creates timeline entry when setting text property', () => {
            // # Navigate to run
            navigateToRun();

            // # Set text property value
            editTextAttribute('Environment', 'Production');
            cy.wait(500);

            // * Verify timeline entry exists with correct format
            cy.get('[data-testid="timeline-item property_changed"]').should('exist');
            cy.contains('set Environment to Production').should('exist');
        });

        it('creates timeline entry when clearing property', () => {
            // # Navigate to run
            navigateToRun();

            // # Set and then clear property
            editTextAttribute('Environment', 'Staging');
            cy.wait(500);

            clickAttributeToEdit('Environment');
            cy.focused().clear();
            cy.get('body').click(0, 0);
            cy.wait(500);

            // * Verify timeline entries exist
            cy.get('[data-testid="timeline-item property_changed"]').should('have.length.at.least', 2);
            cy.contains('cleared Environment').should('exist');
        });

        it('creates timeline entry when updating select property', () => {
            // # Navigate to run
            navigateToRun();

            // # Set initial value
            editSelectAttribute('Severity', 'Low');
            cy.wait(500);

            // # Update to different value
            editSelectAttribute('Severity', 'High');
            cy.wait(500);

            // * Verify timeline entries exist
            cy.get('[data-testid="timeline-item property_changed"]').should('have.length.at.least', 2);
            cy.contains('updated Severity from Low to High').should('exist');
        });
    });

    describe('attribute independence', () => {
        it('run attributes remain independent when playbook attributes change', () => {
            // # Create playbook with attributes
            createPlaybookWithAttributes([
                {name: 'Instance ID', type: 'text'},
                {name: 'Region', type: 'select', options: ['US-East', 'US-West', 'EU']},
            ]);

            // # Start a run
            startRun('Test Run');

            // # Navigate to run and set values
            navigateToRun();
            editTextAttribute('Instance ID', 'inst-001');
            editSelectAttribute('Region', 'US-East');

            // * Verify values are set
            verifyAttributeValue('Instance ID', 'inst-001');
            verifyAttributeValue('Region', 'US-East');

            // # Navigate to playbook attributes tab
            cy.then(() => {
                cy.visit(`/playbooks/playbooks/${testPlaybook.id}/attributes`);
            });

            // # Remove Region attribute (should be at index 1)
            cy.findAllByTestId('property-field-row').eq(1).within(() => {
                cy.findByTestId('menuButton').click();
            });
            cy.findByText(/delete/i).click();
            cy.get('#confirm-property-delete-modal').should('be.visible');
            cy.findByRole('button', {name: /delete/i}).click();
            cy.wait(500);

            // # Add new attribute
            cy.findByRole('button', {name: /add.*attribute/i}).click();
            cy.wait(500);

            // # Set attribute name
            cy.findAllByTestId('property-field-row').last().within(() => {
                cy.findByLabelText('Attribute name').clear().type('Environment');
            });
            cy.get('body').click(0, 0);
            cy.wait(500);

            // # Change type to select
            cy.findAllByTestId('property-field-row').last().within(() => {
                cy.findByRole('button', {name: 'Change attribute type'}).trigger('click');
            });
            cy.findByText(/^select$/i).click();
            cy.wait(500);

            // # Add options - rename Option 1 to Dev
            cy.findAllByTestId('property-field-row').last().within(() => {
                cy.findByText('Option 1').click();
                cy.wait(100);
            });
            cy.findByPlaceholderText('Enter value name').clear().type('Dev{enter}');
            cy.wait(100);

            // # Add Staging option
            cy.findAllByTestId('property-field-row').last().within(() => {
                cy.findByRole('button', {name: 'Add value'}).click();
                cy.wait(100);
            });
            cy.findAllByText(/^Option \d+$/).last().click();
            cy.findByPlaceholderText('Enter value name').clear().type('Staging{enter}');
            cy.wait(100);

            // # Add Prod option
            cy.findAllByTestId('property-field-row').last().within(() => {
                cy.findByRole('button', {name: 'Add value'}).click();
                cy.wait(100);
            });
            cy.findAllByText(/^Option \d+$/).last().click();
            cy.findByPlaceholderText('Enter value name').clear().type('Prod{enter}');
            cy.wait(100);

            // # Navigate back to run
            navigateToRun();

            // * Verify run still has original attributes and values
            verifyAttributeValue('Instance ID', 'inst-001');
            verifyAttributeValue('Region', 'US-East');

            // * Verify new playbook attribute does NOT appear on run
            cy.findByRole('complementary').within(() => {
                cy.findByText('Environment').should('not.exist');
            });
        });
    });

    /**
     * Helper Functions
     */

    /**
     * Navigate to the current test run
     */
    function navigateToRun() {
        cy.then(() => {
            cy.visit(`/playbooks/runs/${testRun.id}`);
        });
    }

    /**
     * Create a playbook with specified attributes
     * @param {Array} attributes - Array of attribute objects {name, type, options, valueType}
     */
    function createPlaybookWithAttributes(attributes) {
        cy.apiCreatePlaybook({
            teamId: testTeam.id,
            title: 'Playbook For Testing',
            memberIDs: [testUser.id],
        }).then((playbook) => {
            testPlaybook = playbook;
        });

        // Add each attribute sequentially
        attributes.forEach((attr, index) => {
            cy.then(() => {
                cy.apiAddPropertyField(testPlaybook.id, {
                    name: attr.name,
                    type: attr.type,
                    attrs: {
                        visibility: 'always',
                        sortOrder: index + 1,
                        options: attr.options ? attr.options.map((opt) => ({name: opt})) : undefined,
                        valueType: attr.valueType,
                    },
                });
            });
        });
    }

    /**
     * Start a run from the current test playbook
     * @param {string} runName - Name for the run
     */
    function startRun(runName) {
        cy.then(() => {
            cy.apiRunPlaybook({
                teamId: testTeam.id,
                playbookId: testPlaybook.id,
                playbookRunName: runName,
                ownerUserId: testUser.id,
            }).then((run) => {
                testRun = run;
            });
        });
    }

    /**
     * Get the attribute row for a given attribute name
     * @param {string} attributeName - Name of the attribute
     */
    function getAttributeRow(attributeName) {
        const testId = `run-property-${attributeName.toLowerCase().replace(/\s+/g, '-')}`;
        return cy.findByTestId(testId);
    }

    /**
     * Verify an attribute exists in the RHS
     * @param {string} attributeName - Name of the attribute
     */
    function verifyAttributeExists(attributeName) {
        const testId = `run-property-${attributeName.toLowerCase().replace(/\s+/g, '-')}`;
        cy.findByRole('complementary').within(() => {
            cy.findByTestId(testId).should('exist');
        });
    }

    /**
     * Verify an attribute has a specific value
     * @param {string} attributeName - Name of the attribute
     * @param {string} expectedValue - Expected value text
     */
    function verifyAttributeValue(attributeName, expectedValue) {
        getAttributeRow(attributeName).within(() => {
            cy.contains(expectedValue).should('exist');
        });
    }

    /**
     * Click on an attribute to start editing
     * @param {string} attributeName - Name of the attribute
     */
    function clickAttributeToEdit(attributeName) {
        getAttributeRow(attributeName).within(() => {
            // Click on the property value (empty state or existing value)
            cy.findByTestId('property-value').click();
        });
    }

    /**
     * Edit a text attribute value
     * @param {string} attributeName - Name of the attribute
     * @param {string} value - Value to type
     */
    function editTextAttribute(attributeName, value) {
        clickAttributeToEdit(attributeName);
        cy.focused().type(value);
        cy.get('body').click(0, 0);
    }

    /**
     * Edit a select attribute value
     * @param {string} attributeName - Name of the attribute
     * @param {string} option - Option to select
     */
    function editSelectAttribute(attributeName, option) {
        clickAttributeToEdit(attributeName);
        cy.findByText(option).click();
    }
});
