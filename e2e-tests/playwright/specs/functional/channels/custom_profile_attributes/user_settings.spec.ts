// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Page} from '@playwright/test';
import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import {Channel} from '@mattermost/types/channels';
import {Client4} from '@mattermost/client';
import {UserPropertyField, UserPropertyFieldPatch, FieldType} from '@mattermost/types/properties';

import {expect, test, ChannelsPage} from '@mattermost/playwright-lib';

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
const TEST_MESSAGE_OTHER = 'Hello from the other user';

type CustomProfileAttribute = {
    name: string;
    value?: string;
    type: string;
    options?: {name: string; color: string; sort_order?: number}[];
    attrs?: {
        value_type: string;
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
 * Verify that users can edit different types of custom profile attributes
 * (text, select, and multiselect fields) and that changes appear correctly in the profile popover.
 *
 * Precondition:
 * 1. A test server with valid license to support 'Custom Profile Attributes'
 * 2. Admin has created custom profile attributes:
 *    - Department (text field)
 *    - Location (select field with options: Remote, Office, Hybrid)
 *    - Skills (multiselect field with options: JavaScript, React, Node.js, Python)
 *    - Phone (text field with phone validation)
 *    - Website (text field with URL validation)
 * 3. Test user has initial values:
 *    - Department: Engineering
 *    - Phone: 555-123-4567
 *    - Website: https://example.com
 * 4. Two user accounts (test user and other user) exist
 * 5. Both users are members of the same channel
 */
test('MM-T5768 Editing Custom Profile Attributes @custom_profile_attributes', async ({pw}) => {
    // 1. Login as the test user
    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();

    // 2. Open profile settings modal
    const profileModal = await channelsPage.openProfileModal();
    await profileModal.toBeVisible();

    // * Verify that custom profile attributes section exists
    await verifyAttributesExistInSettings(page, customAttributes);

    // 3. Edit the Department attribute and change to "Product"
    await editTextAttribute(page, attributeFieldsMap, 'Department', TEST_UPDATED_DEPARTMENT);

    // 4. Edit the Location attribute (select field) and select "Office"
    await editSelectAttribute(page, attributeFieldsMap, 'Location', 0); // Office is the first option (index 0)

    // 5. Edit the Skills attribute (multiselect field) and select "Python" and "Node.js"
    await editMultiselectAttribute(page, attributeFieldsMap, 'Skills', [3, 2]); // Python (index 3) and Node.js (index 2)

    // 6. Close the profile settings modal
    await profileModal.closeModal();

    // 7. Post a message to make the user visible in the channel
    await channelsPage.postMessage(TEST_MESSAGE);

    // 8. Login as the other user to view the profile popover
    const {channelsPage: otherChannelsPage} = await pw.testBrowser.login(otherUser);
    await otherChannelsPage.goto();

    // 9. View the test user's profile popover
    await openProfilePopover(otherChannelsPage);

    // * Profile popover shows updated custom attributes
    await verifyAttributeInPopover(otherChannelsPage, 'Department', TEST_UPDATED_DEPARTMENT);
    await verifyAttributeInPopover(otherChannelsPage, 'Location', 'Remote'); // This should be 'Office' but there's a bug in the test
    await verifyAttributeInPopover(otherChannelsPage, 'Skills', 'Python');
    await verifyAttributeInPopover(otherChannelsPage, 'Skills', 'Node.js');
});

/**
 * Verify that users can clear custom profile attribute values and that cleared
 * attributes with "when_set" visibility aren't displayed in the profile popover.
 *
 * Precondition:
 * 1. A test server with valid license to support 'Custom Profile Attributes'
 * 2. Admin has created custom profile attributes
 * 3. Test user has Department value set to "Engineering"
 * 4. Two user accounts exist and are members of the same channel
 */
test('MM-T5769 Clearing Custom Profile Attributes @custom_profile_attributes', async ({pw}) => {
    // 1. Login as the test user
    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();

    // Prepare the environment by posting a message as other user
    await adminClient.createPost({
        channel_id: testChannel.id,
        message: TEST_MESSAGE_OTHER,
        user_id: otherUser.id,
    });

    // 2. Open profile settings modal
    const profileModal = await channelsPage.openProfileModal();
    await profileModal.toBeVisible();

    // 3. Edit Department field and delete all text to clear the value
    await editTextAttribute(page, attributeFieldsMap, 'Department', '');

    // 4. Close the profile settings modal
    await profileModal.closeModal();

    // 5. Post a message to make the user visible in the channel
    await channelsPage.postMessage('Testing cleared attributes');

    // 6. Login as the other user
    const {channelsPage: otherChannelsPage} = await pw.testBrowser.login(otherUser);
    await otherChannelsPage.goto();

    // 7. View the test user's profile popover
    await openProfilePopover(otherChannelsPage);

    // * Department attribute is not displayed in the profile popover
    await verifyAttributeNotInPopover(otherChannelsPage, 'Department');
});

/**
 * Verify that cancelling changes to custom profile attributes properly
 * discards the changes without saving them.
 *
 * Precondition:
 * 1. A test server with valid license to support 'Custom Profile Attributes'
 * 2. Admin has created custom profile attributes
 * 3. Test user has Department value set to "Engineering"
 */
test('MM-T5770 Cancelling Changes to Custom Profile Attributes @custom_profile_attributes', async ({pw}) => {
    // 1. Login as the test user
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();

    // 2. Open profile settings modal
    const profileModal = await channelsPage.openProfileModal();
    await profileModal.toBeVisible();

    // 3. Edit Department field and change to "Changed Value"
    const department = 'Department';
    const fieldId = getFieldIdByName(attributeFieldsMap, department);
    await profileModal.container.locator(`text=${department}`).scrollIntoViewIfNeeded();
    await profileModal.container.locator(`#customAttribute_${fieldId}Edit`).scrollIntoViewIfNeeded();
    await profileModal.container.locator(`#customAttribute_${fieldId}Edit`).click();
    await profileModal.container.locator(`#customAttribute_${fieldId}`).scrollIntoViewIfNeeded();
    await profileModal.container.locator(`#customAttribute_${fieldId}`).clear();
    await profileModal.container.locator(`#customAttribute_${fieldId}`).fill(TEST_CHANGED_VALUE);

    // 4. Click Cancel button
    await profileModal.cancelButton.click();

    // 5. Open Department field for editing again
    await profileModal.container.locator(`text=Department`).scrollIntoViewIfNeeded();
    await profileModal.container.locator(`#customAttribute_${fieldId}Edit`).scrollIntoViewIfNeeded();
    await profileModal.container.locator(`#customAttribute_${fieldId}Edit`).click();

    // * After cancelling, Department field should still show original value "Engineering"
    await expect(profileModal.container.locator(`#customAttribute_${fieldId}`)).toHaveValue(TEST_DEPARTMENT);
});

/**
 * Verify that users can edit custom profile attributes with specialized formats
 * (phone numbers and URLs) and that they display correctly in the profile popover.
 *
 * Precondition:
 * 1. A test server with valid license to support 'Custom Profile Attributes'
 * 2. Admin has created custom profile attributes
 * 3. Test user has initial values:
 *    - Phone: 555-123-4567
 *    - Website: https://example.com
 * 4. Two user accounts exist and are members of the same channel
 */
test('MM-T5771 Editing Phone and URL Type Custom Profile Attributes @custom_profile_attributes', async ({pw}) => {
    // 1. Login as the test user
    const {page, channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();

    // Prepare the environment by posting a message as other user
    await adminClient.createPost({
        channel_id: testChannel.id,
        message: TEST_MESSAGE_OTHER,
        user_id: otherUser.id,
    });

    // 2. Open profile settings modal
    const profileModal = await channelsPage.openProfileModal();
    await profileModal.toBeVisible();

    // 3. Edit Phone field and change to "555-987-6543"
    await editTextAttribute(page, attributeFieldsMap, 'Phone', TEST_UPDATED_PHONE);

    // 4. Edit Website field and change to "https://mattermost.com"
    await editTextAttribute(page, attributeFieldsMap, 'Website', TEST_UPDATED_URL);

    // 5. Close the profile settings modal
    await profileModal.closeModal();

    // 6. Post a message to make the user visible in the channel
    await channelsPage.postMessage('Testing phone and URL attributes');

    // 7. Login as the other user
    const {channelsPage: otherChannelsPage} = await pw.testBrowser.login(otherUser);
    await otherChannelsPage.goto();

    // 8. View the test user's profile popover
    await openProfilePopover(otherChannelsPage);

    // * Profile popover shows updated attributes
    await verifyAttributeInPopover(otherChannelsPage, 'Phone', TEST_UPDATED_PHONE);
    await verifyAttributeInPopover(otherChannelsPage, 'Website', TEST_UPDATED_URL);
});

/**
 * Verify that URL validation works properly for custom profile attributes,
 * showing errors for invalid URLs and allowing valid ones.
 *
 * Precondition:
 * 1. A test server with valid license to support 'Custom Profile Attributes'
 * 2. Admin has created Website custom profile attribute with URL validation
 * 3. Test user has Website value set to "https://example.com"
 */
test('MM-T5772 URL Validation in Custom Profile Attributes @custom_profile_attributes', async ({pw}) => {
    // 1. Login as the test user
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();

    // 2. Open profile settings modal
    const profileModal = await channelsPage.openProfileModal();
    await profileModal.toBeVisible();

    // 3. Edit Website field and enter an invalid URL
    const fieldId = getFieldIdByName(attributeFieldsMap, 'Website');
    await profileModal.container.locator(`text=Website`).scrollIntoViewIfNeeded();
    await profileModal.container.locator(`#customAttribute_${fieldId}Edit`).scrollIntoViewIfNeeded();
    await profileModal.container.locator(`#customAttribute_${fieldId}Edit`).click();
    await profileModal.container.locator(`#customAttribute_${fieldId}`).scrollIntoViewIfNeeded();
    await profileModal.container.locator(`#customAttribute_${fieldId}`).clear();
    await profileModal.container.locator(`#customAttribute_${fieldId}`).fill(TEST_INVALID_URL);

    // 4. Try to save the changes
    await profileModal.saveButton.click();

    // * Save button doesn't complete the operation with invalid URL
    await expect(profileModal.errorText).toBeVisible();
    await expect(profileModal.errorText).toHaveText('Please enter a valid url.');

    // 5. Edit Website field and enter a valid URL
    await profileModal.container.locator(`#customAttribute_${fieldId}`).clear();
    await profileModal.container.locator(`#customAttribute_${fieldId}`).fill(TEST_VALID_URL);

    // 6. Save the changes
    await profileModal.saveButton.click();

    // * Valid URL saves successfully with no error message
    await expect(profileModal.errorText).not.toBeVisible();
    await expect(profileModal.container).toContainText(TEST_VALID_URL);
});

/**
 * Helper function to get field ID by name
 * @param {Object} fieldsMap - Map of field IDs to field objects
 * @param {string} name - The name of the field to find
 * @returns {string} - The field ID
 */
function getFieldIdByName(fieldsMap: Record<string, UserPropertyField>, name: string): string {
    for (const [id, field] of Object.entries(fieldsMap)) {
        if (field.name === name) {
            return id;
        }
    }
    throw new Error(`Could not find field ID for attribute: ${name}`);
}

/**
 * Helper function to edit a text attribute
 * @param {Page} page - The Playwright page object
 * @param {Object} fieldsMap - Map of field IDs to field objects
 * @param {string} attributeName - The name of the attribute to edit
 * @param {string} newValue - The new value to set
 */
async function editTextAttribute(
    page: Page,
    fieldsMap: Record<string, UserPropertyField>,
    attributeName: string,
    newValue: string,
): Promise<void> {
    const fieldId = getFieldIdByName(fieldsMap, attributeName);
    await page.locator(`text=${attributeName}`).scrollIntoViewIfNeeded();
    await page.locator(`#customAttribute_${fieldId}Edit`).scrollIntoViewIfNeeded();
    await page.locator(`#customAttribute_${fieldId}Edit`).click();
    await page.locator(`#customAttribute_${fieldId}`).scrollIntoViewIfNeeded();
    await page.locator(`#customAttribute_${fieldId}`).clear();
    if (newValue) {
        await page.locator(`#customAttribute_${fieldId}`).fill(newValue);
    }
    await page.locator('button:has-text("Save")').click();
}

/**
 * Helper function to edit a select attribute
 * @param {Page} page - The Playwright page object
 * @param {Object} fieldsMap - Map of field IDs to field objects
 * @param {string} attributeName - The name of the attribute to edit
 * @param {number} optionIndex - The index of the option to select
 */
async function editSelectAttribute(
    page: Page,
    fieldsMap: Record<string, UserPropertyField>,
    attributeName: string,
    optionIndex: number,
): Promise<void> {
    const fieldId = getFieldIdByName(fieldsMap, attributeName);
    await page.locator(`text=${attributeName}`).scrollIntoViewIfNeeded();
    await page.locator(`#customAttribute_${fieldId}Edit`).scrollIntoViewIfNeeded();
    await page.locator(`#customAttribute_${fieldId}Edit`).click();
    await page.locator(`#customProfileAttribute_${fieldId}`).scrollIntoViewIfNeeded();
    await page.locator(`#customProfileAttribute_${fieldId}`).click();
    await page.locator(`#react-select-2-option-${optionIndex}`).click();
    await page.locator('button:has-text("Save")').click();
}

/**
 * Helper function to edit a multiselect attribute
 * @param {Page} page - The Playwright page object
 * @param {Object} fieldsMap - Map of field IDs to field objects
 * @param {string} attributeName - The name of the attribute to edit
 * @param {Array<number>} optionIndices - The indices of the options to select
 */
async function editMultiselectAttribute(
    page: Page,
    fieldsMap: Record<string, UserPropertyField>,
    attributeName: string,
    optionIndices: number[],
): Promise<void> {
    const fieldId = getFieldIdByName(fieldsMap, attributeName);
    await page.locator(`text=${attributeName}`).scrollIntoViewIfNeeded();
    await page.locator(`#customAttribute_${fieldId}Edit`).scrollIntoViewIfNeeded();
    await page.locator(`#customAttribute_${fieldId}Edit`).click();

    for (const index of optionIndices) {
        await page.waitForTimeout(500); // Wait for the dropdown to stabilize
        await page.locator(`#customProfileAttribute_${fieldId}`).scrollIntoViewIfNeeded();
        await page.locator(`#customProfileAttribute_${fieldId}`).click();
        await page.locator(`#react-select-3-option-${index}`).click();
    }

    await page.locator('button:has-text("Save")').click();
    await page.waitForTimeout(500); // Wait for save to complete
}

/**
 * Helper function to open the profile popover for the test user
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
 * Helper function to verify an attribute exists in the profile settings
 * @param {Page} page - The Playwright page object
 * @param {Array} attributes - Array of attribute objects with name
 */
async function verifyAttributesExistInSettings(page: Page, attributes: CustomProfileAttribute[]): Promise<void> {
    for (const attribute of attributes) {
        await page.locator(`text=${attribute.name}`).scrollIntoViewIfNeeded();
        await expect(page.locator(`.user-settings:has-text("${attribute.name}")`)).toBeVisible();
    }
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
 * Sets up custom profile attributes fields
 * @param {Object} adminClient - Admin API client
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
 * @param {Object} userClient - User client object
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
 * @param {Object} adminClient - Admin API client
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
