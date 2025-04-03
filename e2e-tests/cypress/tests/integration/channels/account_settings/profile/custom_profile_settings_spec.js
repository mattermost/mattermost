// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @account_setting @custom_attributes

describe('Profile > Profile Settings > Custom Profile Attributes', () => {
    let testTeam;
    let testUser;
    let otherUser;
    let testChannel;

    let attributeFieldsMap = new Map();

    // Custom attribute definitions
    const customAttributes = [
        {
            name: 'Department',
            value: 'Engineering',
            type: 'text',
        },
        {
            name: 'Location',
            type: 'select',
            options: [
                {name: 'Remote', color: '#00FFFF'},
                {name: 'Office', color: '#FF00FF'},
                {name: 'Hybrid', color: '#FFFF00'},
            ],
        },
        {
            name: 'Skills',
            type: 'multiselect',
            options: [
                {name: 'JavaScript', color: '#F0DB4F'},
                {name: 'React', color: '#61DAFB'},
                {name: 'Node.js', color: '#68A063'},
                {name: 'Python', color: '#3776AB'},
            ],
        },
        {
            name: 'Phone',
            value: '555-123-4567',
            type: 'text',
            attrs: {
                value_type: 'phone',
            },
        },
        {
            name: 'Website',
            value: 'https://example.com',
            type: 'text',
            attrs: {
                value_type: 'url',
            },
        },
    ];

    before(() => {
        // Create test user and team
        cy.apiInitSetup().then(({team, user, channel}) => {
            testTeam = team;
            testUser = user;
            testChannel = channel;

            // Create another user to test profile popover
            cy.apiCreateUser().then(({user: user2}) => {
                otherUser = user2;
                cy.apiAddUserToTeam(testTeam.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, otherUser.id);
                });
            });

            // Set up custom profile attribute fields
            setupCustomProfileAttributeFields(customAttributes).then((fieldsMap) => {
                attributeFieldsMap = fieldsMap;
            });
        });
    });

    beforeEach(() => {
        // Login as the test user
        cy.apiLogin(testUser);

        // Set up initial values for custom profile attributes
        setupCustomProfileAttributeValues(customAttributes, attributeFieldsMap);

        // Visit the test channel
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
    });

    after(() => {
        // Clean up by deleting custom profile attributes
        deleteCustomProfileAttributes(attributeFieldsMap);
    });

    it('MM-T1 Should be able to edit custom profile attributes in profile settings', () => {
        // # Open profile settings modal
        cy.uiOpenProfileModal('Profile Settings');

        // # Verify that custom profile attributes section exists
        customAttributes.forEach((attribute) => {
            cy.contains(attribute.name).scrollIntoView();
            cy.get('.user-settings').contains(attribute.name).should('be.visible');
        });

        // # Edit the Department attribute - first scroll to it to ensure it's visible
        cy.contains('Department').scrollIntoView();
        cy.get('#customAttribute_' + getFieldIdByName(attributeFieldsMap, 'Department') + 'Edit').scrollIntoView().should('be.visible').click();

        // # Type a new value
        cy.get('#customAttribute_' + getFieldIdByName(attributeFieldsMap, 'Department')).scrollIntoView().should('be.visible').clear().type('Product');

        // # Save the changes
        cy.uiSave();

        // # Edit the Location attribute (select field) - first scroll to it to ensure it's visible
        cy.contains('Location').scrollIntoView();
        cy.get('#customAttribute_' + getFieldIdByName(attributeFieldsMap, 'Location') + 'Edit').scrollIntoView().should('be.visible').click();

        // # Get the Location field ID
        const locationFieldId = getFieldIdByName(attributeFieldsMap, 'Location');

        // # Select the Office option using the ReactSelect component
        cy.get(`#customProfileAttribute_${locationFieldId}`).scrollIntoView().should('be.visible').click();
        cy.get('#react-select-2-option-0').click(); // Office is the second option (index 1)
        // # Save the changes
        cy.uiSave();

        // # Edit the Skills attribute (multiselect field) - first scroll to it to ensure it's visible
        cy.contains('Skills').scrollIntoView();
        cy.get('#customAttribute_' + getFieldIdByName(attributeFieldsMap, 'Skills') + 'Edit').scrollIntoView().should('be.visible').click();

        // # Get the Skills field ID
        const skillsFieldId = getFieldIdByName(attributeFieldsMap, 'Skills');

        cy.get(`#customProfileAttribute_${skillsFieldId}`).scrollIntoView().should('be.visible').click();
        cy.get('#react-select-3-option-3').click(); // Python is the fourth option (index 3)
        cy.get(`#customProfileAttribute_${skillsFieldId}`).scrollIntoView().should('be.visible').click();
        cy.get('#react-select-3-option-2').click(); // Node.js is the third option (index 2)

        // # Save the changes
        cy.uiSave();

        // # Close the modal
        cy.uiClose();

        // # Post a message to make the user visible in the channel
        cy.postMessage('Hello from the test user');

        // # Login as the other user to view the profile popover
        cy.apiLogin(otherUser);
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Open the profile popover for the test user
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).find('.user-popover').click();
        });

        // * Verify the profile popover is visible and wait for content to load
        cy.get('.user-profile-popover_container').should('be.visible').find('.user-popover__custom_attributes').should('exist');

        // * Verify the updated custom attributes are displayed correctly
        cy.get('.user-profile-popover_container *').then(($elements) => {
            // Find elements containing the Department attribute name and value
            const departmentElements = $elements.filter((_, el) => el.textContent.includes('Department'));
            const productElements = $elements.filter((_, el) => el.textContent.includes('Product'));

            // If we found matching elements, scroll them into view and verify they're visible
            if (departmentElements.length > 0) {
                cy.wrap(departmentElements[0]).scrollIntoView().should('be.visible');
            } else {
                throw new Error('Could not find attribute "Department" in the profile popover');
            }

            if (productElements.length > 0) {
                cy.wrap(productElements[0]).scrollIntoView().should('be.visible');
            } else {
                throw new Error('Could not find value "Product" in the profile popover');
            }

            // Find elements containing the Location attribute name and value (select field)
            const locationElements = $elements.filter((_, el) => el.textContent.includes('Location'));
            const officeElements = $elements.filter((_, el) => el.textContent.includes('Remote'));

            // If we found matching elements, scroll them into view and verify they're visible
            if (locationElements.length > 0) {
                cy.wrap(locationElements[0]).scrollIntoView().should('be.visible');
            } else {
                throw new Error('Could not find attribute "Location" in the profile popover');
            }

            if (officeElements.length > 0) {
                cy.wrap(officeElements[0]).scrollIntoView().should('be.visible');
            } else {
                throw new Error('Could not find value "Office" in the profile popover');
            }

            // Find elements containing the Skills attribute name and values (multiselect field)
            const skillsElements = $elements.filter((_, el) => el.textContent.includes('Skills'));
            const pythonElements = $elements.filter((_, el) => el.textContent.includes('Python'));
            const nodeElements = $elements.filter((_, el) => el.textContent.includes('Node.js'));

            // If we found matching elements, scroll them into view and verify they're visible
            if (skillsElements.length > 0) {
                cy.wrap(skillsElements[0]).scrollIntoView().should('be.visible');
            } else {
                throw new Error('Could not find attribute "Skills" in the profile popover');
            }

            if (pythonElements.length > 0) {
                cy.wrap(pythonElements[0]).scrollIntoView().should('be.visible');
            } else {
                throw new Error('Could not find value "Python" in the profile popover');
            }

            if (nodeElements.length > 0) {
                cy.wrap(nodeElements[0]).scrollIntoView().should('be.visible');
            } else {
                throw new Error('Could not find value "Node.js" in the profile popover');
            }
        });

        // # Close the profile popover
        cy.get('body').click();

        // # Post a message so header is displayed in next test
        cy.postMessage('Completed test');
    });

    it('MM-T2 Should be able to clear custom profile attributes in profile settings', () => {
        // # Open profile settings modal
        cy.uiOpenProfileModal('Profile Settings');

        // # Edit the Department attribute - first scroll to it to ensure it's visible
        cy.contains('Department').scrollIntoView();
        cy.get('#customAttribute_' + getFieldIdByName(attributeFieldsMap, 'Department') + 'Edit').scrollIntoView().should('be.visible').click();

        // # Clear the value
        cy.get('#customAttribute_' + getFieldIdByName(attributeFieldsMap, 'Department')).scrollIntoView().should('be.visible').clear();

        // # Save the changes
        cy.uiSave();

        // # Close the modal
        cy.uiClose();

        // # Post a message to make the user visible in the channel
        cy.postMessage('Testing cleared attributes');

        // # Login as the other user to view the profile popover
        cy.apiLogin(otherUser);
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Open the profile popover for the test user
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).find('.user-popover').click();
        });

        // * Verify the profile popover is visible and wait for content to load
        cy.get('.user-profile-popover_container').should('be.visible').find('.user-popover__subtitle').should('exist');

        // * Verify the Department attribute is not displayed (since it has visibility 'when_set' by default)
        cy.get('.user-profile-popover_container *').then(($elements) => {
            // Find elements containing the Department attribute name
            const departmentElements = $elements.filter((_, el) => el.textContent.includes('Department'));

            // If we found matching elements, the test should fail
            if (departmentElements.length > 0) {
                throw new Error('Found attribute "Department" when it should not be displayed');
            }
        });

        // # Close the profile popover
        cy.get('body').click();

        // # Post a message so header is displayed in next test
        cy.postMessage('Completed test');
    });

    it('MM-T3 Should cancel changes when clicking cancel button', () => {
        // # Open profile settings modal
        cy.uiOpenProfileModal('Profile Settings');

        // # Edit the Department attribute - first scroll to it to ensure it's visible
        cy.contains('Department').scrollIntoView();
        cy.get('#customAttribute_' + getFieldIdByName(attributeFieldsMap, 'Department') + 'Edit').scrollIntoView().should('be.visible').click();

        // # Type a new value
        cy.get('#customAttribute_' + getFieldIdByName(attributeFieldsMap, 'Department')).scrollIntoView().should('be.visible').clear().type('Changed Value');

        // # Click cancel
        cy.uiCancel();

        // # Edit the Department attribute again to check the value - first scroll to it to ensure it's visible
        cy.contains('Department').scrollIntoView();
        cy.get('#customAttribute_' + getFieldIdByName(attributeFieldsMap, 'Department') + 'Edit').scrollIntoView().should('be.visible').click();

        // * Verify the value is still the original value
        cy.get('#customAttribute_' + getFieldIdByName(attributeFieldsMap, 'Department')).scrollIntoView().should('be.visible').should('have.value', 'Engineering');

        // # Close the edit view
        cy.uiCancel();

        // # Close the modal
        cy.uiClose();
    });

    it('MM-T4 Should be able to edit phone and URL type attributes in profile settings', () => {
        // # Open profile settings modal
        cy.uiOpenProfileModal('Profile Settings');

        // # Edit the Phone attribute - first scroll to it to ensure it's visible
        cy.contains('Phone').scrollIntoView();
        cy.get('#customAttribute_' + getFieldIdByName(attributeFieldsMap, 'Phone') + 'Edit').scrollIntoView().should('be.visible').click();

        // # Type a new value
        cy.get('#customAttribute_' + getFieldIdByName(attributeFieldsMap, 'Phone')).scrollIntoView().should('be.visible').clear().type('555-987-6543');

        // # Save the changes
        cy.uiSave();

        // # Edit the Website attribute - first scroll to it to ensure it's visible
        cy.contains('Website').scrollIntoView();
        cy.get('#customAttribute_' + getFieldIdByName(attributeFieldsMap, 'Website') + 'Edit').scrollIntoView().should('be.visible').click();

        // # Type a new value
        cy.get('#customAttribute_' + getFieldIdByName(attributeFieldsMap, 'Website')).scrollIntoView().should('be.visible').clear().type('https://mattermost.com');

        // # Save the changes
        cy.uiSave();

        // # Close the modal
        cy.uiClose();

        // # Post a message to make the user visible in the channel
        cy.postMessage('Testing phone and URL attributes');

        // # Login as the other user to view the profile popover
        cy.apiLogin(otherUser);
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Open the profile popover for the test user
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).find('.user-popover').click();
        });

        // * Verify the profile popover is visible and wait for content to load
        cy.get('.user-profile-popover_container').should('be.visible').find('.user-popover__subtitle').should('exist');

        // * Verify the updated Phone attribute is displayed correctly
        cy.get('.user-profile-popover_container *').then(($elements) => {
            // Find elements containing the Phone attribute name
            const phoneElements = $elements.filter((_, el) => el.textContent.includes('Phone'));

            // If we found a matching element, scroll it into view and verify it's visible
            if (phoneElements.length > 0) {
                cy.wrap(phoneElements[0]).scrollIntoView().should('be.visible');
            } else {
                throw new Error('Could not find attribute "Phone" in the profile popover');
            }

            // Find elements containing the Phone attribute value
            const phoneValueElements = $elements.filter((_, el) => el.textContent.includes('555-987-6543'));

            // If we found a matching element, scroll it into view and verify it's visible
            if (phoneValueElements.length > 0) {
                cy.wrap(phoneValueElements[0]).scrollIntoView().should('be.visible');
            } else {
                throw new Error('Could not find value "555-987-6543" in the profile popover');
            }
        });

        // * Verify the updated Website attribute is displayed correctly
        cy.get('.user-profile-popover_container *').then(($elements) => {
            // Find elements containing the Website attribute name
            const websiteElements = $elements.filter((_, el) => el.textContent.includes('Website'));

            // If we found a matching element, scroll it into view and verify it's visible
            if (websiteElements.length > 0) {
                cy.wrap(websiteElements[0]).scrollIntoView().should('be.visible');
            } else {
                throw new Error('Could not find attribute "Website" in the profile popover');
            }

            // Find elements containing the Website attribute value
            const websiteValueElements = $elements.filter((_, el) => el.textContent.includes('https://mattermost.com'));

            // If we found a matching element, scroll it into view and verify it's visible
            if (websiteValueElements.length > 0) {
                cy.wrap(websiteValueElements[0]).scrollIntoView().should('be.visible');
            } else {
                throw new Error('Could not find value "https://mattermost.com" in the profile popover');
            }
        });

        // # Close the profile popover
        cy.get('body').click();
    });

    it('MM-T5 Should validate URL format when entered', () => {
        // # Open profile settings modal
        cy.uiOpenProfileModal('Profile Settings');

        // # Edit the Website attribute - first scroll to it to ensure it's visible
        cy.contains('Website').scrollIntoView();
        cy.get('#customAttribute_' + getFieldIdByName(attributeFieldsMap, 'Website') + 'Edit').scrollIntoView().should('be.visible').click();

        // # Type an invalid URL (missing protocol)
        cy.get('#customAttribute_' + getFieldIdByName(attributeFieldsMap, 'Website')).scrollIntoView().should('be.visible').clear().type('ftp://invalid-url');

        // # Try to save the changes
        cy.uiSave();

        // * Verify error message is displayed for invalid URL format
        cy.get('#clientError').should('be.visible');

        // # Type a valid URL
        cy.get('#customAttribute_' + getFieldIdByName(attributeFieldsMap, 'Website')).scrollIntoView().should('be.visible').clear().type('https://example2.com');

        // # Save the changes
        cy.uiSave();

        // # Close the modal
        cy.uiClose();
    });
});

/**
 * Helper function to get field ID by name
 * @param {Map} fieldsMap - Map of field IDs to field objects
 * @param {string} name - The name of the field to find
 * @returns {string} - The field ID
 */
function getFieldIdByName(fieldsMap, name) {
    let fieldID = '';
    fieldsMap.forEach((value, key) => {
        if (value.name === name) {
            fieldID = key;
        }
    });
    return fieldID;
}

/**
 * Sets up custom profile attributes fields more efficiently
 * @param {Array} attributes - Array of attribute objects with name and value
 * @returns {Promise<Map>} - A promise that resolves to a map of field IDs to field objects
 */
function setupCustomProfileAttributeFields(attributes) {
    const fieldsMap = new Map();

    // Create the attribute fields array
    const attributeFields = attributes.map((attr, index) => {
        // Start with basic field properties
        const field = {
            name: attr.name,
            type: attr.type || 'text',
            attrs: {
                sort_order: index,
            },
        };

        // Add options for select and multiselect fields
        if ((attr.type === 'select' || attr.type === 'multiselect') && attr.options) {
            field.attrs.options = attr.options;
        }

        // Add any additional attributes if provided
        if (attr.attrs) {
            field.attrs = {
                ...field.attrs,
                ...attr.attrs,
            };
        }

        return field;
    });

    // Check if fields already exist
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        method: 'GET',
        url: '/api/v4/custom_profile_attributes/fields',
        failOnStatusCode: false, // Don't fail the test if the request fails
    }).then((response) => {
        // If fields exist and the request was successful, use them
        if (response.status === 200 && response.body && response.body.length > 0) {
            response.body.forEach((value) => {
                fieldsMap.set(value.id, value);
            });
            return fieldsMap;
        }

        // If no fields exist or there was an error, create them
        cy.apiAdminLogin();

        // Create fields sequentially to ensure consistent order
        // This is more reliable than trying to create them in parallel
        const createFields = (index = 0) => {
            if (index >= attributeFields.length) {
                return fieldsMap; // All fields created
            }

            return cy.request({
                headers: {'X-Requested-With': 'XMLHttpRequest'},
                method: 'POST',
                url: '/api/v4/custom_profile_attributes/fields',
                body: attributeFields[index],
                failOnStatusCode: false, // Don't fail the test if the request fails
            }).then((fieldResponse) => {
                if (fieldResponse.status !== 201) {
                    throw new Error(`Failed to create field ${attributeFields[index].name}: ${fieldResponse.status}`);
                }
                const createdField = fieldResponse.body;
                fieldsMap.set(createdField.id, createdField);

                return createFields(index + 1); // Create next field
            });
        };

        return createFields();
    });
}

/**
 * Sets up custom profile attribute values for the current user
 * @param {Array} attributes - Array of attribute objects with name and value
 * @param {Map} fields - Map of field IDs to field objects
 * @returns {Cypress.Chainable} - A Cypress chainable for chaining commands
 */
function setupCustomProfileAttributeValues(attributes, fields) {
    // Create a map of attribute values by field ID
    const valuesByFieldId = {};

    attributes.forEach((attr) => {
        let fieldID = '';

        // Find the field ID for this attribute name
        fields.forEach((value, key) => {
            if (value.name === attr.name) {
                fieldID = key;
            }
        });

        // If we found a matching field, add it to our values object
        if (fieldID) {
            valuesByFieldId[fieldID] = attr.value;
        }
    });

    // Only make the API call if we have values to set
    if (Object.keys(valuesByFieldId).length > 0) {
        return cy.request({
            headers: {'X-Requested-With': 'XMLHttpRequest'},
            method: 'PATCH',
            url: '/api/v4/custom_profile_attributes/values',
            body: valuesByFieldId,
            failOnStatusCode: false, // Don't fail the test if the request fails
        }).then((response) => {
            if (response.status !== 200) {
                throw new Error(`Failed to set attribute values: ${response.status}`);
            }
        });
    }

    // Return a resolved Cypress chainable if no values to set
    return cy.wrap(null);
}

/**
 * Deletes all custom profile attributes
 * @param {Map} attributes - Map of field IDs to field objects
 */
function deleteCustomProfileAttributes(attributes) {
    cy.apiAdminLogin();

    // Create an array of promises for deleting fields
    const deletePromises = [];

    attributes.forEach((_, id) => {
        deletePromises.push(
            cy.request({
                method: 'DELETE',
                url: `/api/v4/custom_profile_attributes/fields/${id}`,
                headers: {'X-Requested-With': 'XMLHttpRequest'},
                failOnStatusCode: false, // Don't fail the test if the request fails
            }),
        );
    });

    // Wait for all delete operations to complete
    return Cypress.Promise.all(deletePromises);
}
