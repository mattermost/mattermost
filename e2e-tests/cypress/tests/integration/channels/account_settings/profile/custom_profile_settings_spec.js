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
        },
        {
            name: 'Location',
            value: 'Remote',
        },
        {
            name: 'Title',
            value: 'Software Engineer',
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

        // # Edit the Location attribute - first scroll to it to ensure it's visible
        cy.contains('Location').scrollIntoView();
        cy.get('#customAttribute_' + getFieldIdByName(attributeFieldsMap, 'Location') + 'Edit').scrollIntoView().should('be.visible').click();

        // # Type a new value
        cy.get('#customAttribute_' + getFieldIdByName(attributeFieldsMap, 'Location')).scrollIntoView().should('be.visible').clear().type('Office');

        // # Save the changes
        cy.uiSave();

        // # Close the modal
        cy.uiClose();

        // # Post a message to make the user visible in the channel
        cy.postMessage('Hello from the test user');

        // // # Login as the other user to view the profile popover
        cy.apiLogin(otherUser);
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Open the profile popover for the test user
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).find('.user-popover').click();
        });

        // * Verify the profile popover is visible and wait for content to load
        cy.get('.user-profile-popover_container').should('be.visible').find('.user-popover__subtitle').should('exist');

        // * Verify the updated custom attributes are displayed correctly
        cy.get('.user-profile-popover_container *').then(($elements) => {
            // Find elements containing the Department attribute name and value
            const departmentElements = $elements.filter((_, el) => {
                console.log(el.fieldID);
                console.log(el.textContent);
                return el.textContent.includes('Department');
            });
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

            // Find elements containing the Location attribute name and value
            const locationElements = $elements.filter((_, el) => el.textContent.includes('Location'));
            const officeElements = $elements.filter((_, el) => el.textContent.includes('Office'));

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
        });

        // # Close the profile popover
        cy.get('body').click();

        // # Post a message so header is displayed in next test
        cy.postMessage('Completed test');
    });

    it('MM-T2 Should be able to clear custom profile attributes in profile settings', () => {
        // # Open profile settings modal
        cy.uiOpenProfileModal('Profile Settings');

        // # Edit the Title attribute - first scroll to it to ensure it's visible
        cy.contains('Title').scrollIntoView();
        cy.get('#customAttribute_' + getFieldIdByName(attributeFieldsMap, 'Title') + 'Edit').scrollIntoView().should('be.visible').click();

        // # Clear the value
        cy.get('#customAttribute_' + getFieldIdByName(attributeFieldsMap, 'Title')).scrollIntoView().should('be.visible').clear();

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

        // * Verify the Title attribute is not displayed (since it has visibility 'when_set' by default)
        cy.get('.user-profile-popover_container *').then(($elements) => {
            // Find elements containing the Title attribute name
            const titleElements = $elements.filter((_, el) => el.textContent.includes('Title'));
            const valueElements = $elements.filter((_, el) => el.textContent.includes('Software Engineer'));

            // If we found matching elements, the test should fail
            if (titleElements.length > 0) {
                throw new Error('Found attribute "Title" when it should not be displayed');
            }

            if (valueElements.length > 0) {
                throw new Error('Found value "Software Engineer" when it should not be displayed');
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
        cy.get('#customAttribute_' + getFieldIdByName(attributeFieldsMap, 'Department')).scrollIntoView().should('be.visible').should('have.value', 'Product');

        // # Close the edit view
        cy.uiCancel();

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
    const attributeFields = attributes.map((attr, index) => ({
        name: attr.name,
        type: 'text',
        attrs: {
            sort_order: index,
        },
    }));

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
                fieldsMap.set(fieldResponse.body.id, fieldResponse.body);
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
 * @eslint-disable-next-line no-unused-vars
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
