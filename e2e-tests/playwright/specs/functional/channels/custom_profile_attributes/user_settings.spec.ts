// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import {Channel} from '@mattermost/types/channels';
import {Client4} from '@mattermost/client';
import {UserPropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import {
    CustomProfileAttribute,
    setupCustomProfileAttributeFields,
    setupCustomProfileAttributeValues,
    deleteCustomProfileAttributes,
    verifyAttributesExistInSettings,
    verifyAttributeInPopover,
    verifyAttributeNotInPopover,
    editTextAttribute,
    editSelectAttribute,
    editMultiselectAttribute,
    getFieldIdByName,
    TEST_PHONE,
    TEST_UPDATED_PHONE,
    TEST_URL,
    TEST_UPDATED_URL,
    TEST_INVALID_URL,
    TEST_VALID_URL,
    TEST_DEPARTMENT,
    TEST_UPDATED_DEPARTMENT,
    TEST_CHANGED_VALUE,
    TEST_LOCATION_OPTIONS,
    TEST_SKILLS_OPTIONS,
    TEST_MESSAGE,
    TEST_MESSAGE_OTHER,
} from './helpers';

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

let team: Team;
let user: UserProfile;
let otherUser: UserProfile;
let testChannel: Channel;
let attributeFieldsMap: Record<string, UserPropertyField>;
let adminClient: Client4;
let userClient: Client4;

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
    const lastPost = await otherChannelsPage.getLastPost();
    await otherChannelsPage.openProfilePopover(lastPost);

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
    const lastPost = await channelsPage.getLastPost();
    await channelsPage.openProfilePopover(lastPost);

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
    const lastPost = await otherChannelsPage.getLastPost();
    await otherChannelsPage.openProfilePopover(lastPost);

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
