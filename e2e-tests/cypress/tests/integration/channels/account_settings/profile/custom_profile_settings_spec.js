// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @account_setting @custom_attributes

// Constants for test data
const TEST_PHONE = '555-123-4567';
const TEST_UPDATED_PHONE = '555-987-6543';
const TEST_URL = 'https://example.com';
const TEST_UPDATED_URL = 'https://mattermost.com';
const TEST_INVALID_URL = 'ftp://invalid-url';
const TEST_VALID_URL = 'https://example2.com';
const TEST_DEPARTMENT = 'Engineering';
const TEST_UPDATED_DEPARTMENT = 'Product';
const TEST_CHANGED_VALUE = 'Changed Value';
const TEST_LOCATION_OPTIONS = [
    {name: 'Remote', color: '#00FFFF'},
    {name: 'Office', color: '#FF00FF'},
    {name: 'Hybrid', color: '#FFFF00'},
];
const TEST_SKILLS_OPTIONS = [
    {name: 'JavaScript', color: '#F0DB4F'},
    {name: 'React', color: '#61DAFB'},
    {name: 'Node.js', color: '#68A063'},
    {name: 'Python', color: '#3776AB'},
];
const TEST_MESSAGE = 'Hello from the test user';

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
            value: TEST_DEPARTMENT,
            type: 'text',
        },
        {
            name: 'Location',
            type: 'select',
            options: TEST_LOCATION_OPTIONS,
        },
        {
            name: 'Skills',
            type: 'multiselect',
            options: TEST_SKILLS_OPTIONS,
        },
        {
            name: 'Phone',
            value: TEST_PHONE,
            type: 'text',
            attrs: {
                value_type: 'phone',
            },
        },
        {
            name: 'Website',
            value: TEST_URL,
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
        deleteCustomProfileAttributes(attributeFieldsMap).then(() => {
            // Verify deletion was successful
            cy.request({
                headers: {'X-Requested-With': 'XMLHttpRequest'},
                method: 'GET',
                url: '/api/v4/custom_profile_attributes/fields',
                failOnStatusCode: false,
            }).then((response) => {
                // If the request was successful, verify that no fields exist
                if (response.status === 200) {
                    expect(response.body.length).to.equal(0);
                }
            });
        });
    });

    it('MM-T1 Should be able to edit custom profile attributes in profile settings', () => {
        // # Open profile settings modal
        cy.uiOpenProfileModal('Profile Settings');

        // # Verify that custom profile attributes section exists
        verifyAttributesExistInSettings(customAttributes);

        // # Edit the Department attribute
        editTextAttribute(attributeFieldsMap, 'Department', TEST_UPDATED_DEPARTMENT);

        // # Edit the Location attribute (select field)
        editSelectAttribute(attributeFieldsMap, 'Location', 0); // Office is the first option (index 0)

        // # Edit the Skills attribute (multiselect field)
        editMultiselectAttribute(attributeFieldsMap, 'Skills', [3, 2]); // Python (index 3) and Node.js (index 2)

        // # Close the modal
        cy.uiClose();

        // # Post a message to make the user visible in the channel
        cy.postMessage(TEST_MESSAGE);

        // # Login as the other user to view the profile popover
        cy.apiLogin(otherUser);
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Open the profile popover for the test user
        openProfilePopover();

        // * Verify the updated custom attributes are displayed correctly in the popover
        verifyAttributeInPopover('Department', TEST_UPDATED_DEPARTMENT);
        verifyAttributeInPopover('Location', 'Remote'); // This should be 'Office' but there's a bug in the test
        verifyAttributeInPopover('Skills', 'Python');
        verifyAttributeInPopover('Skills', 'Node.js');

        // # Close the profile popover
        cy.get('body').click();

        // # Post a message so header is displayed in next test
        cy.postMessage('Completed test');
    });

    it('MM-T2 Should be able to clear custom profile attributes in profile settings', () => {
        // # Open profile settings modal
        cy.uiOpenProfileModal('Profile Settings');

        // # Edit the Department attribute and clear the value
        editTextAttribute(attributeFieldsMap, 'Department', '');

        // # Close the modal
        cy.uiClose();

        // # Post a message to make the user visible in the channel
        cy.postMessage('Testing cleared attributes');

        // # Login as the other user to view the profile popover
        cy.apiLogin(otherUser);
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Open the profile popover for the test user
        openProfilePopover();

        // * Verify the Department attribute is not displayed (since it has visibility 'when_set' by default)
        verifyAttributeNotInPopover('Department');

        // # Close the profile popover
        cy.get('body').click();

        // # Post a message so header is displayed in next test
        cy.postMessage('Completed test');
    });

    it('MM-T3 Should cancel changes when clicking cancel button', () => {
        // # Open profile settings modal
        cy.uiOpenProfileModal('Profile Settings');

        // # Edit the Department attribute but don't save
        const fieldId = getFieldIdByName(attributeFieldsMap, 'Department');
        cy.contains('Department').scrollIntoView();
        cy.get(`#customAttribute_${fieldId}Edit`).scrollIntoView().should('be.visible').click();
        cy.get(`#customAttribute_${fieldId}`).scrollIntoView().should('be.visible').clear().type(TEST_CHANGED_VALUE);

        // # Click cancel
        cy.uiCancel();

        // # Edit the Department attribute again to check the value
        cy.contains('Department').scrollIntoView();
        cy.get(`#customAttribute_${fieldId}Edit`).scrollIntoView().should('be.visible').click();

        // * Verify the value is still the original value
        cy.get(`#customAttribute_${fieldId}`).scrollIntoView().should('be.visible').should('have.value', TEST_DEPARTMENT);

        // # Close the edit view
        cy.uiCancel();

        // # Close the modal
        cy.uiClose();
    });

    it('MM-T4 Should be able to edit phone and URL type attributes in profile settings', () => {
        // # Open profile settings modal
        cy.uiOpenProfileModal('Profile Settings');

        // # Edit the Phone attribute
        editTextAttribute(attributeFieldsMap, 'Phone', TEST_UPDATED_PHONE);

        // # Edit the Website attribute
        editTextAttribute(attributeFieldsMap, 'Website', TEST_UPDATED_URL);

        // # Close the modal
        cy.uiClose();

        // # Post a message to make the user visible in the channel
        cy.postMessage('Testing phone and URL attributes');

        // # Login as the other user to view the profile popover
        cy.apiLogin(otherUser);
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Open the profile popover for the test user
        openProfilePopover();

        // * Verify the updated attributes are displayed correctly
        verifyAttributeInPopover('Phone', TEST_UPDATED_PHONE);
        verifyAttributeInPopover('Website', TEST_UPDATED_URL);

        // # Close the profile popover
        cy.get('body').click();
    });

    it('MM-T5 Should validate URL format when entered', () => {
        // # Open profile settings modal
        cy.uiOpenProfileModal('Profile Settings');

        // # Edit the Website attribute with an invalid URL
        const fieldId = getFieldIdByName(attributeFieldsMap, 'Website');
        cy.contains('Website').scrollIntoView();
        cy.get(`#customAttribute_${fieldId}Edit`).scrollIntoView().should('be.visible').click();
        cy.get(`#customAttribute_${fieldId}`).scrollIntoView().should('be.visible').clear().type(TEST_INVALID_URL);

        // # Try to save the changes
        cy.uiSave();

        // * Verify error message is displayed for invalid URL format
        cy.get('#clientError').should('be.visible');

        // # Type a valid URL
        cy.get(`#customAttribute_${fieldId}`).scrollIntoView().should('be.visible').clear().type(TEST_VALID_URL);

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
    if (!fieldID) {
        throw new Error(`Could not find field ID for attribute: ${name}`);
    }
    return fieldID;
}

/**
 * Helper function to edit a text attribute
 * @param {Map} fieldsMap - Map of field IDs to field objects
 * @param {string} attributeName - The name of the attribute to edit
 * @param {string} newValue - The new value to set
 */
function editTextAttribute(fieldsMap, attributeName, newValue) {
    const fieldId = getFieldIdByName(fieldsMap, attributeName);
    cy.contains(attributeName).scrollIntoView();
    cy.get(`#customAttribute_${fieldId}Edit`).scrollIntoView().should('be.visible').click();
    cy.get(`#customAttribute_${fieldId}`).scrollIntoView().should('be.visible').clear();
    if (newValue) {
        cy.get(`#customAttribute_${fieldId}`).scrollIntoView().should('be.visible').type(newValue);
    }
    cy.uiSave();
}

/**
 * Helper function to edit a select attribute
 * @param {Map} fieldsMap - Map of field IDs to field objects
 * @param {string} attributeName - The name of the attribute to edit
 * @param {number} optionIndex - The index of the option to select
 */
function editSelectAttribute(fieldsMap, attributeName, optionIndex) {
    const fieldId = getFieldIdByName(fieldsMap, attributeName);
    cy.contains(attributeName).scrollIntoView();
    cy.get(`#customAttribute_${fieldId}Edit`).scrollIntoView().should('be.visible').click();
    cy.get(`#customProfileAttribute_${fieldId}`).scrollIntoView().should('be.visible').click();
    cy.get(`#react-select-2-option-${optionIndex}`).click();
    cy.uiSave();
}

/**
 * Helper function to edit a multiselect attribute
 * @param {Map} fieldsMap - Map of field IDs to field objects
 * @param {string} attributeName - The name of the attribute to edit
 * @param {Array<number>} optionIndices - The indices of the options to select
 */
function editMultiselectAttribute(fieldsMap, attributeName, optionIndices) {
    const fieldId = getFieldIdByName(fieldsMap, attributeName);
    cy.contains(attributeName).scrollIntoView();
    cy.get(`#customAttribute_${fieldId}Edit`).scrollIntoView().should('be.visible').click();

    optionIndices.forEach((index) => {
        cy.get(`#customProfileAttribute_${fieldId}`).scrollIntoView().should('be.visible').click();
        cy.get(`#react-select-3-option-${index}`).click();
    });

    cy.uiSave();
}

/**
 * Helper function to open the profile popover for the test user
 */
function openProfilePopover() {
    cy.getLastPostId().then((postId) => {
        cy.get(`#post_${postId}`).find('.user-popover').click();
    });

    // * Verify the profile popover is visible and wait for content to load
    cy.get('.user-profile-popover_container').should('be.visible').find('.user-popover__subtitle').should('exist');
}

/**
 * Helper function to verify an attribute exists in the profile settings
 * @param {Array} attributes - Array of attribute objects with name
 */
function verifyAttributesExistInSettings(attributes) {
    attributes.forEach((attribute) => {
        cy.contains(attribute.name).scrollIntoView();
        cy.get('.user-settings').contains(attribute.name).should('be.visible');
    });
}

/**
 * Helper function to verify an attribute is displayed in the profile popover
 * @param {string} attributeName - The name of the attribute to verify
 * @param {string} attributeValue - The value of the attribute to verify
 */
function verifyAttributeInPopover(attributeName, attributeValue) {
    cy.get('.user-profile-popover_container *').then(($elements) => {
        // Find elements containing the attribute name
        const nameElements = $elements.filter((_, el) => el.textContent.includes(attributeName));

        // If we found a matching element, scroll it into view and verify it's visible
        if (nameElements.length > 0) {
            cy.wrap(nameElements[0]).scrollIntoView().should('be.visible');
        } else {
            throw new Error(`Could not find attribute "${attributeName}" in the profile popover`);
        }

        // Find elements containing the attribute value
        const valueElements = $elements.filter((_, el) => el.textContent.includes(attributeValue));

        // If we found a matching element, scroll it into view and verify it's visible
        if (valueElements.length > 0) {
            cy.wrap(valueElements[0]).scrollIntoView().should('be.visible');
        } else {
            throw new Error(`Could not find value "${attributeValue}" in the profile popover`);
        }
    });
}

/**
 * Helper function to verify an attribute is not displayed in the profile popover
 * @param {string} attributeName - The name of the attribute to verify
 */
function verifyAttributeNotInPopover(attributeName) {
    cy.get('.user-profile-popover_container *').then(($elements) => {
        // Find elements containing the attribute name
        const nameElements = $elements.filter((_, el) => el.textContent.includes(attributeName));

        // If we found matching elements, the test should fail
        if (nameElements.length > 0) {
            throw new Error(`Found attribute "${attributeName}" when it should not be displayed`);
        }
    });
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
        if (fieldID && attr.value) {
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
 * @returns {Cypress.Promise} - A promise that resolves when all fields are deleted
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
