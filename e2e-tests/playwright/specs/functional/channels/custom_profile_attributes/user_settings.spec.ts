// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {Channel} from '@mattermost/types/channels';
import type {Client4} from '@mattermost/client';
import type {UserPropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import type {CustomProfileAttribute} from './helpers';
import {
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

// Custom attribute definitions.
// Names are intentionally suffixed with 'US' to avoid sharing server fields with
// custom_attributes.spec.ts, which defines identically-typed 'Department', 'Phone',
// and 'Website' attributes.  With greedy-bin-packing shard balancing the two spec
// files often land in different shards; if they shared fields the owning spec's
// afterAll would delete the field while the other spec is still using it, causing
// consistent CI failures (observed as Department absent from the profile popover).
const customAttributes: CustomProfileAttribute[] = [
    {
        name: 'DepartmentUS',
        value: TEST_DEPARTMENT,
        type: 'text',
    },
    {
        name: 'LocationUS',
        type: 'select',
        options: TEST_LOCATION_OPTIONS,
    },
    {
        name: 'SkillsUS',
        type: 'multiselect',
        options: TEST_SKILLS_OPTIONS,
    },
    {
        name: 'PhoneUS',
        value: TEST_PHONE,
        type: 'text',
        attrs: {
            value_type: 'phone',
        },
    },
    {
        name: 'WebsiteUS',
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
    ({team, user, adminClient, userClient} = await pw.initSetup({userOptions: {prefix: 'cpa-test-'}}));
    const channel = pw.random.channel({
        teamId: team.id,
        name: 'test-channel',
        displayName: 'Test Channel',
    });
    testChannel = await adminClient.createChannel(channel);

    // Create another user to test profile popover
    otherUser = await pw.createNewUserProfile(adminClient, {prefix: 'cpa-other-'});
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

    // 3. Edit the DepartmentUS attribute and change to "Product"
    await editTextAttribute(page, attributeFieldsMap, 'DepartmentUS', TEST_UPDATED_DEPARTMENT);

    // 4. Edit the LocationUS attribute (select field) and select "Remote" (index 0)
    await editSelectAttribute(page, attributeFieldsMap, 'LocationUS', 0); // Remote is the first option (index 0)

    // 5. Edit the SkillsUS attribute (multiselect field) and select "Python" and "Node.js"
    await editMultiselectAttribute(page, attributeFieldsMap, 'SkillsUS', [3, 2]); // Python (index 3) and Node.js (index 2)

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
    await verifyAttributeInPopover(otherChannelsPage, 'DepartmentUS', TEST_UPDATED_DEPARTMENT);
    await verifyAttributeInPopover(otherChannelsPage, 'LocationUS', 'Remote'); // Remote is index 0 in TEST_LOCATION_OPTIONS
    await verifyAttributeInPopover(otherChannelsPage, 'SkillsUS', 'Python');
    await verifyAttributeInPopover(otherChannelsPage, 'SkillsUS', 'Node.js');
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

    // 3. Edit DepartmentUS field and delete all text to clear the value
    await editTextAttribute(page, attributeFieldsMap, 'DepartmentUS', '');

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

    // * DepartmentUS attribute is not displayed in the profile popover
    await verifyAttributeNotInPopover(otherChannelsPage, 'DepartmentUS');
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

    // 3. Edit DepartmentUS field and change to "Changed Value"
    const department = 'DepartmentUS';
    const fieldId = getFieldIdByName(attributeFieldsMap, department);
    await profileModal.container.locator(`text=${department}`).scrollIntoViewIfNeeded();
    await profileModal.container.locator(`#customAttribute_${fieldId}Edit`).scrollIntoViewIfNeeded();
    await profileModal.container.locator(`#customAttribute_${fieldId}Edit`).click();
    await profileModal.container.locator(`#customAttribute_${fieldId}`).scrollIntoViewIfNeeded();
    await profileModal.container.locator(`#customAttribute_${fieldId}`).clear();
    await profileModal.container.locator(`#customAttribute_${fieldId}`).fill(TEST_CHANGED_VALUE);

    // 4. Click Cancel button
    await profileModal.cancelButton.click();

    // 5. Open DepartmentUS field for editing again
    await profileModal.container.locator(`text=${department}`).scrollIntoViewIfNeeded();
    await profileModal.container.locator(`#customAttribute_${fieldId}Edit`).scrollIntoViewIfNeeded();
    await profileModal.container.locator(`#customAttribute_${fieldId}Edit`).click();

    // * After cancelling, DepartmentUS field should still show original value "Engineering"
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

    // 3. Edit PhoneUS field and change to "555-987-6543"
    await editTextAttribute(page, attributeFieldsMap, 'PhoneUS', TEST_UPDATED_PHONE);

    // 4. Edit WebsiteUS field and change to "https://mattermost.com"
    await editTextAttribute(page, attributeFieldsMap, 'WebsiteUS', TEST_UPDATED_URL);

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
    await verifyAttributeInPopover(otherChannelsPage, 'PhoneUS', TEST_UPDATED_PHONE);
    await verifyAttributeInPopover(otherChannelsPage, 'WebsiteUS', TEST_UPDATED_URL);
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

    // 3. Edit WebsiteUS field and enter an invalid URL
    const fieldId = getFieldIdByName(attributeFieldsMap, 'WebsiteUS');
    await profileModal.container.locator('text=WebsiteUS').scrollIntoViewIfNeeded();
    await profileModal.container.locator(`#customAttribute_${fieldId}Edit`).scrollIntoViewIfNeeded();
    await profileModal.container.locator(`#customAttribute_${fieldId}Edit`).click();
    await profileModal.container.locator(`#customAttribute_${fieldId}`).scrollIntoViewIfNeeded();
    await profileModal.container.locator(`#customAttribute_${fieldId}`).clear();
    await profileModal.container.locator(`#customAttribute_${fieldId}`).fill(TEST_INVALID_URL);
    await profileModal.container.locator(`#customAttribute_${fieldId}`).blur();

    // * Save button doesn't complete the operation with invalid URL
    await expect(profileModal.container.locator(`#error_customAttribute_${fieldId}`)).toBeVisible();
    await expect(profileModal.container.locator(`#error_customAttribute_${fieldId}`)).toHaveText(
        'Please enter a valid url.',
    );

    // 5. Edit Website field and enter a valid URL
    await profileModal.container.locator(`#customAttribute_${fieldId}`).clear();
    await profileModal.container.locator(`#customAttribute_${fieldId}`).fill(TEST_VALID_URL);

    // 6. Save the changes
    await profileModal.saveButton.click();

    // * Valid URL saves successfully with no error message
    await expect(profileModal.container.locator(`#error_customAttribute_${fieldId}`)).not.toBeVisible();
    await expect(profileModal.container).toContainText(TEST_VALID_URL);
});
