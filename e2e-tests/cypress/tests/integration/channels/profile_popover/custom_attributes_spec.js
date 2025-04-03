// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @profile_popover @custom_attributes

describe('Profile Popover - Custom Attributes', () => {
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
            value: 'Remote',
            type: 'text',
        },
        {
            name: 'Title',
            value: 'Software Engineer',
            type: 'text',
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
        // Login as the other user
        cy.apiLogin(otherUser);

        // Set up custom profile attributes for the other user
        setupCustomProfileAttributeValues(customAttributes, attributeFieldsMap).then(() => {
            // Visit the test channel
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
        });
    });

    after(() => {
        // Clean up by deleting custom profile attributes
        deleteCustomProfileAttributes(attributeFieldsMap);
    });

    it('MM-T1 Should display custom profile attributes in profile popover', () => {
        // Post a message as the other user to make them visible in the channel
        cy.postMessageAs({
            sender: otherUser,
            message: 'Hello from the other user',
            channelId: testChannel.id,
        });
        cy.uiWaitUntilMessagePostedIncludes('Hello from the other user');

        // Login as the test user
        cy.apiLogin(testUser);

        // Open the profile popover for the other user
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).find('.user-popover').click();
        });

        // Verify the profile popover is visible and wait for content to load
        cy.get('.user-profile-popover_container').should('be.visible').find('.user-popover__subtitle').should('exist');

        // Verify each custom attribute is displayed correctly
        verifyAttributesInPopover(customAttributes);
    });

    it('MM-T2 Should not display custom profile attributes if none exist', () => {
        cy.postMessageAs({
            sender: testUser,
            message: 'Hello from the test user',
            channelId: testChannel.id,
        });

        // # Open the profile popover for the test user
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).find('.user-popover').click();
        });

        // * Verify the profile popover is visible and wait for content to load
        cy.get('.user-profile-popover_container').should('be.visible').find('.user-popover__subtitle').should('exist');

        // * Verify custom attributes are not displayed
        customAttributes.forEach((attribute) => {
            // Find all elements in the popover
            cy.get('.user-profile-popover_container *').then(($elements) => {
                // Find elements containing the attribute name
                const nameElements = $elements.filter((_, el) => el.textContent.includes(attribute.name));

                // If we found a matching element, fail the test
                if (nameElements.length > 0) {
                    throw new Error(`Found attribute "${attribute.name}" when it should not be displayed`);
                }
            });
        });
    });

    it('MM-T3 Should update custom profile attributes when changed', () => {
        // # Post a message as the other user
        cy.postMessageAs({
            sender: otherUser,
            message: 'Hello once more from the other user',
            channelId: testChannel.id,
        });

        // # Open the profile popover to get the user profile state set correctly
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).find('.user-popover').click();
        });

        // * Verify the profile popover is visible and wait for content to load
        cy.get('.user-profile-popover_container').should('be.visible').find('.user-popover__subtitle').should('exist');

        // * Verify initial attributes are displayed correctly
        verifyAttributesInPopover(customAttributes);

        // # Close the profile popover
        cy.get('body').click();

        // # Update custom profile attributes for "otherUser"
        const updatedAttributes = [
            {
                name: 'Department',
                value: 'Product',
            },
            {
                name: 'Location',
                value: 'Office',
            },
        ];
        setupCustomProfileAttributeValues(updatedAttributes, attributeFieldsMap);

        // # Open the profile popover again
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).find('.user-popover').click();
        });

        // * Verify the profile popover is visible and wait for content to load
        cy.get('.user-profile-popover_container').should('be.visible').find('.user-popover__subtitle').should('exist');

        // * Verify updated attributes are displayed correctly
        verifyAttributesInPopover(updatedAttributes);

        // * Verify non-updated attribute is still displayed correctly
        cy.get('.user-profile-popover_container *').then(($elements) => {
            // Find elements containing the attribute name
            const nameElements = $elements.filter((_, el) => el.textContent.includes('Title'));

            // If we found a matching element, scroll it into view and verify it's visible
            if (nameElements.length > 0) {
                cy.wrap(nameElements[0]).scrollIntoView().should('be.visible');
            } else {
                throw new Error('Could not find attribute "Title" in the profile popover');
            }

            // Find elements containing the attribute value
            const valueElements = $elements.filter((_, el) => el.textContent.includes('Software Engineer'));

            // If we found a matching element, scroll it into view and verify it's visible
            if (valueElements.length > 0) {
                cy.wrap(valueElements[0]).scrollIntoView().should('be.visible');
            } else {
                throw new Error('Could not find value "Software Engineer" in the profile popover');
            }
        });
    });

    it('MM-T4 Should not display custom profile attributes with visibility set to hidden', () => {
        // # Post a message from the test user
        cy.postMessageAs({
            sender: testUser,
            message: 'Hello testing hidden visibility from the test user',
            channelId: testChannel.id,
        });

        // # Update the visibility of the Department attribute to hidden
        updateCustomProfileAttributeVisibility(attributeFieldsMap, 'Department', 'hidden').then(() => {
            // # Post a message as the other user
            cy.postMessageAs({
                sender: otherUser,
                message: 'Testing visibility hidden',
                channelId: testChannel.id,
            });

            // # Login as the test user
            cy.apiLogin(testUser);

            // # Open the profile popover for the other user
            cy.getLastPostId().then((postId) => {
                cy.get(`#post_${postId}`).find('.user-popover').click();
            });

            // * Verify the profile popover is visible and wait for content to load
            cy.get('.user-profile-popover_container').should('be.visible').find('.user-popover__subtitle').should('exist');

            // * Verify the Department attribute is not displayed
            cy.get('.user-profile-popover_container *').then(($elements) => {
                const nameElements = $elements.filter((_, el) => el.textContent.includes('Department'));
                expect(nameElements.length).to.equal(0);
            });

            // * Verify other attributes are still displayed
            cy.get('.user-profile-popover_container *').then(($elements) => {
                // Find elements containing the Location attribute name
                const locationElements = $elements.filter((_, el) => el.textContent.includes('Location'));

                // If we found a matching element, scroll it into view and verify it's visible
                if (locationElements.length > 0) {
                    cy.wrap(locationElements[0]).scrollIntoView().should('be.visible');
                } else {
                    throw new Error('Could not find attribute "Location" in the profile popover');
                }
            });

            // # Reset the visibility to default for cleanup
            updateCustomProfileAttributeVisibility(attributeFieldsMap, 'Department', 'when_set');
        });
    });

    it('MM-T5 Should always display custom profile attributes with visibility set to always', () => {
        // # Post a message from the test user
        cy.postMessageAs({
            sender: testUser,
            message: 'Hello testing always visibility from the test user',
            channelId: testChannel.id,
        });

        // # Update the visibility of the Title attribute to always
        updateCustomProfileAttributeVisibility(attributeFieldsMap, 'Title', 'always').then(() => {
            // # Clear the value for the Title attribute
            clearCustomProfileAttributeValue(attributeFieldsMap, 'Title');

            // # Post a message as the other user
            cy.postMessageAs({
                sender: otherUser,
                message: 'Testing visibility always',
                channelId: testChannel.id,
            });

            // # Login as the test user
            cy.apiLogin(testUser);

            // # Open the profile popover for the other user
            cy.getLastPostId().then((postId) => {
                cy.get(`#post_${postId}`).find('.user-popover').click();
            });

            // * Verify the profile popover is visible and wait for content to load
            cy.get('.user-profile-popover_container').should('be.visible').find('.user-popover__subtitle').should('exist');

            // * Verify the Title attribute is displayed even though it has no value
            cy.get('.user-profile-popover_container *').then(($elements) => {
                const titleElements = $elements.filter((_, el) => el.textContent.includes('Title'));

                if (titleElements.length > 0) {
                    cy.wrap(titleElements[0]).scrollIntoView().should('be.visible');
                } else {
                    throw new Error('Could not find attribute "Title" in the profile popover');
                }
            });

            // # Reset the visibility to default for cleanup
            updateCustomProfileAttributeVisibility(attributeFieldsMap, 'Title', 'when_set');
        });
    });

    it('MM-T6 Should display phone and URL type custom profile attributes correctly', () => {
        // # Post a message as the test user
        cy.postMessageAs({
            sender: testUser,
            message: 'Testing phone and URL attributes - testUser',
            channelId: testChannel.id,
        });

        // # Post a message as the other user
        cy.postMessageAs({
            sender: otherUser,
            message: 'Testing phone and URL attributes',
            channelId: testChannel.id,
        });

        // # Login as the test user
        cy.apiLogin(testUser);

        // # Open the profile popover for the other user
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).find('.user-popover').click();
        });

        // * Verify the profile popover is visible and wait for content to load
        cy.get('.user-profile-popover_container').should('be.visible').find('.user-popover__subtitle').should('exist');

        // * Verify the Phone attribute is displayed correctly
        cy.get('.user-profile-popover_container *').then(($elements) => {
            // Find elements containing the Phone attribute name
            const phoneNameElements = $elements.filter((_, el) => el.textContent.includes('Phone'));

            // If we found a matching element, scroll it into view and verify it's visible
            if (phoneNameElements.length > 0) {
                cy.wrap(phoneNameElements[0]).scrollIntoView().should('be.visible');
            } else {
                throw new Error('Could not find attribute "Phone" in the profile popover');
            }

            // Find elements containing the Phone attribute value
            const phoneValueElements = $elements.filter((_, el) => el.textContent.includes('555-123-4567'));

            // If we found a matching element, scroll it into view and verify it's visible
            if (phoneValueElements.length > 0) {
                cy.wrap(phoneValueElements[0]).scrollIntoView().should('be.visible');
            } else {
                throw new Error('Could not find value "555-123-4567" in the profile popover');
            }
        });

        // * Verify the Website attribute is displayed correctly
        cy.get('.user-profile-popover_container *').then(($elements) => {
            // Find elements containing the Website attribute name
            const websiteNameElements = $elements.filter((_, el) => el.textContent.includes('Website'));

            // If we found a matching element, scroll it into view and verify it's visible
            if (websiteNameElements.length > 0) {
                cy.wrap(websiteNameElements[0]).scrollIntoView().should('be.visible');
            } else {
                throw new Error('Could not find attribute "Website" in the profile popover');
            }

            // Find elements containing the Website attribute value
            const websiteValueElements = $elements.filter((_, el) => el.textContent.includes('https://example.com'));

            // If we found a matching element, scroll it into view and verify it's visible
            if (websiteValueElements.length > 0) {
                cy.wrap(websiteValueElements[0]).scrollIntoView().should('be.visible');
            } else {
                throw new Error('Could not find value "https://example.com" in the profile popover');
            }
        });
    });

    it('MM-T7 Should have clickable phone and URL attributes in profile popover', () => {
        // # Post a message as the test user
        cy.postMessageAs({
            sender: testUser,
            message: 'Testing clickable phone and URL attributes- testUser',
            channelId: testChannel.id,
        });

        // # Post a message as the other user
        cy.postMessageAs({
            sender: otherUser,
            message: 'Testing clickable phone and URL attributes',
            channelId: testChannel.id,
        });

        // # Login as the test user
        cy.apiLogin(testUser);

        // # Open the profile popover for the other user
        cy.getLastPostId().then((postId) => {
            cy.get(`#post_${postId}`).find('.user-popover').click();
        });

        // * Verify the profile popover is visible and wait for content to load
        cy.get('.user-profile-popover_container').should('be.visible').find('.user-popover__subtitle').should('exist');

        // * Verify the Phone attribute has a clickable link with tel: protocol
        cy.get('.user-profile-popover_container').within(() => {
            // Find the phone link
            cy.contains('555-123-4567').should('have.attr', 'href').and('include', 'tel:');

            // Find the URL link
            cy.contains('https://example.com').should('have.attr', 'href').and('include', 'https:');
        });
    });
});

/**
 * Helper function to verify attributes are displayed in the profile popover
 * @param {Array} attributes - Array of attribute objects with name and value
 */
function verifyAttributesInPopover(attributes) {
    attributes.forEach((attribute) => {
        // Find all elements in the popover
        cy.get('.user-profile-popover_container *').then(($elements) => {
            // Find elements containing the attribute name
            const nameElements = $elements.filter((_, el) => el.textContent.includes(attribute.name));

            // If we found a matching element, scroll it into view and verify it's visible
            if (nameElements.length > 0) {
                cy.wrap(nameElements[0]).scrollIntoView().should('be.visible');
            } else {
                throw new Error(`Could not find attribute "${attribute.name}" in the profile popover`);
            }

            // Find elements containing the attribute value
            const valueElements = $elements.filter((_, el) => el.textContent.includes(attribute.value));

            // If we found a matching element, scroll it into view and verify it's visible
            if (valueElements.length > 0) {
                cy.wrap(valueElements[0]).scrollIntoView().should('be.visible');
            } else {
                throw new Error(`Could not find value "${attribute.value}" in the profile popover`);
            }
        });
    });
}

/**
 * Updates the visibility property of a custom profile attribute field
 * @param {Map} fieldsMap - Map of field IDs to field objects
 * @param {string} attributeName - The name of the attribute to update
 * @param {string} visibility - The visibility value to set ('when_set', 'hidden', or 'always')
 * @returns {Promise} - A promise that resolves when the update is complete
 */
function updateCustomProfileAttributeVisibility(fieldsMap, attributeName, visibility) {
    let fieldID = '';

    // Find the field ID for the attribute name
    fieldsMap.forEach((value, key) => {
        if (value.name === attributeName) {
            fieldID = key;
        }
    });

    if (!fieldID) {
        throw new Error(`Could not find field ID for attribute: ${attributeName}`);
    }

    // Admin permission is required to update field properties
    cy.apiAdminLogin();

    // Update the visibility property
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        method: 'PATCH',
        url: `/api/v4/custom_profile_attributes/fields/${fieldID}`,
        body: {
            attrs: {
                visibility,
            },
        },
        failOnStatusCode: false, // Don't fail the test if the request fails
    }).then((response) => {
        if (response.status !== 200) {
            throw new Error(`Failed to update visibility for attribute ${attributeName}: ${response.status}`);
        }

        // Update the fieldsMap with the updated field
        fieldsMap.set(response.body.id, response.body);
        return response;
    });
}

/**
 * Clears the value of a specific custom profile attribute
 * @param {Map} fieldsMap - Map of field IDs to field objects
 * @param {string} attributeName - The name of the attribute to clear
 */
function clearCustomProfileAttributeValue(fieldsMap, attributeName) {
    let fieldID = '';

    // Find the field ID for the attribute name
    fieldsMap.forEach((value, key) => {
        if (value.name === attributeName) {
            fieldID = key;
        }
    });

    if (!fieldID) {
        throw new Error(`Could not find field ID for attribute: ${attributeName}`);
    }

    // Create a map with an empty value for the field
    const valuesByFieldId = {
        [fieldID]: '',
    };

    // Update the value to empty
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        method: 'PATCH',
        url: '/api/v4/custom_profile_attributes/values',
        body: valuesByFieldId,
        failOnStatusCode: false, // Don't fail the test if the request fails
    }).then((response) => {
        if (response.status !== 200) {
            throw new Error(`Failed to clear value for attribute ${attributeName}: ${response.status}`);
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
