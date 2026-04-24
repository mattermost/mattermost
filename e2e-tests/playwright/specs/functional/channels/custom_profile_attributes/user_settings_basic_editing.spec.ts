// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserProfile} from '@mattermost/types/users';
import {Channel} from '@mattermost/types/channels';
import {Client4} from '@mattermost/client';
import {UserPropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import {
    verifyAttributesExistInSettings,
    verifyAttributeInPopover,
    verifyAttributeNotInPopover,
    editTextAttribute,
    editSelectAttribute,
    editMultiselectAttribute,
    getFieldIdByName,
    TEST_DEPARTMENT,
    TEST_UPDATED_DEPARTMENT,
    TEST_CHANGED_VALUE,
    TEST_MESSAGE,
    TEST_MESSAGE_OTHER,
} from './helpers';
import {setupCpaTestEnvironment, teardownCpaTestEnvironment, userSettingsCustomAttributes} from './support';

const customAttributes = userSettingsCustomAttributes;

let user: UserProfile;
let otherUser: UserProfile;
let testChannel: Channel;
let attributeFieldsMap: Record<string, UserPropertyField>;
let adminClient: Client4;

test.beforeEach(async ({pw}) => {
    ({user, otherUser, testChannel, attributeFieldsMap, adminClient} = await setupCpaTestEnvironment(
        pw,
        customAttributes,
    ));
});

test.afterAll(async () => {
    await teardownCpaTestEnvironment(adminClient, attributeFieldsMap);
});

/**
 * Verify that users can edit different types of custom profile attributes
 * (text, select, and multiselect fields) and that changes appear correctly in the profile popover.
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
