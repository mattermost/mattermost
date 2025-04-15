// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Page} from '@playwright/test';
import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import {Channel} from '@mattermost/types/channels';
import {Client4} from '@mattermost/client';
import {UserPropertyField, UserPropertyFieldPatch, FieldType} from '@mattermost/types/properties';

import {expect, test, ChannelsPage} from '@mattermost/playwright-lib';

// Constants for test data
const TEST_PHONE = '555-123-4567';
const TEST_UPDATED_PHONE = '555-987-6543';
const TEST_URL = 'https://example.com';
const TEST_UPDATED_URL = 'https://mattermost.com';
const TEST_DEPARTMENT = 'Engineering';
const TEST_LOCATION = 'Remote';
const TEST_UPDATED_DEPARTMENT = 'Product';
const TEST_UPDATED_LOCATION = 'Office';
const TEST_TITLE = 'Software Engineer';
const TEST_MESSAGE = 'Hello from the test user';

type CustomProfileAttribute = {
    name: string;
    value?: string;
    type: string;
    options?: {name: string; color: string; sort_order?: number}[];
    attrs?: {
        value_type?: string;
        visibility?: string;
        options?: {name: string; color: string}[];
    };
};

let team: Team;
let user: UserProfile;
let otherUser: UserProfile;
let testChannel: Channel;
let attributeFieldsMap: Record<string, UserPropertyField>;
let adminClient: Client4;
let userClient: Client4;

// Custom attribute definitions
const customAttributes: CustomProfileAttribute[] = [
    {
        name: 'Department',
        value: TEST_DEPARTMENT,
        type: 'text',
    },
    {
        name: 'Location',
        value: TEST_LOCATION,
        type: 'text',
    },
    {
        name: 'Title',
        value: TEST_TITLE,
        type: 'text',
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

test.beforeEach(async ({pw}) => {
    // Skip test if no license for "Custom Profile Attributes"
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    // Initialize with admin client
    ({team, user, adminClient, userClient} = await pw.initSetup({userPrefix: 'cpa-test-'}));
    const channel = pw.random.channel({
        teamId: team.id,
        name: `test-channel`,
        displayName: `Test Channel`,
    });
    testChannel = await adminClient.createChannel(channel);

    // Create another user to test profile popover
    otherUser = await pw.createNewUserProfile(adminClient, 'cpa-other-');
    await adminClient.addToTeam(team.id, otherUser.id);
    await adminClient.addToChannel(otherUser.id, testChannel.id);
    
    // Add the test user to the test channel
    await adminClient.addToChannel(user.id, testChannel.id);

    // Set up custom profile attribute fields
    attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, customAttributes);

    // Login as the test user
    const {page} = await pw.testBrowser.login(user);

    // Set up initial values for custom profile attributes
    await setupCustomProfileAttributeValues(userClient, customAttributes, attributeFieldsMap);

    // Visit the test channel
    await page.goto(`/${team.name}/channels/${testChannel.name}`);
});

test.afterAll(async () => {
    // Clean up by deleting custom profile attributes
    await deleteCustomProfileAttributes(adminClient, attributeFieldsMap);
});

/**
 * MM-T1: Should display custom profile attributes in profile popover
 * 
 * Verify that custom profile attributes are displayed correctly in the profile popover.
 * 
 * Precondition:
 * 1. A test server with valid license to support 'Custom Profile Attributes'
 * 2. Admin has created custom profile attributes
 * 3. Test user has values set for custom profile attributes
 * 4. User is a member of a channel
 */
test('MM-T1 Should display custom profile attributes in profile popover @custom_attributes', async ({pw}) => {
    // 1. Login as the test user
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();

    // 2. Post a message to make the user visible in the channel
    await channelsPage.postMessage(TEST_MESSAGE);

    // Open the profile popover for the user's post
    await openProfilePopover(channelsPage);

    // Verify each custom attribute is displayed correctly
    for (const attribute of customAttributes) {
        if (attribute.value) {
            await verifyAttributeInPopover(channelsPage, attribute.name, attribute.value);
        }
    }
});

/**
 * MM-T2: Should not display custom profile attributes if none exist
 * 
 * Verify that custom profile attributes are not displayed in the profile popover
 * if the user has no values set.
 * 
 * Precondition:
 * 1. A test server with valid license to support 'Custom Profile Attributes'
 * 2. Admin has created custom profile attributes
 * 3. Test user has no values set for custom profile attributes
 * 4. Two user accounts exist and are members of the same channel
 */
test('MM-T2 Should not display custom profile attributes if none exist @custom_attributes', async ({pw}) => {
    // 1. Login as the other user
    const {channelsPage} = await pw.testBrowser.login(otherUser);
    await channelsPage.goto();

    // 2. Post a message to make the user visible in the channel
    await channelsPage.postMessage(TEST_MESSAGE);

    // Open the profile popover for the user's post
    await openProfilePopover(channelsPage);

    // Verify custom attributes are not displayed
    for (const attribute of customAttributes) {
        await verifyAttributeNotInPopover(channelsPage, attribute.name);
    }
});

// /**
//  * MM-T3: Should update custom profile attributes when changed
//  * 
//  * Verify that custom profile attributes are updated correctly when changed
//  * and the changes are reflected in the profile popover.
//  * 
//  * Precondition:
//  * 1. A test server with valid license to support 'Custom Profile Attributes'
//  * 2. Admin has created custom profile attributes
//  * 3. Other user has values set for custom profile attributes
//  * 4. Two user accounts exist and are members of the same channel
//  */
test('MM-T3 Should update custom profile attributes when changed @custom_attributes', async ({pw}) => {
    // 1. Login as the test user
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();

    // 2. Post a message to make the user visible in the channel
    await channelsPage.postMessage(TEST_MESSAGE);

    // Open the profile popover for the user's post
    await openProfilePopover(channelsPage);

    // Verify each custom attribute is displayed correctly
    for (const attribute of customAttributes) {
        if (attribute.value) {
            await verifyAttributeInPopover(channelsPage, attribute.name, attribute.value);
        }
    }

    // Close the profile popover
    await channelsPage.page.click('body', {position: {x: 10, y: 10}});

    // Update custom profile attributes for "otherUser"
    const updatedAttributes: CustomProfileAttribute[] = [
        {
            name: 'Department',
            value: TEST_UPDATED_DEPARTMENT,
            type: 'text',
        },
        {
            name: 'Location',
            value: TEST_UPDATED_LOCATION,
            type: 'text',
        },
    ];
    await setupCustomProfileAttributeValues(userClient, updatedAttributes, attributeFieldsMap);

    // Open the profile popover again
    await openProfilePopover(channelsPage);

    // Verify updated attributes are displayed correctly
    for (const attribute of updatedAttributes) {
        if (attribute.value) {
            await verifyAttributeInPopover(channelsPage, attribute.name, attribute.value);
        }
    }

    // Verify non-updated attribute is still displayed correctly
    await verifyAttributeInPopover(channelsPage, 'Title', TEST_TITLE);
});

/**
 * MM-T4: Should not display custom profile attributes with visibility set to hidden
 * 
 * Verify that custom profile attributes with visibility set to hidden
 * are not displayed in the profile popover.
 * 
 * Precondition:
 * 1. A test server with valid license to support 'Custom Profile Attributes'
 * 2. Admin has created custom profile attributes
 * 3. Other user has values set for custom profile attributes
 * 4. Two user accounts exist and are members of the same channel
 */
test('MM-T4 Should not display custom profile attributes with visibility set to hidden @custom_attributes', async ({pw}) => {
    // Update the visibility of the Department attribute to hidden
    await updateCustomProfileAttributeVisibility(adminClient, attributeFieldsMap, 'Department', 'hidden');

    // 1. Login as the test user
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();

    // 2. Post a message to make the user visible in the channel
    await channelsPage.postMessage(TEST_MESSAGE);

    // Open the profile popover for the user's post
    await openProfilePopover(channelsPage);

    // Verify the Department attribute is not displayed
    await verifyAttributeNotInPopover(channelsPage, 'Department');

    // Verify other attributes are still displayed
    await verifyAttributeInPopover(channelsPage, 'Location', TEST_LOCATION);
    
    // Reset the visibility to default for cleanup
    await updateCustomProfileAttributeVisibility(adminClient, attributeFieldsMap, 'Department', 'when_set');
});

/**
 * MM-T5: Should always display custom profile attributes with visibility set to always
 * 
 * Verify that custom profile attributes with visibility set to always
 * are displayed in the profile popover even if they have no value.
 * 
 * Precondition:
 * 1. A test server with valid license to support 'Custom Profile Attributes'
 * 2. Admin has created custom profile attributes
 * 3. Other user has values set for custom profile attributes
 * 4. Two user accounts exist and are members of the same channel
 */
test('MM-T5 Should always display custom profile attributes with visibility set to always @custom_attributes', async ({pw}) => {
    // Update the visibility of the Title attribute to always
    await updateCustomProfileAttributeVisibility(adminClient, attributeFieldsMap, 'Title', 'always');

    // 1. Login as the other user
    const {channelsPage} = await pw.testBrowser.login(otherUser);
    await channelsPage.goto();

    // 2. Post a message to make the user visible in the channel
    await channelsPage.postMessage(TEST_MESSAGE);

    // Open the profile popover for the user's post
    await openProfilePopover(channelsPage);

    // Verify custom attributes are not displayed
    for (const attribute of customAttributes) {
        if (attribute.name === 'Title') {
            // Verify the Title attribute is displayed even though it has no value
            const popover = channelsPage.userProfilePopover.container;
            const nameElement = popover.getByText('Title', {exact: false});
            await expect(nameElement).toBeVisible();
        } else {
            await verifyAttributeNotInPopover(channelsPage, attribute.name);
        }
    }

    // Reset the visibility to default for cleanup
    await updateCustomProfileAttributeVisibility(adminClient, attributeFieldsMap, 'Title', 'when_set');
});

/**
 * MM-T6: Should display phone and URL type custom profile attributes correctly
 * 
 * Verify that phone and URL type custom profile attributes are displayed
 * correctly in the profile popover.
 * 
 * Precondition:
 * 1. A test server with valid license to support 'Custom Profile Attributes'
 * 2. Admin has created custom profile attributes including phone and URL types
 * 3. Other user has values set for custom profile attributes
 * 4. Two user accounts exist and are members of the same channel
 */
test('MM-T6 Should display phone and URL type custom profile attributes correctly @custom_attributes', async ({pw}) => {
    // Login as the test user
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();

    // 2. Post a message to make the user visible in the channel
    await channelsPage.postMessage(TEST_MESSAGE);

    // Open the profile popover for the other user
    await openProfilePopover(channelsPage);

    // Verify the Phone attribute is displayed correctly
    await verifyAttributeInPopover(channelsPage, 'Phone', TEST_PHONE);

    // Verify the Website attribute is displayed correctly
    await verifyAttributeInPopover(channelsPage, 'Website', TEST_URL);
});

/**
 * MM-T7: Should have clickable phone and URL attributes in profile popover
 * 
 * Verify that phone and URL type custom profile attributes are clickable
 * in the profile popover.
 * 
 * Precondition:
 * 1. A test server with valid license to support 'Custom Profile Attributes'
 * 2. Admin has created custom profile attributes including phone and URL types
 * 3. Other user has values set for custom profile attributes
 * 4. Two user accounts exist and are members of the same channel
 */
test('MM-T7 Should have clickable phone and URL attributes in profile popover @custom_attributes', async ({pw}) => {
    // Login as the test user
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();

    // 2. Post a message to make the user visible in the channel
    await channelsPage.postMessage(TEST_MESSAGE);

    // Open the profile popover for the other user
    await openProfilePopover(channelsPage);

    // Verify the Phone attribute has a clickable link with tel: protocol
    const popover = channelsPage.userProfilePopover.container;
    const phoneLink = popover.getByText(TEST_PHONE, {exact: false});
    await expect(phoneLink).toHaveAttribute('href', new RegExp(`^tel:`));

    // Verify the Website attribute has a clickable link with https: protocol
    const urlLink = popover.getByText(TEST_URL, {exact: false});
    await expect(urlLink).toHaveAttribute('href', new RegExp(`^https:`));
});

/**
 * Helper function to open the profile popover for the last post's user
 * @param {ChannelsPage} channelsPage - The Playwright channels page object
 */
async function openProfilePopover(channelsPage: ChannelsPage): Promise<void> {
    // Find and click the last post's user avatar to open the profile popover
    const lastPost = await channelsPage.getLastPost();
    await lastPost.hover();
    await lastPost.profileIcon.click();

    // Wait for the profile popover to be visible
    const popover = channelsPage.userProfilePopover;
    await expect(popover.container).toBeVisible();
}

/**
 * Helper function to verify an attribute is displayed in the profile popover
 * @param {ChannelsPage} channelsPage - The Playwright channels page object
 * @param {string} attributeName - The name of the attribute to verify
 * @param {string} attributeValue - The value of the attribute to verify
 */
async function verifyAttributeInPopover(
    channelsPage: ChannelsPage,
    attributeName: string,
    attributeValue: string,
): Promise<void> {
    const popover = channelsPage.userProfilePopover.container;

    // Check for the attribute name
    const nameElement = popover.getByText(attributeName, {exact: false});
    await expect(nameElement).toBeVisible();

    // Check for the attribute value
    const valueElement = popover.getByText(attributeValue, {exact: false});
    await expect(valueElement).toBeVisible();
}

/**
 * Helper function to verify an attribute is not displayed in the profile popover
 * @param {ChannelsPage} channelsPage - The Playwright channels page object
 * @param {string} attributeName - The name of the attribute to verify
 */
async function verifyAttributeNotInPopover(channelsPage: ChannelsPage, attributeName: string): Promise<void> {
    const popover = channelsPage.userProfilePopover.container;

    // Check that the attribute name is not present
    const nameElement = popover.getByText(attributeName, {exact: false});
    await expect(nameElement).not.toBeVisible();
}

/**
 * Updates the visibility property of a custom profile attribute field
 * @param {Client4} adminClient - Admin API client
 * @param {Object} fieldsMap - Map of field IDs to field objects
 * @param {string} attributeName - The name of the attribute to update
 * @param {string} visibility - The visibility value to set ('when_set', 'hidden', or 'always')
 */
async function updateCustomProfileAttributeVisibility(
    adminClient: Client4,
    fieldsMap: Record<string, UserPropertyField>,
    attributeName: string,
    visibility: 'when_set' | 'hidden' | 'always',
): Promise<void> {
    let fieldID = '';

    // Find the field ID for the attribute name
    for (const [id, field] of Object.entries(fieldsMap)) {
        if (field.name === attributeName) {
            fieldID = id;
            break;
        }
    }

    if (!fieldID) {
        throw new Error(`Could not find field ID for attribute: ${attributeName}`);
    }

    try {
        // Update the visibility property
        const updatedField = await adminClient.patchCustomProfileAttributeField(fieldID, {
            // @ts-expect-error The type definition requires more properties than we need to set
            attrs: {
                visibility,
            },
        });

        // Update the fieldsMap with the updated field
        fieldsMap[updatedField.id] = updatedField;
    } catch (error) {
        // eslint-disable-next-line no-console
        console.log(`Failed to update visibility for attribute ${attributeName}:`, error);
    }
}

/**
 * Clears the value of a specific custom profile attribute
 * @param {Client4} userClient - User client object
 * @param {Object} fieldsMap - Map of field IDs to field objects
 * @param {string} attributeName - The name of the attribute to clear
 */
async function clearCustomProfileAttributeValue(
    userClient: Client4,
    fieldsMap: Record<string, UserPropertyField>,
    attributeName: string,
): Promise<void> {
    let fieldID = '';

    // Find the field ID for the attribute name
    for (const [id, field] of Object.entries(fieldsMap)) {
        if (field.name === attributeName) {
            fieldID = id;
            break;
        }
    }

    if (!fieldID) {
        throw new Error(`Could not find field ID for attribute: ${attributeName}`);
    }

    // Create a map with an empty value for the field
    const valuesByFieldId: Record<string, string> = {
        [fieldID]: '',
    };

    try {
        // Update the value to empty
        await userClient.updateCustomProfileAttributeValues(valuesByFieldId);
    } catch (error) {
        // eslint-disable-next-line no-console
        console.log(`Failed to clear value for attribute ${attributeName}:`, error);
    }
}

/**
 * Sets up custom profile attributes fields
 * @param {Client4} adminClient - Admin API client
 * @param {Array} attributes - Array of attribute objects with name and value
 * @returns {Promise<Object>} - A promise that resolves to a map of field IDs to field objects
 */
async function setupCustomProfileAttributeFields(
    adminClient: Client4,
    attributes: CustomProfileAttribute[],
): Promise<Record<string, UserPropertyField>> {
    const fieldsMap: Record<string, UserPropertyField> = {};

    // Create the attribute fields array
    const attributeFields: UserPropertyFieldPatch[] = attributes.map((attr, index) => {
        // Start with basic field properties
        const field: UserPropertyFieldPatch = {
            name: attr.name,
            type: (attr.type as FieldType) || 'text',
            // @ts-expect-error @mattermost/types needs to be updated
            attrs: {
                sort_order: index,
            },
        };

        // Add options for select and multiselect fields
        if ((attr.type === 'select' || attr.type === 'multiselect') && attr.options) {
            // @ts-expect-error @mattermost/types needs to be updated
            field.attrs.options = attr.options;
        }

        // Add any additional attributes if provided
        if (attr.attrs) {
            // @ts-expect-error @mattermost/types needs to be updated
            field.attrs = {
                ...field.attrs,
                ...attr.attrs,
            };
        }

        return field;
    });

    // Get existing fields
    try {
        const existingFields = await adminClient.getCustomProfileAttributeFields();

        // If fields exist, use them
        if (existingFields && existingFields.length > 0) {
            for (const field of existingFields) {
                fieldsMap[field.id] = field;
            }
            return fieldsMap;
        }
    } catch (error) {
        // If request fails, continue to create new fields
        // eslint-disable-next-line no-console
        console.log('Error getting existing custom profile fields, will create new ones', error);
    }

    // Create fields sequentially
    for (const field of attributeFields) {
        try {
            const createdField = await adminClient.createCustomProfileAttributeField(field);
            fieldsMap[createdField.id] = createdField;
        } catch (error) {
            // eslint-disable-next-line no-console
            console.log(`Failed to create field ${field.name}:`, error);
        }
    }

    return fieldsMap;
}

/**
 * Sets up custom profile attribute values for the current user
 * @param {Client4} userClient - User client object
 * @param {Array} attributes - Array of attribute objects with name and value
 * @param {Object} fields - Map of field IDs to field objects
 */
async function setupCustomProfileAttributeValues(
    userClient: Client4,
    attributes: CustomProfileAttribute[],
    fields: Record<string, UserPropertyField>,
): Promise<void> {
    // Create a map of attribute values by field ID
    const valuesByFieldId: Record<string, string> = {};

    for (const attr of attributes) {
        let fieldID = '';

        // Find the field ID for this attribute name
        for (const [id, field] of Object.entries(fields)) {
            if (field.name === attr.name) {
                fieldID = id;
                break;
            }
        }

        // If we found a matching field, add it to our values object
        if (fieldID && attr.value) {
            valuesByFieldId[fieldID] = attr.value;
        }
    }

    // Only make the API call if we have values to set
    if (Object.keys(valuesByFieldId).length > 0) {
        try {
            await userClient.updateCustomProfileAttributeValues(valuesByFieldId);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.log('Failed to set attribute values:', error);
        }
    }
}

/**
 * Deletes all custom profile attributes
 * @param {Client4} adminClient - Admin API client
 * @param {Object} attributes - Map of field IDs to field objects
 */
async function deleteCustomProfileAttributes(
    adminClient: Client4,
    attributes: Record<string, UserPropertyField>,
): Promise<void> {
    // Delete each field
    for (const id of Object.keys(attributes)) {
        try {
            await adminClient.deleteCustomProfileAttributeField(id);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.log(`Failed to delete field ${id}:`, error);
        }
    }

    // Verify deletion was successful
    try {
        const response = await adminClient.getCustomProfileAttributeFields();
        if (response && response.length > 0) {
            // eslint-disable-next-line no-console
            console.log('Warning: Not all custom profile attributes were deleted');
        }
    } catch (error) {
        // eslint-disable-next-line no-console
        console.log('Error checking if all fields were deleted:', error);
    }
}
